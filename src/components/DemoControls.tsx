import { useGame } from "../state/GameProvider";

/** Only rendered with ?demo=1 in the URL, so judges can see several days without waiting. */
export default function DemoControls() {
  const { state, dispatch } = useGame();
  return (
    <div className="demo-controls" aria-label="Demo controls">
      <span>Demo · day +{state.dayOffset}</span>
      <button onClick={() => dispatch({ type: "nextDay" })}>Next day</button>
      <button onClick={() => dispatch({ type: "reset" })}>Reset</button>
    </div>
  );
}
