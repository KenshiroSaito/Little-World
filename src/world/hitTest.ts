import type { CanvasSelection, RelicId, Segment } from '../types.ts'
import { RELIC_TILES, TABLET, type Point } from './layout.ts'
import { leafSize } from './treeShape.ts'

export type HitScene = {
  segments: readonly Segment[]
  revealedRelics: readonly RelicId[]
  ruinLit: boolean
  /** Total LP: leaf clusters, and so their click area, grow with it. */
  lp: number
}

const RELIC_REACH = 0.7
const TABLET_REACH = 0.5
const LEAF_REACH = 0.25
const LINE_REACH = 0.6

/** Point in tile coordinates -> relic, tablet, then the nearest branch segment: what onSelect gets. */
export function hitTest(scene: HitScene, p: Point): CanvasSelection | null {

  for (const relicId of scene.revealedRelics) {
    const t = RELIC_TILES[relicId]
    if (Math.abs(p.x - t.x) <= RELIC_REACH && Math.abs(p.y - t.y) <= RELIC_REACH) return { kind: 'relic', id: relicId }
  }

  if (
    scene.ruinLit &&
    p.x >= TABLET.left - TABLET_REACH &&
    p.x <= TABLET.right + TABLET_REACH &&
    p.y >= TABLET.top - TABLET_REACH &&
    p.y <= TABLET.bottom + TABLET_REACH
  ) {
    return { kind: 'tablet' }
  }

  // A leaf cluster scores 0 at its centre to 1 at its edge; a bare branch line scores above 1,
  // so leaves win. Ties go to the later segment, which is drawn on top.
  let best: string | null = null
  let bestScore = Infinity
  for (const s of scene.segments) {
    if (s.kind !== 'branch') continue
    const reach = leafSize(s.id, scene.lp) / 2 + LEAF_REACH
    const d = Math.hypot(p.x - s.to.x, p.y - s.to.y)
    let score: number
    if (d <= reach) score = d / reach
    else {
      const line = distToSegment(p, s.from, s.to)
      if (line > LINE_REACH) continue
      score = 1 + line
    }
    if (score <= bestScore) {
      best = s.id
      bestScore = score
    }
  }
  return best === null ? null : { kind: 'segment', id: best }
}

export function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}
