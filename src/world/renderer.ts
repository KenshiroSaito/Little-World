import type { CanvasSelection, RelicId, Segment } from '../types.ts'
import { SPIRIT_ANIMS, SPIRIT_CELL } from './artLayout.ts'
import spiritSheetUrl from './assets/spirit-sheet.png'
import {
  clampCamera,
  deviceOffset,
  deviceScale,
  easeInOutCubic,
  fitRect,
  lerpCamera,
  panBy,
  screenToWorld,
  zoomAt,
  type Camera,
  type View,
} from './camera.ts'
import { hitTest, type HitScene } from './hitTest.ts'
import { houseBounds, npcSpot, placeHouses, type House } from './houses.ts'
import {
  RELIC_TILES,
  RUIN,
  SURFACE_Y,
  WORLD_COLS,
  WORLD_H,
  WORLD_ROWS,
  WORLD_W,
  pxToTile,
  tileToPx,
  type Point,
  type TileRect,
} from './layout.ts'
import { computeLight, paintLight } from './lighting.ts'
import { NPCS, npcFrame, type NpcId } from './npcs.ts'
import { RELIC_SPRITES, drawOverlay, type OverlayState } from './overlay.ts'
import { BACKDROP, LEAF, NATURAL_BARK, leafShades } from './palette.ts'
import type { Ambient, Rgb } from './particles.ts'
import { mulberry32 } from './rng.ts'
import { spiritFrame } from './spirit.ts'
import { makeCanvas, spriteCanvas } from './sprites.ts'
import { Stage, type Layers, type StageFrame } from './stage.ts'
import { drawTerrain } from './terrain.ts'
import { clusterAt, drawTree } from './tree.ts'
import { hexRgb, loadImage, loadTreeKit, woodIn, type TreeKit } from './treeKit.ts'
import {
  GROWN_LP,
  analyzeTree,
  boundsToPx,
  growSegments,
  segmentBounds,
  spiritPerch,
  type TreeShape,
} from './treeShape.ts'

export type Scene = {
  segments: readonly Segment[]
  revealedRelics: readonly RelicId[]
  inscriptionCount: number
  /** Total LP: the wood and leaves grow with it, and from 40 LP it pays for tree houses. */
  lp: number
  /** One colour for all the wood (trunk, branches, roots), as '#rrggbb'. */
  barkColor: string
  paintMode: boolean
  reducedMotion: boolean
  spiritEnabled: boolean
}

export type WorldEvents = {
  /** A click landed on a branch, relic or the tablet. */
  onSelect?: (selection: CanvasSelection) => void
}

const EMPTY_SCENE: Scene = {
  segments: [],
  revealedRelics: [],
  inscriptionCount: 0,
  lp: 0,
  barkColor: NATURAL_BARK,
  paintMode: false,
  reducedMotion: false,
  spiritEnabled: true,
}

const GROW_MS = 900
const HOUSE_MS = 1600
const FRESH_MS = 2600
const EASE_MS = 700
const HAPPY_MS = 1500
const TINT_MS = 1600
const SPARKLE_MS = 1200
const PULSE_MS = 1200
const CLICK_SLOP = 5
const WHEEL_STEP = 60
const KEY_PAN = 48
const FIT_MARGIN = 1.5
const ROOT_AMBER: Rgb = [1, 0.69, 0.36]
const GOLD: Rgb = [1, 0.84, 0.48]

const PAN_KEYS: Record<string, [number, number]> = {
  arrowleft: [-1, 0],
  arrowright: [1, 0],
  arrowup: [0, -1],
  arrowdown: [0, 1],
}

/**
 * Owns the canvas: input, camera, the spirit in the canopy, and turning the
 * scene into layers for the three.js stage (or plain 2D without WebGL).
 */
export class WorldRenderer {
  events: WorldEvents = {}

  private readonly canvas: HTMLCanvasElement
  private readonly stage: Stage | null
  private readonly ctx2d: CanvasRenderingContext2D | null
  private readonly layers: Layers
  private readonly treeGlow = makeCanvas(WORLD_W, WORLD_H)
  private readonly observer: ResizeObserver
  private kit: TreeKit | null = null
  private sheet: HTMLImageElement | null = null
  private npcImages: Partial<Record<NpcId, HTMLImageElement>> = {}

