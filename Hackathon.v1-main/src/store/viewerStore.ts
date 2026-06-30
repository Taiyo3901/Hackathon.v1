import { create } from "zustand";
import type { PaneId } from "../types/pdf";

export type PaneState = {
  pdfUrl: string | null;
  title: string;
  pageNumber: number;
  totalPages: number;
  userScale: number;
  fitScale: number;
  jumpRequestId: number;
};

type ViewerState = {
  panes: Record<PaneId, PaneState>;

  loadPdf: (pane: PaneId, url: string, title?: string) => void;
  clearPdf: (pane: PaneId) => void;

  setPageNumber: (pane: PaneId, pageNumber: number) => void;
  jumpToPage: (pane: PaneId, pageNumber: number) => void;
  setTotalPages: (pane: PaneId, totalPages: number) => void;

  zoomIn: (pane: PaneId) => void;
  zoomOut: (pane: PaneId) => void;

  setUserScale: (pane: PaneId, scale: number) => void;
  setFitScale: (pane: PaneId, fitScale: number) => void;

  openLeftPdfOnRightDifferentPage: () => void;
  swapPanes: () => void;
};

const MIN_SCALE = 0.25;
const MAX_SCALE = 6;

const initialPaneState: PaneState = {
  pdfUrl: null,
  title: "未読み込み",
  pageNumber: 1,
  totalPages: 0,
  userScale: 1.15,
  fitScale: MAX_SCALE,
  jumpRequestId: 0,
};

function clampScale(scale: number): number {
  return Math.min(
    MAX_SCALE,
    Math.max(MIN_SCALE, Number(scale.toFixed(2)))
  );
}

function clampPage(pageNumber: number, totalPages: number): number {
  if (!Number.isFinite(pageNumber)) {
    return 1;
  }

  const page = Math.floor(pageNumber);

  if (totalPages > 0) {
    return Math.min(Math.max(1, page), totalPages);
  }

  return Math.max(1, page);
}

export const useViewerStore = create<ViewerState>((set) => ({
  panes: {
    left: { ...initialPaneState },
    right: { ...initialPaneState },
  },

  loadPdf: (pane, url, title = "PDF") =>
    set((state) => ({
      panes: {
        ...state.panes,
        [pane]: {
          ...state.panes[pane],
          pdfUrl: url,
          title,
          pageNumber: 1,
          totalPages: 0,
          userScale: 1.15,
          fitScale: MAX_SCALE,
          jumpRequestId: state.panes[pane].jumpRequestId + 1,
        },
      },
    })),

  clearPdf: (pane) =>
    set((state) => ({
      panes: {
        ...state.panes,
        [pane]: {
          ...initialPaneState,
        },
      },
    })),

  setPageNumber: (pane, pageNumber) =>
    set((state) => {
      const current = state.panes[pane];
      const safePage = clampPage(pageNumber, current.totalPages);

      if (current.pageNumber === safePage) {
        return state;
      }

      return {
        panes: {
          ...state.panes,
          [pane]: {
            ...current,
            pageNumber: safePage,
          },
        },
      };
    }),

  jumpToPage: (pane, pageNumber) =>
    set((state) => {
      const current = state.panes[pane];
      const safePage = clampPage(pageNumber, current.totalPages);

      return {
        panes: {
          ...state.panes,
          [pane]: {
            ...current,
            pageNumber: safePage,
            jumpRequestId: current.jumpRequestId + 1,
          },
        },
      };
    }),

  setTotalPages: (pane, totalPages) =>
    set((state) => {
      const current = state.panes[pane];
      const safeTotal = Math.max(0, totalPages);

      return {
        panes: {
          ...state.panes,
          [pane]: {
            ...current,
            totalPages: safeTotal,
            pageNumber: clampPage(current.pageNumber, safeTotal),
          },
        },
      };
    }),

  zoomIn: (pane) =>
    set((state) => {
      const current = state.panes[pane];

      return {
        panes: {
          ...state.panes,
          [pane]: {
            ...current,
            userScale: clampScale(current.userScale + 0.15),
          },
        },
      };
    }),

  zoomOut: (pane) =>
    set((state) => {
      const current = state.panes[pane];

      return {
        panes: {
          ...state.panes,
          [pane]: {
            ...current,
            userScale: clampScale(current.userScale - 0.15),
          },
        },
      };
    }),

  setUserScale: (pane, scale) =>
    set((state) => {
      const current = state.panes[pane];
      const nextScale = clampScale(scale);

      if (current.userScale === nextScale) {
        return state;
      }

      return {
        panes: {
          ...state.panes,
          [pane]: {
            ...current,
            userScale: nextScale,
          },
        },
      };
    }),

  setFitScale: (pane, fitScale) =>
    set((state) => {
      const current = state.panes[pane];
      const nextFitScale = clampScale(fitScale);

      if (current.fitScale === nextFitScale) {
        return state;
      }

      return {
        panes: {
          ...state.panes,
          [pane]: {
            ...current,
            fitScale: nextFitScale,
          },
        },
      };
    }),

  openLeftPdfOnRightDifferentPage: () =>
    set((state) => {
      const leftPane = state.panes.left;
      const rightPane = state.panes.right;

      if (!leftPane.pdfUrl) {
        return state;
      }

      const leftCurrentPage = leftPane.pageNumber;
      const rightPage = leftCurrentPage;

      return {
        panes: {
          ...state.panes,

          left: {
            ...leftPane,
            pageNumber: leftCurrentPage,
          },

          right: {
            ...rightPane,
            pdfUrl: leftPane.pdfUrl,
            title: leftPane.title,
            totalPages: leftPane.totalPages,
            pageNumber: rightPage,
            userScale: leftPane.userScale,
            fitScale: leftPane.fitScale,
            jumpRequestId: rightPane.jumpRequestId + 1,
          },
        },
      };
    }),

  swapPanes: () =>
    set((state) => {
      const leftPane = state.panes.left;
      const rightPane = state.panes.right;

      return {
        panes: {
          left: {
            ...rightPane,

            // 入れ替え先、つまり左ペイン側の倍率を使う
            userScale: leftPane.userScale,
            fitScale: leftPane.fitScale,

            // ページ移動を確実に反映
            jumpRequestId: leftPane.jumpRequestId + 1,
          },

          right: {
            ...leftPane,

            // 入れ替え先、つまり右ペイン側の倍率を使う
            userScale: rightPane.userScale,
            fitScale: rightPane.fitScale,

            // ページ移動を確実に反映
            jumpRequestId: rightPane.jumpRequestId + 1,
          },
        },
      };
    }),
}));