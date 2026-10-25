import type { GameState, SelfCareLog } from '../types';

/** Newest first; never mutates the saved log array. */
export function getExperienceHistory(state: GameState): SelfCareLog[] {
  return [...state.selfCareLogs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