  private scene: Scene = EMPTY_SCENE
  private segmentsKey = ''
  private shape: TreeShape = analyzeTree([], 0)
  private houses: House[] = []
  /** When each house starts going up (ms); its villager moves in once it stands. */
  private houseStart = new Map<string, number>()
  private view: View = { width: 0, height: 0, dpr: 1 }
  private cam: Camera = { cx: WORLD_W / 2, cy: WORLD_H / 2, zoom: 2 }
  private started = false
  private needsFit = true
  private tween: { from: Camera; to: Camera; start: number } | null = null
  private growth: { ids: Set<string>; start: number } | null = null
  private relicsShown: readonly RelicId[] = []
  private hover: CanvasSelection | null = null
  private treeDirty = true
  private overlayDirty = true

  /** Where the spirit sits (sprite centre, world pixels): off the top of the highest leaves. */
  private spirit: Point = tileToPx(spiritPerch([], 0))
  private happyUntil = 0
  private sparkleUntil = 0
  private tint: { color: Rgb; start: number } | null = null
  private pulse: { at: Point; start: number; color: Rgb } | null = null
  private ruinRevealedAt: number | null = null

  private pointers = new Map<number, Point>()
  private drag: { start: Point; last: Point; moved: boolean } | null = null
  private pinch: { dist: number; zoom: number; mid: Point } | null = null
  private wheel = 0
  private raf = 0
  private disposed = false

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.layers = {
      terrain: drawTerrain(),
      tree: makeCanvas(WORLD_W, WORLD_H).canvas,
      overlay: makeCanvas(WORLD_W, WORLD_H).canvas,
      glow: makeCanvas(WORLD_W, WORLD_H).canvas,
      light: makeCanvas(WORLD_COLS, WORLD_ROWS).canvas,
    }
    let stage: Stage | null = null
    try {
      stage = new Stage(canvas, this.layers)
    } catch (err) {
      console.warn('WebGL unavailable, drawing the world without effects.', err)
    }
    this.stage = stage
    this.ctx2d = stage ? null : canvas.getContext('2d')

    Promise.all([loadTreeKit(), loadImage(spiritSheetUrl), loadNpcSheets()])
      .then(([kit, sheet, npcs]) => {
        if (this.disposed) return
        this.kit = kit
        this.sheet = sheet
        this.npcImages = npcs
        this.stage?.setSpiritSheet(sheet)
        this.stage?.setNpcSheets(npcs)
        this.treeDirty = true
        this.overlayDirty = true
      })
      .catch((err) => console.error('Could not load the world art.', err))

