import { describe, expect, it } from 'vitest'
import {
  MAX_ZOOM,
  MIN_ZOOM,
  WORLD_RECT,
  clampCamera,
  fitRect,
  panBy,
  screenToWorld,
  worldToScreen,
  zoomAt,
  type View,
} from './camera.ts'
import { FIXTURE_SEGMENTS } from './fixtures.ts'
import { hitTest } from './hitTest.ts'
import { RELIC_TILES, RUIN, STONE_TOP, TABLET, WORLD, WORLD_COLS, WORLD_H, WORLD_W } from './layout.ts'
import { computeLight } from './lighting.ts'
import { analyzeTree, growSegments, leafSize, segmentBounds } from './treeShape.ts'
import { resizedColumns, solidColumns } from './treeKit.ts'

const view: View = { width: 800, height: 600, dpr: 1 }
const records = (n: number) => FIXTURE_SEGMENTS.slice(0, n * 2)

describe('camera', () => {
  it('keeps zoom whole and between 1x and 6x', () => {
    const cam = { cx: WORLD_W / 2, cy: WORLD_H / 2, zoom: 3 }
    expect(zoomAt(cam, view, { x: 400, y: 300 }, 9).zoom).toBe(MAX_ZOOM)
    expect(zoomAt(cam, view, { x: 400, y: 300 }, 0).zoom).toBe(MIN_ZOOM)
    expect(zoomAt(cam, view, { x: 400, y: 300 }, 4.4).zoom).toBe(4)
  })

  it('zooms around the cursor', () => {
    const cam = { cx: WORLD_W / 2, cy: WORLD_H / 2, zoom: 2 }
    const anchor = { x: 500, y: 250 }
    const before = screenToWorld(cam, view, anchor)
    const after = screenToWorld(zoomAt(cam, view, anchor, 4), view, anchor)
    expect(after.x).toBeCloseTo(before.x, 0)
    expect(after.y).toBeCloseTo(before.y, 0)
  })

  it('round-trips screen and world points', () => {
    const cam = { cx: 600, cy: 500, zoom: 3 }
    const w = screenToWorld(cam, view, { x: 123, y: 456 })
    const s = worldToScreen(cam, view, w)
    expect(s.x).toBeCloseTo(123)
    expect(s.y).toBeCloseTo(456)
  })

  it('never shows space outside the world', () => {
    const cam = panBy({ cx: 0, cy: 0, zoom: 2 }, view, 5000, 5000)
    const topLeft = screenToWorld(cam, view, { x: 0, y: 0 })
    expect(topLeft.x).toBeGreaterThanOrEqual(WORLD_RECT.x - 1)
    expect(topLeft.y).toBeGreaterThanOrEqual(WORLD_RECT.y - 1)
    const far = clampCamera({ cx: 1e6, cy: 1e6, zoom: 2 }, view)
    const bottomRight = screenToWorld(far, view, { x: 800, y: 600 })
    expect(bottomRight.x).toBeLessThanOrEqual(WORLD_W + 1)
    expect(bottomRight.y).toBeLessThanOrEqual(WORLD_H + 1)
  })

  it('fits a rectangle at the largest zoom that shows all of it', () => {
    const cam = fitRect({ x: 100, y: 100, w: 190, h: 140 }, view)
    expect(cam.zoom).toBe(4)
    expect(cam.cx).toBe(195)
  })
})

describe('tree shape', () => {
  it('gives each segment a leaf size that never changes', () => {
    for (const s of FIXTURE_SEGMENTS) expect(leafSize(s.id)).toBe(leafSize(s.id))
    expect(new Set(FIXTURE_SEGMENTS.map((s) => leafSize(s.id))).size).toBeGreaterThan(1)
  })

  it('thickens older segments as the tree grows', () => {
    const early = analyzeTree(records(2))
    const late = analyzeTree(records(16))
    expect(late.widths.get('log-01:b')!).toBeGreaterThan(early.widths.get('log-01:b')!)
    expect(late.trunkWidth).toBeGreaterThan(early.trunkWidth)
  })

  it('survives a parent cycle in bad data', () => {
    const a = { ...FIXTURE_SEGMENTS[0], id: 'a', parentId: 'b' }
    const b = { ...FIXTURE_SEGMENTS[0], id: 'b', parentId: 'a' }
    expect(() => analyzeTree([a, b])).not.toThrow()
  })

  it('grows new segments from their base', () => {
    const [seg] = growSegments(records(1), new Set(['log-01:b']), 0)
    expect(seg.to).toEqual(seg.from)
  })

  it('bounds include the sapling and the deepest root', () => {
    const r = segmentBounds(records(8), true)
    expect(r.top).toBeLessThan(-3)
    expect(r.bottom).toBe(RUIN.top)
  })
})

