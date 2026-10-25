import type { RelicId } from '../types';

/** Display text for each relic. When a relic appears is decided by progression.ts. */
export const RELICS: Readonly<Record<RelicId, { name: string; lore: string }>> = {
  carved_stone: {
    name: 'Carved Stone',
    lore: 'A worn stone with marks like roots. Someone grew things here once.',
  },
  heartwood_relic: {
    name: 'Heartwood Relic',
    lore: 'Found at the heart of the ruin. The old tree and the new one share the same rings.',
  },
};
