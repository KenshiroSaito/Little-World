import type { RelicId, Segment } from '../types.ts'
import { RELIC_TILES, RUIN, SAPLING, WORLD, WORLD_COLS, WORLD_ROWS, type Point } from './layout.ts'
import { DARK_RGB, GLOW_RGB } from './palette.ts'

const ROOT_RADIUS = 4.5
const RELIC_RADIUS = 2.5
const RUIN_HALO = 3
const SURFACE_REACH = 3.2
const LEVELS = 4
const MAX_DARK = 0.94

/** Light per tile from 0 (dark) to 1, row-major over the world grid, in a few steps. */
export function computeLight(
  segments: readonly Segment[],
  revealedRelics: readonly RelicId[],
  ruinLit: boolean,
): Float32Array {
  const light = new Float32Array(WORLD_COLS * WORLD_ROWS)
  const index = (x: number, y: number) =>
    x < WORLD.left || x > WORLD.right || y < WORLD.top || y > WORLD.bottom
      ? -1
      : (y - WORLD.top) * WORLD_COLS + (x - WORLD.left)
  const raise = (x: number, y: number, v: number) => {
    const i = index(x, y)
    if (i >= 0 && v > light[i]) light[i] = v
  }
  const glow = (cx: number, cy: number, radius: number) => {
    const r = Math.ceil(radius)
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) raise(cx + dx, cy + dy, 1 - Math.hypot(dx, dy) / radius)
    }
  }

  // Daylight reaches a few tiles into the topsoil.
  for (let y = WORLD.top; y <= WORLD.bottom; y++) {
    const v = y <= 0 ? 1 : Math.max(0, 1 - y / SURFACE_REACH)
    for (let x = WORLD.left; x <= WORLD.right; x++) light[index(x, y)] = v
  }

  const lit = new Set<number>()
  const trace = (from: Point, to: Point) => {
    const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) * 4))
    for (let i = 0; i <= steps; i++) {
      const x = Math.round(from.x + ((to.x - from.x) * i) / steps)
      const y = Math.round(from.y + ((to.y - from.y) * i) / steps)
      const key = index(x, y)
      if (key < 0 || lit.has(key)) continue
      lit.add(key)
      glow(x, y, ROOT_RADIUS)
    }
  }
  trace(SAPLING.base, SAPLING.rootTip)
  for (const s of segments) if (s.kind === 'root') trace(s.from, s.to)

  for (const id of revealedRelics) glow(RELIC_TILES[id].x, RELIC_TILES[id].y, RELIC_RADIUS)

  if (ruinLit) {
    for (let y = RUIN.top - RUIN_HALO; y <= RUIN.bottom + RUIN_HALO; y++) {
      for (let x = RUIN.left - RUIN_HALO; x <= RUIN.right + RUIN_HALO; x++) {
        const dx = Math.max(RUIN.left - x, 0, x - RUIN.right)
        const dy = Math.max(RUIN.top - y, 0, y - RUIN.bottom)
        raise(x, y, 1 - Math.hypot(dx, dy) / (RUIN_HALO + 1))
      }
    }
  }

  for (let i = 0; i < light.length; i++) light[i] = Math.round(Math.max(0, light[i]) * LEVELS) / LEVELS
  return light
}

/** One pixel per tile; the renderer scales it up by TILE with smoothing off. */
export function paintLight(ctx: CanvasRenderingContext2D, light: Float32Array): void {
  const img = ctx.createImageData(WORLD_COLS, WORLD_ROWS)
  const d = img.data
  for (let i = 0; i < light.length; i++) {
    const v = light[i]
    d[i * 4] = DARK_RGB[0] + (GLOW_RGB[0] - DARK_RGB[0]) * v
    d[i * 4 + 1] = DARK_RGB[1] + (GLOW_RGB[1] - DARK_RGB[1]) * v
    d[i * 4 + 2] = DARK_RGB[2] + (GLOW_RGB[2] - DARK_RGB[2]) * v
    d[i * 4 + 3] = Math.round((1 - v) * MAX_DARK * 255)
  }
  ctx.putImageData(img, 0, 0)
}
