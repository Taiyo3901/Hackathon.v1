import type { PaneId, PdfTextItem, SearchResult } from "../types/pdf";
import { buildTextLines, normalizeText } from "./textLayout";

export function searchTextItems(
  pane: PaneId,
  query: string,
  items: PdfTextItem[]
): SearchResult[] {
  const normalizedQuery = normalizeText(query).toLowerCase();

  if (!normalizedQuery) {
    return [];
  }

  const lines = buildTextLines(items);
  const results: SearchResult[] = [];

  for (const line of lines) {
    const lineText = normalizeText(line.text);
    const lowerLineText = lineText.toLowerCase();

    if (!lowerLineText.includes(normalizedQuery)) {
      continue;
    }

    results.push({
      id: `${pane}-${line.page}-${line.x.toFixed(1)}-${line.y.toFixed(
        1
      )}-${normalizedQuery}`,
      pane,
      page: line.page,
      text: lineText,
      rect: {
        page: line.page,
        x: line.x,
        y: line.y,
        width: line.width,
        height: line.height,
      },
    });
  }

  return results.sort((a, b) => {
    if (a.page !== b.page) {
      return a.page - b.page;
    }

    if (a.rect.y !== b.rect.y) {
      return a.rect.y - b.rect.y;
    }

    return a.rect.x - b.rect.x;
  });
}