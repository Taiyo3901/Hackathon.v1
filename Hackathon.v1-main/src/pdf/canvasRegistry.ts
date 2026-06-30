import type { PaneId } from "../types/pdf";

const canvasMap = new Map<string, HTMLCanvasElement>();

function makeKey(pane: PaneId, page: number): string {
  return `${pane}:${page}`;
}

export function registerPageCanvas(
  pane: PaneId,
  page: number,
  canvas: HTMLCanvasElement
): void {
  canvasMap.set(makeKey(pane, page), canvas);
}

export function unregisterPageCanvas(pane: PaneId, page: number): void {
  canvasMap.delete(makeKey(pane, page));
}

export function getPageCanvas(
  pane: PaneId,
  page: number
): HTMLCanvasElement | null {
  return canvasMap.get(makeKey(pane, page)) ?? null;
}