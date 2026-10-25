import { COLORS } from "../game/activities";
import { LEAF } from "../world/palette";
import type { ColorId } from "../types";

type Props = {
  colors: ColorId[];
  selectedColor: ColorId;
  onSelectColor: (colorId: ColorId) => void;
  canUndo: boolean;
  onUndo: () => void;
  onDone: () => void;
};

export default function PaintPalette({
  colors,
  selectedColor,
  onSelectColor,
  canUndo,
  onUndo,
  onDone,
}: Props) {
  return (
    <div className="palette" role="toolbar" aria-label="Leaf colours">
      {colors.map((id) => {
        const name = COLORS.find((c) => c.id === id)?.name ?? id;
        return (
          <button
            key={id}
            aria-pressed={selectedColor === id}
            onClick={() => onSelectColor(id)}
          >
            <span className="swatch" style={{ background: LEAF[id].mid }} aria-hidden />
            {name}
          </button>
        );
      })}
      <button onClick={onUndo} disabled={!canUndo}>
        Undo
      </button>
      <button onClick={onDone}>Done</button>
    </div>
  );
}
