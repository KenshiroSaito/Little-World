import * as THREE from 'three'
import type { Point } from './layout.ts'
import { mulberry32 } from './rng.ts'
import { PARTICLE_FRAG, PARTICLE_VERT } from './shaders.ts'

export type Rgb = [number, number, number]

/**
 * A long-lived particle: kind 0 wanders around its origin, kind 2 rises `rise`
 * pixels and loops, kind 3 is a leaf that tumbles `fall` pixels down and loops.
 */
export type Ambient = { origin: Point; color: Rgb; kind: 0 | 2 | 3; rise?: number; fall?: number; size?: number }

const AMBIENT_MAX = 320
const BURST_MAX = 400
const DEAD_BIRTH = -1e6
/** World pixels a leaf falls per second; between falls it rests unseen for as long again. */
const LEAF_SPEED = 18
const MIN_FALL = 16

/**
 * Pixel particles in one buffer: ambient slots first, then a ring of burst
 * slots. Spawning writes a few attributes; every frame after that is GPU-only.
 * The same geometry is drawn crisp in the scene and brighter in the bloom pass.
 * Additive by default, for light; with `additive` false the pixels are solid (leaves).
 */
export class Particles {
  readonly main: THREE.Points
  readonly glow: THREE.Points
  private readonly geometry = new THREE.BufferGeometry()
  private readonly uniforms = {
    uTime: { value: 0 },
    uScale: { value: 1 },
    uMotion: { value: 1 },
  }
  private readonly attr: Record<string, THREE.BufferAttribute>
  private readonly rand = mulberry32(99)
  private next = 0

  constructor(additive = true) {
    const n = AMBIENT_MAX + BURST_MAX
    const make = (size: number) => new THREE.BufferAttribute(new Float32Array(n * size), size)
    this.attr = {
      position: make(3),
      aOrigin: make(2),
      aVelocity: make(2),
      aColor: make(3),
      aBirth: make(1),
      aLife: make(1),
      aSeed: make(1),
      aKind: make(1),
      aSize: make(1),
    }
    for (const [name, a] of Object.entries(this.attr)) this.geometry.setAttribute(name, a)
    for (let i = 0; i < n; i++) this.kill(i)

    const material = (boost: number) =>
      new THREE.ShaderMaterial({
        uniforms: { ...this.uniforms, uBoost: { value: boost } },
        vertexShader: PARTICLE_VERT,
        fragmentShader: PARTICLE_FRAG,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
        premultipliedAlpha: !additive,
      })
    this.main = new THREE.Points(this.geometry, material(1))
    this.glow = new THREE.Points(this.geometry, material(1.8))
    for (const p of [this.main, this.glow]) p.frustumCulled = false
  }

  setAmbient(list: readonly Ambient[]): void {
    for (let i = 0; i < AMBIENT_MAX; i++) {
      const a = list[i]
      if (!a) {
        this.kill(i)
        continue
      }
      // Leaves: velocity is (falls per second, fall height), so each takes about as long whatever its height.
      const fall = Math.max(MIN_FALL, a.fall ?? 0)
      const velocity = a.kind === 3 ? [(LEAF_SPEED / (2 * fall)) * (0.7 + 0.6 * this.rand()), fall] : [0, a.rise ?? 0]
      this.write(i, a.origin, velocity, a.color, 0, 1, this.rand(), a.kind, a.size ?? 1)
    }
    this.flush()
  }

  /** `count` pixels flying out from `at` (world pixels), slightly upward. */
  burst(at: Point, color: Rgb, count: number, speed: number, time: number): void {
    for (let n = 0; n < count; n++) {
      const angle = this.rand() * Math.PI * 2
      const v = speed * (0.35 + this.rand() * 0.65)
      const velocity = [Math.cos(angle) * v, Math.sin(angle) * v - speed * 0.35]
      const life = 1.1 + this.rand() * 0.8
      this.write(AMBIENT_MAX + this.next, at, velocity, color, time, life, this.rand(), 1, this.rand() < 0.3 ? 2 : 1)
      this.next = (this.next + 1) % BURST_MAX
    }
    this.flush()
  }

  update(time: number, scale: number, motion: boolean): void {
    this.uniforms.uTime.value = time
    this.uniforms.uScale.value = scale
    this.uniforms.uMotion.value = motion ? 1 : 0
  }

  dispose(): void {
    this.geometry.dispose()
    ;(this.main.material as THREE.Material).dispose()
    ;(this.glow.material as THREE.Material).dispose()
  }

  private write(
    i: number,
    origin: Point,
    velocity: number[],
    color: Rgb,
    birth: number,
    life: number,
    seed: number,
    kind: number,
    size: number,
  ) {
    const a = this.attr
    a.aOrigin.setXY(i, origin.x, origin.y)
    a.aVelocity.setXY(i, velocity[0], velocity[1])
    a.aColor.setXYZ(i, color[0], color[1], color[2])
    a.aBirth.setX(i, birth)
    a.aLife.setX(i, life)
    a.aSeed.setX(i, seed)
    a.aKind.setX(i, kind)
    a.aSize.setX(i, size)
  }

  private kill(i: number) {
    this.write(i, { x: 0, y: 0 }, [0, 0], [0, 0, 0], DEAD_BIRTH, 1, 0, 1, 1)
  }

  private flush() {
    for (const a of Object.values(this.attr)) a.needsUpdate = true
  }
}
