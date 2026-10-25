import { validPurchases } from '../shop/inventory';
import { MAX_REFLECTION_IMAGES } from '../game/rules';
import { ACTIVITY_IDS, MOOD_TAGS, isCustomColor, type GameState, type SelfCareLog } from '../types';

export const SAVE_KEY = 'littleworld:save';
const COLOR_IDS: readonly string[] = ['base', ...ACTIVITY_IDS];

/** Narrow unknown input to a non-null, non-array object before inspecting fields. */
function object(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function logValid(v: unknown): v is SelfCareLog {
  return object(v) &&
    typeof v.id === 'string' && v.id.length > 0 &&
    (ACTIVITY_IDS as readonly string[]).includes(v.activityId as string) &&
    typeof v.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.date) &&
    typeof v.createdAt === 'string' && !Number.isNaN(Date.parse(v.createdAt)) &&
    v.points === 5 &&
    (v.text === undefined || (typeof v.text === 'string' && v.text.length <= 120)) &&
    (v.mood === undefined || (MOOD_TAGS as readonly string[]).includes(v.mood as string)) &&
    (v.images === undefined || (v.activityId === 'reflect' && Array.isArray(v.images) && v.images.length <= MAX_REFLECTION_IMAGES &&
      v.images.every(id => typeof id === 'string' && id.length > 0)));
}

/** Check a parsed save against the v2 shape before trusting it. */
export function isValidGameState(v: unknown): v is GameState {
  if (!object(v) || v.version !== 2) return false;
  if (!Array.isArray(v.selfCareLogs) || !v.selfCareLogs.every(logValid)) return false;
  const logs = v.selfCareLogs as SelfCareLog[];
  if (v.shopPurchases !== undefined && (!validPurchases(v.shopPurchases) || v.shopPurchases.reduce((sum, p) => sum + p.price, 0) > logs.reduce((sum, log) => sum + log.points, 0))) return false;
  if (new Set(logs.map(l => l.id)).size !== logs.length) return false;
  if (!object(v.leafPaint) || !Object.values(v.leafPaint).every(c => COLOR_IDS.includes(c as string) || isCustomColor(c))) return false;
  const { spirit, settings } = v;
  if (!object(spirit) || typeof spirit.enabled !== 'boolean' || !Number.isSafeInteger(spirit.lastShownLogCount) ||
      !(spirit.lastShownDate === null || typeof spirit.lastShownDate === 'string')) return false;
  if (!object(settings) || typeof settings.reducedMotion !== 'boolean') return false;
  return Number.isSafeInteger(v.dayOffset) && (v.dayOffset as number) >= 0;
}

/** Saved game, or null when there is none or it is unreadable or invalid (a new game starts). */
export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return isValidGameState(parsed) ? parsed : null;
  } catch (error) {
    console.warn('Unable to load saved game; starting a new one', error);
    return null;
  }
}

/** Write the game. A failed write is logged, never thrown, so the game keeps running. */
export function saveGame(state: GameState): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('Unable to save game', error);
  }
}
