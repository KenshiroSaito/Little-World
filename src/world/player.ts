// The spirit as the player character: it walks the ground, jumps, lands on leaf
// bunches and tree-house decks from above, and climbs the trunk, branches and
// roots. Pure, like camera.ts: the renderer builds a PlayerWorld from the tree
// and steps the player every frame; the tests drive it directly.
import type { Segment } from '../types.ts'
import { DECK_W, type House } from './houses.ts'
import { SAPLING, SURFACE_Y, TILE, WORLD, WORLD_W, pxToTile, tileToPx, type Point } from './layout.ts'
import { leafSize, type TreeShape } from './treeShape.ts'
import { distToSegment } from './hitTest.ts'

export type PlayerInput = { left: boolean; right: boolean; up: boolean; down: boolean; jump: boolean }

export type Player = {
  /** Feet, in world pixels. */
  x: number
  y: number
  /** World pixels per second; while climbing, how fast it is climbing. */
  vx: number
  vy: number
  facing: 1 | -1
  mode: 'ground' | 'air' | 'climb'
  /** Jump and Down act when pressed, not while held. */
  jumpHeld: boolean
  downHeld: boolean
  /** The height of the ledge being dropped through, until the feet are below it. */
  dropFrom: number | null
}

/** One-way platform, solid from above: the top of a leaf bunch or a deck. */
export type Ledge = { left: number; right: number; y: number }
/** Something to climb, and how far from its centre line the spirit's hands can be. */
export type Limb = { a: Point; b: Point; reach: number; underground: boolean }
/** Everything the player collides with, in world pixels. */
export type PlayerWorld = { ground: number; ledges: Ledge[]; limbs: Limb[]; left: number; right: number; top: number }

export const NO_INPUT: PlayerInput = { left: false, right: false, up: false, down: false, jump: false }

const GRAVITY = 900
const MAX_FALL = 420
const WALK = 72
const GROUND_ACCEL = 900
const AIR_ACCEL = 500
/** About three tiles high: climbing, not jumping, is how to get up the tree. */
const JUMP = 290
/** Letting go of jump early cuts the rise to this share of the jump speed. */
const JUMP_CUT = 0.45
/** Jumping off a limb is a little weaker than off the ground. */
const LIMB_JUMP = 0.85
const CLIMB = 52
/** The hands, which hold on to limbs, are this far above the feet. */
export const HANDS = 12
/** How much further than a limb's reach the hands can catch it from. */
const CATCH = 4
const STEP = 1 / 120

/** Feet on the ground just right of the trunk, standing still. */
export function spawnPlayer(world: PlayerWorld): Player {
  return {
    x: tileToPx(SAPLING.base).x + 2 * TILE,
    y: world.ground,
    vx: 0,
    vy: 0,
    facing: 1,
    mode: 'ground',
    jumpHeld: false,
    downHeld: false,
    dropFrom: null,
  }
}

/**
 * What the player stands on and climbs: the ground, every leaf bunch and deck as
 * a ledge, and the trunk, branches and roots as limbs as thick as they are drawn.
 */
export function buildPlayerWorld(
  segments: readonly Segment[],
  shape: TreeShape,
  lp: number,
  houses: readonly House[],
): PlayerWorld {
  const ledges: Ledge[] = [bunchLedge(SAPLING.top, 2)]
  const limbs: Limb[] = [
    limb(SAPLING.base, SAPLING.top, shape.trunkWidth, false),
    limb(SAPLING.base, SAPLING.rootTip, shape.rootWidth, true),
  ]
  for (const s of segments) {
    limbs.push(limb(s.from, s.to, shape.widths.get(s.id) ?? 3, s.kind === 'root'))
    if (s.kind === 'branch') ledges.push(bunchLedge(s.to, leafSize(s.id, lp)))
  }
  for (const h of houses) ledges.push({ left: h.at.x - DECK_W / 2, right: h.at.x + DECK_W / 2, y: h.at.y })
  return {
    ground: (SURFACE_Y - WORLD.top) * TILE,
    ledges,
    limbs,
    left: TILE / 2,
    right: WORLD_W - TILE / 2,
    top: 2 * TILE,
  }
}

