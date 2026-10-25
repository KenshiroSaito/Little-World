import type { Segment } from '../types.ts'
import { drawHouse, type House } from './houses.ts'
import { SAPLING, TILE, WORLD_H, WORLD_W, tileToPx, type Point } from './layout.ts'
import { BARK, ROOT, leafShades, packHex } from './palette.ts'
import { hashString, mulberry32 } from './rng.ts'
import { hexRgb, leafCluster, rootFlare, twigHangs, twigSprite, type TreeKit, type Wood } from './treeKit.ts'
import { leafSize, leafVariant, type TreeShape } from './treeShape.ts'

export type TreeDraw = {
  /** Segments as they should appear now, growth already applied. */
  segments: readonly Segment[]
  shape: TreeShape
  /** Segments still growing in, with progress 0 to 1; their leaves bud late. */
  growing: { ids: ReadonlySet<string>; t: number } | null
  /** New growth that glows for the bloom pass, and how strongly (0 to 1). */
  fresh: { ids: ReadonlySet<string>; amount: number } | null
  /** 0 to 3: which root flare from the kit sits at the trunk base. */
  rootStage: number
  /** The kit's wood in the tree's colour, and that colour. */
  wood: Wood
  barkColor: string
  /** One per record: the canopy fills in as it rises, and the sign by the trunk shows it. */
  level: number
  /** Total LP: leaf clusters grow with it. */
  lp: number
  /** Tree houses, each built up to `progress` (0 to 1). Their residents are the stage's sprites. */
  houses: readonly { house: House; progress: number }[]
}

type Stroke = {
  kind: 'bark' | 'root'
  a: Point
  b: Point
  w0: number
  w1: number
  glow: [number, number, number] | null
  glowAmount: number
}

/** A short side twig with a leaf tuft, drawn for density; not a segment of its own. */
type Sprig = { owner: Segment; a: Point; b: Point }

const ROOT_GLOW: [number, number, number] = [255, 176, 92]
const ROOT_GLOW_ALPHA = 0.5
const BUD_AT = 0.55
const LEAF_AT = 0.85
/** Side twigs per branch: one to start, one more every this many levels, up to three. */
const SPRIG_EVERY = 8
const MAX_SPRIGS = 3
/** Branches longer than this (tiles) carry a second cluster partway along. */
const MID_CLUSTER_LEN = 2.6
/** From this level on, mid clusters are a size bigger. Tip clusters grow with LP instead (treeGrowth). */
const LUSH_LEVEL = 10

/**
 * Redraws the tree layer and its glow layer. Segment geometry is B's; every
 * pixel of wood and leaf comes from the module kit: bark is texture-mapped
 * along each stroke, then the root flare, branch-type twigs, side sprigs and
 * leaf clusters are stamped on, then tree houses, then the level sign.
 */
