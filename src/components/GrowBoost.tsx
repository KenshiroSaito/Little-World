import { useState } from "react";
import { ACTIVITY_IDS } from "../types";
import { useGame } from "../state/GameProvider";
import "./GrowBoost.css";

/** How many records (each one a branch with leaves, plus a root) one press adds. */
const BOOST = 10;

/**
 * Hackathon demo: grows the tree 10 records at a time, cycling through the
 * activities so the new leaves come out in every colour. Each press is one
 * growth step, so the tree still grows in progressively rather than all at once.
 */
export default function GrowBoost() {
  const { state, dispatch } = useGame();
  const [presses, setPresses] = useState(0);

  function grow() {
    const now = new Date().toISOString();
    const start = state.selfCareLogs.length;
    for (let i = 0; i < BOOST; i++) {
      dispatch({ type: "record", activityId: ACTIVITY_IDS[(start + i) % ACTIVITY_IDS.length], now });
    }
    setPresses((n) => n + 1);
  }

  return (
    <div className="grow-boost">
      <button className="btn-primary" onClick={grow} aria-label={`Grow the tree by ${BOOST} leaves`}>
        Grow ×{BOOST}
      </button>
      {presses > 0 && <span className="grow-boost-count">+{presses * BOOST} leaves</span>}
    </div>
  );
}
