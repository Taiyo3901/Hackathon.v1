import { useEffect, useMemo, useRef } from "react";
import { pdfjsLib } from "../lib/pdfjs";
import type { PdfTextItem } from "../types/pdf";

type TextLayerProps = {
  textContent: any;
  viewport: any;
  pageNumber: number;
  debug?: boolean;
  onItems?: (page: number, items: PdfTextItem[]) => void;
};

type PositionedTextItem = {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontName?: string;
  fontFamily?: string;
  isBold?: boolean;
};

function getTextContentSignature(textContent: any): string {
  const items = textContent?.items as any[] | undefined;

  if (!items || items.length === 0) {
    return "empty";
  }

  const first = String(items[0]?.str ?? "");
  const last = String(items[items.length - 1]?.str ?? "");

  return `${items.length}:${first}:${last}`;
}

function isBoldFont(fontName?: string, fontFamily?: string): boolean {
  const source = `${fontName ?? ""} ${fontFamily ?? ""}`.toLowerCase();

  return (
    source.includes("bold") ||
    source.includes("black") ||
    source.includes("heavy") ||
    source.includes("semibold") ||
    source.includes("demibold") ||
    source.includes("medium") ||
    source.includes("gothic")
  );
}

export function TextLayer({
  textContent,
  viewport,
  pageNumber,
  debug = false,
  onItems,
}: TextLayerProps) {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const onItemsRef = useRef<TextLayerProps["onItems"]>(onItems);

  useEffect(() => {
    onItemsRef.current = onItems;
  }, [onItems]);

  const renderKey = useMemo(() => {
    return [
      pageNumber,
      viewport?.width,
      viewport?.height,
      viewport?.scale,
      getTextContentSignature(textContent),
      debug ? "debug" : "normal",
    ].join("|");
  }, [pageNumber, viewport, textContent, debug]);

  useEffect(() => {
    const container = layerRef.current;

    if (!container) return;

    const handleNativeSelectStart = (event: Event) => {
      if (event.target === container) {
        event.preventDefault();
      }
    };

    container.addEventListener("selectstart", handleNativeSelectStart);

    return () => {
      container.removeEventListener("selectstart", handleNativeSelectStart);
    };
  }, []);

  useEffect(() => {
    const container = layerRef.current;

    if (!container || !textContent || !viewport) return;

    container.innerHTML = "";

    const rawItems = textContent.items as any[];
    const styles = textContent.styles ?? {};

    const positionedItems: PositionedTextItem[] = rawItems
      .filter((item) => {
        return typeof item.str === "string" && item.str.trim().length > 0;
      })
      .map((item) => {
        const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);

        const x = tx[4];
        const baselineY = tx[5];

        const height =
          Math.hypot(tx[2], tx[3]) ||
          Math.abs((item.height ?? 10) * viewport.scale) ||
          10;

        const width =
          Math.abs((item.width ?? 0) * viewport.scale) ||
          Math.max(String(item.str).length * height * 0.5, 1);

        const fontName =
          typeof item.fontName === "string" ? item.fontName : undefined;

        const styleInfo = fontName ? styles[fontName] : undefined;

        const fontFamily =
          typeof styleInfo?.fontFamily === "string"
            ? styleInfo.fontFamily
            : undefined;

        return {
          str: String(item.str),
          x,
          y: baselineY - height,
          width,
          height,
          fontName,
          fontFamily,
          isBold: isBoldFont(fontName, fontFamily),
        };
      })
      .sort((a, b) => {
        const yDiff = a.y - b.y;

        if (Math.abs(yDiff) > 3) {
          return yDiff;
        }

        return a.x - b.x;
      });

    const exportedItems: PdfTextItem[] = positionedItems.map((item) => ({
      str: item.str,
      x: item.x,
      y: item.y,
      width: item.width,
      height: item.height,
      page: pageNumber,
      fontName: item.fontName,
      fontFamily: item.fontFamily,
      isBold: item.isBold,
    }));

    const fragment = document.createDocumentFragment();

    for (const item of positionedItems) {
      const span = document.createElement("span");

      span.textContent = item.str;
      span.dataset.pdfText = "true";

      span.style.position = "absolute";
      span.style.left = `${item.x}px`;
      span.style.top = `${item.y}px`;
      span.style.width = `${Math.max(item.width, 1)}px`;
      span.style.height = `${Math.max(item.height, 1)}px`;
      span.style.fontSize = `${item.height}px`;
      span.style.lineHeight = "1";
      span.style.whiteSpace = "pre";
      span.style.overflow = "hidden";
      span.style.display = "block";
      span.style.transformOrigin = "0 0";
      span.style.userSelect = "text";
      span.style.webkitUserSelect = "text";
      span.style.pointerEvents = "auto";
      span.style.cursor = "text";

      if (debug) {
        span.style.color = item.isBold ? "blue" : "red";
        span.style.background = item.isBold
          ? "rgba(0,120,255,0.15)"
          : "rgba(255,0,0,0.15)";
        span.style.outline = item.isBold
          ? "1px solid rgba(0,120,255,0.5)"
          : "1px solid rgba(255,0,0,0.4)";
      } else {
        span.style.color = "transparent";
        span.style.background = "transparent";
      }

      fragment.appendChild(span);
    }

    container.appendChild(fragment);

    onItemsRef.current?.(pageNumber, exportedItems);
  }, [renderKey, textContent, viewport, pageNumber, debug]);

  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      event.preventDefault();

      const selection = window.getSelection();
      selection?.removeAllRanges();
    }
  };

  return (
    <div
      ref={layerRef}
      className="pdf-text-layer"
      onMouseDown={handleMouseDown}
      style={{
        position: "absolute",
        inset: 0,
        width: `${viewport.width}px`,
        height: `${viewport.height}px`,
        overflow: "hidden",
        zIndex: 10,
        userSelect: "none",
        WebkitUserSelect: "none",
        pointerEvents: "auto",
        border: debug ? "1px solid red" : "none",
      }}
    />
  );
}