export function drawTree(tree: CanvasRenderingContext2D, glow: CanvasRenderingContext2D, kit: TreeKit, d: TreeDraw): void {
  tree.clearRect(0, 0, WORLD_W, WORLD_H)
  glow.clearRect(0, 0, WORLD_W, WORLD_H)
  const freshAmount = (id: string) => (d.fresh?.ids.has(id) ? d.fresh.amount : 0)
  const progress = (s: Segment) => (d.growing?.ids.has(s.id) ? d.growing.t : 1)

  const { rootWidth, trunkWidth, widths } = d.shape
  const strokes: Stroke[] = [
    { kind: 'root', a: SAPLING.base, b: SAPLING.rootTip, w0: rootWidth, w1: rootWidth - 1, glow: null, glowAmount: 0 },
  ]
  for (const s of d.segments) {
    if (s.kind !== 'root') continue
    const w = widths.get(s.id) ?? 2
    strokes.push({ kind: 'root', a: s.from, b: s.to, w0: w, w1: Math.max(2, Math.round(w * 0.7)), glow: ROOT_GLOW, glowAmount: freshAmount(s.id) })
  }
  const trunk =
    strokes.push({ kind: 'bark', a: SAPLING.base, b: SAPLING.top, w0: trunkWidth, w1: trunkWidth - 1, glow: null, glowAmount: 0 }) - 1
  const sprigs: Sprig[] = []
  for (const s of d.segments) {
    if (s.kind !== 'branch') continue
    const w = widths.get(s.id) ?? 3
    const glowColor = hexRgb(leafShades(s.leafColor ?? 'base').mid)
    strokes.push({ kind: 'bark', a: s.from, b: s.to, w0: w, w1: Math.max(2, Math.round(w * 0.75)), glow: glowColor, glowAmount: freshAmount(s.id) })
    if (progress(s) < LEAF_AT) continue
    for (const sprig of sprigsOf(s, d.level)) {
      sprigs.push(sprig)
      strokes.push({ kind: 'bark', a: sprig.a, b: sprig.b, w0: 2, w1: 2, glow: glowColor, glowAmount: freshAmount(s.id) })
    }
  }
  const spanAt = rasterize(tree, glow, d.wood, strokes)

  // The flare starts where it spreads, as wide as the trunk just above, so one runs into the other.
  const base = tileToPx(SAPLING.base)
  const probe = rootFlare(d.wood, d.rootStage, trunkWidth + 2)
  const top = Math.round(base.y - TILE / 2 - 2) + probe.cut
  const stub = spanAt(trunk, top - 1)
  const flare = stub ? rootFlare(d.wood, d.rootStage, stub.width) : probe
  tree.drawImage(flare.canvas, stub ? stub.left - flare.stubLeft : Math.round(base.x - flare.canvas.width / 2), top)

  for (const s of d.segments) {
    if (s.kind !== 'branch' || progress(s) < LEAF_AT) continue
    const color = s.leafColor ?? 'base'
    const twig = twigSprite(d.wood, color, leafVariant(s.id), s.to.x < s.from.x)
    const tip = tileToPx(s.to)
    const y = twigHangs(color) ? tip.y - twig.height / 2 + 4 : tip.y - twig.height + 6
    tree.drawImage(twig, Math.round(tip.x - twig.width / 2), Math.round(y))
  }

  stampCentred(tree, leafCluster(kit, 'base', 2, 0), tileToPx(SAPLING.top))
  const stamp = (s: Segment, cluster: HTMLCanvasElement, at: Point) => {
    stampCentred(tree, cluster, at)
    const amount = freshAmount(s.id)
    if (amount > 0) {
      glow.globalAlpha = amount
      stampCentred(glow, cluster, at)
      glow.globalAlpha = 1
    }
  }
  // Side tufts and mid clusters first, so each branch's tip cluster sits on top.
  for (const sprig of sprigs) {
    stamp(sprig.owner, leafCluster(kit, sprig.owner.leafColor ?? 'base', 1, leafVariant(sprig.owner.id)), tileToPx(sprig.b))
  }
  for (const s of d.segments) {
    if (s.kind !== 'branch' || progress(s) < LEAF_AT || length(s) < MID_CLUSTER_LEN) continue
    const size = d.level >= LUSH_LEVEL ? 2 : 1
    stamp(s, leafCluster(kit, s.leafColor ?? 'base', size, leafVariant(s.id) + 1), tileToPx(lerp(s.from, s.to, 0.55)))
  }
  for (const s of d.segments) {
    if (s.kind !== 'branch') continue
    const t = progress(s)
    if (t < BUD_AT) continue
    const size = t < LEAF_AT ? 1 : leafSize(s.id, d.lp)
    stamp(s, leafCluster(kit, s.leafColor ?? 'base', size, leafVariant(s.id)), tileToPx(s.to))
  }

  for (const { house, progress: p } of d.houses) {
    drawHouse(tree, house, d.barkColor, p)
    drawHouse(glow, house, d.barkColor, p, true)
  }

  drawLevelSign(tree, d.level, d.barkColor)
}

/**
 * A branch's side twigs: more as the tree levels up, each in a fixed place so
 * new ones join without the old ones moving. They lean upwards, off either side.
 */
