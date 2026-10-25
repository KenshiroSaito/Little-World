import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { SPIRIT_ANIMS, SPIRIT_CELL } from './artLayout.ts'
import { deviceOffset, deviceScale, worldToScreen, type Camera, type View } from './camera.ts'
import { WORLD_COLS, WORLD_H, WORLD_ROWS, WORLD_W, type Point } from './layout.ts'
import { BACKDROP } from './palette.ts'
import { Particles, type Rgb } from './particles.ts'
import { COMPOSITE_FRAG, DARKNESS_FRAG, QUAD_VERT, SPIRIT_FRAG } from './shaders.ts'
import type { SpiritAnim } from './spirit.ts'

/** 2D canvases the stage shows: world-sized, except light (one pixel per tile). */
export type Layers = Record<'terrain' | 'tree' | 'overlay' | 'glow' | 'light', HTMLCanvasElement>
export type LayerName = keyof Layers

export type StageFrame = {
  cam: Camera
  view: View
  /** Seconds. */
  time: number
  spirit: {
    pos: Point
    anim: SpiritAnim
    frame: number
    flip: boolean
    /** Colour-transition sweep: tint colour, 0 to 1 strength, 0 to 1 height. */
    tint: Rgb
    tintAmount: number
    sweep: number
    /** How strongly the spirit glows in the bloom pass. */
    glow: number
    sparkle: boolean
  } | null
  /** A shockwave where growth landed, in world pixels. */
  pulse: { at: Point; start: number; color: Rgb } | null
  /** Ruin glow: 0 or 1, its centre, and seconds since the reveal. */
  ruin: { strength: number; at: Point; since: number }
  /** 0 at the surface to 1 deep underground. */
  depth: number
  bloom: number
  motion: boolean
}

const SPIRIT_LIGHT_TILES = 4.5

/**
 * The three.js side of the renderer: the world layers as nearest-filtered
 * planes, the spirit and particles, selective bloom from a separate glow
 * scene, and a composite pass for the effects tied to play.
 */
export class Stage {
  readonly particles = new Particles()
  private readonly renderer: THREE.WebGLRenderer
  private readonly camera = new THREE.OrthographicCamera(0, 1, 0, -1, -10, 10)
  private readonly main = new THREE.Scene()
  private readonly glowScene = new THREE.Scene()
  private readonly textures: Record<LayerName, THREE.CanvasTexture>
  private readonly darkness: THREE.ShaderMaterial
  private readonly sprites: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>[] = []
  private readonly bloomComposer: EffectComposer
  private readonly finalComposer: EffectComposer
  private readonly composite: ShaderPass
  private sheet: THREE.Texture | null = null

  constructor(canvas: HTMLCanvasElement, layers: Layers) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' })
    this.main.background = new THREE.Color(BACKDROP)
    this.glowScene.background = new THREE.Color(0x000000)
    this.camera.position.z = 5

    const texture = (c: HTMLCanvasElement) => {
      const t = new THREE.CanvasTexture(c)
      t.magFilter = THREE.NearestFilter
      t.minFilter = THREE.NearestFilter
      t.generateMipmaps = false
      t.colorSpace = THREE.SRGBColorSpace
      return t
    }
    this.textures = {
      terrain: texture(layers.terrain),
      tree: texture(layers.tree),
      overlay: texture(layers.overlay),
      glow: texture(layers.glow),
      light: texture(layers.light),
    }

    this.darkness = new THREE.ShaderMaterial({
      uniforms: {
        tLight: { value: this.textures.light },
        uTiles: { value: new THREE.Vector2(WORLD_COLS, WORLD_ROWS) },
        uSpirit: { value: new THREE.Vector2(-1e4, -1e4) },
        uSpiritRadius: { value: SPIRIT_LIGHT_TILES },
      },
      vertexShader: QUAD_VERT,
      fragmentShader: DARKNESS_FRAG,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    })

