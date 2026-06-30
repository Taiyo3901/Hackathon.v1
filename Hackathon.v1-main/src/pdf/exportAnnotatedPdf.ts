import { PDFDocument, LineCapStyle, StandardFonts, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { pdfjsLib } from "../lib/pdfjs";
import type { PaneId, PdfPageViewportInfo, PdfTextBox } from "../types/pdf";
import type { DrawStroke } from "../store/pdfDrawingStore";

type PdfFontLike = {
  widthOfTextAtSize: (text: string, size: number) => number;
};

type PdfPoint = {
  x: number;
  y: number;
};

type ExportAnnotatedPdfParams = {
  pdfBytes?: ArrayBuffer;
  pane: PaneId;
  textBoxes: PdfTextBox[];
  viewportInfos: PdfPageViewportInfo[];
  drawStrokes?: DrawStroke[];
  fileName?: string;
  download?: boolean;
  password?: string;
  forceFlatten?: boolean;
};


type FileSystemWritableFileStreamLike = {
  write: (data: Blob | BufferSource | string) => Promise<void>;
  close: () => Promise<void>;
};

type FileSystemFileHandleLike = {
  createWritable: () => Promise<FileSystemWritableFileStreamLike>;
};

type SaveFilePickerWindow = Window &
  typeof globalThis & {
    showSaveFilePicker?: (options?: {
      suggestedName?: string;
      types?: Array<{
        description?: string;
        accept: Record<string, string[]>;
      }>;
      excludeAcceptAllOption?: boolean;
      startIn?: string;
      id?: string;
    }) => Promise<FileSystemFileHandleLike>;
  };

function parseHexColor(hex: string) {
  if (!hex || hex === "transparent") {
    return rgb(1, 1, 1);
  }

  const normalized = hex.replace("#", "");

  if (normalized.length !== 6) {
    return rgb(0, 0, 0);
  }

  const r = Number.parseInt(normalized.slice(0, 2), 16) / 255;
  const g = Number.parseInt(normalized.slice(2, 4), 16) / 255;
  const b = Number.parseInt(normalized.slice(4, 6), 16) / 255;

  if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) {
    return rgb(0, 0, 0);
  }

  return rgb(r, g, b);
}

function sanitizeFileName(fileName: string): string {
  const sanitized = fileName
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\.pdf$/i, "")
    .trim();

  return sanitized || "annotated";
}

function containsNonLatinText(text: string): boolean {
  return /[^\u0000-\u00ff]/.test(text);
}

function wrapTextByWidth(
  text: string,
  maxWidth: number,
  fontSize: number,
  font: PdfFontLike
): string[] {
  const paragraphs = text.split(/\r?\n/);
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    if (paragraph.length === 0) {
      lines.push("");
      continue;
    }

    let currentLine = "";

    for (const char of paragraph) {
      const nextLine = currentLine + char;
      const width = font.widthOfTextAtSize(nextLine, fontSize);

      if (width > maxWidth && currentLine.length > 0) {
        lines.push(currentLine);
        currentLine = char;
      } else {
        currentLine = nextLine;
      }
    }

    if (currentLine.length > 0) {
      lines.push(currentLine);
    }
  }

  return lines;
}

function getAlignedX(params: {
  baseX: number;
  boxWidth: number;
  line: string;
  fontSize: number;
  font: PdfFontLike;
  align: "left" | "center" | "right";
}): number {
  const { baseX, boxWidth, line, fontSize, font, align } = params;
  const lineWidth = font.widthOfTextAtSize(line, fontSize);

  if (align === "center") {
    return baseX + Math.max(0, (boxWidth - lineWidth) / 2);
  }

  if (align === "right") {
    return baseX + Math.max(0, boxWidth - lineWidth);
  }

  return baseX;
}

function uint8ArrayToBlob(bytes: Uint8Array): Blob {
  const arrayBuffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;

  return new Blob([arrayBuffer], {
    type: "application/pdf",
  });
}

