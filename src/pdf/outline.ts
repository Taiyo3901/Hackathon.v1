import type { OutlineItem, PaneId, PdfTextItem } from "../types/pdf";
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

type LineCandidate = {
  text: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  score: number;
  level: number;
};

function normalizeHeadingText(text: string): string {
  return normalizeText(text)
    .replace(/\s+/g, " ")
    .replace(/^[・•●○\-–—]\s*/, "")
    .trim();
}

function getFontSignal(items: PdfTextItem[]): {
  boldRatio: number;
  hasBold: boolean;
  fontNames: string;
} {
  if (items.length === 0) {
    return {
      boldRatio: 0,
      hasBold: false,
      fontNames: "",
    };
  }

  const boldCount = items.filter((item) => {
    if (item.isBold) return true;

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
    fontNames: items
      .map((item) => item.fontName ?? item.fontFamily ?? "")
      .filter(Boolean)
      .join(" "),
  };
}

function isProbablyPageNumber(text: string): boolean {
  const normalized = normalizeHeadingText(text);

  return /^\d+$/.test(normalized) || /^-\s*\d+\s*-$/.test(normalized);
}

function isProbablyHeaderOrFooter(
  lineY: number,
  pageMinY: number,
  pageMaxY: number
): boolean {
  const pageHeight = Math.max(1, pageMaxY - pageMinY);
  const relativeY = (lineY - pageMinY) / pageHeight;

  return relativeY < 0.025 || relativeY > 0.965;
}

function isNumberedHeading(text: string): boolean {
  const normalized = normalizeHeadingText(text);

  return (
    /^\d+\s+[A-Za-zぁ-んァ-ヶ一-龠]/.test(normalized) ||
    /^\d+(\.\d+)+\s+[A-Za-zぁ-んァ-ヶ一-龠]/.test(normalized) ||
    /^第\s*\d+\s*(章|節)/.test(normalized) ||
    /^\d+\.\s+/.test(normalized)
  );
}

function isAppendixHeading(text: string): boolean {
  const normalized = normalizeHeadingText(text).toLowerCase();

  return /^appendix\s+[a-z0-9]/i.test(normalized) || /^付録/.test(normalized);
}

function isCommonHeading(text: string): boolean {
  const normalized = normalizeHeadingText(text);
  const lower = normalized.toLowerCase();

  if (ENGLISH_COMMON_HEADINGS.some((heading) => lower === heading)) {
    return true;
  }

  if (ENGLISH_COMMON_HEADINGS.some((heading) => lower.startsWith(`${heading} `))) {
    return true;
  }

  if (JAPANESE_COMMON_HEADINGS.some((heading) => normalized === heading)) {
    return true;
  }

  if (JAPANESE_COMMON_HEADINGS.some((heading) => normalized.startsWith(heading))) {
    return true;
  }

  return false;
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

  const titleLikeWords = words.filter((word) => /^[A-Z][A-Za-z0-9-]*$/.test(word));

  return titleLikeWords.length >= Math.ceil(words.length * 0.55);
}

function looksLikeAllCapsHeading(text: string): boolean {
  const normalized = normalizeHeadingText(text);

  if (normalized.length < 4 || normalized.length > 60) {
    return false;
  }

  const lettersOnly = normalized.replace(/[^A-Za-z]/g, "");

  if (lettersOnly.length < 3) {
    return false;
  }

  return lettersOnly === lettersOnly.toUpperCase();
}

function hasSentenceEnding(text: string): boolean {
  const normalized = normalizeHeadingText(text);

  return /[。.!?！？]$/.test(normalized);
}

function isTooLongForHeading(text: string): boolean {
  return normalizeHeadingText(text).length > 95;
}

function isTooShortForHeading(text: string): boolean {
  const normalized = normalizeHeadingText(text);

  if (isCommonHeading(normalized)) {
    return false;
  }

  return normalized.length < 3;
}

function isLikelyBibliographyLine(text: string): boolean {
  const normalized = normalizeHeadingText(text);

  return (
    /^\[\d+\]/.test(normalized) ||
    /^\d+\.\s+[A-Z]/.test(normalized) ||
    /\bdoi\b/i.test(normalized) ||
    /\barxiv\b/i.test(normalized) ||
    /https?:\/\//i.test(normalized)
  );
}

function isMathLikeLine(text: string): boolean {
  const normalized = normalizeHeadingText(text);

  if (!normalized) return false;

  const mathSymbols = normalized.match(/[=+\-−×÷*/^_√∫∑ΣΠπ∞≈≠≤≥<>±∂∆∇{}()[\]]/g);
  const symbolCount = mathSymbols?.length ?? 0;

  const alphaNumericCount = (normalized.match(/[A-Za-z0-9ぁ-んァ-ヶ一-龠]/g) ?? [])
    .length;

  const length = normalized.length;

  const symbolRatio = symbolCount / Math.max(1, length);

  const hasEquation =
    /[A-Za-z0-9]\s*[=≈≠≤≥<>]\s*[A-Za-z0-9]/.test(normalized) ||
    /\\[a-zA-Z]+/.test(normalized);

  const hasMathKeyword =
    /\b(sin|cos|tan|log|ln|lim|exp|max|min)\b/.test(normalized) ||
    /[∫∑ΣΠ√∞π]/.test(normalized);

  if (hasEquation) return true;
  if (hasMathKeyword && symbolCount >= 1) return true;
  if (symbolRatio > 0.18 && alphaNumericCount <= length * 0.8) return true;

  return false;
}

function scoreHeadingLine(params: {
  text: string;
  height: number;
  medianHeight: number;
  x: number;
  pageMinX: number;
  pageMaxX: number;
  y: number;
  pageMinY: number;
  pageMaxY: number;
  items: PdfTextItem[];
}): number {
  const {
    text,
    height,
    medianHeight,
    x,
    pageMinX,
    pageMaxX,
    y,
    pageMinY,
    pageMaxY,
    items,
  } = params;

  const normalized = normalizeHeadingText(text);
  const pageWidth = Math.max(1, pageMaxX - pageMinX);
  const relativeX = (x - pageMinX) / pageWidth;
  const fontSignal = getFontSignal(items);

  let score = 0;

  if (height >= medianHeight * 1.18) score += 2;
  if (height >= medianHeight * 1.35) score += 3;
  if (height >= medianHeight * 1.6) score += 2;

  if (fontSignal.hasBold) score += 2;
  if (fontSignal.boldRatio >= 0.6) score += 2;

  if (isNumberedHeading(normalized)) score += 5;
  if (isAppendixHeading(normalized)) score += 4;
  if (isCommonHeading(normalized)) score += 6;

  if (looksLikeTitleCase(normalized)) score += 2;
  if (looksLikeAllCapsHeading(normalized)) score += 2;

  if (relativeX < 0.18) score += 2;
  if (relativeX < 0.08) score += 1;

  if (relativeX > 0.25 && relativeX < 0.45 && normalized.length < 70) {
    score += 1;
  }

  if (normalized.length >= 4 && normalized.length <= 70) score += 1;
  if (normalized.length > 70 && normalized.length <= 95) score -= 1;

  if (isMathLikeLine(normalized)) score -= 12;
  if (isProbablyPageNumber(normalized)) score -= 10;
  if (isProbablyHeaderOrFooter(y, pageMinY, pageMaxY)) score -= 5;
  if (hasSentenceEnding(normalized)) score -= 3;
  if (isTooLongForHeading(normalized)) score -= 6;
  if (isTooShortForHeading(normalized)) score -= 5;
  if (isLikelyBibliographyLine(normalized)) score -= 8;

  if (/^[ぁ-んァ-ヶ一-龠、。・\s]{25,}$/.test(normalized)) {
    score -= 5;
  }

  return score;
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

    if (seen.has(key)) continue;

    seen.add(key);
    result.push(item);
  }

  return result;
}

