import { isCustomColor, type GameAction, type GameState, type SelfCareLog } from '../types';
import { MAX_REFLECTION_IMAGES, localDate, recordActivity } from '../game/rules';
import { buyItem, wearItem } from '../shop/inventory';
import { isAccessory } from '../shop/catalog';
import { buildTree } from '../game/buildTree';
import { totalLP } from '../game/progression';
import { unlockedColors } from '../game/progression';

export const initialGameState: GameState = {
  version: 2,
  selfCareLogs: [],
  leafPaint: {},
  spirit: { enabled: true, lastShownLogCount: 0, lastShownDate: null },
  settings: { reducedMotion: false },
  dayOffset: 0,
};

/** Pure: the same state and action always give the same result. Time comes in on the action. */
export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'buyItem': {
      const purchases = buyItem(state.shopPurchases ?? [], totalLP(state), action.itemId, action.id);
      return purchases ? { ...state, shopPurchases: purchases } : state;
    }

    case 'placeItem': {
      if (action.segmentId !== null && !buildTree(state.selfCareLogs).some(s => s.kind === 'branch' && s.id === action.segmentId)) return state;
      const purchase = state.shopPurchases?.find(p => p.id === action.purchaseId);
      // Accessories are worn by the spirit, never hung on branches.
      if (!purchase || isAccessory(purchase.itemId)) return state;
      return { ...state, shopPurchases: state.shopPurchases!.map(p => p.id === action.purchaseId ? { ...p, segmentId: action.segmentId } : p) };
    }

    case 'wearItem': {
      const purchases = wearItem(state.shopPurchases ?? [], action.purchaseId, action.worn);
      return purchases ? { ...state, shopPurchases: purchases } : state;
    }

    case 'setImages': {
      const images = action.images.filter(id => typeof id === 'string' && id.length > 0).slice(0, MAX_REFLECTION_IMAGES);
      const log = state.selfCareLogs.find(l => l.id === action.logId);
      if (!log || log.activityId !== 'reflect' || (log.images ?? []).join() === images.join()) return state;
      return {
        ...state,
        selfCareLogs: state.selfCareLogs.map(l => {
          if (l !== log) return l;
          const next: SelfCareLog = { ...l, images };
          if (images.length === 0) delete next.images;
          return next;
        }),
      };
    }

    case 'record':
      return recordActivity(state, action.activityId, action.now, { text: action.text, mood: action.mood, images: action.images });

    case 'paint': {
      if (action.colorId === null) {
        // Undo: remove the paint so the leaves go back to their activity colour.
        if (!(action.segmentId in state.leafPaint)) return state;
        const leafPaint = { ...state.leafPaint };
        delete leafPaint[action.segmentId];
        return { ...state, leafPaint };
      }
      if (!isCustomColor(action.colorId) && !unlockedColors(state).includes(action.colorId)) return state;
      return { ...state, leafPaint: { ...state.leafPaint, [action.segmentId]: action.colorId } };
    }

    case 'spiritShown':
      return {
        ...state,
        spirit: {
          ...state.spirit,
          lastShownLogCount: state.selfCareLogs.length,
          lastShownDate: localDate(new Date(action.now), state.dayOffset),
        },
      };

    case 'setSpiritEnabled':
      return { ...state, spirit: { ...state.spirit, enabled: action.enabled } };

    case 'setReducedMotion':
      return { ...state, settings: { ...state.settings, reducedMotion: action.enabled } };

    case 'nextDay':
      return { ...state, dayOffset: state.dayOffset + 1 };

    case 'reset':
      return initialGameState;
  }
}
