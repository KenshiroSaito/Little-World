import type { ActivityId, GameState, MoodTag, SelfCareLog } from '../types';
import { LP_PER_ACTIVITY } from './activities';

export const MAX_REFLECTION_LENGTH = 120;

/**
 * Local calendar date as YYYY-MM-DD. Uses local getters, not toISOString(),
 * which is UTC and would move late-evening records to the next day.
 */
export function localDate(now: Date, dayOffset = 0): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Activities already recorded on the local day of `now`. */
export function doneToday(state: GameState, now: string): ActivityId[] {
  const today = localDate(new Date(now), state.dayOffset);
  return state.selfCareLogs.filter(log => log.date === today).map(log => log.activityId);
}

/**
 * Record one activity. Returns the same state object, unchanged, when that
 * activity was already recorded today, so each activity pays out once a day.
 * `now` is passed in (ISO string) so this stays a pure function.
 */
export function recordActivity(
  state: GameState,
  activityId: ActivityId,
  now: string,
  extras: { text?: string; mood?: MoodTag } = {},
): GameState {
  const date = localDate(new Date(now), state.dayOffset);
  if (state.selfCareLogs.some(log => log.date === date && log.activityId === activityId)) return state;

  const log: SelfCareLog = {
    // One record per activity per day, so date + activity is already unique.
    id: `${date}-${activityId}`,
    activityId,
    date,
    createdAt: now,
    points: LP_PER_ACTIVITY,
  };
  if (activityId === 'reflect') {
    const text = extras.text?.trim().slice(0, MAX_REFLECTION_LENGTH);
    if (text) log.text = text;
    if (extras.mood) log.mood = extras.mood;
  }
  return { ...state, selfCareLogs: [...state.selfCareLogs, log] };
}
