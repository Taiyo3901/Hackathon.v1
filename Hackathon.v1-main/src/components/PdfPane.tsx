import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { pdfjsLib } from "../lib/pdfjs";
import { PdfPage } from "./PdfPage";
import type { PaneId, PdfTextItem } from "../types/pdf";
import { useViewerStore } from "../store/viewerStore";

type PdfPaneProps = {
  pane: PaneId;
  debugTextLayer: boolean;
  isActive?: boolean;
  fullscreenMode?: boolean;
  onTextItems: (pane: PaneId, page: number, items: PdfTextItem[]) => void;
};

type ScrollAnchor = {
  page: number;
  ratioX: number;
  ratioY: number;
};

const MIN_SCALE = 0.25;
const PANE_HORIZONTAL_PADDING = 40;
const PANE_VERTICAL_PADDING = 32;
const AUTO_FIT_MARGIN = 16;
const SCALE_EPSILON = 0.0001;

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getReadableErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error, null, 2);
  } catch {
    return String(error);
  }
}

function normalizePdfUrl(url: string): string {
  if (url.startsWith("file:")) {
    try {
      return decodeURI(url);
    } catch {
      return url;
    }
  }

  return url;
}

export function PdfPane({
  pane,
  debugTextLayer,
  isActive = false,
  fullscreenMode = false,
  onTextItems,
}: PdfPaneProps) {
  const paneState = useViewerStore((state) => state.panes[pane]);
  const setTotalPages = useViewerStore((state) => state.setTotalPages);
  const setPageNumber = useViewerStore((state) => state.setPageNumber);
  const setUserScale = useViewerStore((state) => state.setUserScale);
  const setFitScale = useViewerStore((state) => state.setFitScale);

  const containerRef = useRef<HTMLElement | null>(null);
  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const tickingRef = useRef(false);

  const initialScrollDoneRef = useRef(false);
  const lastJumpRequestIdRef = useRef<number>(paneState.jumpRequestId);
  const previousScaleRef = useRef<number>(paneState.userScale);
  const pendingScaleAnchorRef = useRef<ScrollAnchor | null>(null);
  const latestStableAnchorRef = useRef<ScrollAnchor | null>(null);
  const fullscreenAnchorRef = useRef<ScrollAnchor | null>(null);
  const suppressPageDetectUntilRef = useRef<number>(0);
  const lastAvailableWidthRef = useRef<number | null>(null);
  const latestUserScaleRef = useRef<number>(paneState.userScale);
  const lastMeasuredUserScaleRef = useRef<number>(paneState.userScale);
  const lastFullscreenModeRef = useRef(fullscreenMode);

  const [pdf, setPdf] = useState<any>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [basePageWidth, setBasePageWidth] = useState<number | null>(null);
  const [basePageHeight, setBasePageHeight] = useState<number | null>(null);

  const effectiveScale = fullscreenMode ? paneState.fitScale : paneState.userScale;

  useEffect(() => {
    latestUserScaleRef.current = paneState.userScale;
  }, [paneState.userScale]);

  useEffect(() => {
    initialScrollDoneRef.current = false;
    lastJumpRequestIdRef.current = paneState.jumpRequestId;
    previousScaleRef.current = paneState.userScale;
    pendingScaleAnchorRef.current = null;
    latestStableAnchorRef.current = null;
    suppressPageDetectUntilRef.current = Date.now() + 1200;
    lastAvailableWidthRef.current = null;
    latestUserScaleRef.current = paneState.userScale;
    lastMeasuredUserScaleRef.current = paneState.userScale;
    pageRefs.current = {};
    setBasePageWidth(null);
    setBasePageHeight(null);
    fullscreenAnchorRef.current = null;

    if (!paneState.pdfUrl) {
      setPdf(null);
      setLoadError(null);
      return;
    }

    let cancelled = false;
    let passwordCancelled = false;

    async function loadPdfDocument(url: string) {
      try {
        setPdf(null);
        setLoadError(null);

        const normalizedUrl = normalizePdfUrl(url);

        const loadingTask = pdfjsLib.getDocument({
          url: normalizedUrl,
          cMapUrl: "/cmaps/",
          cMapPacked: true,
          standardFontDataUrl: "/standard_fonts/",
          useSystemFonts: true,
        } as any);

        loadingTask.onPassword = (
          updatePassword: (password: string) => void,
          reason: number
        ) => {
          const isWrongPassword = reason === 2;

          const message = isWrongPassword
            ? "パスワードが正しくありません。もう一度入力してください。"
            : "このPDFはパスワードで保護されています。パスワードを入力してください。";

          const password = window.prompt(message);

          if (password === null) {
            passwordCancelled = true;

            if (!cancelled) {
              setLoadError(
                "パスワード入力がキャンセルされたため、PDFを開けませんでした。"
              );
            }

            void loadingTask.destroy();
            return;
          }

          updatePassword(password);
        };

        const loadedPdf = await loadingTask.promise;

        if (cancelled || passwordCancelled) {
          return;
        }

        setPdf(loadedPdf);
        setTotalPages(pane, loadedPdf.numPages);

        const firstPage = await loadedPdf.getPage(1);
        const baseViewport = firstPage.getViewport({ scale: 1 });

        if (!cancelled) {
          setBasePageWidth(baseViewport.width);
          setBasePageHeight(baseViewport.height);
        }
      } catch (error) {
        console.error(`[${pane}] PDF load failed`, error);

        if (!cancelled && !passwordCancelled) {
          const message = getReadableErrorMessage(error);

          setLoadError(
            [
              "PDFの読み込みに失敗しました。",
              "",
              message,
              "",
              "パスワード付きPDFの場合は、正しいパスワードを入力してください。",
              "",
              "file:/// のPDFを開いている場合は、Chrome拡張の詳細画面で",
              "「ファイルのURLへのアクセスを許可する」をONにしてください。",
              "",
              "日本語ファイル名や特殊フォントを含むPDFの場合、",
              "cMap / standardFontData の設定が必要なことがあります。",
            ].join("\n")
          );
        }
      }
    }

    void loadPdfDocument(paneState.pdfUrl);

    return () => {
      cancelled = true;
    };
  }, [pane, paneState.pdfUrl, setTotalPages]);

  const scrollToPage = (
    pageNumber: number,
    behavior: ScrollBehavior = "smooth"
  ) => {
    const container = containerRef.current;
    const pageElement = pageRefs.current[pageNumber];

    if (fullscreenMode) {
      return true;
    }

    if (!container || !pageElement) {
      return false;
    }

    const maxLeft = Math.max(0, container.scrollWidth - container.clientWidth);
    const targetLeft =
      pageElement.offsetLeft + pageElement.offsetWidth / 2 - container.clientWidth / 2;

    container.scrollTo({
      top: pageElement.offsetTop,
      left: clampNumber(targetLeft, 0, maxLeft),
      behavior,
    });

    suppressPageDetectUntilRef.current =
      behavior === "smooth" ? Date.now() + 650 : Date.now() + 500;

    window.requestAnimationFrame(() => {
      latestStableAnchorRef.current = getScrollAnchor();
    });

    return true;
  };

  const getDominantVisiblePage = (): number => {
    if (fullscreenMode) {
      return paneState.pageNumber;
    }

    const container = containerRef.current;

    if (!container || !pdf) {
      return paneState.pageNumber;
    }

    const containerRect = container.getBoundingClientRect();

    let bestPage = paneState.pageNumber;
    let bestVisibleArea = 0;

    for (let page = 1; page <= pdf.numPages; page += 1) {
      const element = pageRefs.current[page];

      if (!element) {
        continue;
      }

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

    return bestPage;
  };

  function getScrollAnchor(): ScrollAnchor | null {
    if (fullscreenMode) {
      return latestStableAnchorRef.current;
    }

    const container = containerRef.current;

    if (!container || !pdf) {
      return latestStableAnchorRef.current;
    }

    const page = getDominantVisiblePage();
    const pageElement = pageRefs.current[page];

    if (!pageElement) {
      return latestStableAnchorRef.current;
    }

    const centerXInPage =
      container.scrollLeft + container.clientWidth / 2 - pageElement.offsetLeft;
    const centerYInPage =
      container.scrollTop + container.clientHeight / 2 - pageElement.offsetTop;

    const ratioX =
      pageElement.offsetWidth > 0
        ? clampNumber(centerXInPage / pageElement.offsetWidth, 0, 1)
        : 0.5;

    const ratioY =
      pageElement.offsetHeight > 0
        ? clampNumber(centerYInPage / pageElement.offsetHeight, 0, 1)
        : 0;

    return {
      page,
      ratioX,
      ratioY,
    };
  }

  const restoreScrollAnchor = (anchor: ScrollAnchor | null) => {
    if (fullscreenMode) {
      return;
    }

    if (!anchor) {
      return;
    }

    const container = containerRef.current;
    const pageElement = pageRefs.current[anchor.page];

    if (!container || !pageElement) {
      return;
    }

    const targetLeft =
      pageElement.offsetLeft +
      pageElement.offsetWidth * anchor.ratioX -
      container.clientWidth / 2;

    const targetTop =
      pageElement.offsetTop +
      pageElement.offsetHeight * anchor.ratioY -
      container.clientHeight / 2;

    const maxLeft = Math.max(0, container.scrollWidth - container.clientWidth);
    const maxTop = Math.max(0, container.scrollHeight - container.clientHeight);

    container.scrollLeft = clampNumber(targetLeft, 0, maxLeft);
    container.scrollTop = clampNumber(targetTop, 0, maxTop);

    latestStableAnchorRef.current = getScrollAnchor();
  };

  useEffect(() => {
    const container = containerRef.current;

    if (!container || !basePageWidth || !basePageHeight) {
      return;
    }

    const updateFitAndShrinkIfNeeded = () => {
      const availableWidth =
        container.clientWidth - PANE_HORIZONTAL_PADDING - AUTO_FIT_MARGIN;
      const availableHeight =
        container.clientHeight - PANE_VERTICAL_PADDING - AUTO_FIT_MARGIN;

      if (availableWidth <= 0 || availableHeight <= 0) {
        return;
      }

      const widthScale = availableWidth / basePageWidth;
      const heightScale = availableHeight / basePageHeight;
      const fitScale = Math.max(MIN_SCALE, Math.min(widthScale, heightScale));
      setFitScale(pane, fitScale);

      if (fullscreenMode) {
        lastAvailableWidthRef.current = availableWidth;
        lastMeasuredUserScaleRef.current = latestUserScaleRef.current;
        return;
      }

      const previousAvailableWidth = lastAvailableWidthRef.current;
      const currentUserScale = latestUserScaleRef.current;
      const previousMeasuredScale = lastMeasuredUserScaleRef.current;
      const currentRenderedWidth = basePageWidth * currentUserScale;

      const isInitialMeasure = previousAvailableWidth === null;
      const paneBecameNarrower =
        previousAvailableWidth !== null &&
        availableWidth < previousAvailableWidth - 2;
      const scaleChangedSinceLastMeasure =
        Math.abs(currentUserScale - previousMeasuredScale) > SCALE_EPSILON;

      const currentRenderedHeight = basePageHeight * currentUserScale;

      const shouldAutoShrink =
        !scaleChangedSinceLastMeasure &&
        (isInitialMeasure || paneBecameNarrower) &&
        (currentRenderedWidth > availableWidth ||
          currentRenderedHeight > availableHeight);

      if (shouldAutoShrink) {
        const nextScale = Math.max(MIN_SCALE, fitScale);

        if (nextScale < currentUserScale) {
          pendingScaleAnchorRef.current = getScrollAnchor();
          setUserScale(pane, nextScale);
        }
      }

      lastAvailableWidthRef.current = availableWidth;
      lastMeasuredUserScaleRef.current = currentUserScale;
    };

    const observer = new ResizeObserver(() => {
      window.requestAnimationFrame(updateFitAndShrinkIfNeeded);
    });

    observer.observe(container);
    window.requestAnimationFrame(updateFitAndShrinkIfNeeded);

    return () => observer.disconnect();
  }, [pane, basePageWidth, basePageHeight, fullscreenMode, setFitScale, setUserScale]);

  useEffect(() => {
    if (!pdf) {
      return;
    }

    if (initialScrollDoneRef.current) {
      return;
    }

    const targetPage = paneState.pageNumber;
    let cancelled = false;
    let attempts = 0;

    suppressPageDetectUntilRef.current = Date.now() + 1500;

    const tryScroll = () => {
      if (cancelled || initialScrollDoneRef.current) {
        return;
      }

      attempts += 1;

      const didScroll = scrollToPage(targetPage, "auto");

      if (didScroll) {
        initialScrollDoneRef.current = true;
        suppressPageDetectUntilRef.current = Date.now() + 500;
        latestStableAnchorRef.current = getScrollAnchor();
        return;
      }

      if (attempts < 30) {
        window.setTimeout(tryScroll, 50);
      } else {
        initialScrollDoneRef.current = true;
        suppressPageDetectUntilRef.current = Date.now() + 300;
        latestStableAnchorRef.current = getScrollAnchor();
      }
    };

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(tryScroll);
    });

    return () => {
      cancelled = true;
    };
  }, [pdf, paneState.pageNumber]);

  useEffect(() => {
    if (!pdf) {
      return;
    }

    if (paneState.jumpRequestId === lastJumpRequestIdRef.current) {
      return;
    }

    lastJumpRequestIdRef.current = paneState.jumpRequestId;

    window.requestAnimationFrame(() => {
      const didScroll = scrollToPage(paneState.pageNumber, "smooth");

      if (!didScroll) {
        window.setTimeout(() => {
          scrollToPage(paneState.pageNumber, "smooth");
        }, 80);
      }
    });
  }, [pdf, paneState.jumpRequestId, paneState.pageNumber, fullscreenMode]);

  useLayoutEffect(() => {
    if (!pdf) {
      return;
    }

    const previousScale = previousScaleRef.current;

    if (previousScale === paneState.userScale) {
      latestStableAnchorRef.current = getScrollAnchor();
      return;
    }

    // 重要:
    // scale 変更後のDOMで getScrollAnchor() を取り直すと、すでに左上基準に寄った状態を
    // anchor として保存してしまう。必ず scale 変更前に保存済みの anchor を使って復元する。
    const anchor = pendingScaleAnchorRef.current ?? latestStableAnchorRef.current;

    previousScaleRef.current = paneState.userScale;

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        restoreScrollAnchor(anchor);
        pendingScaleAnchorRef.current = null;
        suppressPageDetectUntilRef.current = Date.now() + 300;
      });
    });
  }, [pdf, paneState.userScale]);

  useEffect(() => {
    if (!pdf) {
      lastFullscreenModeRef.current = fullscreenMode;
      return;
    }

    const wasFullscreen = lastFullscreenModeRef.current;
    lastFullscreenModeRef.current = fullscreenMode;

    if (fullscreenMode && !wasFullscreen) {
      const startPage = getDominantVisiblePage();
      setPageNumber(pane, startPage);
      fullscreenAnchorRef.current = getScrollAnchor();
      latestStableAnchorRef.current = fullscreenAnchorRef.current;
      suppressPageDetectUntilRef.current = Date.now() + 500;
      return;
    }

    if (!fullscreenMode && wasFullscreen) {
      const anchor = fullscreenAnchorRef.current ?? latestStableAnchorRef.current;

      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          restoreScrollAnchor(anchor);
          suppressPageDetectUntilRef.current = Date.now() + 500;
        });
      });
    }
  }, [fullscreenMode, pdf, pane, setPageNumber]);

  const updateDominantVisiblePage = () => {
    if (!pdf) {
      return;
    }

    if (!initialScrollDoneRef.current) {
      return;
    }

    if (Date.now() < suppressPageDetectUntilRef.current) {
      return;
    }

    const bestPage = getDominantVisiblePage();

    if (bestPage !== paneState.pageNumber) {
      setPageNumber(pane, bestPage);
    }
  };

  const handleScroll = () => {
    latestStableAnchorRef.current = getScrollAnchor();

    if (tickingRef.current) {
      return;
    }

    tickingRef.current = true;

    window.requestAnimationFrame(() => {
      latestStableAnchorRef.current = getScrollAnchor();
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

  const visiblePageNumbers = fullscreenMode
    ? [paneState.pageNumber]
    : Array.from({ length: pdf.numPages }, (_, index) => index + 1);

  return (
    <section
      ref={containerRef}
      className={isActive ? "pdf-pane active-pane" : "pdf-pane"}
      data-pane-id={pane}
      onScroll={handleScroll}
    >
      <div className="pane-status">
        {pane === "left" ? "左" : "右"} / p.{paneState.pageNumber} /{" "}
        {paneState.totalPages} / {Math.round(effectiveScale * 100)}%
      </div>

      {visiblePageNumbers.map((pageNumber) => {
        return (
          <div
            key={pageNumber}
            className="pdf-page-wrapper"
            ref={(element) => {
              pageRefs.current[pageNumber] = element;
            }}
            data-page-wrapper={pageNumber}
          >
            <PdfPage
              pane={pane}
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
