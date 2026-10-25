import type { ColorId } from '../types.ts'

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