    const flat = (name: LayerName) =>
      new THREE.MeshBasicMaterial({ map: this.textures[name], transparent: true, depthTest: false, depthWrite: false })
    this.main.add(
      worldPlane(flat('terrain'), 0),
      worldPlane(flat('tree'), 1),
      worldPlane(this.darkness, 2),
      worldPlane(flat('overlay'), 3),
    )
    this.particles.main.renderOrder = 4
    this.main.add(this.particles.main)
    this.glowScene.add(worldPlane(flat('glow'), 0))
    this.particles.glow.renderOrder = 1
    this.glowScene.add(this.particles.glow)

    // Spirit and its sparkle, each once crisp in the scene and once as light in the glow scene.
    for (const [scene, emissive, order] of [
      [this.main, 0, 5],
      [this.main, 0, 6],
      [this.glowScene, 1, 2],
      [this.glowScene, 1, 3],
    ] as const) {
      const mesh = spriteMesh(SPIRIT_CELL.w, SPIRIT_CELL.h, emissive, order)
      scene.add(mesh)
      this.sprites.push(mesh)
    }

    this.bloomComposer = new EffectComposer(this.renderer)
    this.bloomComposer.renderToScreen = false
    this.bloomComposer.addPass(new RenderPass(this.glowScene, this.camera))
    this.bloomComposer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 1, 0.6, 0))

    this.composite = new ShaderPass(
      new THREE.ShaderMaterial({
        uniforms: {
          tDiffuse: { value: null },
          tBloom: { value: null },
          uResolution: { value: new THREE.Vector2(1, 1) },
          uTime: { value: 0 },
          uPulse: { value: new THREE.Vector3(0, 0, -1) },
          uPulseColor: { value: new THREE.Vector3() },
          uRuin: { value: new THREE.Vector3() },
          uFlash: { value: 1e3 },
          uDepth: { value: 0 },
          uBloomStrength: { value: 1 },
          uMotion: { value: 1 },
        },
        vertexShader: QUAD_VERT,
        fragmentShader: COMPOSITE_FRAG,
      }),
      'tDiffuse',
    )
    this.finalComposer = new EffectComposer(this.renderer)
    this.finalComposer.addPass(new RenderPass(this.main, this.camera))
    this.finalComposer.addPass(this.composite)
    this.finalComposer.addPass(new OutputPass())
  }

  setSpiritSheet(image: HTMLImageElement): void {
    const t = sheetTexture(image)
    this.sheet = t
    for (const m of this.sprites) m.material.uniforms.tSheet.value = t
  }

  markDirty(...names: LayerName[]): void {
    for (const n of names) this.textures[n].needsUpdate = true
  }

  resize(view: View): void {
    this.renderer.setPixelRatio(view.dpr)
    this.renderer.setSize(view.width, view.height, false)
    for (const c of [this.bloomComposer, this.finalComposer]) {
      c.setPixelRatio(view.dpr)
      c.setSize(view.width, view.height)
    }
    this.composite.uniforms.uResolution.value.set(view.width * view.dpr, view.height * view.dpr)
  }

  render(f: StageFrame): void {
    const { cam, view } = f
    const k = deviceScale(cam.zoom, view.dpr)
    const off = deviceOffset(cam, view)
    const w = view.width * view.dpr
    const h = view.height * view.dpr
    // World y points down, three's up: world (x, y) is drawn at (x, -y).
    this.camera.left = -off.x / k
    this.camera.right = (w - off.x) / k
    this.camera.top = off.y / k
    this.camera.bottom = -(h - off.y) / k
    this.camera.updateProjectionMatrix()

    this.particles.update(f.time, k, f.motion)
    this.updateSpirit(f)

    const u = this.composite.uniforms
    const toUv = (p: Point) => {
      const s = worldToScreen(cam, view, p)
      return [s.x / view.width, 1 - s.y / view.height]
    }
    u.tBloom.value = this.bloomComposer.renderTarget2.texture
    u.uTime.value = f.time
    if (f.pulse) {
      const [x, y] = toUv(f.pulse.at)
      u.uPulse.value.set(x, y, f.pulse.start)
      u.uPulseColor.value.set(...f.pulse.color)
    } else u.uPulse.value.set(0, 0, -1)
    const [rx, ry] = toUv(f.ruin.at)
    u.uRuin.value.set(rx, ry, f.ruin.strength)
    u.uFlash.value = f.ruin.since
    u.uDepth.value = f.depth
    u.uBloomStrength.value = f.bloom
    u.uMotion.value = f.motion ? 1 : 0

    this.bloomComposer.render()
    this.finalComposer.render()
  }

  dispose(): void {
    this.bloomComposer.dispose()
    this.finalComposer.dispose()
    this.particles.dispose()
    for (const t of Object.values(this.textures)) t.dispose()
    this.sheet?.dispose()
    this.main.traverse(disposeMesh)
    this.glowScene.traverse(disposeMesh)
    this.renderer.dispose()
  }


  private updateSpirit(f: StageFrame) {
    const s = f.spirit
    const visible = s !== null && this.sheet !== null
    const [main, sparkle, glow, sparkleGlow] = this.sprites
    main.visible = glow.visible = visible
    sparkle.visible = sparkleGlow.visible = visible && s.sparkle
    this.darkness.uniforms.uSpirit.value.set(visible ? s.pos.x : -1e4, visible ? s.pos.y : -1e4)
    if (!visible) return

    const image = this.sheet!.image as HTMLImageElement
    const fw = SPIRIT_CELL.w / image.width
    const fh = SPIRIT_CELL.h / image.height
    const frameUv = (anim: SpiritAnim, frame: number) =>
      new THREE.Vector4(frame * fw, 1 - (SPIRIT_ANIMS[anim].row + 1) * fh, fw, fh)
    const x = Math.round(s.pos.x - SPIRIT_CELL.w / 2) + SPIRIT_CELL.w / 2
    const y = Math.round(s.pos.y - SPIRIT_CELL.h / 2) + SPIRIT_CELL.h / 2
    for (const [mesh, anim, frame] of [
      [main, s.anim, s.frame],
      [glow, s.anim, s.frame],
      [sparkle, 'sparkle', 0],
      [sparkleGlow, 'sparkle', 0],
    ] as const) {
      const uni = mesh.material.uniforms
      uni.uFrame.value = frameUv(anim, frame)
      uni.uFlip.value = s.flip ? 1 : 0
      uni.uTint.value.set(...s.tint)
      uni.uTintAmount.value = anim === 'sparkle' ? 0 : s.tintAmount
      uni.uSweep.value = s.sweep
      uni.uGlow.value = anim === 'sparkle' ? 1 : s.glow
      mesh.position.set(x, -y, 0)
    }
  }
}

