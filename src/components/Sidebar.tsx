import type { ChangeEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import type { FormulaCandidate, PaneId } from "../types/pdf";
import { copyLatexToClipboard } from "../pdf/formula";
import { useViewerStore } from "../store/viewerStore";

type SidebarProps = {
  formulas: FormulaCandidate[];
  debugTextLayer: boolean;
  collapsed: boolean;
  onToggleSidebar: () => void;
  onToggleDebugTextLayer: () => void;
};

type SidebarTab = "controls" | "latex";

export function Sidebar({
  formulas,
  debugTextLayer,
  collapsed,
  onToggleSidebar,
  onToggleDebugTextLayer,
}: SidebarProps) {
  const [tab, setTab] = useState<SidebarTab>("controls");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [isLeftControlsOpen, setIsLeftControlsOpen] = useState(true);
  const [isRightControlsOpen, setIsRightControlsOpen] = useState(true);
  const [isLatexLeftOpen, setIsLatexLeftOpen] = useState(true);
  const [isLatexRightOpen, setIsLatexRightOpen] = useState(true);

  const panes = useViewerStore((state) => state.panes);
  const loadPdf = useViewerStore((state) => state.loadPdf);
  const clearPdf = useViewerStore((state) => state.clearPdf);
  const jumpToPage = useViewerStore((state) => state.jumpToPage);
  const zoomIn = useViewerStore((state) => state.zoomIn);
  const zoomOut = useViewerStore((state) => state.zoomOut);
  const openLeftPdfOnRightDifferentPage = useViewerStore(
    (state) => state.openLeftPdfOnRightDifferentPage
  );

  const formulasByPane = useMemo(() => {
    return {
      left: formulas.filter((formula) => formula.pane === "left"),
      right: formulas.filter((formula) => formula.pane === "right"),
    };
  }, [formulas]);

  const handleFileChange = (
    pane: PaneId,
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) return;

    const url = URL.createObjectURL(file);
    loadPdf(pane, url, file.name);

    event.target.value = "";
  };

  const effectiveLeftScale = Math.min(panes.left.userScale, panes.left.fitScale);
  const effectiveRightScale = Math.min(
    panes.right.userScale,
    panes.right.fitScale
  );

  const copyOne = async (formula: FormulaCandidate) => {
    await copyLatexToClipboard(formula.latex);
    setCopiedId(formula.id);

    window.setTimeout(() => {
      setCopiedId(null);
    }, 1200);
  };

  const copyAllCurrentPage = async () => {
    const text = formulas
      .map((formula) => `% ${formula.pane} p.${formula.page}\n${formula.latex}`)
      .join("\n\n");

    await copyLatexToClipboard(text);
    setCopiedId("all");

    window.setTimeout(() => {
      setCopiedId(null);
    }, 1200);
  };

  if (collapsed) {
    return (
      <aside className="sidebar sidebar-mini">
        <button className="sidebar-toggle" onClick={onToggleSidebar}>
          ▶
        </button>
      </aside>
    );
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-title-row">
        <h1>Paper PDF Analyzer</h1>
        <button className="sidebar-toggle" onClick={onToggleSidebar}>
          ◀
        </button>
      </div>

      <div className="sidebar-tabs">
        <button
          className={tab === "controls" ? "active" : ""}
          onClick={() => setTab("controls")}
        >
          操作
        </button>

        <button
          className={tab === "latex" ? "active" : ""}
          onClick={() => setTab("latex")}
        >
          LaTeX
        </button>
      </div>

      {tab === "controls" && (
        <div className="sidebar-content">
          <button onClick={openLeftPdfOnRightDifferentPage}>
            左PDFの別ページを右に開く
          </button>

          <button onClick={onToggleDebugTextLayer}>
            TextLayer Debug: {debugTextLayer ? "ON" : "OFF"}
          </button>

          <CollapsibleSection
            title="左ペイン操作"
            open={isLeftControlsOpen}
            onToggle={() => setIsLeftControlsOpen((value) => !value)}
          >
            <PaneControls
              pane="left"
              fileName={panes.left.title}
              pageNumber={panes.left.pageNumber}
              totalPages={panes.left.totalPages}
              userScale={panes.left.userScale}
              effectiveScale={effectiveLeftScale}
              onFileChange={handleFileChange}
              onClear={clearPdf}
              onJumpPage={jumpToPage}
              onZoomIn={() => zoomIn("left")}
              onZoomOut={() => zoomOut("left")}
            />
          </CollapsibleSection>

          <CollapsibleSection
            title="右ペイン操作"
            open={isRightControlsOpen}
            onToggle={() => setIsRightControlsOpen((value) => !value)}
          >
            <PaneControls
              pane="right"
              fileName={panes.right.title}
              pageNumber={panes.right.pageNumber}
              totalPages={panes.right.totalPages}
              userScale={panes.right.userScale}
              effectiveScale={effectiveRightScale}
              onFileChange={handleFileChange}
              onClear={clearPdf}
              onJumpPage={jumpToPage}
              onZoomIn={() => zoomIn("right")}
              onZoomOut={() => zoomOut("right")}
            />
          </CollapsibleSection>
        </div>
      )}

      {tab === "latex" && (
        <div className="sidebar-content">
          <button onClick={copyAllCurrentPage} disabled={formulas.length === 0}>
            表示中ページのLaTeXを全部コピー
          </button>

          {copiedId === "all" && <div className="copied">コピーしました</div>}

          <CollapsibleSection
            title={`左ペイン LaTeX (${formulasByPane.left.length})`}
            open={isLatexLeftOpen}
            onToggle={() => setIsLatexLeftOpen((value) => !value)}
          >
            <FormulaList
              formulas={formulasByPane.left}
              copiedId={copiedId}
              onCopy={copyOne}
            />
          </CollapsibleSection>

          <CollapsibleSection
            title={`右ペイン LaTeX (${formulasByPane.right.length})`}
            open={isLatexRightOpen}
            onToggle={() => setIsLatexRightOpen((value) => !value)}
          >
            <FormulaList
              formulas={formulasByPane.right}
              copiedId={copiedId}
              onCopy={copyOne}
            />
          </CollapsibleSection>
        </div>
      )}
    </aside>
  );
}

