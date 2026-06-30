import type { PdfTextItem, TextLine } from "../types/pdf";

type RoughRow = {
  page: number;
  items: PdfTextItem[];
};

export function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function getMedian(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function getLineBounds(items: PdfTextItem[]): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const minX = Math.min(...items.map((item) => item.x));
  const maxX = Math.max(...items.map((item) => item.x + item.width));
  const minY = Math.min(...items.map((item) => item.y));
  const maxY = Math.max(...items.map((item) => item.y + item.height));

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function joinLineItems(items: PdfTextItem[]): string {
  const sorted = [...items].sort((a, b) => a.x - b.x);

  let text = "";
  let previousRight = 0;

  const medianHeight = getMedian(sorted.map((item) => item.height)) || 10;
  const medianCharWidth =
    getMedian(
      sorted
        .filter((item) => item.str.length > 0)
        .map((item) => item.width / Math.max(1, item.str.length))
    ) || medianHeight * 0.45;

  for (const item of sorted) {
    const gap = item.x - previousRight;

    if (text.length > 0 && gap > Math.max(medianCharWidth * 1.7, medianHeight * 0.35)) {
      text += " ";
    }

    text += item.str;
    previousRight = item.x + item.width;
  }

  return normalizeText(text);
}

function buildRoughRows(items: PdfTextItem[]): RoughRow[] {
  const sortedItems = [...items]
    .filter((item) => item.str.trim().length > 0)
    .sort((a, b) => {
      if (a.page !== b.page) {
        return a.page - b.page;
      }

      const aCenterY = a.y + a.height / 2;
      const bCenterY = b.y + b.height / 2;
      const yDiff = aCenterY - bCenterY;

      if (Math.abs(yDiff) > Math.max(4, Math.min(a.height, b.height) * 0.45)) {
        return yDiff;
      }

      return a.x - b.x;
    });

  const rows: RoughRow[] = [];

  for (const item of sortedItems) {
    const itemCenterY = item.y + item.height / 2;

    let matchedRow: RoughRow | null = null;

    for (const row of rows) {
      if (row.page !== item.page) {
        continue;
      }

      const rowHeights = row.items.map((rowItem) => rowItem.height);
      const rowMedianHeight = getMedian(rowHeights) || item.height || 10;

      const rowCenters = row.items.map(
        (rowItem) => rowItem.y + rowItem.height / 2
      );
      const rowCenterY = getMedian(rowCenters);

      const threshold = Math.max(
        4,
        Math.min(Math.max(rowMedianHeight, item.height) * 0.45, rowMedianHeight * 0.75)
      );

      if (Math.abs(rowCenterY - itemCenterY) <= threshold) {
        matchedRow = row;
        break;
      }
    }

    if (matchedRow) {
      matchedRow.items.push(item);
      matchedRow.items.sort((a, b) => a.x - b.x);
    } else {
      rows.push({
        page: item.page,
        items: [item],
      });
    }
  }

  return rows;
}

/**
 * 同じY座標付近にある文字群を、横方向の大きな空白で分割する。
 * 2段組PDFで、左列と右列が同じ行として混ざるのを防ぐ。
 */
function splitRowByLargeHorizontalGaps(row: RoughRow): PdfTextItem[][] {
  const items = [...row.items].sort((a, b) => a.x - b.x);

  if (items.length <= 1) {
    return [items];
  }

  const medianHeight = getMedian(items.map((item) => item.height)) || 10;

  const charWidths = items
    .filter((item) => item.str.length > 0)
    .map((item) => item.width / Math.max(1, item.str.length))
    .filter((value) => Number.isFinite(value) && value > 0);

  const medianCharWidth = getMedian(charWidths) || medianHeight * 0.45;

  /**
   * カラム間の空白はかなり大きいので、通常単語間スペースより大きめに設定。
   * ただし、論文PDFでは列間が狭いこともあるため、固定値36pxも下限として見る。
   */
  const largeGapThreshold = Math.max(36, medianHeight * 2.4, medianCharWidth * 7);

  const groups: PdfTextItem[][] = [];
  let currentGroup: PdfTextItem[] = [items[0]];

  for (let index = 1; index < items.length; index += 1) {
    const previous = items[index - 1];
    const current = items[index];

    const previousRight = previous.x + previous.width;
    const gap = current.x - previousRight;

    if (gap > largeGapThreshold) {
      groups.push(currentGroup);
      currentGroup = [current];
    } else {
      currentGroup.push(current);
    }
  }

  groups.push(currentGroup);

  return groups;
}

/**
 * ページ内の行をx位置からカラム番号へ分類する。
 * ここでは厳密な段組解析ではなく、抽出結果の整理とデバッグ用に使う。
 */
function assignColumns(lines: TextLine[]): TextLine[] {
  const linesByPage = new Map<number, TextLine[]>();

  for (const line of lines) {
    const current = linesByPage.get(line.page) ?? [];
    current.push(line);
    linesByPage.set(line.page, current);
  }

  const result: TextLine[] = [];

  for (const [, pageLines] of linesByPage) {
    const sortedByX = [...pageLines].sort((a, b) => a.x - b.x);

    const medianHeight =
      getMedian(sortedByX.map((line) => line.height).filter((value) => value > 0)) ||
      10;

    const columnGapThreshold = Math.max(60, medianHeight * 5);

    const columnAnchors: number[] = [];

    for (const line of sortedByX) {
      const existingIndex = columnAnchors.findIndex(
        (anchorX) => Math.abs(anchorX - line.x) <= columnGapThreshold
      );

      if (existingIndex === -1) {
        columnAnchors.push(line.x);
      }
    }

    columnAnchors.sort((a, b) => a - b);

    for (const line of pageLines) {
      let column = 0;
      let bestDistance = Number.POSITIVE_INFINITY;

      columnAnchors.forEach((anchorX, index) => {
        const distance = Math.abs(anchorX - line.x);

        if (distance < bestDistance) {
          bestDistance = distance;
          column = index;
        }
      });

      result.push({
        ...line,
        column,
      });
    }
  }

  return result.sort((a, b) => {
    if (a.page !== b.page) {
      return a.page - b.page;
    }

    if (a.column !== b.column) {
      return a.column - b.column;
    }

    const yDiff = a.y - b.y;

    if (Math.abs(yDiff) > 4) {
      return yDiff;
    }

    return a.x - b.x;
  });
}

export function buildTextLines(items: PdfTextItem[]): TextLine[] {
  const roughRows = buildRoughRows(items);
  const lines: TextLine[] = [];

  for (const row of roughRows) {
    const groups = splitRowByLargeHorizontalGaps(row);

    for (const group of groups) {
      if (group.length === 0) {
        continue;
      }

      const bounds = getLineBounds(group);
      const text = joinLineItems(group);

      if (!text) {
        continue;
      }

      lines.push({
        items: [...group].sort((a, b) => a.x - b.x),
        text,
        page: row.page,
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        column: 0,
      });
    }
  }

  return assignColumns(lines);
}

export function itemsToPlainText(items: PdfTextItem[]): string {
  const lines = buildTextLines(items);

  return lines
    .sort((a, b) => {
      if (a.page !== b.page) {
        return a.page - b.page;
      }

      if (a.column !== b.column) {
        return a.column - b.column;
      }

      if (a.y !== b.y) {
        return a.y - b.y;
      }

      return a.x - b.x;
    })
    .map((line) => line.text)
    .filter(Boolean)
    .join("\n");
}