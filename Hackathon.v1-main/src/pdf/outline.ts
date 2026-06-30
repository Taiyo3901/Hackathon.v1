import type { OutlineItem, PaneId, PdfTextItem, TextLine } from "../types/pdf";
import { buildTextLines, getMedian, normalizeText } from "./textLayout";

const ENGLISH_COMMON_HEADINGS = [
  "abstract",
  "introduction",
  "related work",
  "background",
  "preliminaries",
  "method",
  "methods",
  "methodology",
  "approach",
  "proposed method",
  "model",
  "system",
  "implementation",
  "experiment",
  "experiments",
  "experimental setup",
  "evaluation",
  "results",
  "analysis",
  "discussion",
  "limitations",
  "conclusion",
  "conclusions",
  "future work",
  "references",
  "bibliography",
  "acknowledgements",
  "acknowledgments",
];

const JAPANESE_COMMON_HEADINGS = [
  "概要",
  "要旨",
  "はじめに",
  "序論",
  "背景",
  "関連研究",
  "先行研究",
  "目的",
  "提案手法",
  "手法",
  "方法",
  "実装",
  "実験",
  "評価",
  "結果",
  "考察",
  "議論",
  "結論",
  "まとめ",
  "今後の課題",
  "参考文献",
  "謝辞",
];

function normalizeHeadingText(text: string): string {
  return normalizeText(text)
    .replace(/^[・•●○\-–—]\s*/, "")
    .trim();
}

function isMathLikeLine(text: string): boolean {
  const normalized = normalizeHeadingText(text);

  if (!normalized) {
    return false;
  }

  const mathSymbols =
    normalized.match(/[=+\-−×÷*/^_√∫∑ΣΠπ∞≈≠≤≥<>±∂∆∇{}()[\]|]/g) ?? [];

  const symbolRatio = mathSymbols.length / Math.max(1, normalized.length);

  const hasEquation =
    /[A-Za-z0-9]\s*[=≈≠≤≥<>]\s*[A-Za-z0-9]/.test(normalized);

  const hasMathKeyword =
    /\b(sin|cos|tan|log|ln|lim|exp|max|min)\b/i.test(normalized) ||
    /[∫∑ΣΠ√∞π]/.test(normalized);

  if (hasEquation) return true;
  if (hasMathKeyword && mathSymbols.length >= 1) return true;
  if (symbolRatio > 0.18) return true;

  return false;
}

function getFontSignal(items: PdfTextItem[]): {
  boldRatio: number;
  hasBold: boolean;
} {
  if (items.length === 0) {
    return {
      boldRatio: 0,
      hasBold: false,
    };
  }

  const boldCount = items.filter((item) => {
    if (item.isBold) {
      return true;
    }

    const source = `${item.fontName ?? ""} ${item.fontFamily ?? ""}`.toLowerCase();

    return (
      source.includes("bold") ||
      source.includes("black") ||
      source.includes("heavy") ||
      source.includes("semibold") ||
      source.includes("demibold") ||
      source.includes("medium") ||
      source.includes("gothic")
    );
  }).length;

  return {
    boldRatio: boldCount / items.length,
    hasBold: boldCount > 0,
  };
}

function isCommonHeading(text: string): boolean {
  const normalized = normalizeHeadingText(text);
  const lower = normalized.toLowerCase();

  if (ENGLISH_COMMON_HEADINGS.some((heading) => lower === heading)) {
    return true;
  }

  if (
    ENGLISH_COMMON_HEADINGS.some((heading) =>
      lower.startsWith(`${heading} `)
    )
  ) {
    return true;
  }

  if (JAPANESE_COMMON_HEADINGS.some((heading) => normalized === heading)) {
    return true;
  }

  if (
    JAPANESE_COMMON_HEADINGS.some((heading) =>
      normalized.startsWith(heading)
    )
  ) {
    return true;
  }

  return false;
}

function isNumberedHeading(text: string): boolean {
  const normalized = normalizeHeadingText(text);

  return (
    /^\d+\s+[A-Za-zぁ-んァ-ヶ一-龠]/.test(normalized) ||
    /^\d+(\.\d+)+\s+[A-Za-zぁ-んァ-ヶ一-龠]/.test(normalized) ||
    /^\d+\.\s+/.test(normalized) ||
    /^第\s*\d+\s*(章|節)/.test(normalized)
  );
}

function isProbablyPageNumber(text: string): boolean {
  const normalized = normalizeHeadingText(text);

  return /^\d+$/.test(normalized) || /^-\s*\d+\s*-$/.test(normalized);
}

function isProbablyHeaderOrFooter(
  y: number,
  pageMinY: number,
  pageMaxY: number
): boolean {
  const pageHeight = Math.max(1, pageMaxY - pageMinY);
  const relativeY = (y - pageMinY) / pageHeight;

  return relativeY < 0.025 || relativeY > 0.965;
}

function looksLikeTitleCase(text: string): boolean {
  const normalized = normalizeHeadingText(text);

  if (/[ぁ-んァ-ヶ一-龠]/.test(normalized)) {
    return false;
  }

  const words = normalized.split(/\s+/).filter(Boolean);

  if (words.length === 0 || words.length > 12) {
    return false;
  }

  const titleLikeWords = words.filter((word) =>
    /^[A-Z][A-Za-z0-9-]*$/.test(word)
  );

  return titleLikeWords.length >= Math.ceil(words.length * 0.55);
}

