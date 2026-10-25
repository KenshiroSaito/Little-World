import type { ColorId, GameState, RelicId, RevealedRelic, SelfCareLog } from '../types';

/** Total LP needed for each relic. 20 LP: roots reach stone. 40 LP: roots reach the ruin. */
export const RELIC_THRESHOLDS: Readonly<Record<RelicId, number>> = {
  carved_stone: 20,
  heartwood_relic: 40,
};
export const RUIN_THRESHOLD = RELIC_THRESHOLDS.heartwood_relic;

/** Sum of every record's points. Nothing is ever subtracted. */
export function totalLP(state: GameState): number {
  return state.selfCareLogs.reduce((sum, log) => sum + log.points, 0);
}

/** base, plus the colour of every activity recorded at least once. */
export function unlockedColors(state: GameState): ColorId[] {
  const colors: ColorId[] = ['base'];
  for (const log of state.selfCareLogs) {
    if (!colors.includes(log.activityId)) colors.push(log.activityId);
  }
  return colors;
}

/** Relics whose threshold has been reached, with the time of the record that crossed it. */
export function revealedRelics(state: GameState): RevealedRelic[] {
  const found: RevealedRelic[] = [];
  let sum = 0;
  for (const log of state.selfCareLogs) {
    const before = sum;
    sum += log.points;
    for (const [id, threshold] of Object.entries(RELIC_THRESHOLDS) as [RelicId, number][]) {
      if (before < threshold && sum >= threshold) found.push({ id, foundAt: log.createdAt });
    }
  }
  return found;
}

export function ruinReached(state: GameState): boolean {
  return totalLP(state) >= RUIN_THRESHOLD;
}

/** Reflect records with a sentence, a mood or photos, oldest first. Shown on the ruin's tablet wall. */
export function inscriptions(state: GameState): SelfCareLog[] {
  return state.selfCareLogs.filter(log => log.activityId === 'reflect' && (log.text || log.mood || log.images?.length));
}
