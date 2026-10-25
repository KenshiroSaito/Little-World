import type { ActivityId, GameState, MoodTag } from '../types';
import { localDate } from './rules';

/** The spirit speaks only after this many new records since its last message. */
export const SPIRIT_MIN_NEW_RECORDS = 3;
const WINDOW_DAYS = 7;

/**
 * Templates use only counts of activities and mood tags. They never read free
 * text, and never mention missed days, streaks or anything the player did not do.
 */
const ACTIVITY_LINES: Record<ActivityId, (n: number) => string> = {
  walk: n => `You went for ${n} walk${n === 1 ? '' : 's'} this week. The roots felt every step.`,
  connect: n => `You reached out to someone ${n} time${n === 1 ? '' : 's'} this week. The lanterns noticed.`,
  break: n => `You took ${n} break${n === 1 ? '' : 's'} this week. The teal leaves suit you.`,
  reflect: n => `${n} new reflection${n === 1 ? '' : 's'}. The roots are listening.`,
};
const HARD_MOODS: MoodTag[] = ['tired', 'anxious', 'low'];

/** Every template the spirit can say, used by tests to check the wording. */
export function allSpiritTemplates(): string[] {
  return [
    ...Object.values(ACTIVITY_LINES).map(line => line(2)),
    hardMoodLine('tired', 2),
  ];
}

function hardMoodLine(mood: MoodTag, n: number): string {
  return `You marked '${mood}' ${n === 1 ? 'once' : `${n} times`}, and you still looked after yourself. That counts.`;
}

/**
 * What the spirit says when the game opens, or null when it should stay quiet:
 * it is switched off, already spoke today, or fewer than 3 records are new.
 */
export function spiritMessage(state: GameState, now: string): string | null {
  const { spirit, selfCareLogs, dayOffset } = state;
  const today = localDate(new Date(now), dayOffset);
  if (!spirit.enabled) return null;
  if (spirit.lastShownDate === today) return null;
  if (selfCareLogs.length - spirit.lastShownLogCount < SPIRIT_MIN_NEW_RECORDS) return null;

  const since = localDate(new Date(now), dayOffset - (WINDOW_DAYS - 1));
  const recent = selfCareLogs.filter(log => log.date >= since);

  // A hard mood, met with care, is the most important thing to notice.
  const moodCounts = new Map<MoodTag, number>();
  for (const log of recent) if (log.mood) moodCounts.set(log.mood, (moodCounts.get(log.mood) ?? 0) + 1);
  const hard = HARD_MOODS.find(m => moodCounts.has(m));
  if (hard && recent.some(log => log.activityId !== 'reflect')) return hardMoodLine(hard, moodCounts.get(hard)!);

  // Otherwise, the activity done most often this week.
  const counts = new Map<ActivityId, number>();
  for (const log of recent) counts.set(log.activityId, (counts.get(log.activityId) ?? 0) + 1);
  const [top] = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return top ? ACTIVITY_LINES[top[0]](top[1]) : null;
}
