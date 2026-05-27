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
};

const MIN_SCALE = 0.35;
const MAX_SCALE = 3;

const initialPaneState: PaneState = {
  pdfUrl: null,
  title: "未読み込み",
  pageNumber: 1,
  totalPages: 0,
  userScale: 1.2,
  fitScale: MAX_SCALE,
  jumpRequestId: 0,
};

function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, Number(scale.toFixed(2))));
}

function clampPage(pageNumber: number, totalPages: number): number {
  if (!Number.isFinite(pageNumber)) {
    return 1;
  }

  const integerPage = Math.floor(pageNumber);

  if (totalPages > 0) {
    return Math.min(Math.max(1, integerPage), totalPages);
  }

  return Math.max(1, integerPage);
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
          fitScale: MAX_SCALE,
          jumpRequestId: state.panes[pane].jumpRequestId + 1,
        },
      },
    })),

  clearPdf: (pane) =>
    set((state) => ({
      panes: {
        ...state.panes,
        [pane]: { ...initialPaneState },
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
      const safeTotalPages = Math.max(0, totalPages);

      return {
        panes: {
          ...state.panes,
          [pane]: {
            ...current,
            totalPages: safeTotalPages,
            pageNumber: clampPage(current.pageNumber, safeTotalPages),
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
      const left = state.panes.left;

      if (!left.pdfUrl) {
        return state;
      }

      const preferredPage = clampPage(
        left.pageNumber + 1,
        left.totalPages || left.pageNumber + 1
      );

      return {
        panes: {
          ...state.panes,
          right: {
            ...state.panes.right,
            pdfUrl: left.pdfUrl,
            title: `${left.title} / 別ページ`,
            pageNumber: preferredPage,
            totalPages: left.totalPages,
            userScale: left.userScale,
            fitScale: MAX_SCALE,
            jumpRequestId: state.panes.right.jumpRequestId + 1,
          },
        },
      };
    }),
}));