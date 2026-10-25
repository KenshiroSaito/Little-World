import type { MoodTag } from '../types';

/** Optional mood tags for Reflect. A mood never changes rewards or how the tree looks. */
export const MOODS: ReadonlyArray<{ id: MoodTag; label: string }> = [
  { id: 'calm', label: 'Calm' },
  { id: 'happy', label: 'Happy' },
  { id: 'tired', label: 'Tired' },
  { id: 'anxious', label: 'Anxious' },
  { id: 'low', label: 'Low' },
];
