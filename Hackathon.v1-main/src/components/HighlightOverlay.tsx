import { useHighlightStore } from "../store/highlightStore";
import type { PaneId } from "../types/pdf";

type HighlightOverlayProps = {
  pane: PaneId;
  pageNumber: number;
};

export function HighlightOverlay({ pane, pageNumber }: HighlightOverlayProps) {
  const activeHighlight = useHighlightStore((state) => state.activeHighlight);

  if (!activeHighlight) {
    return null;
  }

  if (activeHighlight.pane !== pane || activeHighlight.page !== pageNumber) {
    return null;
  }

  const rect = activeHighlight.rect;

  return (
    <div
      className="highlight-overlay"
      style={{
        position: "absolute",
        left: `${rect.x}px`,
        top: `${rect.y}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        background: "rgba(255, 230, 0, 0.32)",
        border: "2px solid rgba(255, 200, 0, 0.9)",
        borderRadius: "4px",
        pointerEvents: "none",
        zIndex: 15,
      }}
      title={activeHighlight.label}
    />
  );
}
``