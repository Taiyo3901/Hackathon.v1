import { create } from "zustand";
import type { PaneId, PdfPageViewportInfo, PdfTextBox } from "../types/pdf";

type PdfTextBoxState = {
  textBoxAddArmed: boolean;
  selectedTextBoxId: string | null;
  textBoxes: PdfTextBox[];
  viewportInfos: PdfPageViewportInfo[];
  armTextBoxAdd: () => void;
  cancelTextBoxAdd: () => void;
  addTextBox: (box: PdfTextBox) => void;
  updateTextBox: (id: string, patch: Partial<PdfTextBox>) => void;
  removeTextBox: (id: string) => void;
  clearPaneTextBoxes: (pane: PaneId) => void;
  swapPaneTextBoxes: () => void;
  selectTextBox: (id: string | null) => void;
  setViewportInfo: (info: PdfPageViewportInfo) => void;
};

export const usePdfTextBoxStore = create<PdfTextBoxState>((set) => ({
  textBoxAddArmed: false,
  selectedTextBoxId: null,
  textBoxes: [],
  viewportInfos: [],

  armTextBoxAdd: () => set({ textBoxAddArmed: true, selectedTextBoxId: null }),
  cancelTextBoxAdd: () => set({ textBoxAddArmed: false }),

  addTextBox: (box) =>
    set((state) => ({
      textBoxes: [...state.textBoxes, box],
      selectedTextBoxId: box.id,
      textBoxAddArmed: false,
    })),

  updateTextBox: (id, patch) =>
    set((state) => ({
      textBoxes: state.textBoxes.map((box) =>
        box.id === id ? { ...box, ...patch } : box
      ),
    })),

  removeTextBox: (id) =>
    set((state) => ({
      textBoxes: state.textBoxes.filter((box) => box.id !== id),
      selectedTextBoxId: state.selectedTextBoxId === id ? null : state.selectedTextBoxId,
    })),

  clearPaneTextBoxes: (pane) =>
    set((state) => ({
      textBoxes: state.textBoxes.filter((box) => box.pane !== pane),
      viewportInfos: state.viewportInfos.filter((info) => info.pane !== pane),
      selectedTextBoxId: null,
      textBoxAddArmed: false,
    })),

  swapPaneTextBoxes: () =>
    set((state) => ({
      textBoxes: state.textBoxes.map((box) => ({
        ...box,
        pane: box.pane === "left" ? "right" : "left",
      })),
      viewportInfos: state.viewportInfos.map((info) => ({
        ...info,
        pane: info.pane === "left" ? "right" : "left",
      })),
      selectedTextBoxId: null,
      textBoxAddArmed: false,
    })),

  selectTextBox: (id) => set({ selectedTextBoxId: id, textBoxAddArmed: false }),

  setViewportInfo: (info) =>
    set((state) => ({
      viewportInfos: [
        ...state.viewportInfos.filter(
          (current) => !(current.pane === info.pane && current.page === info.page)
        ),
        info,
      ],
    })),
}));
