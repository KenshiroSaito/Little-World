import type { ShopPurchase } from './shop/inventory';
// Shared types for Little World (spec v2.1).
// Agreed by A, B and C. Change only after telling the whole team.

// ---------- IDs ----------

export const ACTIVITY_IDS = ["walk", "connect", "break", "reflect"] as const;
export type ActivityId = (typeof ACTIVITY_IDS)[number];

export const MOOD_TAGS = ["calm", "happy", "tired", "anxious", "low"] as const;
export type MoodTag = (typeof MOOD_TAGS)[number];

/** "base" is unlocked from the start; each activity unlocks its own colour. */
export type ColorId = "base" | ActivityId;

/** A leaf colour: one of the unlockable colours, or any "#rrggbb" the player mixes. */
export type LeafColor = ColorId | `#${string}`;

export function isCustomColor(v: unknown): v is `#${string}` {
  return typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);
}

export const RELIC_IDS = ["carved_stone", "heartwood_relic"] as const;
export type RelicId = (typeof RELIC_IDS)[number];

// ---------- Stored state (facts only) ----------

export type SelfCareLog = {
  id: string;
  activityId: ActivityId;
  date: string; // local YYYY-MM-DD
  createdAt: string; // ISO timestamp
  points: number; // 5
  text?: string; // reflect only, max 120 chars
  mood?: MoodTag; // reflect only
};

export type GameState = {
  version: 2;
  shopPurchases?: ShopPurchase[];
  selfCareLogs: SelfCareLog[];
  /** segment id -> colour the player painted */
  leafPaint: Record<string, LeafColor>;
  spirit: {
    enabled: boolean;
    lastShownLogCount: number;
    lastShownDate: string | null; // local YYYY-MM-DD
  };
  settings: { reducedMotion: boolean };
  /** demo mode only, 0 otherwise */
  dayOffset: number;
};

// ---------- Derived (computed by B, never stored) ----------

/** Output of buildTree. The contract between B (logic) and A (renderer). */
export type Segment = {
  id: string; // `${logId}:b` or `${logId}:r`
  kind: "branch" | "root";
  parentId: string | null;
  from: { x: number; y: number }; // tile coordinates
  to: { x: number; y: number };
  leafColor?: LeafColor; // branches: painted colour, else the activity's colour
};

export type RevealedRelic = {
  id: RelicId;
  foundAt: string; // createdAt of the record that crossed the threshold
};

// ---------- Contracts between members ----------

/** C -> B: everything the UI can ask the game to do. */
export type GameAction =
  | {
      type: "record";
      activityId: ActivityId;
      now: string; // ISO timestamp, passed in so the reducer stays pure
      text?: string;
      mood?: MoodTag;
    }
  | {
      type: "paint";
      segmentId: string;
      colorId: LeafColor | null; // null removes the paint (used for Undo)
    }
  | { type: "spiritShown"; now: string }
  | { type: "setSpiritEnabled"; enabled: boolean }
  | { type: "setReducedMotion"; enabled: boolean }
  | { type: "nextDay" } // demo mode only
  | { type: "buyItem"; itemId: string; id: string }
  | { type: "placeItem"; purchaseId: string; segmentId: string | null }
  | { type: "reset" };

/** A -> C: what the player clicked on the canvas. */
export type CanvasSelection =
  | { kind: "segment"; id: string }
  | { kind: "relic"; id: RelicId }
  | { kind: "tablet" };
