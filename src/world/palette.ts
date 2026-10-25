import { isCustomColor, type ColorId, type LeafColor } from '../types.ts'

export type Shades = { outline: string; dark: string; mid: string; light: string }

/**
 * Leaf shades per colour id. `mid` is the colour from the art guide
 * (worldtreeprocedural.jpeg) and the swatch for the paint palette.
 */
export const LEAF: Record<ColorId, Shades> = {
  base: { outline: '#1d4a33', dark: '#2f9e5f', mid: '#57e389', light: '#a6f5c4' },
  walk: { outline: '#2a5200', dark: '#4cb800', mid: '#76ff03', light: '#c4ff8a' },
  connect: { outline: '#6b2f00', dark: '#c96a00', mid: '#ff9800', light: '#ffd08a' },
  break: { outline: '#00434d', dark: '#008a9c', mid: '#00bcd4', light: '#8eeaf5' },
  reflect: { outline: '#4a1f55', dark: '#8a3f99', mid: '#ba68c8', light: '#e6b8ee' },
}

const mixed = new Map<string, Shades>()

/**
 * Shades for any leaf colour. A mixed '#rrggbb' is the `mid`, with the other
 * three stepped in lightness the way the preset ramps are.
 */
export function leafShades(color: LeafColor): Shades {
  if (!isCustomColor(color)) return LEAF[color]
  let s = mixed.get(color)
  if (!s) {
    const [h, sat, l] = hexHsl(color)
    s = {
      outline: hslHex(h, sat, l * 0.32),
      dark: hslHex(h, sat, l * 0.65),
      mid: color,
      light: hslHex(h, sat, l + (1 - l) * 0.5),
    }
    mixed.set(color, s)
  }
  return s
}

function hexHsl(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff].map((c) => c / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  if (d === 0) return [0, 0, l]
  const s = d / (1 - Math.abs(2 * l - 1))
  const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h * 60, s, l]
}

function hslHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  return '#' + [r, g, b].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('')
}

/** The kit's own bark colour (its root flares' mean), and the tree's colour by default. */
export const NATURAL_BARK = '#6a6554'

export const BARK: Shades = { outline: '#2a1a10', dark: '#4a2e1c', mid: '#6b4428', light: '#93633a' }
export const ROOT: Shades = { outline: '#2e1c10', dark: '#7a5230', mid: '#a5774a', light: '#cf9f6c' }

export const SKY = ['#4f97e0', '#62a6e8', '#78b6ee', '#8fc6f2', '#a9d5f4', '#c4e3f4']
export const HILLS = { far: '#a3cfd8', near: '#8cc49a' }
export const CLOUD = { light: '#ffffff', shade: '#dcebf5' }

export const GRASS = { dark: '#2f6e2a', mid: '#4f9e36', light: '#7fca4c' }
export const FLOWERS = ['#ffe066', '#ffffff', '#ff9fb8', '#c7a6ff']
export const SOIL = { dark: '#5a3923', mid: '#774d31', light: '#8f603f', pebble: '#a39280', pebbleLight: '#c4b6a4' }
export const STONE = { dark: '#4a4d58', mid: '#676b78', light: '#878c99', ore: '#7fd9c4' }
export const DEEP_STONE = { dark: '#34363f', mid: '#4a4d58', light: '#5f6370', ore: '#e0b45a' }
export const RUIN_STONE = { mortar: '#8f7d5f', dark: '#b3a181', mid: '#d3c4a3', light: '#efe5cb', glyph: '#8a7556' }
export const RUIN_BACK = { mortar: '#4f4536', dark: '#6b5e48', mid: '#80725a', light: '#94866c' }

/** Darkness is tinted towards amber as light rises, so roots seem to glow. */
export const DARK_RGB = [9, 8, 20]
export const GLOW_RGB = [70, 42, 12]
export const RUIN_GLOW = 'rgba(255, 186, 96, 0.1)'
export const GLYPH_GLOW = '#ffd27a'
export const HIGHLIGHT = '#ffffff'
export const BACKDROP = '#0b0a14'

const packed = new Map<string, number>()

/** '#rrggbb' as one RGBA word, for writing straight into a Uint32Array over ImageData. */
export function packHex(hex: string): number {
  let v = packed.get(hex)
  if (v === undefined) {
    const n = parseInt(hex.slice(1), 16)
    v = (0xff000000 | ((n & 0xff) << 16) | (n & 0xff00) | ((n >> 16) & 0xff)) >>> 0
    packed.set(hex, v)
  }
  return v
}
