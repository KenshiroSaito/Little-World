import { useGame } from "../state/GameProvider";

type Props = {
  onClose: () => void;
};

export default function SettingsPanel({ onClose }: Props) {
  const { state, dispatch } = useGame();

  function reset() {
    if (window.confirm("Reset your tree? This deletes all progress on this device.")) {
      dispatch({ type: "reset" });
      onClose();
    }
  }

  return (
    <div className="panel" role="dialog" aria-label="Settings">
      <h2>Settings</h2>
      <label>
        <input
          type="checkbox"
          checked={state.spirit.enabled}
          onChange={(e) => dispatch({ type: "setSpiritEnabled", enabled: e.target.checked })}
        />{" "}
        Tree spirit
      </label>
      <label>
        <input
          type="checkbox"
          checked={state.settings.reducedMotion}
          onChange={(e) => dispatch({ type: "setReducedMotion", enabled: e.target.checked })}
        />{" "}
        Reduced motion
      </label>
      <button onClick={reset}>Reset save</button>

      <h3>About</h3>
      <p>
        Little World is a self-care game: every act of care grows your tree, and nothing is
        lost when you rest. It is not a medical tool. Your data stays on this device.
      </p>
      <p>
        If you are struggling, you are not alone: UVic Counselling Services, or call or text
        9-8-8 (Suicide Crisis Helpline, Canada).
      </p>
      <button onClick={onClose}>Close</button>
    </div>
  );
}
