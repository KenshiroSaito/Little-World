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
      <button onClick={() => onOpenPanel("selfCare")}>Self-Care</button>
      <button onClick={onTogglePaint} aria-pressed={paintMode}>
        Paint
      </button>
      <button onClick={() => onOpenPanel("relics")}>Relics</button>
      <button onClick={() => onOpenPanel("settings")}>Settings</button>
      <span className="hud-zoom">
        <button onClick={onZoomOut} aria-label="Zoom out">−</button>
        <button onClick={onZoomIn} aria-label="Zoom in">+</button>
        <button onClick={onFitTree}>Fit tree</button>
      </span>
    </div>
  );
}
