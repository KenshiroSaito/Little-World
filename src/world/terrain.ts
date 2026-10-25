import {
  DEEP_STONE_TOP,
  PEDESTAL,
  RUIN,
  RUIN_PILLARS,
  STONE_TOP,
  SURFACE_Y,
  TABLET,
  TILE,
  WORLD,
  WORLD_H,
  WORLD_W,
  inRect,
  tileToPx,
  type Point,
} from './layout.ts'
import { CLOUD, DEEP_STONE, FLOWERS, GRASS, HILLS, ROOT, RUIN_BACK, RUIN_STONE, SKY, SOIL, STONE, packHex } from './palette.ts'
import { mulberry32, noise2 } from './rng.ts'
import { SPRITES, makeCanvas, type SpriteDef } from './sprites.ts'

type Put = (x: number, y: number, color: string) => void
type StonePalette = typeof STONE
type BrickPalette = typeof RUIN_BACK
/** Horizontal extent of a carved column at one pixel row, and which edge of a block it is. */
type Span = { l: number; r: number; edge: 'top' | 'bottom' | null } | null

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
const CLOUDS = [
  { x: -27, y: -21, w: 5 },
  { x: -13, y: -24, w: 4 },
  { x: 15, y: -22, w: 6 },
  { x: 28, y: -17, w: 4 },
  { x: -21, y: -13, w: 3 },
]
const CARVINGS = [
  ['.xxx.', 'x...x', 'x.x.x', 'x..x.', '.xx..'],
  ['..x..', '.xxx.', 'x.x.x', '..x..', '.x.x.'],
  ['x...x', '.x.x.', '..x..', '.x.x.', 'x...x'],
]

/** Sky, hills, ground layers and the buried ruin. Painted once; nothing here changes with growth. */
export function drawTerrain(): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(WORLD_W, WORLD_H)
  const img = ctx.createImageData(WORLD_W, WORLD_H)
  const buf = new Uint32Array(img.data.buffer)
  const put: Put = (x, y, color) => {
    if (x < 0 || y < 0 || x >= WORLD_W || y >= WORLD_H) return
    buf[y * WORLD_W + x] = packHex(color)
  }
  const groundTop = (SURFACE_Y - WORLD.top) * TILE

  paintSky(put, groundTop)
  paintClouds(put)
  paintHills(put, groundTop)
  for (let ty = SURFACE_Y; ty <= WORLD.bottom; ty++) {
    for (let tx = WORLD.left; tx <= WORLD.right; tx++) paintTile(put, tx, ty)
  }
  paintRuinDetails(put)
  paintTufts(put, groundTop)

  ctx.putImageData(img, 0, 0)
  return canvas
}

function tileOrigin(tx: number, ty: number): Point {
  return { x: (tx - WORLD.left) * TILE, y: (ty - WORLD.top) * TILE }
}

function tileRand(tx: number, ty: number, salt: number): () => number {
  return mulberry32(Math.floor(noise2(tx, ty, salt) * 4294967296))
}