    canvas.addEventListener('pointerdown', this.onPointerDown)
    canvas.addEventListener('pointermove', this.onPointerMove)
    canvas.addEventListener('pointerup', this.onPointerUp)
    canvas.addEventListener('pointercancel', this.onPointerCancel)
    canvas.addEventListener('pointerleave', this.onPointerLeave)
    canvas.addEventListener('wheel', this.onWheel, { passive: false })
    canvas.addEventListener('keydown', this.onKeyDown)
    this.observer = new ResizeObserver(() => this.resize())
    this.observer.observe(canvas)
    this.resize()
    this.raf = requestAnimationFrame(this.frame)
  }

  destroy(): void {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.observer.disconnect()
    const c = this.canvas
    c.removeEventListener('pointerdown', this.onPointerDown)
    c.removeEventListener('pointermove', this.onPointerMove)
    c.removeEventListener('pointerup', this.onPointerUp)
    c.removeEventListener('pointercancel', this.onPointerCancel)
    c.removeEventListener('pointerleave', this.onPointerLeave)
    c.removeEventListener('wheel', this.onWheel)
    c.removeEventListener('keydown', this.onKeyDown)
    this.stage?.dispose()
    this.events = {}
  }

  setScene(next: Scene): void {
    const prev = this.scene
    this.scene = next
    const key = segmentsKey(next.segments)
    const segmentsChanged = key !== this.segmentsKey
    if (segmentsChanged) {
      this.segmentsKey = key
      const before = new Set(prev.segments.map((s) => s.id))
      const after = new Set(next.segments.map((s) => s.id))
      const fresh = next.segments.filter((s) => !before.has(s.id))
      const removed = prev.segments.some((s) => !after.has(s.id))
      if (!this.started || removed) {
        this.growth = null
        this.needsFit = true
        this.ruinRevealedAt = null
      } else if (fresh.length > 0) {
        this.onGrowth(fresh)
      }
      this.rebuildAmbient()
    }
    if (segmentsChanged || next.lp !== prev.lp) {
      this.shape = analyzeTree(next.segments, next.lp)
      this.spirit = tileToPx(spiritPerch(next.segments, next.lp))
      this.syncHouses(this.started && !this.needsFit)
      this.treeDirty = true
    }
    if (next.barkColor !== prev.barkColor) this.treeDirty = true
    if (!this.growth) this.revealRelics(this.started)
    if (!next.paintMode && this.hover?.kind === 'segment') this.hover = null
    this.overlayDirty = true
    this.started = true
    if (this.needsFit && this.view.width > 0) this.fit(false)
  }

  zoomIn(): void {
    this.zoomBy(1)
  }

  zoomOut(): void {
    this.zoomBy(-1)
  }

  fitTree(): void {
    this.fit(true)
  }

  // --- growth and reveals ---------------------------------------------------

  private onGrowth(fresh: Segment[]) {
    const now = performance.now()
    // Reduced motion: no growing-in, no shockwave or bursts; the new leaves still glow and fade.
    this.growth = { ids: new Set(fresh.map((s) => s.id)), start: this.scene.reducedMotion ? now - GROW_MS : now }
    const branch = fresh.find((s) => s.kind === 'branch')
    const root = fresh.find((s) => s.kind === 'root')
    const color = rgb01(leafShades(branch?.leafColor ?? 'base').mid)
    if (!this.scene.reducedMotion) {
      if (branch) {
        this.pulse = { at: tileToPx(branch.to), start: now, color }
        this.stage?.particles.burst(tileToPx(branch.to), color, 36, 70, now / 1000)
      }
      if (root) this.stage?.particles.burst(tileToPx(root.to), ROOT_AMBER, 18, 40, now / 1000)
    }
    this.happyUntil = now + HAPPY_MS
    this.tint = { color, start: now }
    this.focusOn(fresh)
  }

  /** Relics appear when the root that reaches them has finished growing. */
  private revealRelics(celebrate: boolean) {
    const next = this.scene.revealedRelics
    const added = next.filter((id) => !this.relicsShown.includes(id))
    const changed = added.length > 0 || next.length !== this.relicsShown.length
    this.relicsShown = next
    if (!changed) return
    const now = performance.now()
    if (celebrate && !this.scene.reducedMotion) {
      for (const id of added) this.stage?.particles.burst(tileToPx(RELIC_TILES[id]), GOLD, 40, 55, now / 1000)
      if (added.length > 0) this.sparkleUntil = now + SPARKLE_MS
    }
    if (added.includes('heartwood_relic')) {
      this.ruinRevealedAt = celebrate ? now / 1000 : null
      if (celebrate && !this.scene.reducedMotion) this.stage?.particles.burst(ruinCentre(), GOLD, 90, 90, now / 1000)
    }
    this.treeDirty = true
    this.overlayDirty = true
    this.rebuildAmbient()
  }

  private ruinLit(): boolean {
    return this.relicsShown.includes('heartwood_relic')
  }

  /**
   * Houses LP has paid for. A new one goes up once its record's branch has
   * grown in; on first draw, after a reset or with reduced motion it just stands.
   */
  private syncHouses(animate: boolean) {
    this.houses = placeHouses(this.scene.segments, this.scene.lp)
    const ids = new Set(this.houses.map((h) => h.id))
    for (const id of this.houseStart.keys()) if (!ids.has(id)) this.houseStart.delete(id)
    const now = performance.now()
    const start = animate && !this.scene.reducedMotion ? now + GROW_MS : now - HOUSE_MS
    for (const h of this.houses) if (!this.houseStart.has(h.id)) this.houseStart.set(h.id, start)
  }

  /** Each finished house's resident on its porch, facing away from the trunk, mostly idle. */
  private npcDraws(ms: number): StageFrame['npcs'] {
    return this.houses
      .filter((h) => this.houseProgress(h.id, ms) >= 1)
      .map((h, i) => {
        const { row, frame } = npcFrame(h.npc, ms / 1000, (i * 0.618) % 1, this.scene.reducedMotion)
        const spot = npcSpot(h)
        return { npc: h.npc, row, frame, x: spot.x, feetY: spot.y, flip: h.side < 0 }
      })
  }

  private houseProgress(id: string, ms: number): number {
    const start = this.houseStart.get(id)
    return start === undefined ? 1 : Math.min(1, Math.max(0, (ms - start) / HOUSE_MS))
  }

  /**
   * Fireflies in each branch's leaf colour, amber spores on roots, gold motes in
   * a lit ruin, and leaves falling from every branch (two each once the tree is grown).
   */
  private rebuildAmbient() {
    if (!this.stage) return
    const rand = mulberry32(7)
    const jitter = (p: Point, r: number) => ({ x: p.x + (rand() - 0.5) * r, y: p.y + (rand() - 0.5) * r })
    const ground = tileToPx({ x: 0, y: SURFACE_Y }).y
    const leaves: Ambient[] = []
    for (const s of this.scene.segments) {
      if (s.kind !== 'branch') continue
      const shades = leafShades(s.leafColor ?? 'base')
      for (let i = this.scene.lp >= GROWN_LP ? 2 : 1; i > 0; i--) {
        const origin = jitter(tileToPx(s.to), 20)
        leaves.push({ origin, color: rgb01(rand() < 0.5 ? shades.mid : shades.dark), kind: 3, fall: ground - origin.y, size: 3 })
      }
    }
    this.stage.leaves.setAmbient(leaves)
    const list: Ambient[] = [{ origin: jitter(tileToPx({ x: 0, y: -3 }), 20), color: rgb01(LEAF.base.light), kind: 0 }]
    for (const s of this.scene.segments) {
      const p = tileToPx(s.to)
      if (s.kind === 'branch') list.push({ origin: jitter(p, 26), color: rgb01(leafShades(s.leafColor ?? 'base').light), kind: 0 })
      else list.push({ origin: jitter(p, 12), color: ROOT_AMBER, kind: 0 })
    }
    if (this.ruinLit()) {
      const a = tileToPx({ x: RUIN.left + 1, y: RUIN.bottom - 1 })
      const b = tileToPx({ x: RUIN.right - 1, y: RUIN.bottom - 1 })
      const rise = (RUIN.bottom - RUIN.top - 1) * 16
      for (let i = 0; i < 40; i++) list.push({ origin: { x: a.x + rand() * (b.x - a.x), y: a.y }, color: GOLD, kind: 2, rise })
    }
    this.stage.particles.setAmbient(list)
  }

  // --- camera ---------------------------------------------------------------

  private focusOn(segments: readonly Segment[]) {
    if (this.view.width === 0) return
    this.moveTo(fitRect(boundsToPx(segmentBounds(segments, false, this.scene.lp), FIT_MARGIN), this.view, this.cam.zoom))
  }

  private fit(animate: boolean) {
    this.needsFit = false
    const bounds = withHouses(segmentBounds(this.scene.segments, true, this.scene.lp), this.houses)
    const target = fitRect(boundsToPx(bounds, FIT_MARGIN), this.view)
    if (animate) this.moveTo(target)
    else {
      this.cam = target
      this.tween = null
    }
  }

  private moveTo(target: Camera) {
    if (this.scene.reducedMotion) {
      this.cam = target
      this.tween = null
    } else this.tween = { from: this.cam, to: target, start: performance.now() }
  }

  private zoomBy(step: number) {
    this.tween = null
    const centre = { x: this.view.width / 2, y: this.view.height / 2 }
    this.cam = zoomAt(this.cam, this.view, centre, this.cam.zoom + step)
  }

  private resize() {
    const rect = this.canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    this.view = { width: rect.width, height: rect.height, dpr }
    if (this.stage) this.stage.resize(this.view)
    else {
      this.canvas.width = Math.max(1, Math.round(rect.width * dpr))
      this.canvas.height = Math.max(1, Math.round(rect.height * dpr))
    }
    if (this.needsFit && this.started && rect.width > 0) this.fit(false)
    else this.cam = clampCamera(this.cam, this.view)
  }

  // --- frame ----------------------------------------------------------------

  private frame = (ms: number) => {
    this.raf = requestAnimationFrame(this.frame)
    if (this.view.width === 0 || !this.started) return

    if (this.tween) {
      const t = Math.min(1, (ms - this.tween.start) / EASE_MS)
      this.cam = clampCamera(lerpCamera(this.tween.from, this.tween.to, easeInOutCubic(Math.max(0, t))), this.view)
      if (t >= 1) this.tween = null
    }

    if (this.growth) {
      const age = ms - this.growth.start
      if (age >= GROW_MS) this.revealRelics(true)
      if (age >= FRESH_MS) this.growth = null
      this.treeDirty = true
    }
    if (this.houses.some((h) => this.houseProgress(h.id, ms) < 1)) this.treeDirty = true
    if (this.treeDirty && this.kit) this.redrawTree(ms)
    if (this.overlayDirty) this.redrawOverlay()

    if (this.stage) this.renderStage(ms)
    else this.drawFallback(ms)
  }

  private redrawTree(ms: number) {
    let segments = this.scene.segments
    let growing: { ids: Set<string>; t: number } | null = null
    let fresh: { ids: Set<string>; amount: number } | null = null
    if (this.growth) {
      const age = ms - this.growth.start
      const t = Math.min(1, Math.max(0, age / GROW_MS))
      if (t < 1) {
        segments = growSegments(segments, this.growth.ids, t)
        growing = { ids: this.growth.ids, t }
      }
      fresh = { ids: this.growth.ids, amount: (1 - Math.min(1, age / FRESH_MS)) ** 2 }
    }
    const roots = segments.filter((s) => s.kind === 'root').length
    drawTree(this.layers.tree.getContext('2d')!, this.treeGlow.ctx, this.kit!, {
      segments,
      shape: this.shape,
      growing,
      fresh,
      rootStage: Math.min(3, Math.floor(roots / 4)),
      wood: woodIn(this.kit!, this.scene.barkColor),
      barkColor: this.scene.barkColor,
      level: this.scene.segments.filter((s) => s.kind === 'branch').length,
      lp: this.scene.lp,
      houses: this.houses.map((house) => ({ house, progress: this.houseProgress(house.id, ms) })),
    })
    paintLight(this.layers.light.getContext('2d')!, computeLight(segments, this.relicsShown, this.ruinLit()))
    this.treeDirty = false
    this.composeGlow()
    this.stage?.markDirty('tree', 'light', 'glow')
  }

  private redrawOverlay() {
    const ctx = this.layers.overlay.getContext('2d')!
    ctx.clearRect(0, 0, WORLD_W, WORLD_H)
    drawOverlay(ctx, this.overlayState(), false)
    this.overlayDirty = false
    this.composeGlow()
    this.stage?.markDirty('overlay', 'glow')
  }

  /** The bloom source: the tree's glow plus the overlay drawn as light. */
  private composeGlow() {
    const ctx = this.layers.glow.getContext('2d')!
    ctx.clearRect(0, 0, WORLD_W, WORLD_H)
    ctx.drawImage(this.treeGlow.canvas, 0, 0)
    drawOverlay(ctx, this.overlayState(), true)
  }

  private overlayState(): OverlayState {
    const h = this.hover
    let hover: OverlayState['hover'] = null
    if (h?.kind === 'tablet') hover = 'tablet'
    else if (h?.kind === 'relic') {
      const p = tileToPx(RELIC_TILES[h.id])
      hover = { canvas: spriteCanvas(RELIC_SPRITES[h.id]), x: p.x - 8, y: p.y - 8 }
    } else if (h?.kind === 'segment' && this.kit) {
      const seg = this.scene.segments.find((s) => s.id === h.id)
      if (seg) hover = clusterAt(this.kit, seg, this.scene.lp)
    }
    return { relics: this.relicsShown, ruinLit: this.ruinLit(), inscriptions: this.scene.inscriptionCount, hover }
  }

  private renderStage(ms: number) {
    const time = ms / 1000
    let spirit = null
    if (this.scene.spiritEnabled) {
      const { anim, frame } = spiritFrame(time, ms < this.happyUntil, this.scene.reducedMotion)
      const tp = this.tint ? (ms - this.tint.start) / TINT_MS : 1
      spirit = {
        pos: this.spirit,
        anim,
        frame,
        flip: false,
        tint: this.tint?.color ?? GOLD,
        tintAmount: tp < 1 ? (tp < 0.6 ? 1 : 1 - (tp - 0.6) / 0.4) : 0,
        sweep: Math.min(1, tp * 1.8),
        glow: 0.12,
        sparkle: ms < this.sparkleUntil && (this.scene.reducedMotion || Math.floor(ms / 150) % 2 === 0),
      }
    }
    const pulse = this.pulse && ms - this.pulse.start < PULSE_MS ? { ...this.pulse, start: this.pulse.start / 1000 } : null
    const lit = this.ruinLit()
    this.stage!.render({
      cam: this.cam,
      view: this.view,
      time,
      spirit,
      npcs: this.npcDraws(ms),
      pulse,
      ruin: { strength: lit ? 1 : 0, at: ruinCentre(), since: this.ruinRevealedAt === null ? 1e3 : time - this.ruinRevealedAt },
      depth: Math.min(1, Math.max(0, pxToTile({ x: 0, y: this.cam.cy }).y / 24)),
      bloom: lit ? 1.1 : 1,
      motion: !this.scene.reducedMotion,
    })
  }

  /** Without WebGL: the same layers composited in 2D, no bloom or particles. */
  private drawFallback(ms: number) {
    const ctx = this.ctx2d
    if (!ctx) return
    const k = deviceScale(this.cam.zoom, this.view.dpr)
    const off = deviceOffset(this.cam, this.view)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.imageSmoothingEnabled = false
    ctx.fillStyle = BACKDROP
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
    ctx.setTransform(k, 0, 0, k, off.x, off.y)
    ctx.drawImage(this.layers.terrain, 0, 0)
    ctx.drawImage(this.layers.tree, 0, 0)
    ctx.drawImage(this.layers.light, 0, 0, WORLD_COLS, WORLD_ROWS, 0, 0, WORLD_W, WORLD_H)
    ctx.drawImage(this.layers.overlay, 0, 0)
    for (const a of this.npcDraws(ms)) {
      const img = this.npcImages[a.npc]
      const { w, h } = NPCS[a.npc].cell
      if (img) drawCell(ctx, img, a.frame * w, a.row * h, w, h, Math.round(a.x - w / 2), a.feetY - h + 1, a.flip)
    }
    if (!this.sheet || !this.scene.spiritEnabled) return
    const { anim, frame } = spiritFrame(ms / 1000, ms < this.happyUntil, this.scene.reducedMotion)
    const { w, h } = SPIRIT_CELL
    const s = this.spirit
    drawCell(ctx, this.sheet, frame * w, SPIRIT_ANIMS[anim].row * h, w, h, Math.round(s.x - w / 2), Math.round(s.y - h / 2), false)
  }

  // --- input ----------------------------------------------------------------

  private hitScene(): HitScene {
    return {
      segments: this.scene.segments,
      revealedRelics: this.relicsShown,
      ruinLit: this.ruinLit(),
      lp: this.scene.lp,
    }
  }

  private local(e: PointerEvent | WheelEvent): Point {
    const r = this.canvas.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  private targetAt(p: Point): CanvasSelection | null {
    return hitTest(this.hitScene(), pxToTile(screenToWorld(this.cam, this.view, p)))
  }

  private setHover(target: CanvasSelection | null) {
    const next = target?.kind === 'segment' && !this.scene.paintMode ? null : target
    if (JSON.stringify(next) !== JSON.stringify(this.hover)) {
      this.hover = next
      this.overlayDirty = true
    }
    this.updateCursor()
  }

  private updateCursor() {
    this.canvas.style.cursor = this.drag?.moved ? 'grabbing' : this.hover ? 'pointer' : 'grab'
  }

  private onPointerDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    this.canvas.setPointerCapture(e.pointerId)
    this.canvas.focus({ preventScroll: true })
    const p = this.local(e)
    this.pointers.set(e.pointerId, p)
    this.tween = null
    if (this.pointers.size === 1) this.drag = { start: p, last: p, moved: false }
    else if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()]
      this.pinch = { dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), zoom: this.cam.zoom, mid: midpoint(a, b) }
      this.drag = null
    }
  }

  private onPointerMove = (e: PointerEvent) => {
    const p = this.local(e)
    if (!this.pointers.has(e.pointerId)) {
      if (e.pointerType === 'mouse') this.setHover(this.targetAt(p))
      return
    }
    this.pointers.set(e.pointerId, p)
    if (this.pinch && this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()]
      const mid = midpoint(a, b)
      this.cam = panBy(this.cam, this.view, mid.x - this.pinch.mid.x, mid.y - this.pinch.mid.y)
      this.pinch.mid = mid
      const zoom = Math.round((this.pinch.zoom * Math.hypot(a.x - b.x, a.y - b.y)) / this.pinch.dist)
      if (zoom !== this.cam.zoom) this.cam = zoomAt(this.cam, this.view, mid, zoom)
    } else if (this.drag) {
      if (!this.drag.moved && Math.hypot(p.x - this.drag.start.x, p.y - this.drag.start.y) > CLICK_SLOP) {
        this.drag.moved = true
        this.updateCursor()
      }
      if (this.drag.moved) this.cam = panBy(this.cam, this.view, p.x - this.drag.last.x, p.y - this.drag.last.y)
      this.drag.last = p
    }
  }

  private onPointerUp = (e: PointerEvent) => {
    if (!this.pointers.has(e.pointerId)) return
    const click = this.drag !== null && !this.drag.moved && this.pointers.size === 1
    this.release(e.pointerId)
    if (!click) return
    const target = this.targetAt(this.local(e))
    if (target) this.events.onSelect?.(target)
  }

  private onPointerCancel = (e: PointerEvent) => this.release(e.pointerId)

  private onPointerLeave = () => this.setHover(null)

  private release(id: number) {
    this.pointers.delete(id)
    if (this.pointers.size < 2) this.pinch = null
    if (this.pointers.size === 1) {
      // Lifting one finger of a pinch carries on as a drag, never a click.
      const p = [...this.pointers.values()][0]
      this.drag = { start: p, last: p, moved: true }
    } else if (this.pointers.size === 0) this.drag = null
    this.updateCursor()
  }

  private onWheel = (e: WheelEvent) => {
    e.preventDefault()
    this.tween = null
    const delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? this.view.height : 1)
    if (Math.sign(delta) !== Math.sign(this.wheel)) this.wheel = 0
    this.wheel += e.ctrlKey ? delta * 4 : delta
    if (Math.abs(this.wheel) < WHEEL_STEP) return
    const step = Math.sign(this.wheel)
    this.wheel = 0
    this.cam = zoomAt(this.cam, this.view, this.local(e), this.cam.zoom - step)
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return
    const key = e.key.toLowerCase()
    if (PAN_KEYS[key]) this.panKey(key)
    else if (key === '+' || key === '=') this.zoomBy(1)
    else if (key === '-' || key === '_') this.zoomBy(-1)
    else if (key === 'f' || key === '0') this.fit(true)
    else return
    e.preventDefault()
  }

  private panKey(key: string) {
    const [x, y] = PAN_KEYS[key]
    this.tween = null
    this.cam = panBy(this.cam, this.view, -x * KEY_PAN, -y * KEY_PAN)
  }
}