async function requestPdfSaveFileHandle(
  suggestedName: string
): Promise<FileSystemFileHandleLike | null> {
  const pickerWindow = window as SaveFilePickerWindow;

  if (typeof pickerWindow.showSaveFilePicker !== "function") {
    return null;
  }

  try {
    return await pickerWindow.showSaveFilePicker({
      suggestedName,
      types: [
        {
          description: "PDF file",
          accept: {
            "application/pdf": [".pdf"],
          },
        },
      ],
      excludeAcceptAllOption: false,
      startIn: "downloads",
      id: "pdf-analyzer-annotated-pdf",
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("SAVE_CANCELLED");
    }

    return null;
  }
}

async function savePdfWithFileHandle(
  bytes: Uint8Array,
  fileHandle: FileSystemFileHandleLike
): Promise<void> {
  const writable = await fileHandle.createWritable();

  try {
    await writable.write(uint8ArrayToBlob(bytes));
  } finally {
    await writable.close();
  }
}

function downloadPdfWithAnchor(bytes: Uint8Array, fileName: string): void {
  const blob = uint8ArrayToBlob(bytes);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = fileName;

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(url);
}

async function saveOrDownloadPdf(params: {
  bytes: Uint8Array;
  fileName: string;
  fileHandle: FileSystemFileHandleLike | null;
}): Promise<void> {
  const { bytes, fileName, fileHandle } = params;

  if (fileHandle) {
    await savePdfWithFileHandle(bytes, fileHandle);
    return;
  }

  downloadPdfWithAnchor(bytes, fileName);
}

async function loadJapaneseFont(pdfDoc: PDFDocument): Promise<any | null> {
  try {
    const fontResponse = await fetch("/fonts/NotoSansJP-Regular.ttf");

    if (!fontResponse.ok) {
      return null;
    }

    const fontBytes = await fontResponse.arrayBuffer();

    pdfDoc.registerFontkit(fontkit);

    return await pdfDoc.embedFont(fontBytes);
  } catch {
    return null;
  }
}

async function getFonts(pdfDoc: PDFDocument, textBoxes: PdfTextBox[]) {
  const hasNonLatin = textBoxes.some((box) => containsNonLatinText(box.text));
  const japaneseFont = await loadJapaneseFont(pdfDoc);

  if (hasNonLatin && !japaneseFont) {
    throw new Error(
      [
        "日本語を含むテキストをPDFに保存するにはフォントが必要です。",
        "以下の場所にフォントファイルを配置してください。",
        "",
        "public/fonts/NotoSansJP-Regular.ttf",
      ].join("\n")
    );
  }

  return {
    regularFont: hasNonLatin
      ? japaneseFont
      : await pdfDoc.embedFont(StandardFonts.Helvetica),
    boldFont: hasNonLatin
      ? japaneseFont
      : await pdfDoc.embedFont(StandardFonts.HelveticaBold),
  };
}

function drawTextBoxesOnPdfPage(params: {
  pdfPage: any;
  box: PdfTextBox;
  viewportInfo: PdfPageViewportInfo;
  regularFont: any;
  boldFont: any;
}) {
  const { pdfPage, box, viewportInfo, regularFont, boldFont } = params;

  const pageWidth = pdfPage.getWidth();
  const pageHeight = pdfPage.getHeight();

  const scaleX = pageWidth / viewportInfo.width;
  const scaleY = pageHeight / viewportInfo.height;

  const pdfX = box.x * scaleX;
  const pdfY = pageHeight - (box.y + box.height) * scaleY;
  const pdfWidth = box.width * scaleX;
  const pdfHeight = box.height * scaleY;

  const fontSize = box.fontSize * scaleY;
  const lineHeight = fontSize * 1.35;

  const opacity =
    typeof box.opacity === "number"
      ? Math.min(1, Math.max(0.05, box.opacity))
      : 1;

  const align = box.textAlign ?? "left";
  const font = box.fontWeight === "bold" ? boldFont : regularFont;

  if (!font) {
    return;
  }

  if (box.backgroundColor && box.backgroundColor !== "transparent") {
    pdfPage.drawRectangle({
      x: pdfX,
      y: pdfY,
      width: pdfWidth,
      height: pdfHeight,
      color: parseHexColor(box.backgroundColor),
      opacity: Math.min(1, Math.max(0, opacity * 0.35)),
    });
  }

  const lines = wrapTextByWidth(
    box.text,
    Math.max(10, pdfWidth - fontSize * 0.5),
    fontSize,
    font
  );

  let cursorY = pdfY + pdfHeight - fontSize;

  for (const line of lines) {
    if (cursorY < 0) {
      break;
    }

    const alignedX = getAlignedX({
      baseX: pdfX,
      boxWidth: pdfWidth,
      line,
      fontSize,
      font,
      align,
    });

    pdfPage.drawText(line, {
      x: alignedX,
      y: cursorY,
      size: fontSize,
      font,
      color: parseHexColor(box.color || "#000000"),
      opacity: 1,
    });

    cursorY -= lineHeight;
  }
}

function toPdfPoint(params: {
  point: { x: number; y: number };
  pageWidth: number;
  pageHeight: number;
}): PdfPoint {
  const { point, pageWidth, pageHeight } = params;

  return {
    x: point.x * pageWidth,
    y: pageHeight - point.y * pageHeight,
  };
}

function getDistance(a: PdfPoint, b: PdfPoint): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function removeNearDuplicatePoints(points: PdfPoint[], minDistance: number): PdfPoint[] {
  if (points.length <= 2) {
    return points;
  }

  const result: PdfPoint[] = [points[0]];

  for (let index = 1; index < points.length - 1; index += 1) {
    const point = points[index];
    const previous = result[result.length - 1];

    if (getDistance(previous, point) >= minDistance) {
      result.push(point);
    }
  }

  const lastPoint = points[points.length - 1];

  if (getDistance(result[result.length - 1], lastPoint) > 0) {
    result.push(lastPoint);
  }

  return result;
}

function smoothPdfPoints(points: PdfPoint[], passes = 1): PdfPoint[] {
  if (points.length < 4) {
    return points;
  }

  let current = points;

  for (let pass = 0; pass < passes; pass += 1) {
    current = current.map((point, index) => {
      if (index === 0 || index === current.length - 1) {
        return point;
      }

      const previous = current[index - 1];
      const next = current[index + 1];

      return {
        x: previous.x * 0.25 + point.x * 0.5 + next.x * 0.25,
        y: previous.y * 0.25 + point.y * 0.5 + next.y * 0.25,
      };
    });
  }

  return current;
}

function catmullRomPoint(
  p0: PdfPoint,
  p1: PdfPoint,
  p2: PdfPoint,
  p3: PdfPoint,
  t: number
): PdfPoint {
  const t2 = t * t;
  const t3 = t2 * t;

  return {
    x:
      0.5 *
      (2 * p1.x +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y:
      0.5 *
      (2 * p1.y +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  };
}

function pointsToSmoothPolyline(points: PdfPoint[]): PdfPoint[] {
  if (points.length <= 2) {
    return points;
  }

  const result: PdfPoint[] = [points[0]];

  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[index - 1] ?? points[index];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[index + 2] ?? p2;

    const segmentLength = getDistance(p1, p2);
    const steps = Math.min(18, Math.max(4, Math.ceil(segmentLength / 2.5)));

    for (let step = 1; step <= steps; step += 1) {
      result.push(catmullRomPoint(p0, p1, p2, p3, step / steps));
    }
  }

  return result;
}

function drawStrokeOnPdfPage(params: {
  pdfPage: any;
  stroke: DrawStroke;
}) {
  const { pdfPage, stroke } = params;

  if (stroke.points.length < 2) {
    return;
  }

  const pageWidth = pdfPage.getWidth();
  const pageHeight = pdfPage.getHeight();

  const rawPdfPoints = stroke.points.map((point) =>
    toPdfPoint({
      point,
      pageWidth,
      pageHeight,
    })
  );

  const minDistance = Math.max(0.35, stroke.width * 0.2);
  const simplifiedPoints = removeNearDuplicatePoints(rawPdfPoints, minDistance);
  const smoothedPoints = smoothPdfPoints(simplifiedPoints, 1);
  const polylinePoints = pointsToSmoothPolyline(smoothedPoints);

  if (polylinePoints.length < 2) {
    return;
  }

  const lineColor = parseHexColor(stroke.color);
  const thickness = Math.max(0.5, stroke.width);

  for (let index = 1; index < polylinePoints.length; index += 1) {
    const previous = polylinePoints[index - 1];
    const current = polylinePoints[index];

    if (getDistance(previous, current) <= 0.01) {
      continue;
    }

    pdfPage.drawLine({
      start: previous,
      end: current,
      thickness,
      color: lineColor,
      opacity: 1,
      lineCap: LineCapStyle.Round,
    });
  }
}

async function exportDirectPdf(params: {
  pdfBytes: ArrayBuffer;
  pane: PaneId;
  textBoxes: PdfTextBox[];
  viewportInfos: PdfPageViewportInfo[];
  drawStrokes?: DrawStroke[];
}): Promise<Uint8Array> {
  const { pdfBytes, pane, textBoxes, viewportInfos, drawStrokes = [] } = params;

  const pdfDoc = await PDFDocument.load(pdfBytes.slice(0), {
    ignoreEncryption: true,
  });

  const targetBoxes = textBoxes.filter(
    (box) => box.pane === pane && box.text.trim().length > 0
  );

  const targetStrokes = drawStrokes.filter((stroke) => stroke.pane === pane);

  if (targetBoxes.length === 0 && targetStrokes.length === 0) {
    throw new Error("保存する注釈がありません。");
  }

  const fonts =
    targetBoxes.length > 0
      ? await getFonts(pdfDoc, targetBoxes)
      : {
          regularFont: null,
          boldFont: null,
        };

  const { regularFont, boldFont } = fonts;
  const pages = pdfDoc.getPages();

  for (const box of targetBoxes) {
    const page = pages[box.page - 1];

    if (!page) {
      continue;
    }

    const viewportInfo = viewportInfos.find(
      (info) =>
        info.pane === pane &&
        info.page === box.page &&
        info.width > 0 &&
        info.height > 0
    );

    if (!viewportInfo) {
      continue;
    }

    drawTextBoxesOnPdfPage({
      pdfPage: page,
      box,
      viewportInfo,
      regularFont,
      boldFont,
    });
  }

  for (const stroke of targetStrokes) {
    const page = pages[stroke.page - 1];

    if (!page) {
      continue;
    }

    drawStrokeOnPdfPage({
      pdfPage: page,
      stroke,
    });
  }

  return await pdfDoc.save();
}

async function renderPdfPageToPng(params: {
  pdf: any;
  pageNumber: number;
  scale: number;
}): Promise<{
  pngBytes: Uint8Array;
  width: number;
  height: number;
}> {
  const { pdf, pageNumber, scale } = params;
  const page = await pdf.getPage(pageNumber);

  const displayViewport = page.getViewport({ scale: 1 });
  const renderViewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", {
    alpha: false,
  });

  if (!context) {
    throw new Error("Canvasの初期化に失敗しました。");
  }

  canvas.width = Math.floor(renderViewport.width);
  canvas.height = Math.floor(renderViewport.height);

  await page.render({
    canvasContext: context,
    viewport: renderViewport,
  }).promise;

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => {
      if (!value) {
        reject(new Error("PDFページの画像化に失敗しました。"));
        return;
      }

      resolve(value);
    }, "image/png");
  });

  const arrayBuffer = await blob.arrayBuffer();

  return {
    pngBytes: new Uint8Array(arrayBuffer),
    width: displayViewport.width,
    height: displayViewport.height,
  };
}

