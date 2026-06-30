import type { PdfRect } from "../types/pdf";

export function cropCanvasByCssRect(
  canvas: HTMLCanvasElement,
  rect: PdfRect,
  padding = 8
): string {
  const cssWidth = Number(canvas.style.width.replace("px", "")) || canvas.width;
  const cssHeight = Number(canvas.style.height.replace("px", "")) || canvas.height;

  const ratioX = canvas.width / cssWidth;
  const ratioY = canvas.height / cssHeight;

  const sx = Math.max(0, (rect.x - padding) * ratioX);
  const sy = Math.max(0, (rect.y - padding) * ratioY);
  const sw = Math.min(canvas.width - sx, (rect.width + padding * 2) * ratioX);
  const sh = Math.min(canvas.height - sy, (rect.height + padding * 2) * ratioY);

  const output = document.createElement("canvas");
  output.width = Math.max(1, Math.floor(sw));
  output.height = Math.max(1, Math.floor(sh));

  const ctx = output.getContext("2d");

  if (!ctx) {
    throw new Error("Failed to create crop canvas context");
  }

  ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, output.width, output.height);

  return output.toDataURL("image/png");
}