function sheetTexture(image: HTMLImageElement): THREE.Texture {
  const t = new THREE.Texture(image)
  t.magFilter = THREE.NearestFilter
  t.minFilter = THREE.NearestFilter
  t.generateMipmaps = false
  t.colorSpace = THREE.SRGBColorSpace
  t.needsUpdate = true
  return t
}

/** A sheet-frame sprite (see SPIRIT_FRAG); `emissive` draws it as light for the bloom pass. */
function spriteMesh(w: number, h: number, emissive: number, order: number) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.ShaderMaterial({
      uniforms: {
        tSheet: { value: null },
        uFrame: { value: new THREE.Vector4() },
        uFlip: { value: 0 },
        uTint: { value: new THREE.Vector3() },
        uTintAmount: { value: 0 },
        uSweep: { value: 0 },
        uGlow: { value: 1 },
        uEmissive: { value: emissive },
      },
      vertexShader: QUAD_VERT,
      fragmentShader: SPIRIT_FRAG,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    }),
  )
  mesh.renderOrder = order
  mesh.frustumCulled = false
  mesh.visible = false
  return mesh
}

function worldPlane(material: THREE.Material, order: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_W, WORLD_H), material)
  mesh.position.set(WORLD_W / 2, -WORLD_H / 2, 0)
  mesh.renderOrder = order
  mesh.frustumCulled = false
  return mesh
}

function disposeMesh(o: THREE.Object3D) {
  if (!(o instanceof THREE.Mesh)) return
  o.geometry.dispose()
  ;(o.material as THREE.Material).dispose()
}
