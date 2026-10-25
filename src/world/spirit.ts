// The tree spirit is the player character (player.ts moves it); C's
// SpiritBubble shows what it says. Which sheet frame to show is decided here;
// the stage draws it from the sheet cut out of maincharacter.jpeg.
import { SPIRIT_ANIMS } from './artLayout.ts'
import type { Point } from './layout.ts'
import type { Player } from './player.ts'

export type SpiritAnim = keyof typeof SPIRIT_ANIMS

const IDLE_FPS = 5
const WALK_FPS = 10
// The idle frame with the open, happy mouth. The sheet's Happy frame is a
// close-up face, so it is not used on the body.
const HAPPY_IDLE_FRAME = 5
/** The walk frame with the legs apart: the spirit mid-jump or falling. */
const AIR_FRAME = 2
/** Slower than this (world pixels per second) counts as standing still. */
const STILL = 4

/** Which sheet frame to show. Happy briefly after care; no frame ever looks sad. */
export function spiritFrame(time: number, happy: boolean, reducedMotion: boolean): { anim: SpiritAnim; frame: number } {
  if (happy) return { anim: 'idle', frame: HAPPY_IDLE_FRAME }
  if (reducedMotion) return { anim: 'idle', frame: 0 }
  return { anim: 'idle', frame: Math.floor(time * IDLE_FPS) % SPIRIT_ANIMS.idle.frames }
}

/**
 * The player's frame: walking frames (side on, mirrored when facing left) while
 * it walks, climbs or is in the air, the idle (front on) when it stands still.
 * Walking still animates with reduced motion: it only moves when the player does.
 */
export function playerFrame(
  p: Pick<Player, 'mode' | 'vx' | 'vy' | 'facing'>,
  time: number,
  happy: boolean,
  reducedMotion: boolean,
): { anim: SpiritAnim; frame: number; flip: boolean } {
  const flip = p.facing < 0
  const walking = Math.floor(time * WALK_FPS) % SPIRIT_ANIMS.walk.frames
  if (p.mode === 'air') return { anim: 'walk', frame: AIR_FRAME, flip }
  if (p.mode === 'climb') return { anim: 'walk', frame: Math.hypot(p.vx, p.vy) > STILL ? walking : 0, flip }
  if (Math.abs(p.vx) > STILL) return { anim: 'walk', frame: walking, flip }
  return { ...spiritFrame(time, happy, reducedMotion), flip: false }
}

/**
 * How far the body in each frame of a sheet row sits from where it is in the
 * row's first frame, found by sliding each frame up to 2 pixels for the best
 * overlap. Worn accessories move by this so they bob with the body.
 * `alpha` is the sheet's alpha channel, one byte per pixel, `width` wide.
 */
export function frameShifts(alpha: ArrayLike<number>, width: number, cell: { w: number; h: number }, row: number, frames: number): Point[] {
  const solid = (frame: number, x: number, y: number) =>
    x >= 0 && y >= 0 && x < cell.w && y < cell.h && alpha[(row * cell.h + y) * width + frame * cell.w + x] >= 128
  const shifts: Point[] = []
  for (let f = 0; f < frames; f++) {
    let best = { x: 0, y: 0 }
    let bestScore = -1
    for (let sy = -2; sy <= 2; sy++) {
      for (let sx = -2; sx <= 2; sx++) {
        let score = 0
        for (let y = 0; y < cell.h; y++) for (let x = 0; x < cell.w; x++) if (solid(0, x, y) && solid(f, x + sx, y + sy)) score++
        // Ties go to the smaller shift.
        if (score > bestScore || (score === bestScore && Math.abs(sx) + Math.abs(sy) < Math.abs(best.x) + Math.abs(best.y))) {
          best = { x: sx, y: sy }
          bestScore = score
        }
      }
    }
    shifts.push(best)
  }
  return shifts
}