type CollapsibleSectionProps = {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
};

function CollapsibleSection({
  title,
  open,
  onToggle,
  children,
}: CollapsibleSectionProps) {
  return (
    <section className="collapsible-section">
      <button className="collapsible-header" onClick={onToggle}>
        <span>{open ? "▼" : "▶"}</span>
        <span>{title}</span>
      </button>

      {open && <div className="collapsible-body">{children}</div>}
    </section>
  );
}

type PaneControlsProps = {
  pane: PaneId;
  fileName: string;
  pageNumber: number;
  totalPages: number;
  userScale: number;
  effectiveScale: number;
  onFileChange: (pane: PaneId, event: ChangeEvent<HTMLInputElement>) => void;
  onClear: (pane: PaneId) => void;
  onJumpPage: (pane: PaneId, pageNumber: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
};

function PaneControls({
  pane,
  fileName,
  pageNumber,
  totalPages,
  userScale,
  effectiveScale,
  onFileChange,
  onClear,
  onJumpPage,
  onZoomIn,
  onZoomOut,
}: PaneControlsProps) {
  const [pageInput, setPageInput] = useState(String(pageNumber));

  useEffect(() => {
    setPageInput(String(pageNumber));
  }, [pageNumber]);

  const jump = () => {
    const parsed = Number(pageInput);

    if (!Number.isFinite(parsed)) {
      setPageInput(String(pageNumber));
      return;
    }

    const safePage =
      totalPages > 0
        ? Math.min(Math.max(1, Math.floor(parsed)), totalPages)
        : Math.max(1, Math.floor(parsed));

    setPageInput(String(safePage));
    onJumpPage(pane, safePage);
  };

  return (
    <div className="pane-controls-inner">
      <div className="file-name">{fileName}</div>

      <label className="file-button">
        PDFを読み込む
        <input
          type="file"
          accept="application/pdf"
          onChange={(event) => onFileChange(pane, event)}
        />
      </label>

      <button onClick={() => onClear(pane)}>クリア</button>

      <div className="control-row">
        <button onClick={onZoomOut}>-</button>
        <span>手動 {Math.round(userScale * 100)}%</span>
        <button onClick={onZoomIn}>+</button>
      </div>

      <div className="page-info">
        表示倍率: {Math.round(effectiveScale * 100)}%
      </div>

      <div className="page-jump-row">
        <span>ページ</span>

        <input
          className="page-jump-input"
          type="number"
          min={1}
          max={totalPages || undefined}
          value={pageInput}
          onChange={(event) => setPageInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              jump();
            }
          }}
          onBlur={jump}
        />

        <span>/ {totalPages || "-"}</span>

        <button onClick={jump}>移動</button>
      </div>

      <div className="hint">
        通常スクロール: ページ移動 / pinch or Ctrl+wheel: PDFズーム
      </div>
    </div>
  );
}

type FormulaListProps = {
  formulas: FormulaCandidate[];
  copiedId: string | null;
  onCopy: (formula: FormulaCandidate) => void;
};

function FormulaList({ formulas, copiedId, onCopy }: FormulaListProps) {
  return (
    <div className="formula-list">
      {formulas.length === 0 && (
        <div className="empty-message">数式候補なし</div>
      )}

      {formulas.map((formula) => (
        <div key={formula.id} className="formula-card">
          <div className="formula-meta">
            p.{formula.page} / score {formula.score}
          </div>

          <div className="formula-raw">{formula.rawText}</div>

          <pre className="formula-latex">{formula.latex}</pre>

          <button onClick={() => onCopy(formula)}>
            {copiedId === formula.id ? "コピー済み" : "LaTeXコピー"}
          </button>
        </div>
      ))}
    </div>
  );
}