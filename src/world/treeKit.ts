// The module kit cut from worldtreeprocedural.jpeg by tools/extract_art.py:
// bark to texture-map along segments, root flares, base-green leaf clusters
// (recoloured per activity, the guide's "colour application" merge) and the
// four branch types. All the wood can be put in one colour.
import type { ColorId } from '../types.ts'
import { TREE_KIT } from './artLayout.ts'
import kitUrl from './assets/tree-kit.png'
import { LEAF } from './palette.ts'
import { mulberry32 } from './rng.ts'
import { makeCanvas, withOutline } from './sprites.ts'
import type { LeafSize } from './treeShape.ts'

type KitName = keyof typeof TREE_KIT

/** A sprite's pixels as RGBA words, for sampling bark as a texture. */
export type Pixels = { w: number; h: number; data: Uint32Array }

export type TreeKit = {
  barkTrunk: Pixels
  barkRoot: Pixels
  rootFlares: HTMLCanvasElement[]
  /** The kit's dark grey outline (packed RGBA), so bark strokes are edged like its sprites. */
  outline: number
  leaves: HTMLCanvasElement[]
  twigs: HTMLCanvasElement[]
}

// Branch type per leaf colour: oak, willow, pine, fruiting (two variants each in the kit).
const TWIG_TYPE: Record<ColorId, number> = { base: 0, break: 0, reflect: 1, walk: 2, connect: 3 }

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Could not load ${url}`))
    img.src = url
  })
}

export async function loadTreeKit(): Promise<TreeKit> {
  const img = await loadImage(kitUrl)
  const cut = (name: KitName) => {
    const r = TREE_KIT[name]
    const { canvas, ctx } = makeCanvas(r.w, r.h)
    ctx.drawImage(img, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h)
    return canvas
  }
  const range = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => cut(`${prefix}${i}` as KitName))
  const rootFlares = range('roots', 4)
  return {
    barkTrunk: solidColumns(pixels(cut('bark0'))),
    barkRoot: solidColumns(pixels(cut('bark1'))),
    rootFlares,
    outline: darkest(pixels(rootFlares[0])),
    leaves: range('leaf', 5),
    twigs: range('twig', 8),
  }
}

/** The kit's wood in one colour: what the tree is drawn with. */
export type Wood = Pick<TreeKit, 'barkTrunk' | 'barkRoot' | 'rootFlares' | 'outline' | 'twigs'>

const woods = new Map<string, Wood>()

/**
 * Every wood pixel of the kit (bark, root flares, branch types) recoloured to
 * `color` by its brightness, so trunk, branches and roots are one even colour
 * whatever the player picks. Leaves, willow strands and fruit keep theirs.
 */
export function woodIn(kit: TreeKit, color: string): Wood {
  const cached = woods.get(color)
  if (cached) return cached
  const target = hexRgb(color)
  const reference = meanLum(kit.rootFlares.map(pixels))
  const tint = (c: number) => {
    if (!(c >>> 24) || !isWood(c)) return c
    const k = lum(c) / reference
    let out = c & 0xff000000
    for (let ch = 0; ch < 3; ch++) out |= Math.max(0, Math.min(255, Math.round(target[ch] * k))) << (8 * ch)
    return out >>> 0
  }
  const tinted = (px: Pixels): Pixels => ({ w: px.w, h: px.h, data: px.data.map(tint) })
  const canvas = (src: HTMLCanvasElement) => {
    const px = tinted(pixels(src))
    const { canvas, ctx } = makeCanvas(px.w, px.h)
    const img = ctx.createImageData(px.w, px.h)
    new Uint32Array(img.data.buffer).set(px.data)
    ctx.putImageData(img, 0, 0)
    return canvas
  }
  const wood = {
    barkTrunk: tinted(kit.barkTrunk),
    barkRoot: tinted(kit.barkRoot),
    rootFlares: kit.rootFlares.map(canvas),
    outline: tint(kit.outline),
    twigs: kit.twigs.map(canvas),
  }
  woods.set(color, wood)
  return wood
}

/** Bark is a low-saturation brown or olive grey; leaves, strands and fruit are not. */
function isWood(c: number): boolean {
  const r = c & 0xff
  const g = (c >>> 8) & 0xff
  const b = (c >>> 16) & 0xff
  return Math.max(r, g, b) - Math.min(r, g, b) < 48 && g <= r + 6
}

function pixels(canvas: HTMLCanvasElement): Pixels {
  const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data
  return { w: canvas.width, h: canvas.height, data: new Uint32Array(data.buffer) }
}

const lum = (c: number) => (c & 0xff) * 0.3 + ((c >>> 8) & 0xff) * 0.59 + ((c >>> 16) & 0xff) * 0.11

/** The middle of a sprite's darkest tenth: its outline colour. */
export function darkest(px: Pixels): number {
  const solid = [...px.data].filter((c) => c >>> 24).sort((a, b) => lum(a) - lum(b))
  return solid[Math.floor(solid.length * 0.05)]
}

/** Mean brightness of sprites' opaque pixels, outline (the darkest tenth) left out. */
function meanLum(sprites: Pixels[]): number {
  const solid = sprites.flatMap((px) => [...px.data].filter((c) => c >>> 24).map(lum)).sort((a, b) => a - b)
  const body = solid.slice(Math.floor(solid.length * 0.1))
  return body.reduce((sum, v) => sum + v, 0) / Math.max(1, body.length)
}

/**
 * The widest run of columns with no clear texel. Bark is stretched across a stroke's
 * whole width, so a clear edge column would show as a stripe of fallback colour.
 */
export function solidColumns(px: Pixels): Pixels {
  const solid = (x: number) => {
    for (let y = 0; y < px.h; y++) if (!(px.data[y * px.w + x] >>> 24)) return false
    return true
  }
  let best = { start: 0, end: 0 }
  for (let start = 0, x = 0; x <= px.w; x++) {
    if (x < px.w && solid(x)) continue
    if (x - start > best.end - best.start) best = { start, end: x }
    start = x + 1
  }
  if (best.end === best.start || best.end - best.start === px.w) return px
  const w = best.end - best.start
  const data = new Uint32Array(w * px.h)
  for (let y = 0; y < px.h; y++) data.set(px.data.subarray(y * px.w + best.start, y * px.w + best.end), y * w)
  return { w, h: px.h, data }
}

const recoloured = new Map<string, HTMLCanvasElement>()

/**
 * Maps a base-green sprite onto a colour's four shades by brightness rank, so
 * every colour keeps the hand-drawn light and shadow. `shift` darkens by steps.
 */
function recolour(kit: TreeKit, index: number, color: ColorId, shift: number): HTMLCanvasElement {
  const key = `${index}:${color}:${shift}`
  const cached = recoloured.get(key)
  if (cached) return cached
  const src = kit.leaves[index]
  const { canvas, ctx } = makeCanvas(src.width, src.height)
  const img = src.getContext('2d')!.getImageData(0, 0, src.width, src.height)
  const d = img.data
  const lums: number[] = []
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 0) lums.push(d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11)
  const sorted = [...lums].sort((a, b) => a - b)
  const cut = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]
  const steps = [cut(0.12), cut(0.45), cut(0.82)]
  const s = LEAF[color]
  const ramp = [s.outline, s.dark, s.mid, s.light].map(hexRgb)
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue
    const lum = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11
    const level = lum < steps[0] ? 0 : lum < steps[1] ? 1 : lum < steps[2] ? 2 : 3
    const [r, g, b] = ramp[level === 0 ? 0 : Math.max(1, level - shift)]
    d[i] = r
    d[i + 1] = g
    d[i + 2] = b
    d[i + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  recoloured.set(key, canvas)
  return canvas
}

const clusters = new Map<string, HTMLCanvasElement>()

const PIECES: Record<LeafSize, number> = { 1: 1, 2: 6, 3: 11, 4: 18 }

/**
 * A bush `size` tiles wide, assembled from kit clusters (back pieces a shade
 * darker) and outlined in the colour's darkest shade. 2px wider than size * 16 + 16.
 */
export function leafCluster(kit: TreeKit, color: ColorId, size: LeafSize, variant: number): HTMLCanvasElement {
  const key = `${color}:${size}:${variant}`
  const cached = clusters.get(key)
  if (cached) return cached
  const side = size * 16 + 16
  const { canvas, ctx } = makeCanvas(side, side)
  const rand = mulberry32(variant * 977 + size * 31 + 5)
  const count = PIECES[size]
  const reach = size * 8 - 3
  const pieces = Array.from({ length: count }, (_, i) => {
    const angle = rand() * Math.PI * 2
    const dist = i === 0 ? 0 : reach * Math.sqrt(0.35 + rand() * 0.65)
    return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist * 0.8, index: Math.floor(rand() * kit.leaves.length) }
  })
  // Upper pieces first and darker, lower pieces last and brighter: a lit, rounded crown.
  pieces.sort((a, b) => a.y - b.y)
  pieces.forEach((p, i) => {
    const sprite = recolour(kit, p.index, color, i < count / 3 ? 1 : 0)
    ctx.drawImage(sprite, Math.round(side / 2 + p.x - sprite.width / 2), Math.round(side / 2 + p.y - sprite.height / 2))
  })
  const bush = withOutline(canvas, LEAF[color].outline)
  clusters.set(key, bush)
  return bush
}

/**
 * Source column for each column of a sprite made `delta` columns wider (or narrower),
 * repeating (or dropping) evenly spaced columns strictly between `left` and `right`, so
 * the pixels keep their size and the outline columns stay put. At least one inner
 * column is always kept.
 */
export function resizedColumns(width: number, left: number, right: number, delta: number): number[] {
  const inner = Array.from({ length: Math.max(0, right - left - 1) }, (_, i) => left + 1 + i)
  const copies = new Array<number>(width).fill(1)
  const n = inner.length === 0 ? 0 : Math.min(Math.abs(delta), delta < 0 ? inner.length - 1 : Infinity)
  for (let k = 0; k < n; k++) copies[inner[Math.floor(((k + 0.5) * inner.length) / n) % inner.length]] += Math.sign(delta)
  return copies.flatMap((count, x) => new Array<number>(count).fill(x))
}

export type RootFlare = {
  canvas: HTMLCanvasElement
  /** The stub's left outline column in `canvas`. */
  stubLeft: number
  /** Rows of straight stub left off the top: the trunk itself is drawn there instead. */
  cut: number
}

const flares = new WeakMap<Wood, Map<string, RootFlare>>()

/**
 * Root flare `stage` from the row where it starts to spread, its stub widened or
 * narrowed to `stubWidth` pixels (outline included) so it carries on from a trunk of
 * any thickness. The kit's straight stub (with its mossy collar) is left off, so the
 * bark runs unbroken into the roots.
 */
export function rootFlare(wood: Wood, stage: number, stubWidth: number): RootFlare {
  const index = Math.max(0, Math.min(wood.rootFlares.length - 1, stage))
  const key = `${index}:${stubWidth}`
  let made = flares.get(wood)
  if (!made) flares.set(wood, (made = new Map()))
  const cached = made.get(key)
  if (cached) return cached
  const src = pixels(wood.rootFlares[index])
  const span = (y: number) => {
    let l = 0
    while (l < src.w && !(src.data[y * src.w + l] >>> 24)) l++
    let r = src.w - 1
    while (r > l && !(src.data[y * src.w + r] >>> 24)) r--
    return [l, r]
  }
  const [left, right] = span(0)
  let cut = 1
  while (cut < src.h - 1 && span(cut)[0] === left && span(cut)[1] === right) cut++
  const cols = resizedColumns(src.w, left, right, stubWidth - (right - left + 1))
  const h = src.h - cut
  const { canvas, ctx } = makeCanvas(cols.length, h)
  const img = ctx.createImageData(cols.length, h)
  const out = new Uint32Array(img.data.buffer)
  for (let y = 0; y < h; y++) cols.forEach((x, i) => (out[y * cols.length + i] = src.data[(y + cut) * src.w + x]))
  ctx.putImageData(img, 0, 0)
  const flare = { canvas, stubLeft: left, cut }
  made.set(key, flare)
  return flare
}

const flipped = new Map<HTMLCanvasElement, HTMLCanvasElement>()

/** The branch type for a leaf colour, mirrored when the branch leans left. */
export function twigSprite(wood: Wood, color: ColorId, variant: number, leansLeft: boolean): HTMLCanvasElement {
  const sprite = wood.twigs[TWIG_TYPE[color] * 2 + (variant & 1)]
  if (!leansLeft) return sprite
  let mirror = flipped.get(sprite)
  if (!mirror) {
    const made = makeCanvas(sprite.width, sprite.height)
    made.ctx.scale(-1, 1)
    made.ctx.drawImage(sprite, -sprite.width, 0)
    mirror = made.canvas
    flipped.set(sprite, mirror)
  }
  return mirror
}

/** Willow strands hang, so that type is centred on the tip instead of standing on it. */
export function twigHangs(color: ColorId): boolean {
  return TWIG_TYPE[color] === 1
}

export function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}
