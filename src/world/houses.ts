// Tree houses: from 40 LP the tree is big enough to live in, and every record
// after that builds one more house, with a villager at its door. Placement is
// pure and stable (a house never moves as the tree grows); drawing is plain
// pixel art in world pixels, stamped over the leaves so no house is ever hidden.
import type { Segment } from '../types.ts'
import { WORLD, pxToTile, tileToPx, type Point, type TileRect } from './layout.ts'
import { hashString } from './rng.ts'
import { hexRgb } from './treeKit.ts'
import { GROWN_LP } from './treeShape.ts'

/** Every record is worth 5 LP, so one house per record once the tree is grown. */
const LP_PER_HOUSE = 5
/** Deck, hut and roof sizes in world pixels. */
const DECK_W = 46
const DECK_H = 4
const HUT_W = 30
const WALL_H = 20
const ROOF_H = 12
/** Clear space between houses, and between a deck and the trunk's centre line, in world pixels. */
const GAP_X = DECK_W + 6
const GAP_Y = WALL_H + ROOF_H + DECK_H + 8
const TRUNK_CLEAR = DECK_W / 2 + 14
/** Where along a branch a deck may sit, best first, and how level the branch must be. */
const ALONG = [0.6, 0.75, 0.45, 0.88]
const MIN_SPAN = 1.5
const MAX_SLOPE = 1.3

export type House = {
  id: string
  segmentId: string
  /** Deck centre in world pixels; y is where feet stand. */
  at: Point
  /** 1 when the house is right of the trunk: its door is on the outer side. */
  side: 1 | -1
  /** Which roof colours and villager. */
  look: number
}

/** Houses `lp` has paid for: one at 40 LP and one more every record after. */
export function houseCount(lp: number): number {
  return lp < GROWN_LP ? 0 : Math.floor((lp - GROWN_LP) / LP_PER_HOUSE) + 1
}

/**
 * Where each house stands. House n is paid for by record GROWN_LP / 5 + n and
 * may only use branches grown by then, so later growth never moves a house. It
 * goes on a fairly level side branch, clear of the trunk and every earlier
 * house, alternating sides; when there is no room it waits for new branches.
 */
export function placeHouses(segments: readonly Segment[], lp: number): House[] {
  const branches = segments.filter((s) => s.kind === 'branch')
  const firstRecord = GROWN_LP / LP_PER_HOUSE
  const houses: House[] = []
  const used = new Set<string>()
  let owed = 0
  for (let n = 0; n < houseCount(lp); n++) {
    owed++
    const grown = branches.slice(0, firstRecord + n)
    while (owed > 0) {
      const prefer: 1 | -1 = houses.length % 2 === 0 ? -1 : 1
      const spot = findSpot(grown, prefer, used, houses) ?? findSpot(grown, -prefer as 1 | -1, used, houses)
      if (!spot) break
      used.add(spot.segment.id)
      const look = hashString(spot.segment.id) % LOOKS.length
      houses.push({ id: `house:${spot.segment.id}`, segmentId: spot.segment.id, at: spot.at, side: spot.side, look })
      owed--
    }
  }
  return houses
}

/** The first free branch on `side`, oldest first, with room for a deck somewhere along it. */
function findSpot(branches: readonly Segment[], side: 1 | -1, used: ReadonlySet<string>, houses: readonly House[]) {
  for (const s of branches) {
    if (used.has(s.id)) continue
    const dx = s.to.x - s.from.x
    const dy = s.to.y - s.from.y
    if (Math.sign(dx) !== side || Math.abs(dx) < MIN_SPAN || Math.abs(dy) > Math.abs(dx) * MAX_SLOPE) continue
    for (const t of ALONG) {
      const p = tileToPx({ x: s.from.x + dx * t, y: s.from.y + dy * t })
      const at = { x: Math.round(p.x), y: Math.round(p.y) - 2 }
      if (Math.abs(at.x - tileToPx({ x: 0, y: 0 }).x) < TRUNK_CLEAR) continue
      if (at.y - GAP_Y < tileToPx({ x: 0, y: WORLD.top }).y) continue
      if (houses.some((h) => Math.abs(h.at.x - at.x) < GAP_X && Math.abs(h.at.y - at.y) < GAP_Y)) continue
      return { segment: s, at, side }
    }
  }
  return null
}

