import { memo, useEffect, useRef, useState } from "react";
import { TextLayer } from "./TextLayer";
import { HighlightOverlay } from "./HighlightOverlay";
import { TextBoxLayer } from "./TextBoxLayer";
import type { PaneId, PdfTextItem } from "../types/pdf";
import { FreehandDrawLayer } from "./FreehandDrawLayer";

type PdfPageProps = {
  pane: PaneId;
  pdf: any;
  pageNumber: number;
  scale: number;
  debugTextLayer?: boolean;
  onTextItems?: (page: number, items: PdfTextItem[]) => void;
};

function PdfPageComponent({
  pane,
  pdf,
  pageNumber,
  scale,
  debugTextLayer = false,
  onTextItems,
}: PdfPageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderTaskRef = useRef<any>(null);

  const [viewport, setViewport] = useState<any>(null);
  const [textContent, setTextContent] = useState<any>(null);

  useEffect(() => {
    let disposed = false;

    async function renderPage() {
      try {
        const page = await pdf.getPage(pageNumber);

        if (disposed) {
          return;
        }

        const vp = page.getViewport({ scale });

        setViewport(vp);
        setTextContent(null);

        const canvas = canvasRef.current;

        if (!canvas) {
          return;
        }

        const ctx = canvas.getContext("2d", { alpha: false });

        if (!ctx) {
          return;
        }

        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch {
            // ignore
          }
        }

        const outputScale = window.devicePixelRatio || 1;

        canvas.width = Math.floor(vp.width * outputScale);
        canvas.height = Math.floor(vp.height * outputScale);

        canvas.style.width = `${Math.floor(vp.width)}px`;
        canvas.style.height = `${Math.floor(vp.height)}px`;

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const transform =
          outputScale !== 1
            ? [outputScale, 0, 0, outputScale, 0, 0]
            : undefined;

        const renderTask = page.render({
          canvasContext: ctx,
          viewport: vp,
          transform,
        });

        renderTaskRef.current = renderTask;

        try {
          await renderTask.promise;
        } catch (error: any) {
          if (error?.name !== "RenderingCancelledException") {
            console.error(`[PdfPage ${pageNumber}] render error`, error);
          }

          return;
        }

        if (disposed) {
          return;
        }

        const tc = await page.getTextContent({
          disableCombineTextItems: false,
          includeMarkedContent: false,
        } as any);

        if (disposed) {
          return;
        }

        setTextContent(tc);
      } catch (error) {
        console.error(`[PdfPage ${pageNumber}] failed`, error);
      }
    }

    void renderPage();

    return () => {
      disposed = true;

      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // ignore
        }
      }
    };
  }, [pdf, pageNumber, scale]);

  return (
    <div
      className="pdf-page"
      data-page={pageNumber}
      style={{
        position: "relative",
        width: viewport ? `${viewport.width}px` : "0px",
        height: viewport ? `${viewport.height}px` : "0px",
        margin: "16px auto",
        background: "white",
        boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      <canvas
        ref={canvasRef}
        className="pdf-canvas"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          display: "block",
          pointerEvents: "none",
          userSelect: "none",
          WebkitUserSelect: "none",
        }}
      />

      {viewport && textContent && textContent.items.length > 0 && (
        <TextLayer
          textContent={textContent}
          viewport={viewport}
          pageNumber={pageNumber}
          debug={debugTextLayer}
          onItems={onTextItems}
        />
      )}

      <HighlightOverlay pane={pane} pageNumber={pageNumber} />

      {viewport && (
        <FreehandDrawLayer
          pane={pane}
          pageNumber={pageNumber}
          width={viewport.width}
          height={viewport.height}
        />
      )}

      {viewport && (
        <TextBoxLayer
          pane={pane}
          pageNumber={pageNumber}
          viewportWidth={viewport.width}
          viewportHeight={viewport.height}
        />
      )}
    </div>
  );
}

export const PdfPage = memo(PdfPageComponent);