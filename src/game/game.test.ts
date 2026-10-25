import { describe, expect, it } from 'vitest';
import type { GameState } from '../types';
import { gameReducer, initialGameState } from '../state/gameReducer';
import { isValidGameState } from '../state/persistence';
import { buildTree, rootDepth } from './buildTree';
import { doneToday, localDate, recordActivity } from './rules';
import { journalPages } from './journal';
import { inscriptions, revealedRelics, totalLP, unlockedColors } from './progression';
import { allSpiritTemplates, spiritMessage } from './spirit';

const at = (day: number, hour = 12) => new Date(2026, 9, day, hour).toISOString();
const ALL = ['walk', 'connect', 'break', 'reflect'] as const;

/** Record all four activities on each of `days` consecutive days, starting Oct 1. */
function fullDays(days: number, state: GameState = initialGameState): GameState {
  for (let d = 1; d <= days; d++) {
    for (const a of ALL) state = recordActivity(state, a, at(d), { text: a === 'reflect' ? `day ${d}` : undefined });
  }
  return state;
}

describe('rewards', () => {
  it('pays out every record of an activity, even on the same day', () => {
    const once = recordActivity(initialGameState, 'walk', at(1, 9));
    const twice = recordActivity(once, 'walk', at(1, 18));
    expect(totalLP(twice)).toBe(10);
    expect(twice.selfCareLogs.map(l => l.id)).toEqual(['2026-10-01-walk', '2026-10-01-walk-2']);
  });

  it('has no daily LP cap', () => {
    let day = fullDays(1);
    for (const a of ALL) day = recordActivity(day, a, at(1, 20));
    expect(totalLP(day)).toBe(40);
    expect(doneToday(day, at(1))).toHaveLength(8);
    expect(isValidGameState(day)).toBe(true);
  });

  it('pays out again the next day', () => {
    const next = recordActivity(fullDays(1), 'walk', at(2));
    expect(totalLP(next)).toBe(25);
  });

  it('loses nothing over a 30-day gap', () => {
    const before = fullDays(2);
    const after = recordActivity(before, 'walk', at(31));
    expect(totalLP(after)).toBe(totalLP(before) + 5);
    expect(unlockedColors(after)).toEqual(unlockedColors(before));
    expect(revealedRelics(after)).toEqual(revealedRelics(before));
    // Every segment that existed before the gap is still there, unchanged.
    const grown = buildTree(after.selfCareLogs);
    for (const segment of buildTree(before.selfCareLogs)) {
      expect(grown).toContainEqual(segment);
    }
  });

  it('dates a 23:59 record on that day, not the next', () => {
    expect(localDate(new Date(2026, 9, 25, 23, 59))).toBe('2026-10-25');
    const late = recordActivity(initialGameState, 'break', new Date(2026, 9, 25, 23, 59).toISOString());
    expect(late.selfCareLogs[0].date).toBe('2026-10-25');
  });

  it('keeps text and mood only for reflect, trimmed to 120 characters', () => {
    const walk = recordActivity(initialGameState, 'walk', at(1), { text: 'nice', mood: 'calm' });
    expect(walk.selfCareLogs[0].text).toBeUndefined();
    const long = 'a'.repeat(200);
    const reflect = recordActivity(initialGameState, 'reflect', at(1), { text: `  ${long} `, mood: 'tired' });
    expect(reflect.selfCareLogs[0].text).toHaveLength(120);
    expect(reflect.selfCareLogs[0].mood).toBe('tired');
    expect(inscriptions(reflect)).toHaveLength(1);
  });

  it('demo Next day moves "today" forward', () => {
    const day = fullDays(1);
    expect(doneToday(day, at(1))).toHaveLength(4);
    const tomorrow = gameReducer(day, { type: 'nextDay' });
    expect(doneToday(tomorrow, at(1))).toHaveLength(0);
  });
});

describe('buildTree', () => {
  it('is deterministic: the same logs give the same tree', () => {
    const logs = fullDays(4).selfCareLogs;
    expect(buildTree(logs)).toEqual(buildTree([...logs]));
  });

  it('adds one branch and one root per record', () => {
    const logs = fullDays(3).selfCareLogs;
    const tree = buildTree(logs);
    expect(tree.filter(s => s.kind === 'branch')).toHaveLength(logs.length);
    expect(tree.filter(s => s.kind === 'root')).toHaveLength(logs.length);
  });

  it('roots reach stone (depth 8) at 20 LP and the ruin (depth 16) at 40 LP', () => {
    const deepest = (n: number) =>
      Math.max(...buildTree(fullDays(3).selfCareLogs.slice(0, n)).filter(s => s.kind === 'root').map(s => s.to.y));
    expect(deepest(3)).toBeLessThan(8);
    expect(deepest(4)).toBe(8);
    expect(deepest(7)).toBeLessThan(16);
    expect(deepest(8)).toBe(16);
    expect(rootDepth(8)).toBe(16);
  });

  it('stays inside the world, however long the tree grows', () => {
    const tree = buildTree(fullDays(30).selfCareLogs);
    for (const s of tree) {
      expect(s.to.y).toBeLessThanOrEqual(36);
      expect(s.to.y).toBeGreaterThanOrEqual(-22);
      expect(s.to.x).toBeGreaterThanOrEqual(-34);
      expect(s.to.x).toBeLessThanOrEqual(33);
    }
  });

  it('keeps painted leaves through further growth', () => {
    const state = fullDays(1);
    const target = buildTree(state.selfCareLogs).find(s => s.kind === 'branch')!;
    const painted = gameReducer(state, { type: 'paint', segmentId: target.id, colorId: 'connect' });
    const grown = recordActivity(painted, 'walk', at(2));
    expect(buildTree(grown.selfCareLogs, grown.leafPaint).find(s => s.id === target.id)?.leafColor).toBe('connect');
  });
});

