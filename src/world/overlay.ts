import type { RelicId } from '../types.ts'
import { RELIC_TILES, RUIN, TABLET, TILE, tileToPx } from './layout.ts'
import { GLYPH_GLOW, HIGHLIGHT, RUIN_GLOW } from './palette.ts'
import { haloCanvas, outlineCanvas, spriteCanvas, type SpriteName } from './sprites.ts'
import { tabletGlyphLines } from './terrain.ts'

export const RELIC_SPRITES: Record<RelicId, SpriteName> = { carved_stone: 'carvedStone', heartwood_relic: 'heartwood' }
const RELIC_HALO: Record<RelicId, string> = { carved_stone: '140, 240, 215', heartwood_relic: '255, 200, 110' }

export type OverlayState = {
  relics: readonly RelicId[]
  ruinLit: boolean
  inscriptions: number
  /** What the pointer is over: an outline sprite at a world position, or the tablet. */
  hover: { canvas: HTMLCanvasElement; x: number; y: number } | 'tablet' | null
}

/**
 * Things drawn above the darkness: the lit ruin, carved lines for each
 * reflection, relics and the hover outline. With `glow`, the same things as
 * light sources for the bloom pass.
 */
export function drawOverlay(ctx: CanvasRenderingContext2D, s: OverlayState, glow: boolean): void {
  if (s.ruinLit) {
    const a = tileToPx({ x: RUIN.left, y: RUIN.top })
    const b = tileToPx({ x: RUIN.right, y: RUIN.bottom })
    // The warm wash is only for the eye; as a bloom source it would haze the whole underground.
    if (!glow) {
      ctx.fillStyle = RUIN_GLOW
      ctx.fillRect(a.x - TILE / 2, a.y - TILE / 2, b.x - a.x + TILE, b.y - a.y + TILE)
    }
    ctx.fillStyle = GLYPH_GLOW
    const lines = tabletGlyphLines()
    for (let i = 0; i < Math.min(lines.length, s.inscriptions); i++) {
      for (const p of lines[i]) ctx.fillRect(p.x, p.y, 1, 1)
    }
  }

  for (const id of s.relics) {
    const p = tileToPx(RELIC_TILES[id])
    const halo = haloCanvas(20, RELIC_HALO[id])
    ctx.drawImage(halo, p.x - halo.width / 2, p.y - halo.height / 2)
    ctx.drawImage(spriteCanvas(RELIC_SPRITES[id]), p.x - 8, p.y - 8)
  }

  if (s.hover === 'tablet') {
    const a = tileToPx({ x: TABLET.left, y: TABLET.top })
    const w = (TABLET.right - TABLET.left + 1) * TILE + 2
    const h = (TABLET.bottom - TABLET.top + 1) * TILE + 2
    const x = a.x - TILE / 2 - 1
    const y = a.y - TILE / 2 - 1
    ctx.fillStyle = HIGHLIGHT
    ctx.fillRect(x, y, w, 1)
    ctx.fillRect(x, y + h - 1, w, 1)
    ctx.fillRect(x, y, 1, h)
    ctx.fillRect(x + w - 1, y, 1, h)
  } else if (s.hover) {
    ctx.drawImage(outlineCanvas(s.hover.canvas), s.hover.x - 1, s.hover.y - 1)
  }
}