/** Tile bounds of the houses, roofs and struts included, for framing the tree. */
export function houseBounds(houses: readonly House[]): TileRect | null {
  if (houses.length === 0) return null
  const r = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity }
  for (const h of houses) {
    const a = pxToTile({ x: h.at.x - DECK_W / 2, y: h.at.y - WALL_H - ROOF_H - 4 })
    const b = pxToTile({ x: h.at.x + DECK_W / 2, y: h.at.y + DECK_H + 7 })
    r.left = Math.min(r.left, a.x)
    r.right = Math.max(r.right, b.x)
    r.top = Math.min(r.top, a.y)
    r.bottom = Math.max(r.bottom, b.y)
  }
  return r
}

/** Where a house's villager stands, feet on the deck: in front of the door. */
export function doorstep(h: House): Point {
  return { x: doorX(h) + 4, y: h.at.y }
}

function hutLeft(h: House): number {
  return h.at.x - HUT_W / 2 - h.side * 4
}

function doorX(h: House): number {
  return h.side > 0 ? hutLeft(h) + HUT_W - 12 : hutLeft(h) + 4
}

type Look = { roof: string; roofDark: string; wall: string; wallDark: string; trim: string }

const LOOKS: Look[] = [
  { roof: '#c4473a', roofDark: '#8a2b24', wall: '#e8d3a8', wallDark: '#bfa577', trim: '#5a3a24' },
  { roof: '#3f6fb5', roofDark: '#284a7e', wall: '#dcd6c8', wallDark: '#aea591', trim: '#e8c45a' },
  { roof: '#4f8f3a', roofDark: '#335f26', wall: '#d9b98a', wallDark: '#ad8d60', trim: '#7a4a2a' },
  { roof: '#7b4fa3', roofDark: '#523470', wall: '#e3d7c0', wallDark: '#b5a688', trim: '#e8c45a' },
  { roof: '#d08a2e', roofDark: '#94601c', wall: '#e9dcc1', wallDark: '#bba886', trim: '#4a3022' },
  { roof: '#2f8c8c', roofDark: '#1f5f5f', wall: '#e6cfa1', wallDark: '#b89f70', trim: '#8a5a3a' },
]
const OUTLINE = '#2a2630'
const WINDOW = '#ffd56b'
const WINDOW_LIT = '#fff1b8'
const DOOR = '#4a3022'

/**
 * Draws a house on its deck, rising from the deck as `progress` goes 0 to 1.
 * With `glow`, only the lit window, as a light source for the bloom pass.
 */
