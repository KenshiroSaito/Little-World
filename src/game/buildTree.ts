import type { LeafColor, Segment, SelfCareLog } from '../types';

// Coordinates follow the Segment comment in types.ts: tiles, x to the right of
// the trunk, y down from the surface (negative is above ground).

/** The taproot deepens 4 tiles every second record: 2 tiles per record on average. */
export const TAPROOT_STEP = 4;
const SAPLING_TOP = { x: 0, y: -3 };
const SAPLING_ROOT = { x: 0, y: 1 };
const CANOPY_LIMIT = -22; // branches stop rising here and spread sideways
const WORLD_X = { min: -34, max: 33 };

/** Small seeded generator: the same seed always gives the same sequence. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a hash, so each log id gets its own stable seed. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const round = (n: number) => Math.round(n * 4) / 4;
const clampX = (x: number) => Math.min(WORLD_X.max, Math.max(WORLD_X.min, x));
const between = (rand: () => number, min: number, max: number) => min + rand() * (max - min);

/** The world ends at depth 39 (A's layout.ts); the taproot stops just above bedrock. */
export const MAX_ROOT_DEPTH = 36;

/** Expected taproot depth (tiles below the surface) after `records` records. */
export function rootDepth(records: number): number {
  return Math.min(MAX_ROOT_DEPTH, Math.floor(records / 2) * TAPROOT_STEP);
}

/**
 * Turn the self-care logs into the tree. Pure and deterministic: logs are
 * processed in order, every random choice comes from a generator seeded by the
 * log id, so the same logs always give the same tree on every device.
 *
 * Each log adds one branch segment and one root segment:
 * - branch: grows up and out from a random existing branch.
 * - root: on even records the taproot deepens by TAPROOT_STEP (so depth is
 *   exact for the 20 LP / 40 LP thresholds); on odd records a side root grows
 *   from a random existing root, never deeper than the taproot.
 */
export function buildTree(logs: readonly SelfCareLog[], leafPaint: Readonly<Record<string, LeafColor>> = {}): Segment[] {
  const branches: Segment[] = [];
  const trunk: Segment[] = [];
  const roots: Segment[] = [];
  let taprootTip: Segment | null = null;

  logs.forEach((log, index) => {
    const rand = mulberry32(hash(log.id));
    const recordNumber = index + 1;

    // Branch. Every third record (starting with the first) the trunk grows up
    // near x = 0; the others are side branches, alternating left and right, so
    // the tree stays balanced instead of drifting to one side.
    const branchId = `${log.id}:b`;
    const trunkTip = trunk.at(-1);
    const trunkGrows = recordNumber % 3 === 1 && (trunkTip?.to.y ?? SAPLING_TOP.y) > CANOPY_LIMIT + 2;
    let segment: Segment;
    if (trunkGrows || !trunkTip) {
      const from = trunkTip?.to ?? SAPLING_TOP;
      segment = {
        id: branchId,
        kind: 'branch',
        parentId: trunkTip?.id ?? null,
        from,
        to: { x: round(between(rand, -0.75, 0.75)), y: round(Math.max(CANOPY_LIMIT, from.y - between(rand, 2, 3))) },
      };
      trunk.push(segment);
    } else {
      const side = recordNumber % 2 === 0 ? 1 : -1;
      // Grow from the trunk or from a branch already on this side.
      const candidates = [...trunk, ...branches.filter(b => !trunk.includes(b) && Math.sign(b.to.x) === side)];
      const parent = candidates[Math.floor(rand() * candidates.length)];
      const t = between(rand, 0.4, 0.95);
      const from = {
        x: parent.from.x + (parent.to.x - parent.from.x) * t,
        y: parent.from.y + (parent.to.y - parent.from.y) * t,
      };
      const atCanopy = from.y <= CANOPY_LIMIT;
      segment = {
        id: branchId,
        kind: 'branch',
        parentId: parent.id,
        from: { x: round(from.x), y: round(from.y) },
        to: {
          x: round(clampX(from.x + side * between(rand, 2, 4.5))),
          y: round(Math.max(CANOPY_LIMIT, from.y + (atCanopy ? between(rand, 0, 1) : between(rand, -2.5, -0.5)))),
        },
      };
    }
    segment.leafColor = leafPaint[branchId] ?? log.activityId;
    branches.push(segment);

    // Root
    const rootId = `${log.id}:r`;
    const taprootGrows = recordNumber % 2 === 0 && (taprootTip?.to.y ?? 0) < MAX_ROOT_DEPTH;
    if (taprootGrows) {
      const start = taprootTip?.to ?? { x: 0, y: 0 };
      const tip: Segment = {
        id: rootId,
        kind: 'root',
        parentId: taprootTip?.id ?? null,
        from: start,
        to: { x: round(between(rand, -1, 1)), y: rootDepth(recordNumber) },
      };
      roots.push(tip);
      taprootTip = tip;
    } else {
      const parent = roots.length > 0 ? roots[Math.floor(rand() * roots.length)] : null;
      const start = parent ? parent.to : SAPLING_ROOT;
      const maxDepth = Math.max(rootDepth(recordNumber), SAPLING_ROOT.y + 1);
      const side = rand() < 0.5 ? -1 : 1;
      roots.push({
        id: rootId,
        kind: 'root',
        parentId: parent?.id ?? null,
        from: { x: round(start.x), y: round(start.y) },
        to: {
          x: round(clampX(start.x + side * between(rand, 2, 4))),
          y: round(Math.min(maxDepth, start.y + between(rand, 1, 3))),
        },
      });
    }
  });

  return [...branches, ...roots];
}
