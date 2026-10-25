import type { ActivityId } from "../types";

// 8×8 pixel icons for the Self-Care panel, one character per pixel ("." is clear).
const ICONS: Record<ActivityId, { rows: string[]; colors: Record<string, string> }> = {
  walk: {
    rows: ["..GGG...", "..GgG...", "..GgG...", "..GgGG..", "..GggGGG", ".GgggggG", ".GGGGGGG", "........"],
    colors: { G: "#76ff03", g: "#3f9900" },
  },
  connect: {
    rows: ["........", ".OO..OO.", "OwOOOOOO", "OOOOOOOo", ".OOOOOo.", "..OOOo..", "...Oo...", "........"],
    colors: { O: "#ff9800", o: "#c96a00", w: "#ffd08a" },
  },
  break: {
    rows: ["..s.s...", ".s.s....", "TTTTT...", "TtttTTT.", "TtttT.T.", "TtttTTT.", "TTTTT...", "........"],
    colors: { T: "#00bcd4", t: "#006f7d", s: "#8eeaf5" },
  },
  reflect: {
    rows: ["........", "LLLlLLL.", "LppLppL.", "LppLppL.", "LppLppL.", "LLLlLLL.", ".lllll..", "........"],
    colors: { L: "#ba68c8", l: "#7a3488", p: "#e6b8ee" },
  },
};

export default function ActivityIcon({ id }: { id: ActivityId }) {
  const { rows, colors } = ICONS[id];
  return (
    <span className="activity-icon" aria-hidden>
      <svg viewBox="0 0 8 8" width="24" height="24" shapeRendering="crispEdges">
        {rows.flatMap((row, y) =>
          [...row].map((c, x) => (colors[c] ? <rect key={`${x},${y}`} x={x} y={y} width="1" height="1" fill={colors[c]} /> : null)),
        )}
      </svg>
    </span>
  );
}
