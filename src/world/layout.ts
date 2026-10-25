import type { RelicId } from '../types.ts'

export type Point = { x: number; y: number }
export type TileRect = { left: number; right: number; top: number; bottom: number }

/** One tile is 16 world pixels; the camera shows world pixels at 1x to 6x. */
export const TILE = 16

/** World extent in tiles, inclusive. See Segment in types.ts for the axes. */
export const WORLD: TileRect = { left: -36, right: 35, top: -26, bottom: 39 }
export const WORLD_COLS = WORLD.right - WORLD.left + 1
export const WORLD_ROWS = WORLD.bottom - WORLD.top + 1
export const WORLD_W = WORLD_COLS * TILE
export const WORLD_H = WORLD_ROWS * TILE

// Layer rows. These assume B's taproot grows 2 tiles per record, so 4 records
// (20 LP) reach STONE_TOP and 8 records (40 LP) reach RUIN.top.
export const SURFACE_Y = 0
export const STONE_TOP = 8
export const DEEP_STONE_TOP = 30

export const RUIN: TileRect = { left: -11, right: 11, top: 16, bottom: 25 }
export const RUIN_PILLARS = [-6, 6]
export const TABLET: TileRect = { left: -10, right: -8, top: 18, bottom: 22 }
export const PEDESTAL: Point = { x: 0, y: 24 }

export const RELIC_TILES: Record<RelicId, Point> = {
  carved_stone: { x: 1, y: 8 },
  heartwood_relic: { x: 0, y: 23 },
}

/** Drawn before any record: a stem with one base-green cluster, and a stub root. */
export const SAPLING = {
  base: { x: 0, y: 0 },
  top: { x: 0, y: -3 },
  rootTip: { x: 0, y: 1 },
}

/** Tile coordinates to world pixels (the centre of tile (0, 0) is at its tile centre). */
export function tileToPx(p: Point): Point {
  return {
    x: (p.x - WORLD.left) * TILE + TILE / 2,
    y: (p.y - WORLD.top) * TILE + TILE / 2,
  }
}

export function pxToTile(p: Point): Point {
  return {
    x: (p.x - TILE / 2) / TILE + WORLD.left,
    y: (p.y - TILE / 2) / TILE + WORLD.top,
  }
}

export function inRect(r: TileRect, x: number, y: number): boolean {
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom
}