export function drawHouse(ctx: CanvasRenderingContext2D, h: House, wood: string, progress: number, glow = false): void {
  if (progress <= 0) return
  const look = LOOKS[h.look % LOOKS.length]
  const left = h.at.x - DECK_W / 2
  const deckTop = h.at.y
  const hutX = hutLeft(h)
  const wallTop = deckTop - WALL_H
  const top = wallTop - ROOF_H - 4
  const bottom = deckTop + DECK_H + 7
  const shown = Math.round((bottom - top) * Math.min(1, progress))
  ctx.save()
  ctx.beginPath()
  ctx.rect(left - 6, bottom - shown, DECK_W + 12, shown)
  ctx.clip()

  const rect = (x: number, y: number, w: number, hh: number, c: string) => {
    ctx.fillStyle = c
    ctx.fillRect(x, y, w, hh)
  }
  const winX = h.side > 0 ? hutX + 5 : hutX + HUT_W - 13
  if (glow) {
    rect(winX, wallTop + 5, 8, 7, WINDOW)
    ctx.restore()
    return
  }

  // Deck: planks across the branch, two struts down to it, and a rail on the outer end.
  const [r, g, b] = hexRgb(wood)
  const plank = `rgb(${Math.min(255, r + 52)}, ${Math.min(255, g + 40)}, ${Math.min(255, b + 26)})`
  const plankDark = `rgb(${Math.min(255, r + 12)}, ${Math.min(255, g + 8)}, ${b})`
  for (const sx of [left + 9, left + DECK_W - 11]) {
    const lean = sx < h.at.x ? 1 : -1
    for (let i = 0; i < 7; i++) {
      rect(sx + lean * i - 1, deckTop + DECK_H + i, 4, 1, OUTLINE)
      rect(sx + lean * i, deckTop + DECK_H + i, 2, 1, plankDark)
    }
  }
  rect(left - 1, deckTop - 1, DECK_W + 2, DECK_H + 2, OUTLINE)
  rect(left, deckTop, DECK_W, DECK_H, plank)
  rect(left, deckTop + DECK_H - 1, DECK_W, 1, plankDark)
  for (let x = left + 6; x < left + DECK_W; x += 7) rect(x, deckTop, 1, DECK_H - 1, plankDark)
  const railX = h.side > 0 ? left + DECK_W - 2 : left
  rect(railX - 1, deckTop - 9, 4, 9, OUTLINE)
  rect(railX, deckTop - 8, 2, 8, plank)
  const railFrom = h.side > 0 ? hutX + HUT_W : left
  const railTo = h.side > 0 ? left + DECK_W : hutX
  rect(railFrom, deckTop - 9, railTo - railFrom, 3, OUTLINE)
  rect(railFrom, deckTop - 8, railTo - railFrom, 1, plank)

  // Walls with boards, a door and a lit window.
  rect(hutX - 1, wallTop - 1, HUT_W + 2, WALL_H + 1, OUTLINE)
  rect(hutX, wallTop, HUT_W, WALL_H, look.wall)
  for (let y = wallTop + 4; y < deckTop; y += 5) rect(hutX, y, HUT_W, 1, look.wallDark)
  rect(h.side > 0 ? hutX : hutX + HUT_W - 2, wallTop, 2, WALL_H, look.wallDark)
  const dx = doorX(h)
  rect(dx - 1, deckTop - 14, 10, 14, OUTLINE)
  rect(dx, deckTop - 13, 8, 13, DOOR)
  rect(dx + 1, deckTop - 12, 6, 1, look.trim)
  rect(winX - 1, wallTop + 4, 10, 9, OUTLINE)
  rect(winX, wallTop + 5, 8, 7, WINDOW)
  rect(winX + 1, wallTop + 5, 2, 2, WINDOW_LIT)
  rect(winX + 3, wallTop + 5, 1, 7, OUTLINE)
  rect(winX, wallTop + 8, 8, 1, OUTLINE)
  rect(winX - 1, wallTop + 13, 10, 2, look.trim)

  // A pitched roof with an overhang, lit on the left.
  const cx = hutX + HUT_W / 2
  for (let i = 0; i < ROOF_H; i++) {
    const half = Math.round(((HUT_W + 10) / 2) * (1 - i / ROOF_H))
    const y = wallTop - 1 - i
    rect(cx - half - 1, y, half * 2 + 2, 1, OUTLINE)
    if (half > 1) {
      rect(cx - half, y, half, 1, look.roof)
      rect(cx, y, half, 1, look.roofDark)
    }
  }
  rect(cx - 1, wallTop - ROOF_H - 1, 2, 1, OUTLINE)
  rect(hutX - 5, wallTop - 2, HUT_W + 10, 1, look.roofDark)
  rect(hutX - 6, wallTop - 1, HUT_W + 12, 1, OUTLINE)
  // A chimney on the trunk side.
  const chimney = h.side > 0 ? hutX + 5 : hutX + HUT_W - 9
  rect(chimney - 1, wallTop - ROOF_H + 1, 6, 8, OUTLINE)
  rect(chimney, wallTop - ROOF_H + 2, 4, 7, look.trim)
  ctx.restore()
}
