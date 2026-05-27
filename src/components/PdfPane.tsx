import { useEffect, useMemo, useRef, useState } from "react";
import { pdfjsLib } from "../lib/pdfjs";
import { PdfPage } from "./PdfPage";
import type { PaneId, PdfTextItem } from "../types/pdf";
import { useViewerStore } from "../store/viewerStore";

type PdfPaneProps = {
  pane: PaneId;
  debugTextLayer: boolean;
  onTextItems: (pane: PaneId, page: number, items: PdfTextItem[]) => void;
};

const MIN_SCALE = 0.35;
const PANE_HORIZONTAL_PADDING = 48;
const AUTO_FIT_MARGIN = 24;

export function PdfPane({ pane, debugTextLayer, onTextItems }: PdfPaneProps) {
  const paneState = useViewerStore((state) => state.panes[pane]);
  const setTotalPages = useViewerStore((state) => state.setTotalPages);
  const setPageNumber = useViewerStore((state) => state.setPageNumber);
  const setFitScale = useViewerStore((state) => state.setFitScale);

  const containerRef = useRef<HTMLElement | null>(null);
  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const tickingRef = useRef(false);
  const initialScrollDoneRef = useRef(false);

  const [pdf, setPdf] = useState<any>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [basePageWidth, setBasePageWidth] = useState<number | null>(null);

  const effectiveScale = useMemo(() => {
    return Math.min(paneState.userScale, paneState.fitScale);
  }, [paneState.userScale, paneState.fitScale]);

  useEffect(() => {
    initialScrollDoneRef.current = false;
    setBasePageWidth(null);

    if (!paneState.pdfUrl) {
      setPdf(null);
      setLoadError(null);
      return;
    }

    let cancelled = false;

    async function loadPdf(url: string) {
      try {
        setPdf(null);
        setLoadError(null);

        const loadingTask = pdfjsLib.getDocument({ url });
        const loadedPdf = await loadingTask.promise;

        if (cancelled) return;

        setPdf(loadedPdf);
        setTotalPages(pane, loadedPdf.numPages);

        const firstPage = await loadedPdf.getPage(1);
        const baseViewport = firstPage.getViewport({ scale: 1 });

        if (!cancelled) {
          setBasePageWidth(baseViewport.width);
        }
      } catch (error) {
        console.error(`[${pane}] PDF load failed`, error);

        if (!cancelled) {
          const message =
            error instanceof Error ? error.message : String(error);

          setLoadError(message);
        }
      }
    }

    void loadPdf(paneState.pdfUrl);

    return () => {
      cancelled = true;
    };
  }, [pane, paneState.pdfUrl, setTotalPages]);

  useEffect(() => {
    const container = containerRef.current;

    if (!container || !basePageWidth) {
      return;
    }

    const updateFitScale = () => {
      const availableWidth =
        container.clientWidth - PANE_HORIZONTAL_PADDING - AUTO_FIT_MARGIN;

      if (availableWidth <= 0) {
        return;
      }

      const nextFitScale = Math.max(MIN_SCALE, availableWidth / basePageWidth);

      setFitScale(pane, nextFitScale);
    };

    const observer = new ResizeObserver(() => {
      window.requestAnimationFrame(updateFitScale);
    });

    observer.observe(container);

    window.requestAnimationFrame(updateFitScale);

    return () => {
      observer.disconnect();
    };
  }, [pane, basePageWidth, setFitScale]);

  // 初回ロード時だけ、現在ページへ移動
  useEffect(() => {
    if (!pdf) return;
    if (initialScrollDoneRef.current) return;

    const target = pageRefs.current[paneState.pageNumber];

    if (target) {
      target.scrollIntoView({
        block: "start",
        behavior: "auto",
      });

      initialScrollDoneRef.current = true;
    }
  }, [pdf, paneState.pageNumber]);

  // 数字入力などによる明示的ジャンプ時だけ動く
  useEffect(() => {
    if (!pdf) return;

    const target = pageRefs.current[paneState.pageNumber];

    if (!target) return;

    target.scrollIntoView({
      block: "start",
      behavior: "smooth",
    });
  }, [pdf, paneState.jumpRequestId, paneState.pageNumber]);

  const updateDominantVisiblePage = () => {
    const container = containerRef.current;
    if (!container || !pdf) return;

    const containerRect = container.getBoundingClientRect();

    let bestPage = paneState.pageNumber;
    let bestVisibleArea = 0;

    for (let page = 1; page <= pdf.numPages; page += 1) {
      const element = pageRefs.current[page];
      if (!element) continue;

      const rect = element.getBoundingClientRect();

      const visibleTop = Math.max(rect.top, containerRect.top);
      const visibleBottom = Math.min(rect.bottom, containerRect.bottom);
      const visibleHeight = Math.max(0, visibleBottom - visibleTop);

      const visibleLeft = Math.max(rect.left, containerRect.left);
      const visibleRight = Math.min(rect.right, containerRect.right);
      const visibleWidth = Math.max(0, visibleRight - visibleLeft);

      const visibleArea = visibleWidth * visibleHeight;

      if (visibleArea > bestVisibleArea) {
        bestVisibleArea = visibleArea;
        bestPage = page;
      }
    }

    if (bestVisibleArea > 0 && bestPage !== paneState.pageNumber) {
      setPageNumber(pane, bestPage);
    }
  };

  const handleScroll = () => {
    if (tickingRef.current) return;

    tickingRef.current = true;

    window.requestAnimationFrame(() => {
      updateDominantVisiblePage();
      tickingRef.current = false;
    });
  };

  if (!paneState.pdfUrl) {
    return (
      <section className="pdf-pane empty-pane" data-pane-id={pane}>
        <div>PDFが読み込まれていません</div>
      </section>
    );
  }

  if (loadError) {
    return (
      <section className="pdf-pane empty-pane" data-pane-id={pane}>
        <div>
          <h3>PDF読み込みエラー</h3>
          <pre>{loadError}</pre>
        </div>
      </section>
    );
  }

  if (!pdf) {
    return (
      <section className="pdf-pane empty-pane" data-pane-id={pane}>
        <div>PDFを読み込み中...</div>
      </section>
    );
  }

  return (
    <section
      ref={containerRef}
      className="pdf-pane"
      data-pane-id={pane}
      onScroll={handleScroll}
    >
      <div className="pane-status">
        {pane === "left" ? "左" : "右"} / p.{paneState.pageNumber} /{" "}
        {paneState.totalPages} / 表示 {Math.round(effectiveScale * 100)}%
        {" / "}
        手動 {Math.round(paneState.userScale * 100)}%
      </div>

      {Array.from({ length: pdf.numPages }, (_, index) => {
        const pageNumber = index + 1;

        return (
          <div
            key={pageNumber}
            ref={(element) => {
              pageRefs.current[pageNumber] = element;
            }}
            data-page-wrapper={pageNumber}
          >
            <PdfPage
              pdf={pdf}
              pageNumber={pageNumber}
              scale={effectiveScale}
              debugTextLayer={debugTextLayer}
              onTextItems={(page, items) => onTextItems(pane, page, items)}
            />
          </div>
        );
      })}
    </section>
  );
}