describe('progression', () => {
  it('reveals the Carved Stone at 20 LP and the Heartwood Relic at 40 LP', () => {
    expect(revealedRelics(fullDays(1)).map(r => r.id)).toEqual(['carved_stone']);
    expect(revealedRelics(fullDays(2)).map(r => r.id)).toEqual(['carved_stone', 'heartwood_relic']);
  });

  it('refuses to paint with a locked colour, and undoes paint with null', () => {
    const walked = recordActivity(initialGameState, 'walk', at(1));
    const seg = buildTree(walked.selfCareLogs)[0].id;
    expect(gameReducer(walked, { type: 'paint', segmentId: seg, colorId: 'reflect' })).toBe(walked);
    const painted = gameReducer(walked, { type: 'paint', segmentId: seg, colorId: 'base' });
    expect(painted.leafPaint[seg]).toBe('base');
    expect(gameReducer(painted, { type: 'paint', segmentId: seg, colorId: null }).leafPaint).toEqual({});
  });

  it('paints with any mixed #rrggbb colour, and keeps it in a valid save', () => {
    const walked = recordActivity(initialGameState, 'walk', at(1));
    const seg = buildTree(walked.selfCareLogs)[0].id;
    const painted = gameReducer(walked, { type: 'paint', segmentId: seg, colorId: '#ff6fa8' });
    expect(buildTree(painted.selfCareLogs, painted.leafPaint).find(s => s.id === seg)?.leafColor).toBe('#ff6fa8');
    expect(isValidGameState(painted)).toBe(true);
    expect(gameReducer(walked, { type: 'paint', segmentId: seg, colorId: '#nope' as `#${string}` })).toBe(walked);
  });
});

describe('spirit', () => {
  it('stays quiet with fewer than 3 new records', () => {
    let state = recordActivity(initialGameState, 'walk', at(1));
    state = recordActivity(state, 'break', at(1));
    expect(spiritMessage(state, at(1))).toBeNull();
  });

  it('speaks after 3 new records, then not again the same day', () => {
    const state = fullDays(1);
    expect(spiritMessage(state, at(1))).not.toBeNull();
    const shown = gameReducer(state, { type: 'spiritShown', now: at(1) });
    expect(spiritMessage(shown, at(1))).toBeNull();
  });

  it('never talks about missed days or streaks', () => {
    for (const line of allSpiritTemplates()) {
      expect(line).not.toMatch(/miss|streak|forgot|haven't|didn't|lost|behind/i);
    }
  });
});

describe('saving', () => {
  it('accepts a real game and rejects corrupt saves', () => {
    expect(isValidGameState(fullDays(2))).toBe(true);
    expect(isValidGameState(null)).toBe(false);
    expect(isValidGameState({ version: 3 })).toBe(false);
    expect(isValidGameState({ ...initialGameState, selfCareLogs: [{ id: 'x' }] })).toBe(false);
  });
});

describe('journal', () => {
  it('starts a page for each day, oldest first, and opens nothing for no records', () => {
    expect(journalPages([])).toEqual([]);
    const pages = journalPages(fullDays(3).selfCareLogs);
    expect(pages.map(p => p.date)).toEqual(['2026-10-01', '2026-10-02', '2026-10-03']);
    expect(pages.every(p => !p.continued && p.entries.length === 4)).toBe(true);
  });

  it('carries a busy day over onto more pages, keeping every record once', () => {
    let state = initialGameState;
    for (let i = 0; i < 30; i++) state = recordActivity(state, ALL[i % 4], at(1, 8), { text: 'x'.repeat(100) });
    const pages = journalPages(state.selfCareLogs);
    expect(pages.length).toBeGreaterThan(1);
    expect(pages.slice(1).every(p => p.continued && p.date === '2026-10-01')).toBe(true);
    expect(pages.flatMap(p => p.entries.map(e => e.id))).toEqual(state.selfCareLogs.map(l => l.id));
  });
});
