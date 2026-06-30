import { create } from "zustand";
import type { PaneId } from "../types/pdf";

type PdfSourceState = {
  pdfBytesByPane: Partial<Record<PaneId, ArrayBuffer>>;
  setPdfBytes: (pane: PaneId, bytes: ArrayBuffer) => void;
  clearPdfBytes: (pane: PaneId) => void;
  copyPdfBytes: (from: PaneId, to: PaneId) => void;
  swapPdfBytes: () => void;
};

export const usePdfSourceStore = create<PdfSourceState>((set) => ({
  pdfBytesByPane: {},

  setPdfBytes: (pane, bytes) =>
    set((state) => ({
      pdfBytesByPane: {
        ...state.pdfBytesByPane,
        [pane]: bytes.slice(0),
      },
    })),

  clearPdfBytes: (pane) =>
    set((state) => {
      const next: Partial<Record<PaneId, ArrayBuffer>> = {
        ...state.pdfBytesByPane,
      };
      delete next[pane];
      return { pdfBytesByPane: next };
    }),

  copyPdfBytes: (from, to) =>
    set((state) => {
      const source = state.pdfBytesByPane[from];
      if (!source) return state;
      return {
        pdfBytesByPane: {
          ...state.pdfBytesByPane,
          [to]: source.slice(0),
        },
      };
    }),

  swapPdfBytes: () =>
    set((state) => {
      const next: Partial<Record<PaneId, ArrayBuffer>> = {};
      if (state.pdfBytesByPane.right) next.left = state.pdfBytesByPane.right.slice(0);
      if (state.pdfBytesByPane.left) next.right = state.pdfBytesByPane.left.slice(0);
      return { pdfBytesByPane: next };
    }),
}));
