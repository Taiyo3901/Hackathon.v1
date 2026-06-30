import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sidebar } from "./Sidebar";
import { PdfPane } from "./PdfPane";
import { useViewerStore } from "../store/viewerStore";
import { useHighlightStore } from "../store/highlightStore";
import { usePdfSourceStore } from "../store/pdfSourceStore";
import { usePdfTextBoxStore } from "../store/pdfTextBoxStore";
import { loadPdfBytesFromUrl } from "../pdf/loadPdfBytesFromUrl";
import type {
  FormulaCandidate,
  OutlineItem,
  PaneId,
  PdfTextItem,
} from "../types/pdf";
import { extractFormulaCandidates } from "../pdf/formula";
import { extractOutlineItems } from "../pdf/outline";

type TextItemsByPane = {
  left: PdfTextItem[];
  right: PdfTextItem[];
};

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();

  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    target.isContentEditable
  );
}

function getPdfTitleFromUrl(url: string): string {
  try {
    const decoded = decodeURI(url);
    const last = decoded.split(/[\\/]/).pop();

    if (last && last.toLowerCase().endsWith(".pdf")) {
      return last;
    }

    return "URL PDF";
  } catch {
    return "URL PDF";
  }
}

export function SplitPdfViewer() {
  const loadPdf = useViewerStore((state) => state.loadPdf);
  const panes = useViewerStore((state) => state.panes);
  const zoomIn = useViewerStore((state) => state.zoomIn);
  const zoomOut = useViewerStore((state) => state.zoomOut);
  const setUserScale = useViewerStore((state) => state.setUserScale);
  const jumpToPage = useViewerStore((state) => state.jumpToPage);
  const swapPanes = useViewerStore((state) => state.swapPanes);

  const setPdfBytes = usePdfSourceStore((state) => state.setPdfBytes);
  const swapPdfBytes = usePdfSourceStore((state) => state.swapPdfBytes);
  const swapPaneTextBoxes = usePdfTextBoxStore(
    (state) => state.swapPaneTextBoxes
  );

  const clearOutlineHighlight = useHighlightStore(
    (state) => state.clearOutlineHighlight
  );
  const clearHighlight = useHighlightStore((state) => state.clearHighlight);

  const appRootRef = useRef<HTMLDivElement | null>(null);
  const viewerAreaRef = useRef<HTMLElement | null>(null);
  const wheelLockRef = useRef(false);

  const [debugTextLayer, setDebugTextLayer] = useState(false);
  const [splitRatio, setSplitRatio] = useState(50);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [activePane, setActivePane] = useState<PaneId>("left");
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [textItemsByPane, setTextItemsByPane] = useState<TextItemsByPane>({
    left: [],
    right: [],
  });

  const getEffectivePane = useCallback((): PaneId | null => {
    if (panes[activePane]?.pdfUrl) {
      return activePane;
    }

    if (panes.left.pdfUrl) {
      return "left";
    }

    if (panes.right.pdfUrl) {
      return "right";
    }

    return null;
  }, [activePane, panes]);

  const toggleFullscreen = useCallback(() => {
    const viewerArea = viewerAreaRef.current;

    if (!viewerArea) {
      return;
    }

    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }

    void viewerArea.requestFullscreen?.().catch((error) => {
      console.warn("[SplitPdfViewer] fullscreen request failed", error);
    });
  }, []);

  const moveActivePanePage = useCallback(
    (delta: number) => {
      const effectivePane = getEffectivePane();

      if (!effectivePane) {
        return;
      }

      const current = panes[effectivePane];
      const proposedPage = current.pageNumber + delta;
      const nextPage =
        current.totalPages > 0
          ? Math.min(Math.max(1, proposedPage), current.totalPages)
          : Math.max(1, proposedPage);

      jumpToPage(effectivePane, nextPage);
      setActivePane(effectivePane);
    },
    [getEffectivePane, jumpToPage, panes]
  );

  useEffect(() => {
    const handleFullscreenChange = () => {
      const viewerArea = viewerAreaRef.current;
      const isViewerFullscreen = document.fullscreenElement === viewerArea;

      setIsFullscreen(isViewerFullscreen);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const params = new URLSearchParams(window.location.search);
    const pdfParam = params.get("pdf");

    if (
      typeof pdfParam !== "string" ||
      pdfParam.length === 0 ||
      panes.left.pdfUrl
    ) {
      return;
    }

    const title = getPdfTitleFromUrl(pdfParam);

    loadPdf("left", pdfParam, title);

    void loadPdfBytesFromUrl(pdfParam)
      .then((bytes) => {
        if (cancelled) {
          return;
        }

        setPdfBytes("left", bytes);
      })
      .catch((error) => {
        console.warn("[SplitPdfViewer] URL PDF bytes load failed", error);
      });

    return () => {
      cancelled = true;
    };
  }, [loadPdf, panes.left.pdfUrl, setPdfBytes]);

  useEffect(() => {
    const root = appRootRef.current;

    if (!root) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      const paneElement = target.closest("[data-pane-id]");
      const paneId = paneElement?.getAttribute("data-pane-id");

      if (paneId === "left" || paneId === "right") {
        setActivePane(paneId);
      }
    };

    root.addEventListener("pointerdown", handlePointerDown);

    return () => {
      root.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  useEffect(() => {
    const root = appRootRef.current;

    if (!root) {
      return;
    }

    const handleWheel = (event: WheelEvent) => {
      const isZoomGesture = event.ctrlKey || event.metaKey;

      if (!isZoomGesture) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      const paneElement = target.closest("[data-pane-id]");

      if (!paneElement) {
        return;
      }

      const paneId = paneElement.getAttribute("data-pane-id");

      if (paneId !== "left" && paneId !== "right") {
        return;
      }

      clearHighlight();
      clearOutlineHighlight();

      if (wheelLockRef.current) {
        return;
      }

      wheelLockRef.current = true;

      if (event.deltaY < 0) {
        zoomIn(paneId);
      } else {
        zoomOut(paneId);
      }

      window.setTimeout(() => {
        wheelLockRef.current = false;
      }, 40);
    };

    root.addEventListener("wheel", handleWheel, {
      passive: false,
      capture: true,
    });

    return () => {
      root.removeEventListener("wheel", handleWheel, true);
    };
  }, [zoomIn, zoomOut, clearHighlight, clearOutlineHighlight]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) {
        if (event.key === "Escape") {
          if (isFullscreen) {
            event.preventDefault();
            event.stopPropagation();
            void document.exitFullscreen();
            return;
          }

          (event.target as HTMLElement).blur();
        }

        return;
      }

      const effectivePane = getEffectivePane();
      const isCtrlOrMeta = event.ctrlKey || event.metaKey;

      const prevent = () => {
        event.preventDefault();
        event.stopPropagation();
      };

      if (isFullscreen) {
        if (event.key === "Escape") {
          prevent();
          void document.exitFullscreen();
          return;
        }

        if (event.key === "ArrowUp") {
          prevent();
          moveActivePanePage(-1);
          return;
        }

        if (event.key === "ArrowDown") {
          prevent();
          moveActivePanePage(1);
          return;
        }

        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          prevent();
          setActivePane(event.key === "ArrowLeft" ? "left" : "right");
          return;
        }
      }

      if (isCtrlOrMeta && event.key.toLowerCase() === "f") {
        prevent();
        clearOutlineHighlight();
        setIsSidebarCollapsed(false);

        window.setTimeout(() => {
          window.dispatchEvent(new CustomEvent("pdf-viewer-open-search"));
        }, 0);

        return;
      }

      if (!effectivePane) {
        return;
      }

      const current = panes[effectivePane];

      if (
        isCtrlOrMeta &&
        (event.key === "+" || event.key === "=" || event.code === "Equal")
      ) {
        prevent();
        clearHighlight();
        clearOutlineHighlight();
        zoomIn(effectivePane);
        setActivePane(effectivePane);
        return;
      }

      if (isCtrlOrMeta && (event.key === "-" || event.code === "Minus")) {
        prevent();
        clearHighlight();
        clearOutlineHighlight();
        zoomOut(effectivePane);
        setActivePane(effectivePane);
        return;
      }

      if (isCtrlOrMeta && event.key === "0") {
        prevent();
        clearHighlight();
        clearOutlineHighlight();
        setUserScale(effectivePane, 1);
        setActivePane(effectivePane);
        return;
      }

      if (isCtrlOrMeta && event.key === "1") {
        prevent();
        clearHighlight();
        clearOutlineHighlight();
        setUserScale(effectivePane, 1.25);
        setActivePane(effectivePane);
        return;
      }

      if (isCtrlOrMeta && event.key === "2") {
        prevent();
        clearHighlight();
        clearOutlineHighlight();
        setUserScale(effectivePane, 1.5);
        setActivePane(effectivePane);
        return;
      }

      if (
        event.key === "PageDown" ||
        event.key === "ArrowRight" ||
        event.key === " "
      ) {
        prevent();
        clearHighlight();
        clearOutlineHighlight();

        const nextPage =
          current.totalPages > 0
            ? Math.min(current.totalPages, current.pageNumber + 1)
            : current.pageNumber + 1;

        jumpToPage(effectivePane, nextPage);
        setActivePane(effectivePane);
        return;
      }

      if (event.key === "PageUp" || event.key === "ArrowLeft") {
        prevent();
        clearHighlight();
        clearOutlineHighlight();

        const previousPage = Math.max(1, current.pageNumber - 1);

        jumpToPage(effectivePane, previousPage);
        setActivePane(effectivePane);
        return;
      }

      if (event.key === "Home") {
        prevent();
        clearHighlight();
        clearOutlineHighlight();
        jumpToPage(effectivePane, 1);
        setActivePane(effectivePane);
        return;
      }

      if (event.key === "End") {
        prevent();
        clearHighlight();
        clearOutlineHighlight();

        if (current.totalPages > 0) {
          jumpToPage(effectivePane, current.totalPages);
          setActivePane(effectivePane);
        }

        return;
      }

      if (event.key.toLowerCase() === "s") {
        prevent();
        clearHighlight();
        clearOutlineHighlight();
        swapPanes();
        swapPdfBytes();
        swapPaneTextBoxes();
        return;
      }

      if (event.key.toLowerCase() === "d") {
        prevent();
        clearHighlight();
        setDebugTextLayer((value) => !value);
        return;
      }

      if (event.key === "Escape") {
        prevent();
        clearHighlight();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [
    panes,
    getEffectivePane,
    zoomIn,
    zoomOut,
    setUserScale,
    jumpToPage,
    swapPanes,
    swapPdfBytes,
    swapPaneTextBoxes,
    clearHighlight,
    clearOutlineHighlight,
    isFullscreen,
    moveActivePanePage,
  ]);

  const handleTextItems = useCallback(
    (pane: PaneId, page: number, items: PdfTextItem[]) => {
      setTextItemsByPane((prev) => {
        const filtered = prev[pane].filter((item) => item.page !== page);

        return {
          ...prev,
          [pane]: [...filtered, ...items],
        };
      });
    },
    []
  );

  const hasLeftPdf = Boolean(panes.left.pdfUrl);
  const hasRightPdf = Boolean(panes.right.pdfUrl);
  const isSplitMode = hasLeftPdf && hasRightPdf;

  const visiblePanes: PaneId[] = useMemo(() => {
    if (hasLeftPdf && hasRightPdf) {
      return ["left", "right"];
    }

    if (hasLeftPdf) {
      return ["left"];
    }

    if (hasRightPdf) {
      return ["right"];
    }

    return [];
  }, [hasLeftPdf, hasRightPdf]);

  const formulas = useMemo<FormulaCandidate[]>(() => {
    const result: FormulaCandidate[] = [];

    if (hasLeftPdf) {
      result.push(
        ...extractFormulaCandidates(
          "left",
          panes.left.pageNumber,
          textItemsByPane.left
        )
      );
    }

    if (hasRightPdf) {
      result.push(
        ...extractFormulaCandidates(
          "right",
          panes.right.pageNumber,
          textItemsByPane.right
        )
      );
    }

    return result;
  }, [
    hasLeftPdf,
    hasRightPdf,
    panes.left.pageNumber,
    panes.right.pageNumber,
    textItemsByPane.left,
    textItemsByPane.right,
  ]);

  const outlineItems = useMemo<OutlineItem[]>(() => {
    return [
      ...extractOutlineItems("left", textItemsByPane.left),
      ...extractOutlineItems("right", textItemsByPane.right),
    ].sort((a, b) => {
      if (a.pane !== b.pane) {
        return a.pane === "left" ? -1 : 1;
      }

      if (a.page !== b.page) {
        return a.page - b.page;
      }

      return a.rect.y - b.rect.y;
    });
  }, [textItemsByPane.left, textItemsByPane.right]);

  const handleDividerPointerDown = (
    event: React.PointerEvent<HTMLDivElement>
  ) => {
    event.preventDefault();
    clearHighlight();
    clearOutlineHighlight();

    const viewerArea = viewerAreaRef.current;

    if (!viewerArea) {
      return;
    }

    const rect = viewerArea.getBoundingClientRect();

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const x = moveEvent.clientX - rect.left;
      const ratio = (x / rect.width) * 100;
      const clamped = Math.min(82, Math.max(18, ratio));

      setSplitRatio(Number(clamped.toFixed(1)));
    };

    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  const resetDivider = () => {
    clearHighlight();
    clearOutlineHighlight();
    setSplitRatio(50);
  };

  const renderedPaneNodes = visiblePanes.flatMap((pane, index) => {
    const nodes: ReactNode[] = [];

    if (isSplitMode && index > 0) {
      nodes.push(
        <div
          key="split-divider"
          className="split-divider"
          onPointerDown={handleDividerPointerDown}
          onDoubleClick={resetDivider}
          title="ドラッグで左右幅調整 / ダブルクリックで50:50"
        />
      );
    }

    nodes.push(
      <PdfPane
        key={pane}
        pane={pane}
        debugTextLayer={debugTextLayer}
        isActive={isFullscreen ? activePane === pane : false}
        fullscreenMode={isFullscreen}
        onTextItems={handleTextItems}
      />
    );

    return nodes;
  });

  return (
    <div
      ref={appRootRef}
      className={
        isSidebarCollapsed
          ? "app-layout sidebar-collapsed"
          : "app-layout sidebar-expanded"
      }
    >
      <Sidebar
        formulas={formulas}
        outlineItems={outlineItems}
        textItemsByPane={textItemsByPane}
        debugTextLayer={debugTextLayer}
        isFullscreen={isFullscreen}
        collapsed={isSidebarCollapsed}
        onToggleSidebar={() => {
          clearOutlineHighlight();
          setIsSidebarCollapsed(true);
        }}
        onToggleDebugTextLayer={() => {
          clearHighlight();
          setDebugTextLayer((value) => !value);
        }}
        onToggleFullscreen={toggleFullscreen}
      />

      <main
        ref={viewerAreaRef}
        className={
          isSplitMode
            ? isFullscreen
              ? "viewer-area split-mode fullscreen-mode"
              : "viewer-area split-mode"
            : isFullscreen
              ? "viewer-area single-mode fullscreen-mode"
              : "viewer-area single-mode"
        }
        style={
          isSplitMode
            ? {
                gridTemplateColumns: `minmax(0, ${splitRatio}fr) 8px minmax(0, ${
                  100 - splitRatio
                }fr)`,
              }
            : undefined
        }
      >
        {visiblePanes.length === 0 && (
          <div className="no-pdf-message">PDFを読み込んでください</div>
        )}

      {renderedPaneNodes}
      </main>
    </div>
  );
}
