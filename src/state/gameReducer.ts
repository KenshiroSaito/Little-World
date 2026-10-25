import type { GameAction, GameState } from '../types';
import { localDate, recordActivity } from '../game/rules';
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
      if (!unlockedColors(state).includes(action.colorId)) return state;
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
