import { createContext, useContext, useEffect, useMemo, useReducer, type Dispatch, type ReactNode } from 'react';
import type { ActivityId, ColorId, GameAction, LeafColor, GameState, MoodTag, RevealedRelic, Segment, SelfCareLog } from '../types';
import { buildTree } from '../game/buildTree';
import { getExperienceHistory } from '../game/history';
import { inscriptions, revealedRelics, ruinReached, totalLP, unlockedColors } from '../game/progression';
import { doneToday } from '../game/rules';
import { spiritMessage } from '../game/spirit';
import { gameReducer, initialGameState } from './gameReducer';
import { clearImages } from './images';
import { loadGame, saveGame } from './persistence';

export interface GameContextValue {
  state: GameState;
  dispatch: Dispatch<GameAction>;
  // Derived values, recomputed from state; none of these are stored.
  totalLP: number;
  segments: Segment[];
  unlockedColors: ColorId[];
  revealedRelics: RevealedRelic[];
  ruinReached: boolean;
  inscriptions: SelfCareLog[];
  history: SelfCareLog[];
  doneToday: ActivityId[];
  spiritMessage: string | null;
  // Helpers that add the current time, so components never build actions by hand.
  record: (activityId: ActivityId, extras?: { text?: string; mood?: MoodTag; images?: string[] }) => void;
  paintLeaves: (segmentId: string, colorId: LeafColor | null) => void;
  markSpiritShown: () => void;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, initialGameState, () => loadGame() ?? initialGameState);
  useEffect(() => { saveGame(state); }, [state]);
  // A new or reset game has no reflections, so no photos to keep.
  const noLogs = state.selfCareLogs.length === 0;
  useEffect(() => {
    if (noLogs) clearImages().catch(error => console.warn('Unable to clear kept photos', error));
  }, [noLogs]);

  // buildTree only reruns when the logs or the paint change.
  const segments = useMemo(() => buildTree(state.selfCareLogs, state.leafPaint), [state.selfCareLogs, state.leafPaint]);

  const value = useMemo<GameContextValue>(() => {
    const now = new Date().toISOString();
    return {
      state,
      dispatch,
      totalLP: totalLP(state),
      segments,
      unlockedColors: unlockedColors(state),
      revealedRelics: revealedRelics(state),
      ruinReached: ruinReached(state),
      inscriptions: inscriptions(state),
      history: getExperienceHistory(state),
      doneToday: doneToday(state, now),
      spiritMessage: spiritMessage(state, now),
      record: (activityId, extras = {}) =>
        dispatch({ type: 'record', activityId, now: new Date().toISOString(), ...extras }),
      paintLeaves: (segmentId, colorId) => dispatch({ type: 'paint', segmentId, colorId }),
      markSpiritShown: () => dispatch({ type: 'spiritShown', now: new Date().toISOString() }),
    };
  }, [state, segments]);

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useGame(): GameContextValue {
  const context = useContext(GameContext);
  if (!context) throw new Error('useGame must be used inside GameProvider');
  return context;
}
