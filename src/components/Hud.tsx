import type { PanelId } from "../App";

type Props = {
  totalLP: number;
  paintMode: boolean;
  onOpenPanel: (panel: PanelId) => void;
  onTogglePaint: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitTree: () => void;
};

export default function Hud({
  totalLP,
  paintMode,
  onOpenPanel,
  onTogglePaint,
  onZoomIn,
  onZoomOut,
  onFitTree,
}: Props) {
  return (
    <div className="hud">
      <span className="hud-lp">{totalLP} LP</span>
      <button className="btn-primary" onClick={() => onOpenPanel("selfCare")}>Self-Care</button>
      <button onClick={onTogglePaint} aria-pressed={paintMode}>
        Paint
      </button>
      <button onClick={() => onOpenPanel("journal")}>Journal</button>
      <button onClick={() => onOpenPanel("relics")}>Relics</button>
      <button onClick={() => onOpenPanel("settings")}>Settings</button>
      <span className="hud-zoom">
        <button className="btn-icon" onClick={onZoomIn} aria-label="Zoom in">+</button>
        <button className="btn-icon" onClick={onZoomOut} aria-label="Zoom out">−</button>
        <button className="btn-icon" onClick={onFitTree} aria-label="Fit tree">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M1 5V1h4M11 1h4v4M15 11v4h-4M5 15H1v-4" />
          </svg>
        </button>
      </span>
    </div>
  );
}
