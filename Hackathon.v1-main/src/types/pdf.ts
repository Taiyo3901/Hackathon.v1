export type PaneId = "left" | "right";

export type PdfRect = {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PdfTextItem = {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;

  fontName?: string;
  fontFamily?: string;
  isBold?: boolean;
};

export type TextLine = {
  items: PdfTextItem[];
  text: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  column?: number;
};

export type FormulaCandidate = {
  id: string;
  pane: PaneId;
  page: number;
  rawText: string;
  latex: string;
  score: number;
  rect: PdfRect;
};

export type SearchResult = {
  id: string;
  pane: PaneId;
  page: number;
  text: string;
  rect: PdfRect;
};

export type OutlineItem = {
  id: string;
  pane: PaneId;
  page: number;
  title: string;
  level: number;
  rect: PdfRect;
};

export type HighlightSource = "outline" | "search" | "formula" | "manual";

export type HighlightTarget = {
  id: string;
  pane: PaneId;
  page: number;
  rect: PdfRect;
  label?: string;
  source?: HighlightSource;
};

export type OcrResult = {
  page: number;
  text: string;
};

export type PdfTextAlign = "left" | "center" | "right";

export type PdfTextFontWeight = "normal" | "bold";

export type PdfTextBox = {
  id: string;
  pane: PaneId;
  page: number;

  x: number;
  y: number;
  width: number;
  height: number;

  text: string;
  fontSize: number;
  color: string;

  textAlign?: "left" | "center" | "right";
  fontWeight?: "normal" | "bold";
  italic?: boolean;
  underline?: boolean;
  backgroundColor?: string;
  opacity?: number
};

export type PdfPageViewportInfo = {
  pane: PaneId;
  page: number;
  width: number;
  height: number;
};