async function exportFlattenedPdf(params: {
  pdfBytes: ArrayBuffer;
  pane: PaneId;
  textBoxes: PdfTextBox[];
  viewportInfos: PdfPageViewportInfo[];
  drawStrokes?: DrawStroke[];
  password?: string;
}): Promise<Uint8Array> {
  const {
    pdfBytes,
    pane,
    textBoxes,
    viewportInfos,
    drawStrokes = [],
    password,
  } = params;

  const targetBoxes = textBoxes.filter(
    (box) => box.pane === pane && box.text.trim().length > 0
  );

  const targetStrokes = drawStrokes.filter((stroke) => stroke.pane === pane);

  if (targetBoxes.length === 0 && targetStrokes.length === 0) {
    throw new Error("保存する注釈がありません。");
  }

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(pdfBytes.slice(0)),
    password,
    cMapUrl: "/cmaps/",
    cMapPacked: true,
    standardFontDataUrl: "/standard_fonts/",
    useSystemFonts: true,
  } as any);

  let pdf: any;

  try {
    pdf = await loadingTask.promise;
  } catch (error: any) {
    if (
      error?.name === "PasswordException" ||
      String(error?.message ?? "").toLowerCase().includes("password")
    ) {
      throw new Error("PASSWORD_REQUIRED_OR_INVALID");
    }

    throw error;
  }

  const pdfDoc = await PDFDocument.create();
  const fonts =
    targetBoxes.length > 0
      ? await getFonts(pdfDoc, targetBoxes)
      : {
          regularFont: null,
          boldFont: null,
        };

  const { regularFont, boldFont } = fonts;

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const rendered = await renderPdfPageToPng({
      pdf,
      pageNumber,
      scale: 2,
    });

    const pdfPage = pdfDoc.addPage([rendered.width, rendered.height]);
    const image = await pdfDoc.embedPng(rendered.pngBytes);

    pdfPage.drawImage(image, {
      x: 0,
      y: 0,
      width: rendered.width,
      height: rendered.height,
    });

    const boxesOnPage = targetBoxes.filter((box) => box.page === pageNumber);

    for (const box of boxesOnPage) {
      const viewportInfo = viewportInfos.find(
        (info) =>
          info.pane === pane &&
          info.page === box.page &&
          info.width > 0 &&
          info.height > 0
      );

      if (!viewportInfo) {
        continue;
      }

      drawTextBoxesOnPdfPage({
        pdfPage,
        box,
        viewportInfo,
        regularFont,
        boldFont,
      });
    }

    const strokesOnPage = targetStrokes.filter(
      (stroke) => stroke.page === pageNumber
    );

    for (const stroke of strokesOnPage) {
      drawStrokeOnPdfPage({
        pdfPage,
        stroke,
      });
    }
  }

  return await pdfDoc.save();
}

