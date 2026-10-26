// Background music and sound effects. Browsers only let a page play audio after
// the player has interacted with it, so the music starts from the title screen's
// button and the sounds load then.
import jumpUrl from './jump.mp3'
import musicUrl from './lovely-garden.mp3'

const MUSIC_VOLUME = 0.35
const JUMP_VOLUME = 0.6

let sounds: { music: HTMLAudioElement; jump: HTMLAudioElement } | null = null

function load() {
  if (!sounds) {
    const music = new Audio(musicUrl)
    music.loop = true
    music.volume = MUSIC_VOLUME
    const jump = new Audio(jumpUrl)
    jump.volume = JUMP_VOLUME
    sounds = { music, jump }
  }
  return sounds
}

/** Start the looping background track, unless it is already playing. */
export function startMusic(): void {
  const { music } = load()
  if (!music.paused) return
  music.play().catch((error) => console.warn('Unable to play the music', error))
}

/** Play the jump sound from the start, cutting off one still playing. */
export function playJump(): void {
  const { jump } = load()
  jump.currentTime = 0
  jump.play().catch((error) => console.warn('Unable to play the jump sound', error))
}
