import { HIGHLIGHT, RUIN_STONE } from './palette.ts'

export type SpriteDef = { rows: string[]; colors: Record<string, string> }

// 16x16 pixel sprites. '.' is transparent; every other character is looked up in colors.
export const SPRITES = {
  carvedStone: {
    colors: { o: '#26282f', d: '#585c68', m: '#7f838e', l: '#a9adb6', g: '#8fe8d2' },
    rows: [
      '................',
      '.....oooooo.....',
      '...oodmmmmmoo...',
      '..odmmmmmmmllo..',
      '..odmmmgmmmllo..',
      '.odmmmmgmmmmllo.',
      '.odmmgmgmgmmmlo.',
      '.odmmmggggmmmlo.',
      '.odmmmmggmmmmmo.',
      '.oddmmmggmmmmmo.',
      '.oddmmgmmgmmmdo.',
      '..oddgmmmmgmdo..',
      '..oodgmmmmmgdo..',
      '...oodddddddo...',
      '.....ooooooo....',
      '................',
    ],
  },
  heartwood: {
    colors: { o: '#3a1f0e', b: '#6b3f1f', r: '#a0612c', w: '#d99a52', h: '#f5c77e', c: '#fff1b8' },
    rows: [
      '................',
      '.....oooooo.....',
      '...oobbbbbboo...',
      '..obbwwwwwwbbo..',
      '..obwwrrrrwwbo..',
      '.obwwrwwwwrwwbo.',
      '.obwrwwhhwwrwbo.',
      '.obwrwhcchwrwbo.',
      '.obwrwhcchwrwbo.',
      '.obwrwwhhwwrwbo.',
      '.obwwrwwwwrwwbo.',
      '..obwwrrrrwwbo..',
      '..obbwwwwwwbbo..',
      '...oobbbbbboo...',
      '.....oooooo.....',
      '................',
    ],
  },
  urn: {
    colors: { o: '#5a4632', m: '#b07a4a', l: '#d9a070', d: '#7a4e2c', g: '#8a7556' },
    rows: [
      '................',
      '................',
      '................',
      '................',
      '.....oooooo.....',
      '......ommo......',
      '.....ommmmo.....',
      '....omlmmmmo....',
      '...omlmmmmmdo...',
      '...omlmgmgmdo...',
      '...ommmmmmmdo...',
      '...ommgggggdo...',
      '....ommmmmdo....',
      '.....oddddo.....',
      '......oooo......',
      '................',
    ],
  },
  rubble: {
    colors: { o: RUIN_STONE.mortar, l: RUIN_STONE.light, m: RUIN_STONE.mid, d: RUIN_STONE.dark },
    rows: [
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '..........oo....',
      '.........olmo...',
      '...oo....ommdo..',
      '..olmo..olmmdo..',
      '.olmmdo.ommddo..',
      '.ommddoooommdoo.',
      'oooooooooooooooo',
    ],
  },
} satisfies Record<string, SpriteDef>

export type SpriteName = keyof typeof SPRITES

export function makeCanvas(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D is not available')
  ctx.imageSmoothingEnabled = false
  return { canvas, ctx }
}

const sprites = new Map<SpriteName, HTMLCanvasElement>()

export function spriteCanvas(name: SpriteName): HTMLCanvasElement {
  let canvas = sprites.get(name)
  if (!canvas) {
    const def: SpriteDef = SPRITES[name]
    const made = makeCanvas(def.rows[0].length, def.rows.length)
    def.rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const color = def.colors[row[x]]
        if (!color) continue
        made.ctx.fillStyle = color
        made.ctx.fillRect(x, y, 1, 1)
      }
    })
    canvas = made.canvas
    sprites.set(name, canvas)
  }
  return canvas
}

const outlines = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>()

/** A 1px ring around the opaque pixels of src, 2px larger; draw it at (x - 1, y - 1). */
export function outlineCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
  const cached = outlines.get(src)
  if (cached) return cached
  const w = src.width
  const h = src.height
  const alpha = src.getContext('2d')!.getImageData(0, 0, w, h).data
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && alpha[(y * w + x) * 4 + 3] > 0
  const out = makeCanvas(w + 2, h + 2)
  out.ctx.fillStyle = HIGHLIGHT
  for (let y = -1; y <= h; y++) {
    for (let x = -1; x <= w; x++) {
      if (solid(x, y)) continue
      if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) out.ctx.fillRect(x + 1, y + 1, 1, 1)
    }
  }
  outlines.set(src, out.canvas)
  return out.canvas
}

/**
 * src with a 1px `color` ring around its opaque pixels, 2px larger: the edge
 * leaf bushes get so that overlapping bushes read as separate shapes.
 */
export function withOutline(src: HTMLCanvasElement, color: string): HTMLCanvasElement {
  const w = src.width
  const h = src.height
  const alpha = src.getContext('2d')!.getImageData(0, 0, w, h).data
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && alpha[(y * w + x) * 4 + 3] > 0
  const out = makeCanvas(w + 2, h + 2)
  out.ctx.fillStyle = color
  for (let y = -1; y <= h; y++) {
    for (let x = -1; x <= w; x++) {
      if (solid(x, y)) continue
      if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) out.ctx.fillRect(x + 1, y + 1, 1, 1)
    }
  }
  out.ctx.drawImage(src, 1, 1)
  return out.canvas
}

const halos = new Map<string, HTMLCanvasElement>()

/** A stepped round glow of the given radius in world pixels; draw it centred. */
export function haloCanvas(radius: number, rgb: string): HTMLCanvasElement {
  const key = `${radius}:${rgb}`
  let canvas = halos.get(key)
  if (!canvas) {
    const size = radius * 2
    const made = makeCanvas(size, size)
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const d = Math.hypot(x + 0.5 - radius, y + 0.5 - radius) / radius
        const a = d < 0.45 ? 0.22 : d < 0.75 ? 0.13 : d < 1 ? 0.06 : 0
        if (a === 0) continue
        made.ctx.fillStyle = `rgba(${rgb}, ${a})`
        made.ctx.fillRect(x, y, 1, 1)
      }
    }
    canvas = made.canvas
    halos.set(key, canvas)
  }
  return canvas
}