export async function exportAnnotatedPdf({
  pdfBytes,
  pane,
  textBoxes,
  viewportInfos,
  drawStrokes = [],
  fileName = "annotated.pdf",
  download = true,
  password,
  forceFlatten = false,
}: ExportAnnotatedPdfParams): Promise<Uint8Array> {
  if (!pdfBytes) {
    throw new Error(
      [
        "元PDFデータが保存用ストアにありません。",
        "PDFを操作タブの「PDFを読み込む」からファイル選択で読み込み直してください。",
      ].join("\n")
    );
  }

  const safeName = sanitizeFileName(fileName);
  const outputName = safeName.endsWith(".pdf") ? safeName : `${safeName}.pdf`;

  // showSaveFilePicker はユーザー操作直後に呼ぶ必要があるため、
  // PDF生成処理の前に保存先とファイル名を選んでもらいます。
  const saveFileHandle = download
    ? await requestPdfSaveFileHandle(outputName)
    : null;

  let savedBytes: Uint8Array;

  if (forceFlatten) {
    savedBytes = await exportFlattenedPdf({
      pdfBytes,
      pane,
      textBoxes,
      viewportInfos,
      drawStrokes,
      password,
    });
  } else {
    try {
      savedBytes = await exportDirectPdf({
        pdfBytes,
        pane,
        textBoxes,
        viewportInfos,
        drawStrokes,
      });
    } catch {
      savedBytes = await exportFlattenedPdf({
        pdfBytes,
        pane,
        textBoxes,
        viewportInfos,
        drawStrokes,
        password,
      });
    }
  }

  if (download) {
    await saveOrDownloadPdf({
      bytes: savedBytes,
      fileName: outputName,
      fileHandle: saveFileHandle,
    });
  }

  return savedBytes;
}
