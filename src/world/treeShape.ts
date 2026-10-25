// Pure geometry the renderer and hit-testing share. No DOM here.
import type { Segment } from '../types.ts'
import { SAPLING, TILE, tileToPx, type Point, type TileRect } from './layout.ts'
import type { PxRect } from './camera.ts'
import { hashString } from './rng.ts'

export type LeafSize = 1 | 2 | 3 | 4

/** Total LP at which the tree is grown: thicker wood, fuller leaves, and tree houses from here on. */
export const GROWN_LP = 40
const MAX_TRUNK = 24

export type Growth = {
  grown: boolean
  /** Trunk width at the ground in world pixels, outline excluded. */
  trunkWidth: number
  /** Width of the thinnest branch tips. */
  twigWidth: number
  /** Added to each cluster's own size, then capped at maxLeaf. */
  leafBonus: number
  maxLeaf: LeafSize
}

/**
 * How big the wood and leaves are at `lp` total LP. The trunk thickens a pixel
 * per record, then jumps when the tree is grown at 40 LP and keeps thickening
 * more slowly; leaf clusters step up at 20, 40 and 80 LP.
 */
export function treeGrowth(lp: number): Growth {
  const v = Math.max(0, lp)
  const grown = v >= GROWN_LP
  return {
    grown,
    trunkWidth: grown ? Math.min(MAX_TRUNK, 14 + Math.floor((v - GROWN_LP) / 10)) : 4 + Math.floor(v / 5),
    twigWidth: grown ? 4 : 3,
    leafBonus: grown ? 1 : v >= 20 ? 0 : -1,
    maxLeaf: v >= 80 ? 4 : 3,
  }
}

/** Leaf cluster width in tiles: the segment's own size (fixed by its id, so paint never reshuffles it) grown by LP. */
export function leafSize(segmentId: string, lp: number): LeafSize {
  const g = treeGrowth(lp)
  const own = hashString(segmentId) % 3 === 0 ? 3 : 2
  return clamp(own + g.leafBonus, 1, g.maxLeaf) as LeafSize
}

export function leafVariant(segmentId: string): number {
  return (hashString(segmentId) >>> 8) % 4
}

export type TreeShape = {
  /** Line width in world pixels at each segment's base. */
  widths: Map<string, number>
  trunkWidth: number
  rootWidth: number
}

/**
 * Line widths. The trunk's width comes from LP (treeGrowth); every other segment
 * tapers from it by how much of the tree grows beyond it, down to twig width at
 * the tips, so the whole tree thickens as LP rises.
 */
export function analyzeTree(segments: readonly Segment[], lp: number): TreeShape {
  const children = new Map<string, string[]>()
  for (const s of segments) {
    if (s.parentId === null) continue
    const list = children.get(s.parentId)
    if (list) list.push(s.id)
    else children.set(s.parentId, [s.id])
  }

  const sizes = new Map<string, number>()
  const sizeOf = (id: string, seen: Set<string>): number => {
    const known = sizes.get(id)
    if (known !== undefined) return known
    if (seen.has(id)) return 1 // a parent cycle in bad data: stop instead of recursing forever
    seen.add(id)
    let n = 1
    for (const child of children.get(id) ?? []) n += sizeOf(child, seen)
    sizes.set(id, n)
    return n
  }

  const g = treeGrowth(lp)
  const rootWidth = Math.max(3, Math.round(g.trunkWidth * 0.75))
  const widest = { branch: Math.max(g.twigWidth, g.trunkWidth - 2), root: Math.max(2, rootWidth - 1) }
  const thinnest = { branch: g.twigWidth, root: 2 }
  const total = { branch: 0, root: 0 }
  for (const s of segments) total[s.kind]++

  const widths = new Map<string, number>()
  for (const s of segments) {
    // 0 at a bare tip, 1 for the segment everything else grows from.
    const share = Math.log2(sizeOf(s.id, new Set())) / Math.log2(Math.max(2, total[s.kind]))
    const w = thinnest[s.kind] + (widest[s.kind] - thinnest[s.kind]) * Math.min(1, share)
    widths.set(s.id, clamp(Math.round(w), thinnest[s.kind], widest[s.kind]))
  }
  return { widths, trunkWidth: g.trunkWidth, rootWidth }
}

/** Segments in `growing` drawn at progress t (0 to 1) along their length. */
export function growSegments(segments: readonly Segment[], growing: ReadonlySet<string>, t: number): Segment[] {
  const k = 1 - (1 - t) ** 3
  return segments.map((s) =>
    growing.has(s.id)
      ? { ...s, to: { x: s.from.x + (s.to.x - s.from.x) * k, y: s.from.y + (s.to.y - s.from.y) * k } }
      : s,
  )
}

/** Tile bounds of the given segments, leaf clusters at `lp` included; the sapling too when asked. */
export function segmentBounds(segments: readonly Segment[], withSapling: boolean, lp: number): TileRect {
  const r: TileRect = withSapling
    ? { left: -1, right: 1, top: SAPLING.top.y - 1, bottom: SAPLING.rootTip.y }
    : { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity }
  const add = (x: number, y: number) => {
    r.left = Math.min(r.left, x)
    r.right = Math.max(r.right, x)
    r.top = Math.min(r.top, y)
    r.bottom = Math.max(r.bottom, y)
  }
  for (const s of segments) {
    add(s.from.x, s.from.y)
    add(s.to.x, s.to.y)
    if (s.kind === 'branch') {
      const half = leafSize(s.id, lp) / 2
      add(s.to.x - half, s.to.y - half)
      add(s.to.x + half, s.to.y + half)
    }
  }
  return r
}

/** Tile bounds to world pixels, padded by `margin` tiles. */
export function boundsToPx(r: TileRect, margin: number): PxRect {
  const a = tileToPx({ x: r.left - margin, y: r.top - margin })
  const b = tileToPx({ x: r.right + margin, y: r.bottom + margin })
  return { x: a.x - TILE / 2, y: a.y - TILE / 2, w: b.x - a.x + TILE, h: b.y - a.y + TILE }
}

/** Where the spirit floats: just off the top right of the highest leaf cluster. */
export function spiritPerch(segments: readonly Segment[], lp: number): Point {
  let top = { x: SAPLING.top.x, y: SAPLING.top.y, half: 1 }
  for (const s of segments) {
    if (s.kind === 'branch' && s.to.y < top.y) top = { x: s.to.x, y: s.to.y, half: leafSize(s.id, lp) / 2 }
  }
  return { x: top.x + top.half + 0.5, y: top.y - top.half }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}