function sprigsOf(s: Segment, level: number): Sprig[] {
  const count = Math.min(MAX_SPRIGS, 1 + Math.floor(level / SPRIG_EVERY))
  const len = length(s)
  if (len < 1.5) return []
  const dir = { x: (s.to.x - s.from.x) / len, y: (s.to.y - s.from.y) / len }
  const out: Sprig[] = []
  for (let k = 0; k < count; k++) {
    const rand = mulberry32(hashString(`${s.id}#${k}`))
    const a = lerp(s.from, s.to, 0.3 + 0.55 * rand())
    const turn = (0.55 + rand() * 0.45) * (k % 2 === 0 ? 1 : -1)
    let nx = dir.x * Math.cos(turn) - dir.y * Math.sin(turn)
    let ny = dir.x * Math.sin(turn) + dir.y * Math.cos(turn)
    if (ny > 0.2) {
      // Never droop: mirror a downward twig to the upper side.
      ;[nx, ny] = [dir.x * Math.cos(-turn) - dir.y * Math.sin(-turn), dir.x * Math.sin(-turn) + dir.y * Math.cos(-turn)]
    }
    const l = 0.9 + rand() * 0.7
    out.push({ owner: s, a, b: { x: a.x + nx * l, y: a.y + ny * l } })
  }
  return out
}

/** A small wooden sign right of the trunk with the tree's level on it. */
function drawLevelSign(ctx: CanvasRenderingContext2D, level: number, wood: string) {
  const text = `LV${Math.max(0, Math.floor(level))}`
  const width = text.length * 4 + 3
  const base = tileToPx(SAPLING.base)
  const x = Math.round(base.x + 20)
  const bottom = Math.round(base.y - TILE / 2 + 3)
  const boardTop = bottom - 16
  const [r, g, b] = hexRgb(wood)
  const board = `rgb(${Math.min(255, r + 46)}, ${Math.min(255, g + 36)}, ${Math.min(255, b + 24)})`
  const dark = '#2a2630'
  ctx.fillStyle = dark
  ctx.fillRect(x + Math.floor(width / 2) - 1, boardTop + 8, 3, bottom - boardTop - 8)
  ctx.fillRect(x - 1, boardTop - 1, width + 2, 9)
  ctx.fillStyle = board
  ctx.fillRect(x, boardTop, width, 7)
  ctx.fillStyle = `rgb(${r}, ${g}, ${b})`
  ctx.fillRect(x + Math.floor(width / 2), boardTop + 8, 1, bottom - boardTop - 8)
  ctx.fillStyle = dark
  ;[...text].forEach((ch, i) => {
    const rows = GLYPHS[ch]
    for (let gy = 0; gy < 5; gy++) {
      for (let gx = 0; gx < 3; gx++) if (rows[gy][gx] === '1') ctx.fillRect(x + 2 + i * 4 + gx, boardTop + 1 + gy, 1, 1)
    }
  })
}

const GLYPHS: Record<string, string[]> = {
  L: ['100', '100', '100', '100', '111'],
  V: ['000', '101', '101', '101', '010'],
  '0': ['111', '101', '101', '101', '111'],
  '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '011', '001', '111'],
  '4': ['101', '101', '111', '001', '001'],
  '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'],
  '7': ['111', '001', '010', '010', '010'],
  '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '111'],
}

function length(s: Segment): number {
  return Math.hypot(s.to.x - s.from.x, s.to.y - s.from.y)
}

function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

/** The drawn leaf cluster of a branch segment and where it sits, for hover outlines. */
export function clusterAt(kit: TreeKit, s: Segment, lp: number): { canvas: HTMLCanvasElement; x: number; y: number } {
  const canvas = leafCluster(kit, s.leafColor ?? 'base', leafSize(s.id, lp), leafVariant(s.id))
  const tip = tileToPx(s.to)
  return { canvas, x: Math.round(tip.x - canvas.width / 2), y: Math.round(tip.y - canvas.height / 2) }
}

function stampCentred(ctx: CanvasRenderingContext2D, sprite: HTMLCanvasElement, at: Point) {
  ctx.drawImage(sprite, Math.round(at.x - sprite.width / 2), Math.round(at.y - sprite.height / 2))
}

/**
 * Draws the strokes and returns where stroke `index` lies on world pixel row `y`:
 * its left outline column and its width, outline included (null if it misses the row).
 */
