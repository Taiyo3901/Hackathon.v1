import { create } from "zustand";
import type { HighlightTarget } from "../types/pdf";

type HighlightState = {
  activeHighlight: HighlightTarget | null;

  setHighlight: (highlight: HighlightTarget) => void;
  clearHighlight: () => void;
  clearOutlineHighlight: () => void;
};

export const useHighlightStore = create<HighlightState>((set, get) => ({
  activeHighlight: null,

  setHighlight: (highlight) =>
    set({
      activeHighlight: highlight,
    }),

  clearHighlight: () =>
    set({
      activeHighlight: null,
    }),

  clearOutlineHighlight: () => {
    const current = get().activeHighlight;

    if (current?.source === "outline") {
      set({
        activeHighlight: null,
      });
    }
  },
}));