import { WORLD_H, WORLD_W, type Point } from './layout.ts'

export const MIN_ZOOM = 1
export const MAX_ZOOM = 6

/** cx, cy: the world pixel at the centre of the view. zoom: whole-pixel scale. */
export type Camera = { cx: number; cy: number; zoom: number }
/** CSS pixel size of the canvas and the device pixel ratio. */
export type View = { width: number; height: number; dpr: number }
/** A rectangle in world pixels. */
export type PxRect = { x: number; y: number; w: number; h: number }

export const WORLD_RECT: PxRect = { x: 0, y: 0, w: WORLD_W, h: WORLD_H }

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(zoom)))
}

/** Device pixels per world pixel, always whole so pixel art stays crisp. */
export function deviceScale(zoom: number, dpr: number): number {
  return Math.max(1, Math.round(zoom * dpr))
}

/** CSS pixels per world pixel. */
export function cssScale(zoom: number, dpr: number): number {
  return deviceScale(zoom, dpr) / dpr
}

/** Device-pixel position of world (0, 0), rounded so tiles land on whole pixels. */
export function deviceOffset(cam: Camera, view: View): Point {
  const k = deviceScale(cam.zoom, view.dpr)
  return {
    x: Math.round((view.width * view.dpr) / 2 - cam.cx * k),
    y: Math.round((view.height * view.dpr) / 2 - cam.cy * k),
  }
}

export function screenToWorld(cam: Camera, view: View, p: Point): Point {
  const k = deviceScale(cam.zoom, view.dpr)
  const off = deviceOffset(cam, view)
  return { x: (p.x * view.dpr - off.x) / k, y: (p.y * view.dpr - off.y) / k }
}

export function worldToScreen(cam: Camera, view: View, p: Point): Point {
  const k = deviceScale(cam.zoom, view.dpr)
  const off = deviceOffset(cam, view)
  return { x: (p.x * k + off.x) / view.dpr, y: (p.y * k + off.y) / view.dpr }
}

/** Keeps the view inside the world; centres the world on an axis it does not fill. */
export function clampCamera(cam: Camera, view: View, world = WORLD_RECT): Camera {
  const s = cssScale(cam.zoom, view.dpr)
  return {
    zoom: cam.zoom,
    cx: clampAxis(cam.cx, view.width / s, world.x, world.w),
    cy: clampAxis(cam.cy, view.height / s, world.y, world.h),
  }
}

function clampAxis(c: number, visible: number, start: number, size: number): number {
  if (visible >= size) return start + size / 2
  return Math.min(start + size - visible / 2, Math.max(start + visible / 2, c))
}

/** Changes zoom while the world point under `anchor` (CSS pixels) stays put. */
export function zoomAt(cam: Camera, view: View, anchor: Point, zoom: number, world = WORLD_RECT): Camera {
  const z = clampZoom(zoom)
  const w = screenToWorld(cam, view, anchor)
  const s = cssScale(z, view.dpr)
  return clampCamera(
    { zoom: z, cx: w.x - (anchor.x - view.width / 2) / s, cy: w.y - (anchor.y - view.height / 2) / s },
    view,
    world,
  )
}

/** Moves the world by a screen-space drag of (dx, dy) CSS pixels. */
export function panBy(cam: Camera, view: View, dx: number, dy: number, world = WORLD_RECT): Camera {
  const s = cssScale(cam.zoom, view.dpr)
  return clampCamera({ zoom: cam.zoom, cx: cam.cx - dx / s, cy: cam.cy - dy / s }, view, world)
}

/**
 * The largest whole zoom up to `maxZoom` that shows all of `rect`, centred on it.
 * If it is too tall even at the smallest zoom, its top stays in view (the canopy, not mid-root).
 */
export function fitRect(rect: PxRect, view: View, maxZoom = MAX_ZOOM, world = WORLD_RECT): Camera {
  let zoom = MIN_ZOOM
  for (let z = clampZoom(maxZoom); z > MIN_ZOOM; z--) {
    const s = cssScale(z, view.dpr)
    if (rect.w * s <= view.width && rect.h * s <= view.height) {
      zoom = z
      break
    }
  }
  const visible = view.height / cssScale(zoom, view.dpr)
  const cy = rect.h > visible ? rect.y + visible / 2 : rect.y + rect.h / 2
  return clampCamera({ zoom, cx: rect.x + rect.w / 2, cy }, view, world)
}

/** Position eases; zoom switches to the target at once so every frame stays crisp. */
export function lerpCamera(from: Camera, to: Camera, t: number): Camera {
  return { zoom: to.zoom, cx: from.cx + (to.cx - from.cx) * t, cy: from.cy + (to.cy - from.cy) * t }
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}