function rasterize(
  tree: CanvasRenderingContext2D,
  glow: CanvasRenderingContext2D,
  wood: Wood,
  strokes: Stroke[],
): (index: number, y: number) => { left: number; width: number } | null {
  const ends = strokes.map((st) => ({ a: tileToPx(st.a), b: tileToPx(st.b) }))
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  ends.forEach(({ a, b }, i) => {
    const r = Math.max(strokes[i].w0, strokes[i].w1) / 2 + 2
    minX = Math.min(minX, a.x - r, b.x - r)
    minY = Math.min(minY, a.y - r, b.y - r)
    maxX = Math.max(maxX, a.x + r, b.x + r)
    maxY = Math.max(maxY, a.y + r, b.y + r)
  })
  const bx = Math.floor(minX)
  const by = Math.floor(minY)
  const bw = Math.ceil(maxX) - bx + 1
  const bh = Math.ceil(maxY) - by + 1
  const owner = new Int16Array(bw * bh).fill(-1)
  const across = new Float32Array(bw * bh)
  const along = new Float32Array(bw * bh)

  ends.forEach(({ a, b }, index) => {
    const st = strokes[index]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len = Math.hypot(dx, dy)
    const ux = len > 0 ? dx / len : 0
    const uy = len > 0 ? dy / len : -1
    // Pick the normal that points right or down, so the bark's lit side stays up and left.
    const flip = -uy + ux < 0 ? -1 : 1
    const nx = -uy * flip
    const ny = ux * flip
    const steps = Math.max(1, Math.ceil(len * 2))
    for (let s = 0; s <= steps; s++) {
      const t = s / steps
      const cx = a.x + dx * t - bx
      const cy = a.y + dy * t - by
      const r = (st.w0 + (st.w1 - st.w0) * t) / 2
      for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(bh - 1, Math.ceil(cy + r)); y++) {
        for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(bw - 1, Math.ceil(cx + r)); x++) {
          const px = x + 0.5 - cx
          const py = y + 0.5 - cy
          if (px * px + py * py > r * r) continue
          const i = y * bw + x
          owner[i] = index
          across[i] = (px * nx + py * ny) / r
          along[i] = len * t + px * ux + py * uy
        }
      }
    }
  })

  const treeImg = tree.createImageData(bw, bh)
  const glowImg = glow.createImageData(bw, bh)
  const out = new Uint32Array(treeImg.data.buffer)
  const lit = new Uint32Array(glowImg.data.buffer)
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= bw || y >= bh ? -1 : owner[y * bw + x])
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      const i = y * bw + x
      const o = owner[i]
      if (o < 0) {
        const n = Math.max(at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1))
        if (n >= 0) out[i] = wood.outline
        continue
      }
      const st = strokes[o]
      const tex = st.kind === 'bark' ? wood.barkTrunk : wood.barkRoot
      const u = Math.round((across[i] * 0.5 + 0.5) * (tex.w - 1))
      const v = ((Math.floor(along[i]) % tex.h) + tex.h) % tex.h
      const texel = tex.data[v * tex.w + u]
      out[i] = texel >>> 24 ? texel : packHex((st.kind === 'bark' ? BARK : ROOT).mid)
      if (st.glow) {
        const a =
          st.glowAmount > 0 ? st.glowAmount : st.kind === 'root' && Math.abs(across[i]) < 0.35 ? ROOT_GLOW_ALPHA : 0
        if (a > 0) lit[i] = rgba(st.glow, a)
      }
    }
  }
  tree.putImageData(treeImg, bx, by)
  glow.putImageData(glowImg, bx, by)

  return (index, y) => {
    const row = y - by
    if (row < 0 || row >= bh) return null
    let lo = bw
    let hi = -1
    for (let x = 0; x < bw; x++) {
      if (owner[row * bw + x] !== index) continue
      lo = Math.min(lo, x)
      hi = x
    }
    return hi < lo ? null : { left: bx + lo - 1, width: hi - lo + 3 }
  }
}

function rgba([r, g, b]: [number, number, number], a: number): number {
  return ((Math.round(a * 255) << 24) | (b << 16) | (g << 8) | r) >>> 0
}
