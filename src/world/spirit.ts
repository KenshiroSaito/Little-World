// The tree spirit sits in the canopy, just off its highest leaves; C's
// SpiritBubble shows what it says. Which sheet frame to show is decided here;
// the stage draws it from the sheet cut out of maincharacter.jpeg.
import { SPIRIT_ANIMS } from './artLayout.ts'

export type SpiritAnim = keyof typeof SPIRIT_ANIMS

const IDLE_FPS = 5
// The idle frame with the open, happy mouth. The sheet's Happy frame is a
// close-up face, so it is not used on the body.
const HAPPY_IDLE_FRAME = 5

/** Which sheet frame to show. Happy briefly after care; no frame ever looks sad. */
export function spiritFrame(time: number, happy: boolean, reducedMotion: boolean): { anim: SpiritAnim; frame: number } {
  if (happy) return { anim: 'idle', frame: HAPPY_IDLE_FRAME }
  if (reducedMotion) return { anim: 'idle', frame: 0 }
  return { anim: 'idle', frame: Math.floor(time * IDLE_FPS) % SPIRIT_ANIMS.idle.frames }
}