describe('fixture thresholds', () => {
  const deepest = (n: number) => Math.max(...records(n).filter((s) => s.kind === 'root').map((s) => s.to.y))
  it('reaches stone at 20 LP and the ruin at 40 LP', () => {
    expect(deepest(3)).toBeLessThan(STONE_TOP)
    expect(deepest(4)).toBe(STONE_TOP)
    expect(deepest(7)).toBeLessThan(RUIN.top)
    expect(deepest(8)).toBe(RUIN.top)
  })
})

describe('hit testing', () => {
  const scene = { segments: records(16), revealedRelics: [], ruinLit: false }

  it('finds the branch whose leaves were clicked', () => {
    expect(hitTest(scene, { x: -4, y: -9 })).toEqual({ kind: 'segment', id: 'log-02:b' })
  })

  it('finds nothing in empty sky', () => {
    expect(hitTest(scene, { x: 25, y: -20 })).toBeNull()
  })

  it('only finds relics and the tablet once revealed', () => {
    const stone = RELIC_TILES.carved_stone
    expect(hitTest(scene, stone)?.kind).not.toBe('relic')
    expect(hitTest({ ...scene, revealedRelics: ['carved_stone'] }, stone)).toEqual({ kind: 'relic', id: 'carved_stone' })
    const tablet = { x: TABLET.left, y: TABLET.top + 1 }
    expect(hitTest(scene, tablet)).toBeNull()
    expect(hitTest({ ...scene, ruinLit: true }, tablet)).toEqual({ kind: 'tablet' })
  })

  it("only ever reports main's CanvasSelection kinds", () => {
    const lit = { ...scene, revealedRelics: ['carved_stone', 'heartwood_relic'] as const, ruinLit: true }
    const kinds = new Set<string>()
    for (let y = -20; y <= 26; y += 0.5) for (let x = -15; x <= 15; x += 0.5) kinds.add(hitTest(lit, { x, y })?.kind ?? 'none')
    expect([...kinds].sort()).toEqual(['none', 'relic', 'segment', 'tablet'])
  })
})

describe('lighting', () => {
  const at = (light: Float32Array, x: number, y: number) => light[(y - WORLD.top) * WORLD_COLS + (x - WORLD.left)]

  it('is bright above ground and dark deep down with no roots', () => {
    const light = computeLight([], [], false)
    expect(at(light, 10, -5)).toBe(1)
    expect(at(light, 10, 20)).toBe(0)
  })

  it('lights tiles around the roots and the whole ruin once reached', () => {
    const light = computeLight(records(8), [], false)
    expect(at(light, 0, 15)).toBe(1)
    expect(at(light, -9, 22)).toBe(0)
    const lit = computeLight(records(8), ['carved_stone', 'heartwood_relic'], true)
    expect(at(lit, -9, 22)).toBe(1)
  })
})

describe('tree kit', () => {
  it('widens a root flare by repeating inner columns, keeping its outline columns', () => {
    const cols = resizedColumns(12, 3, 8, 3)
    expect(cols).toHaveLength(15)
    expect(cols.slice(0, 4)).toEqual([0, 1, 2, 3])
    expect(cols.slice(-4)).toEqual([8, 9, 10, 11])
    expect([...cols].sort((a, b) => a - b)).toEqual(cols)
  })

  it('narrows a root flare by dropping inner columns, but keeps at least one', () => {
    expect(resizedColumns(12, 3, 8, -2)).toHaveLength(10)
    const narrowest = resizedColumns(12, 3, 8, -20)
    expect(narrowest).toHaveLength(9)
    expect(narrowest.filter((x) => x > 3 && x < 8)).toHaveLength(1)
    expect([...narrowest.slice(0, 4), ...narrowest.slice(-4)]).toEqual([0, 1, 2, 3, 8, 9, 10, 11])
  })

  it('keeps only bark columns with no clear texel', () => {
    const o = 0xff000000
    // 4x2: column 0 has a gap, columns 1 and 2 are solid, column 3 is clear.
    const px = { w: 4, h: 2, data: Uint32Array.from([0, o | 1, o | 2, 0, o, o | 3, o | 4, 0]) }
    expect(solidColumns(px)).toEqual({ w: 2, h: 2, data: Uint32Array.from([o | 1, o | 2, o | 3, o | 4]) })
  })
})
