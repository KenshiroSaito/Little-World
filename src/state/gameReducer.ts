import { isCustomColor, type GameAction, type GameState } from '../types';
import { localDate, recordActivity } from '../game/rules';
import { buyItem } from '../shop/inventory';
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
      if (!state.shopPurchases?.some(p => p.id === action.purchaseId)) return state;
      return { ...state, shopPurchases: state.shopPurchases.map(p => p.id === action.purchaseId ? { ...p, segmentId: action.segmentId } : p) };
    }

    case 'record':
      return recordActivity(state, action.activityId, action.now, { text: action.text, mood: action.mood });

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