/** The walkable top of a leaf cluster of `size` tiles (treeKit.ts leafCluster), a little sunk into the leaves. */
function bunchLedge(tip: Point, size: number): Ledge {
  const p = tileToPx(tip)
  const reach = size * 8 - 3
  return { left: p.x - reach, right: p.x + reach, y: Math.round(p.y - reach * 0.8 - 3) }
}

function limb(a: Point, b: Point, width: number, underground: boolean): Limb {
  return { a: tileToPx(a), b: tileToPx(b), reach: width / 2 + 3, underground }
}

/** Advances the player by `dt` seconds in small fixed steps, so landing never misses a ledge. */
export function stepPlayer(player: Player, input: PlayerInput, world: PlayerWorld, dt: number): Player {
  const p = { ...player }
  let left = Math.min(dt, 0.1)
  while (left > 1e-6) {
    const h = Math.min(STEP, left)
    step(p, input, world, h)
    left -= h
  }
  return p
}

function step(p: Player, input: PlayerInput, w: PlayerWorld, h: number) {
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0)
  if (dir !== 0) p.facing = dir > 0 ? 1 : -1
  const jump = input.jump && !p.jumpHeld
  const down = input.down && !p.downHeld
  p.jumpHeld = input.jump
  p.downHeld = input.down

  if (p.mode === 'climb') {
    climb(p, input, dir, jump, w, h)
    return
  }

  // Up catches a limb near the hands; Down on the ground climbs into the roots below the feet.
  if (input.up || (down && p.mode === 'ground' && p.y >= w.ground - 0.5)) {
    const hands = input.up ? { x: p.x, y: p.y - HANDS } : { x: p.x, y: p.y + CATCH }
    const near = nearestLimb(w.limbs, hands, input.up ? null : true)
    if (near && near.dist <= near.limb.reach + CATCH) {
      const held = holdOn(hands, near)
      p.mode = 'climb'
      p.x = held.x
      p.y = held.y + HANDS
      p.vx = p.vy = 0
      return
    }
  }

  p.vx = approach(p.vx, dir * WALK, (p.mode === 'ground' ? GROUND_ACCEL : AIR_ACCEL) * h)
  if (p.mode === 'ground') {
    if (jump) {
      p.mode = 'air'
      p.vy = -JUMP
    } else if (down && p.y < w.ground - 0.5) {
      p.mode = 'air'
      p.dropFrom = p.y
      p.vy = 0
    }
  }

  const prevY = p.y
  p.x = clamp(p.x + p.vx * h, w.left, w.right)
  if (p.mode === 'ground') {
    if (!supported(w, p.x, p.y)) {
      p.mode = 'air'
      p.vy = 0
    }
    return
  }

  if (!input.jump && p.vy < -JUMP * JUMP_CUT) p.vy = -JUMP * JUMP_CUT
  p.vy = Math.min(MAX_FALL, p.vy + GRAVITY * h)
  p.y += p.vy * h
  if (p.y < w.top) {
    p.y = w.top
    p.vy = Math.max(0, p.vy)
  }
  if (p.dropFrom !== null && p.y > p.dropFrom + 1) p.dropFrom = null
  // Never loose underground (a limb vanished on reset): back up onto the grass.
  const floor = prevY > w.ground ? w.ground : landing(w, p.x, prevY, p.y, p.dropFrom)
  if (floor !== null && p.vy >= 0) {
    p.y = floor
    p.vy = 0
    p.mode = 'ground'
  }
}

