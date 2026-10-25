// The characters who move into the tree houses. Their sheets were cut by
// tools/extract_art.py from character sheets that are no longer kept, so this
// layout is kept by hand. Every sheet's frames face right, feet on the bottom row.
import blacksmithUrl from './assets/blacksmith.png'
import knightUrl from './assets/knight.png'
import librarianUrl from './assets/librarian.png'
import wizardUrl from './assets/wizard.png'

export type NpcId = 'wizard' | 'librarian' | 'knight' | 'blacksmith'

type Anim = { row: number; frames: readonly number[]; fps: number }
type NpcDef = { url: string; cell: { w: number; h: number }; idle: Anim; action: Anim }

const anim = (row: number, frames: number[], fps: number): Anim => ({ row, frames, fps })

/**
 * Sheet rows, 12 frames each. Wizard: walk, cast, brew, read, magic. Librarian:
 * idle, carry, shelve, read, gesture. Knight: idle, guard, attack, defend, rest.
 * Blacksmith: idle, forge, craft, inspect, gesture.
 */
export const NPCS: Record<NpcId, NpcDef> = {
  wizard: { url: wizardUrl, cell: { w: 46, h: 51 }, idle: anim(0, [0, 1, 2, 3, 4, 5], 2), action: anim(1, [6, 7, 8, 9, 10], 6) },
  librarian: { url: librarianUrl, cell: { w: 53, h: 49 }, idle: anim(0, [0, 1, 2, 3], 2), action: anim(3, [0, 1, 2, 3], 3) },
  knight: { url: knightUrl, cell: { w: 65, h: 54 }, idle: anim(0, [0, 0, 9, 10], 1.5), action: anim(1, [6, 7, 8, 9, 10, 11], 6) },
  blacksmith: {
    url: blacksmithUrl,
    cell: { w: 52, h: 51 },
    idle: anim(0, [0, 1, 2, 3, 4, 5], 2),
    action: anim(1, [0, 1, 2, 3, 4], 8),
  },
}

/** The order characters move in: the first four houses each get someone new, then round again. */
export const NPC_ORDER: readonly NpcId[] = ['wizard', 'librarian', 'knight', 'blacksmith']

const IDLE_SECONDS = 6
const ACTION_SECONDS = 3

/**
 * The sheet cell an NPC shows at `time` seconds: mostly idle, now and then their
 * own thing (casting, reading, guarding, forging). `phase` (0 to 1) staggers
 * neighbours. With reduced motion they hold their first idle frame.
 */
export function npcFrame(id: NpcId, time: number, phase: number, reducedMotion: boolean): { row: number; frame: number } {
  const def = NPCS[id]
  if (reducedMotion) return { row: def.idle.row, frame: def.idle.frames[0] }
  const cycle = IDLE_SECONDS + ACTION_SECONDS
  const within = (((time + phase * cycle) % cycle) + cycle) % cycle
  const a = within < IDLE_SECONDS ? def.idle : def.action
  const since = within < IDLE_SECONDS ? within : within - IDLE_SECONDS
  return { row: a.row, frame: a.frames[Math.floor(since * a.fps) % a.frames.length] }
}
