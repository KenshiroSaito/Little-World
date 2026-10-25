import type { ActivityId, ColorId } from '../types';

/** Every self-care record is worth the same; there is no bonus for doing more. */
export const LP_PER_ACTIVITY = 5;

/** The four activities, in the order the Self-Care panel shows them. */
export const ACTIVITIES: ReadonlyArray<{ id: ActivityId; label: string; colorName: string }> = [
  { id: 'walk', label: 'Walk', colorName: 'Spring green' },
  { id: 'connect', label: 'Connect', colorName: 'Sunset orange' },
  { id: 'break', label: 'Take a Break', colorName: 'Teal' },
  { id: 'reflect', label: 'Reflect', colorName: 'Lavender' },
];

/** Leaf colours: base is unlocked from the start, each activity unlocks its own. */
export const COLORS: ReadonlyArray<{ id: ColorId; name: string }> = [
  { id: 'base', name: 'Base green' },
  ...ACTIVITIES.map(a => ({ id: a.id, name: a.colorName })),
];