function climb(p: Player, input: PlayerInput, dir: number, jump: boolean, w: PlayerWorld, h: number) {
  // No letting go underground: there is nothing to land on down there.
  if (jump && p.y - HANDS <= w.ground) {
    p.mode = 'air'
    p.vy = -JUMP * LIMB_JUMP
    p.vx = dir * WALK
    return
  }
  const dy = (input.down ? 1 : 0) - (input.up ? 1 : 0)
  const want = { x: p.x + dir * CLIMB * h, y: p.y - HANDS + dy * CLIMB * h }
  const near = nearestLimb(w.limbs, want, null)
  if (!near) {
    p.mode = 'air'
    p.vy = 0
    return
  }
  // Moving off a limb slides along it instead: the hands stay within its reach.
  const held = holdOn(want, near)
  const x = clamp(held.x, w.left, w.right)
  const y = held.y + HANDS
  // Climbing down onto the grass from above puts the feet on it.
  if (p.y <= w.ground && y >= w.ground && !near.limb.underground) {
    p.x = x
    p.y = w.ground
    p.vx = p.vy = 0
    p.mode = 'ground'
    return
  }
  p.vx = (x - p.x) / h
  p.vy = (y - p.y) / h
  p.x = x
  p.y = y
}

type Near = { limb: Limb; point: Point; dist: number }

/** The closest limb to `p`; with `underground` set, only roots (true) or only wood above ground (false). */
export function nearestLimb(limbs: readonly Limb[], p: Point, underground: boolean | null): Near | null {
  let best: Near | null = null
  for (const l of limbs) {
    if (underground !== null && l.underground !== underground) continue
    const point = closestPoint(p, l.a, l.b)
    const dist = Math.hypot(p.x - point.x, p.y - point.y)
    if (!best || dist < best.dist) best = { limb: l, point, dist }
  }
  return best
}

/** `p` pulled in to within the limb's reach. */
function holdOn(p: Point, near: Near): Point {
  if (near.dist <= near.limb.reach) return p
  const k = near.limb.reach / near.dist
  return { x: near.point.x + (p.x - near.point.x) * k, y: near.point.y + (p.y - near.point.y) * k }
}

function closestPoint(p: Point, a: Point, b: Point): Point {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / len2, 0, 1)
  return { x: a.x + t * dx, y: a.y + t * dy }
}

function supported(w: PlayerWorld, x: number, y: number): boolean {
  if (Math.abs(y - w.ground) < 0.5) return true
  return w.ledges.some((l) => Math.abs(y - l.y) < 0.5 && x >= l.left && x <= l.right)
}

/** The highest floor the feet crossed going from y0 down to y1, or null. */
function landing(w: PlayerWorld, x: number, y0: number, y1: number, dropFrom: number | null): number | null {
  let best: number | null = y0 <= w.ground && y1 >= w.ground ? w.ground : null
  for (const l of w.ledges) {
    if (l.y === dropFrom || x < l.left || x > l.right || y0 > l.y || y1 < l.y) continue
    if (best === null || l.y < best) best = l.y
  }
  return best
}

/**
 * The branch whose leaf bunch (or bare wood) the player's body is at, for
 * reading its journal entry. Scored like hitTest: leaves win over wood.
 */
export function bunchAt(segments: readonly Segment[], lp: number, p: Player): string | null {
  const body = pxToTile({ x: p.x, y: p.y - HANDS })
  let best: string | null = null
  let bestScore = Infinity
  for (const s of segments) {
    if (s.kind !== 'branch') continue
    const reach = leafSize(s.id, lp) / 2 + 0.75
    const d = Math.hypot(body.x - s.to.x, body.y - s.to.y)
    const line = distToSegment(body, s.from, s.to)
    const score = d <= reach ? d / reach : line <= 0.5 ? 1 + line : Infinity
    if (score <= bestScore && score < Infinity) {
      best = s.id
      bestScore = score
    }
  }
  return best
}

function approach(v: number, target: number, by: number): number {
  return v < target ? Math.min(target, v + by) : Math.max(target, v - by)
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}