function paintSky(put: Put, height: number) {
  for (let y = 0; y < height; y++) {
    const f = (y / height) * (SKY.length - 1)
    const band = Math.min(SKY.length - 2, Math.floor(f))
    // Solid bands, dithered only where one meets the next.
    const blend = Math.max(0, (f - band - 0.7) / 0.3)
    for (let x = 0; x < WORLD_W; x++) {
      const threshold = (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16
      put(x, y, blend > threshold ? SKY[band + 1] : SKY[band])
    }
  }
}

function paintClouds(put: Put) {
  CLOUDS.forEach((cloud, n) => {
    const rand = mulberry32(n + 11)
    const centre = tileToPx(cloud)
    const half = (cloud.w * TILE) / 2
    const count = 3 + cloud.w
    const puffs = Array.from({ length: count }, (_, i) => ({
      x: centre.x - half + ((i + 0.5) / count) * half * 2,
      y: centre.y - rand() * 6,
      r: 5 + rand() * half * 0.45,
    }))
    const base = Math.round(centre.y + 6)
    const reach = half + half * 0.45 + 5
    for (let y = Math.floor(centre.y - reach); y <= base; y++) {
      for (let x = Math.floor(centre.x - reach); x <= centre.x + reach; x++) {
        if (puffs.some((p) => Math.hypot(x - p.x, y - p.y) <= p.r)) put(x, y, y >= base - 2 ? CLOUD.shade : CLOUD.light)
      }
    }
  })
}

function paintHills(put: Put, groundTop: number) {
  for (let x = 0; x < WORLD_W; x++) {
    const far = 30 + 14 * Math.sin(x * 0.011 + 1) + 7 * Math.sin(x * 0.029)
    const near = 14 + 8 * Math.sin(x * 0.017 + 2) + 4 * Math.sin(x * 0.047)
    for (let y = Math.floor(groundTop - far); y < groundTop; y++) put(x, y, HILLS.far)
    for (let y = Math.floor(groundTop - near); y < groundTop; y++) put(x, y, HILLS.near)
  }
}

/** Layer boundaries wobble by a tile per column, except near the trunk where depth must be exact. */
function layerTop(tx: number, top: number, salt: number): number {
  if (Math.abs(tx) <= 2) return top
  return top + (noise2(tx, 0, salt) < 0.3 ? -1 : 0) + (noise2(tx, 1, salt) < 0.2 ? 1 : 0)
}

function paintTile(put: Put, tx: number, ty: number) {
  const o = tileOrigin(tx, ty)
  if (inRect(RUIN, tx, ty)) paintRuinTile(put, tx, ty, o)
  else if (ty === SURFACE_Y) paintGrass(put, tx, o)
  else if (ty >= layerTop(tx, DEEP_STONE_TOP, 21)) paintStone(put, tx, ty, o, DEEP_STONE)
  else if (ty >= layerTop(tx, STONE_TOP, 17)) paintStone(put, tx, ty, o, STONE)
  else paintSoil(put, tx, ty, o)
}

function paintSoil(put: Put, tx: number, ty: number, o: Point) {
  for (let py = 0; py < TILE; py++) {
    for (let px = 0; px < TILE; px++) {
      const x = o.x + px
      const y = o.y + py
      const n = noise2(x, y, 3)
      let c = n < 0.07 ? SOIL.dark : n > 0.95 ? SOIL.light : SOIL.mid
      if ((py === TILE - 1 || px === TILE - 1) && noise2(x, y, 4) < 0.55) c = SOIL.dark
      else if ((py === 0 || px === 0) && noise2(x, y, 4) < 0.3) c = SOIL.light
      put(x, y, c)
    }
  }
  const variant = noise2(tx, ty, 5)
  const rand = tileRand(tx, ty, 6)
  if (variant < 0.14) {
    const pebbles = 1 + Math.floor(rand() * 3)
    for (let i = 0; i < pebbles; i++) {
      const px = o.x + 2 + Math.floor(rand() * 11)
      const py = o.y + 2 + Math.floor(rand() * 11)
      for (let dx = 0; dx < 3; dx++) {
        put(px + dx, py, SOIL.pebble)
        put(px + dx, py + 1, SOIL.pebble)
      }
      put(px, py, SOIL.pebbleLight)
      put(px + 2, py + 1, SOIL.dark)
    }
  } else if (variant < 0.2) {
    let x = 3 + Math.floor(rand() * 10)
    const length = 5 + Math.floor(rand() * 5)
    for (let py = 0; py < length; py++) {
      put(o.x + x, o.y + py, ROOT.dark)
      if (rand() < 0.35) x = Math.min(14, Math.max(1, x + (rand() < 0.5 ? -1 : 1)))
    }
  }
}

function paintGrass(put: Put, tx: number, o: Point) {
  paintSoil(put, tx, SURFACE_Y, o)
  for (let px = 0; px < TILE; px++) {
    const x = o.x + px
    const depth = 3 + Math.floor(noise2(x, 0, 9) * 3)
    for (let py = 0; py < depth; py++) {
      put(x, o.y + py, py === 0 ? GRASS.light : py === depth - 1 ? GRASS.dark : GRASS.mid)
    }
    if (noise2(x, 1, 9) < 0.3) put(x, o.y + depth, GRASS.dark)
  }
}

/** Grass blades and flowers poking up into the sky row, kept clear of the trunk. */
function paintTufts(put: Put, groundTop: number) {
  for (let x = 0; x < WORLD_W; x++) {
    const n = noise2(x, 2, 9)
    if (n < 0.28) put(x, groundTop - 1, GRASS.mid)
    if (n < 0.1) put(x, groundTop - 2, GRASS.light)
  }
  for (let tx = WORLD.left; tx <= WORLD.right; tx++) {
    if (Math.abs(tx) <= 1 || noise2(tx, 3, 9) > 0.22) continue
    const x = tileOrigin(tx, 0).x + 3 + Math.floor(noise2(tx, 4, 9) * 10)
    const petal = FLOWERS[Math.floor(noise2(tx, 5, 9) * FLOWERS.length)]
    put(x, groundTop - 1, GRASS.dark)
    put(x, groundTop - 2, GRASS.dark)
    put(x, groundTop - 3, GRASS.mid)
    put(x - 1, groundTop - 4, petal)
    put(x + 1, groundTop - 4, petal)
    put(x, groundTop - 5, petal)
    put(x, groundTop - 4, petal === FLOWERS[0] ? '#b8762a' : FLOWERS[0])
  }
}

function paintStone(put: Put, tx: number, ty: number, o: Point, pal: StonePalette) {
  for (let py = 0; py < TILE; py++) {
    for (let px = 0; px < TILE; px++) {
      const x = o.x + px
      const y = o.y + py
      const n = noise2(x, y, 13)
      let c = n < 0.06 ? pal.dark : n > 0.94 ? pal.light : pal.mid
      if ((py === TILE - 1 || px === TILE - 1) && noise2(x, y, 14) < 0.75) c = pal.dark
      else if ((py === 0 || px === 0) && noise2(x, y, 14) < 0.5) c = pal.light
      put(x, y, c)
    }
  }
  const variant = noise2(tx, ty, 15)
  const rand = tileRand(tx, ty, 16)
  if (variant < 0.16) {
    let x = 2 + Math.floor(rand() * 12)
    const length = 6 + Math.floor(rand() * 6)
    for (let y = 1; y <= Math.min(14, length); y++) {
      put(o.x + x, o.y + y, pal.dark)
      x = Math.min(14, Math.max(1, x + (rand() < 0.5 ? -1 : 1)))
    }
  } else if (variant < 0.2) {
    const x = o.x + 3 + Math.floor(rand() * 9)
    const y = o.y + 3 + Math.floor(rand() * 9)
    put(x, y, pal.ore)
    put(x + 1, y, pal.ore)
    put(x, y + 1, pal.ore)
    put(x + 1, y + 1, pal.light)
  }
}

function paintRuinTile(put: Put, tx: number, ty: number, o: Point) {
  const shell = ty === RUIN.top || ty === RUIN.bottom || tx === RUIN.left || tx === RUIN.right
  if (ty === RUIN.bottom) paintFlagstone(put, o)
  else paintBricks(put, o, shell ? RUIN_STONE : RUIN_BACK, tx * 31 + ty)

  if (shell && ty !== RUIN.bottom && noise2(tx, ty, 31) < 0.28) {
    const carving = CARVINGS[Math.floor(noise2(tx, ty, 32) * CARVINGS.length)]
    stampRows(put, carving, o.x + 5, o.y + 1, RUIN_STONE.glyph)
  }
  if (tx === 0 && ty === RUIN.top) {
    // The crack the taproot comes through.
    for (let py = 0; py < TILE; py++) put(o.x + 7 + (py % 3 === 0 ? 1 : 0), o.y + py, RUIN_STONE.mortar)
  }
  if (shell) return

  if (ty === RUIN.top + 1 && (tx === RUIN.left + 1 || tx === RUIN.right - 1)) {
    const mirror = tx === RUIN.right - 1
    for (let py = 0; py < TILE; py++) {
      for (let px = 0; px < TILE; px++) {
        const along = (mirror ? TILE - 1 - px : px) + py
        if (along >= TILE) continue
        put(o.x + px, o.y + py, along === TILE - 1 ? RUIN_STONE.dark : py === 7 ? RUIN_STONE.mortar : RUIN_STONE.mid)
      }
    }
  }
  if (RUIN_PILLARS.includes(tx)) {
    const part = ty === RUIN.top + 1 ? 'capital' : ty === RUIN.bottom - 1 ? 'base' : 'shaft'
    paintColumn(put, o, (py) => {
      if (part === 'capital' && py < 5) return { l: 0, r: 15, edge: py === 0 ? 'top' : py === 4 ? 'bottom' : null }
      if (part === 'base' && py >= 11) return { l: 1, r: 14, edge: py === 11 ? 'top' : py === 15 ? 'bottom' : null }
      return { l: 3, r: 12, edge: null }
    }, [6, 9])
  }
}

function paintBricks(put: Put, o: Point, pal: BrickPalette, salt: number) {
  for (let py = 0; py < TILE; py++) {
    const seam = py < 8 ? 0 : 8
    const by = py % 8
    for (let px = 0; px < TILE; px++) {
      const x = o.x + px
      const y = o.y + py
      let c: string
      if (by === 7 || px === seam) c = pal.mortar
      else if (by === 0 || px === seam + 1) c = pal.light
      else if (by === 6) c = pal.dark
      else c = noise2(x, y, salt) < 0.08 ? pal.dark : pal.mid
      put(x, y, c)
    }
  }
}

function paintFlagstone(put: Put, o: Point) {
  for (let py = 0; py < TILE; py++) {
    for (let px = 0; px < TILE; px++) {
      const c =
        py === TILE - 1 || px === TILE - 1
          ? RUIN_STONE.mortar
          : py === 0
            ? RUIN_STONE.light
            : py === TILE - 2
              ? RUIN_STONE.dark
              : RUIN_STONE.mid
      put(o.x + px, o.y + py, c)
    }
  }
}

/** A carved block shaded from the left, row by row from `span`; `flutes` are darker columns. */
function paintColumn(put: Put, o: Point, span: (py: number) => Span, flutes: number[] = []) {
  for (let py = 0; py < TILE; py++) {
    const s = span(py)
    if (!s) continue
    for (let px = s.l; px <= s.r; px++) {
      let c: string
      if (px === s.l || px === s.r) c = RUIN_STONE.mortar
      else if (s.edge === 'top' || px === s.l + 1) c = RUIN_STONE.light
      else if (s.edge === 'bottom' || px === s.r - 1 || flutes.includes(px)) c = RUIN_STONE.dark
      else c = RUIN_STONE.mid
      put(o.x + px, o.y + py, c)
    }
  }
}

function paintRuinDetails(put: Put) {
  // The tablet wall: one slab with ancient carving, which glows once the roots arrive.
  const t = tabletRect()
  for (let y = 0; y < t.h; y++) {
    for (let x = 0; x < t.w; x++) {
      const edge = x === 0 || y === 0 || x === t.w - 1 || y === t.h - 1
      const c = edge
        ? RUIN_STONE.mortar
        : x === 1 || y === 1
          ? RUIN_STONE.light
          : x === t.w - 2 || y === t.h - 2
            ? RUIN_STONE.dark
            : RUIN_STONE.mid
      put(t.x + x, t.y + y, c)
    }
  }
  for (const line of tabletGlyphLines()) for (const p of line) put(p.x, p.y, RUIN_STONE.glyph)

  paintColumn(put, tileOrigin(PEDESTAL.x, PEDESTAL.y), (py) => {
    if (py < 3) return null
    if (py <= 5) return { l: 1, r: 14, edge: py === 3 ? 'top' : py === 5 ? 'bottom' : null }
    if (py <= 12) return { l: 4, r: 11, edge: null }
    return { l: 2, r: 13, edge: py === 13 ? 'top' : null }
  })

  const floor = RUIN.bottom - 1
  stampSprite(put, SPRITES.urn, tileOrigin(8, floor))
  stampSprite(put, SPRITES.rubble, tileOrigin(9, floor))
  stampSprite(put, SPRITES.rubble, tileOrigin(-4, floor))
}

function stampRows(put: Put, rows: string[], x: number, y: number, color: string) {
  rows.forEach((row, dy) => {
    for (let dx = 0; dx < row.length; dx++) if (row[dx] !== '.') put(x + dx, y + dy, color)
  })
}

function stampSprite(put: Put, def: SpriteDef, o: Point) {
  def.rows.forEach((row, dy) => {
    for (let dx = 0; dx < row.length; dx++) {
      const color = def.colors[row[dx]]
      if (color) put(o.x + dx, o.y + dy, color)
    }
  })
}

function tabletRect() {
  const o = tileOrigin(TABLET.left, TABLET.top)
  return { x: o.x, y: o.y, w: (TABLET.right - TABLET.left + 1) * TILE, h: (TABLET.bottom - TABLET.top + 1) * TILE }
}

let glyphLines: Point[][] | null = null

/** Carved lines on the tablet, top to bottom, as world pixels. Each reflection lights one line. */
export function tabletGlyphLines(): Point[][] {
  if (glyphLines) return glyphLines
  const t = tabletRect()
  const rand = mulberry32(2026)
  const lines: Point[][] = []
  for (let ly = 5; ly + 3 <= t.h - 4; ly += 6) {
    const line: Point[] = []
    const end = t.w - 4 - Math.floor(rand() * 10)
    for (let lx = 4; lx + 3 <= end; lx += 4 + Math.floor(rand() * 2)) {
      const bits = 1 + Math.floor(rand() * 511)
      for (let b = 0; b < 9; b++) {
        if (bits & (1 << b)) line.push({ x: t.x + lx + (b % 3), y: t.y + ly + Math.floor(b / 3) })
      }
    }
    lines.push(line)
  }
  glyphLines = lines
  return lines
}