async function loadNpcSheets(): Promise<Record<NpcId, HTMLImageElement>> {
  const ids = Object.keys(NPCS) as NpcId[]
  const images = await Promise.all(ids.map((id) => loadImage(NPCS[id].url)))
  return Object.fromEntries(ids.map((id, i) => [id, images[i]])) as Record<NpcId, HTMLImageElement>
}

/** Content, not identity: callers may rebuild the array on every render. */
function segmentsKey(segments: readonly Segment[]): string {
  return segments.map((s) => `${s.id}|${s.leafColor ?? ''}|${s.from.x},${s.from.y}|${s.to.x},${s.to.y}`).join(';')
}

/** One sheet cell at (x, y), mirrored when `flip` (sheets face right). */
function drawCell(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  sx: number,
  sy: number,
  w: number,
  h: number,
  x: number,
  y: number,
  flip: boolean,
) {
  if (!flip) {
    ctx.drawImage(img, sx, sy, w, h, x, y, w, h)
    return
  }
  ctx.save()
  ctx.translate(x + w, y)
  ctx.scale(-1, 1)
  ctx.drawImage(img, sx, sy, w, h, 0, 0, w, h)
  ctx.restore()
}

/** r grown to take in the houses, roofs and struts included. */
function withHouses(r: TileRect, houses: readonly House[]): TileRect {
  const h = houseBounds(houses)
  if (!h) return r
  return {
    left: Math.min(r.left, h.left),
    right: Math.max(r.right, h.right),
    top: Math.min(r.top, h.top),
    bottom: Math.max(r.bottom, h.bottom),
  }
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

function ruinCentre(): Point {
  return tileToPx({ x: (RUIN.left + RUIN.right) / 2, y: (RUIN.top + RUIN.bottom) / 2 })
}

function rgb01(hex: string): Rgb {
  const [r, g, b] = hexRgb(hex)
  return [r / 255, g / 255, b / 255]
}