function estimateHeadingLevel(
  text: string,
  height: number,
  medianHeight: number
): number {
  const normalized = normalizeHeadingText(text);

  if (/^\d+\s+/.test(normalized)) return 1;
  if (/^\d+\.\s+/.test(normalized)) return 1;
  if (/^\d+\.\d+\s+/.test(normalized)) return 2;
  if (/^\d+\.\d+\.\d+\s+/.test(normalized)) return 3;

  if (/^第\s*\d+\s*章/.test(normalized)) return 1;
  if (/^第\s*\d+\s*節/.test(normalized)) return 2;

  if (isCommonHeading(normalized)) return 1;

  if (height >= medianHeight * 1.55) return 1;
  if (height >= medianHeight * 1.25) return 2;

  return 2;
}

function normalizeKey(text: string): string {
  return normalizeHeadingText(text)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[：:]+$/g, "")
    .trim();
}

function dedupeOutlineItems(items: OutlineItem[]): OutlineItem[] {
  const result: OutlineItem[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const key = `${item.pane}:${item.page}:${normalizeKey(item.title)}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(item);
  }

  return result;
}

function buildPageColumnStats(lines: TextLine[]) {
  const map = new Map<
    string,
    {
      minX: number;
      maxX: number;
      minY: number;
      maxY: number;
      medianHeight: number;
    }
  >();

  const grouped = new Map<string, TextLine[]>();

  for (const line of lines) {
    const key = `${line.page}:${line.column}`;
    const current = grouped.get(key) ?? [];
    current.push(line);
    grouped.set(key, current);
  }

  for (const [key, groupLines] of grouped) {
    const minX = Math.min(...groupLines.map((line) => line.x));
    const maxX = Math.max(...groupLines.map((line) => line.x + line.width));
    const minY = Math.min(...groupLines.map((line) => line.y));
    const maxY = Math.max(...groupLines.map((line) => line.y + line.height));
    const medianHeight = getMedian(groupLines.map((line) => line.height)) || 10;

    map.set(key, {
      minX,
      maxX,
      minY,
      maxY,
      medianHeight,
    });
  }

  return map;
}

function scoreHeadingLine(params: {
  text: string;
  line: TextLine;
  pageMinX: number;
  pageMaxX: number;
  pageMinY: number;
  pageMaxY: number;
  medianHeight: number;
}): number {
  const { text, line, pageMinX, pageMaxX, pageMinY, pageMaxY, medianHeight } =
    params;

  const normalized = normalizeHeadingText(text);
  const fontSignal = getFontSignal(line.items);
  const columnWidth = Math.max(1, pageMaxX - pageMinX);
  const relativeX = (line.x - pageMinX) / columnWidth;

  let score = 0;

  if (line.height >= medianHeight * 1.18) score += 2;
  if (line.height >= medianHeight * 1.35) score += 3;
  if (line.height >= medianHeight * 1.6) score += 2;

  if (fontSignal.hasBold) score += 2;
  if (fontSignal.boldRatio >= 0.6) score += 2;

  if (isNumberedHeading(normalized)) score += 5;
  if (isCommonHeading(normalized)) score += 6;
  if (looksLikeTitleCase(normalized)) score += 2;

  if (relativeX < 0.18) score += 2;
  if (relativeX < 0.08) score += 1;

  if (normalized.length >= 4 && normalized.length <= 70) score += 1;

  if (isMathLikeLine(normalized)) score -= 12;
  if (isProbablyPageNumber(normalized)) score -= 10;
  if (isProbablyHeaderOrFooter(line.y, pageMinY, pageMaxY)) score -= 5;
  if (/[。.!?！？]$/.test(normalized)) score -= 3;
  if (normalized.length > 95) score -= 6;
  if (normalized.length < 3 && !isCommonHeading(normalized)) score -= 5;
  if (/^\[\d+\]/.test(normalized)) score -= 8;
  if (/https?:\/\//i.test(normalized)) score -= 8;
  if (/\bdoi\b/i.test(normalized)) score -= 8;
  if (/\barxiv\b/i.test(normalized)) score -= 8;

  return score;
}

export function extractOutlineItems(
  pane: PaneId,
  items: PdfTextItem[]
): OutlineItem[] {
  const lines = buildTextLines(items);

  if (lines.length === 0) {
    return [];
  }

  const statsMap = buildPageColumnStats(lines);
  const outlineItems: OutlineItem[] = [];

  for (const line of lines) {
    const text = normalizeHeadingText(line.text);

    if (!text) {
      continue;
    }

    if (isMathLikeLine(text)) {
      continue;
    }

    const stats = statsMap.get(`${line.page}:${line.column}`);

    if (!stats) {
      continue;
    }

    const score = scoreHeadingLine({
      text,
      line,
      pageMinX: stats.minX,
      pageMaxX: stats.maxX,
      pageMinY: stats.minY,
      pageMaxY: stats.maxY,
      medianHeight: stats.medianHeight,
    });

    if (score < 5) {
      continue;
    }

    outlineItems.push({
      id: `${pane}-outline-${line.page}-${line.column}-${line.x.toFixed(
        1
      )}-${line.y.toFixed(1)}-${text}`,
      pane,
      page: line.page,
      title: text,
      level: estimateHeadingLevel(text, line.height, stats.medianHeight),
      rect: {
        page: line.page,
        x: line.x,
        y: line.y,
        width: line.width,
        height: line.height,
      },
    });
  }

  return dedupeOutlineItems(outlineItems).sort((a, b) => {
    if (a.page !== b.page) return a.page - b.page;
    if (a.rect.y !== b.rect.y) return a.rect.y - b.rect.y;
    return a.rect.x - b.rect.x;
  });
}