export function extractOutlineItems(
  pane: PaneId,
  items: PdfTextItem[]
): OutlineItem[] {
  const lines = buildTextLines(items);

  if (lines.length === 0) {
    return [];
  }

  const allHeights = lines.flatMap((line) => line.items.map((item) => item.height));
  const medianHeight = getMedian(allHeights) || 10;

  const pageStats = new Map<
    number,
    {
      minX: number;
      maxX: number;
      minY: number;
      maxY: number;
    }
  >();

  for (const line of lines) {
    const current = pageStats.get(line.page);

    if (!current) {
      pageStats.set(line.page, {
        minX: line.x,
        maxX: line.x + line.width,
        minY: line.y,
        maxY: line.y + line.height,
      });
    } else {
      current.minX = Math.min(current.minX, line.x);
      current.maxX = Math.max(current.maxX, line.x + line.width);
      current.minY = Math.min(current.minY, line.y);
      current.maxY = Math.max(current.maxY, line.y + line.height);
    }
  }

  const candidates: LineCandidate[] = [];

  for (const line of lines) {
    const text = normalizeHeadingText(line.text);

    if (!text) continue;

    if (isMathLikeLine(text)) {
      continue;
    }

    const stats = pageStats.get(line.page);

    if (!stats) continue;

    const score = scoreHeadingLine({
      text,
      height: line.height,
      medianHeight,
      x: line.x,
      pageMinX: stats.minX,
      pageMaxX: stats.maxX,
      y: line.y,
      pageMinY: stats.minY,
      pageMaxY: stats.maxY,
      items: line.items,
    });

    if (score < 5) continue;

    candidates.push({
      text,
      page: line.page,
      x: line.x,
      y: line.y,
      width: line.width,
      height: line.height,
      score,
      level: estimateHeadingLevel(text, line.height, medianHeight),
    });
  }

  const outlineItems: OutlineItem[] = candidates.map((candidate) => ({
    id: `${pane}-outline-${candidate.page}-${candidate.x.toFixed(
      1
    )}-${candidate.y.toFixed(1)}-${candidate.text}`,
    pane,
    page: candidate.page,
    title: candidate.text,
    level: candidate.level,
    rect: {
      page: candidate.page,
      x: candidate.x,
      y: candidate.y,
      width: candidate.width,
      height: candidate.height,
    },
  }));

  return dedupeOutlineItems(outlineItems).sort((a, b) => {
    if (a.page !== b.page) {
      return a.page - b.page;
    }

    if (a.rect.y !== b.rect.y) {
      return a.rect.y - b.rect.y;
    }

    return a.rect.x - b.rect.x;
  });
}