import { create } from "zustand";
import type { PaneId } from "../types/pdf";

export type DrawPoint = {
  x: number;
  y: number;
};

export type DrawStroke = {
  id: string;
  pane: PaneId;
  page: number;
  color: string;
  width: number;
  points: DrawPoint[];
};

type PdfDrawingState = {
  drawingMode: boolean;
  penColor: string;
  penWidth: number;
  strokes: DrawStroke[];

  setDrawingMode: (enabled: boolean) => void;
  toggleDrawingMode: () => void;
  setPenColor: (color: string) => void;
  setPenWidth: (width: number) => void;

  addStroke: (stroke: DrawStroke) => void;
  undoStroke: (pane?: PaneId, page?: number) => void;
  clearStrokes: (pane?: PaneId, page?: number) => void;
  clearPaneStrokes: (pane: PaneId) => void;
  swapPaneStrokes: () => void;
};

export const usePdfDrawingStore = create<PdfDrawingState>((set) => ({
  drawingMode: false,
  penColor: "#ef4444",
  penWidth: 3,
  strokes: [],

  setDrawingMode: (enabled) => {
    set({ drawingMode: enabled });
  },

  toggleDrawingMode: () => {
    set((state) => ({
      drawingMode: !state.drawingMode,
    }));
  },

  setPenColor: (color) => {
    set({ penColor: color });
  },

  setPenWidth: (width) => {
    set({
      penWidth: Math.min(32, Math.max(1, Math.floor(width))),
    });
  },

  addStroke: (stroke) => {
    set((state) => ({
      strokes: [...state.strokes, stroke],
    }));
  },

  undoStroke: (pane, page) => {
    set((state) => {
        const targetIndex = [...state.strokes]
        .map((stroke, index) => ({ stroke, index }))
        .reverse()
        .find(({ stroke }) => {
            if (pane && stroke.pane !== pane) return false;
            if (typeof page === "number" && stroke.page !== page) return false;
            return true;
        })?.index;

        if (typeof targetIndex !== "number") {
        return state;
        }

        return {
        strokes: state.strokes.filter((_, index) => index !== targetIndex),
        };
    });
  },

  clearStrokes: (pane, page) => {
    set((state) => ({
      strokes: state.strokes.filter((stroke) => {
        if (pane && stroke.pane !== pane) return true;
        if (typeof page === "number" && stroke.page !== page) return true;
        return false;
      }),
    }));
  },

  clearPaneStrokes: (pane) => {
    set((state) => ({
      strokes: state.strokes.filter((stroke) => stroke.pane !== pane),
    }));
  },

  swapPaneStrokes: () => {
    set((state) => ({
      strokes: state.strokes.map((stroke) => ({
        ...stroke,
        pane: stroke.pane === "left" ? "right" : "left",
      })),
    }));
  },
}));