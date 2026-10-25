import { useState } from "react";
import { COLORS } from "../game/activities";
import { LEAF } from "../world/palette";
import { isCustomColor, type ColorId, type LeafColor } from "../types";

type Props = {
  colors: ColorId[];
  selectedColor: LeafColor;
  onSelectColor: (color: LeafColor) => void;
  canUndo: boolean;
  onUndo: () => void;
  onDone: () => void;
};

type Rgb = [number, number, number];

const CHANNELS = ["R", "G", "B"] as const;
const DEFAULT_MIX: Rgb = [255, 111, 168];

const toHex = (rgb: Rgb) => `#${rgb.map((c) => c.toString(16).padStart(2, "0")).join("")}` as const;

function fromHex(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

export default function PaintPalette({
  colors,
  selectedColor,
  onSelectColor,
  canUndo,
  onUndo,
  onDone,
}: Props) {
  const [mix, setMix] = useState<Rgb>(() => (isCustomColor(selectedColor) ? fromHex(selectedColor) : DEFAULT_MIX));
  const [mixing, setMixing] = useState(false);
  const mixHex = toHex(mix);

  function setChannel(index: number, value: number) {
    const next = mix.map((c, i) => (i === index ? value : c)) as Rgb;
    setMix(next);
    onSelectColor(toHex(next));
  }

  return (
    <div className="palette" role="toolbar" aria-label="Leaf colours">
      {mixing && (
        <div className="mixer" role="group" aria-label="Mix a colour">
          <span className="mixer-preview" style={{ background: mixHex }} aria-hidden />
          {CHANNELS.map((channel, i) => (
            <label key={channel} className="mixer-channel">
              {channel}
              <input
                type="range"
                min={0}
                max={255}
                value={mix[i]}
                onChange={(e) => setChannel(i, Number(e.target.value))}
                style={{ accentColor: ["#ff5a5a", "#5ad66b", "#5a8cff"][i] }}
              />
              <output>{mix[i]}</output>
            </label>
          ))}
          <code className="mixer-hex">{mixHex}</code>
        </div>
      )}
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
      <button
        aria-pressed={isCustomColor(selectedColor)}
        aria-expanded={mixing}
        onClick={() => {
          onSelectColor(mixHex);
          setMixing((open) => !open);
        }}
      >
        <span className="swatch" style={{ background: mixHex }} aria-hidden />
        Mix
      </button>
      <button onClick={onUndo} disabled={!canUndo}>
        Undo
      </button>
      <button className="btn-primary" onClick={onDone}>Done</button>
    </div>
  );
}
