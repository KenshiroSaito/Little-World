import { useState } from "react";
import { ACTIVITIES } from "../game/activities";
import { MOODS } from "../game/moods";
import { MAX_REFLECTION_LENGTH } from "../game/rules";
import { useGame } from "../state/GameProvider";
import type { ActivityId, MoodTag } from "../types";

type Props = {
  onClose: () => void;
};

export default function SelfCarePanel({ onClose }: Props) {
  const { record, doneToday } = useGame();
  const [reflectOpen, setReflectOpen] = useState(false);
  const [text, setText] = useState("");
  const [mood, setMood] = useState<MoodTag | "">("");

  function recordAndClose(activityId: ActivityId) {
    record(activityId, activityId === "reflect" ? { text, mood: mood || undefined } : {});
    onClose();
  }

  return (
    <div className="panel" role="dialog" aria-label="Self-Care">
      <h2>Self-Care</h2>
      <ul className="activity-list">
        {ACTIVITIES.map((a) => {
          const times = doneToday.filter((id) => id === a.id).length;
          return (
            <li key={a.id}>
              <button onClick={() => (a.id === "reflect" ? setReflectOpen(true) : recordAndClose(a.id))}>
                {a.label} · 5 LP · {a.colorName}
                {times > 0 && ` ✓ done today${times > 1 ? ` ×${times}` : ""}`}
              </button>
            </li>
          );
        })}
      </ul>

      {reflectOpen && (
        <div className="reflect-form">
          <label>
            One sentence about how you are today (optional)
            <input
              value={text}
              maxLength={MAX_REFLECTION_LENGTH}
              onChange={(e) => setText(e.target.value)}
            />
          </label>
          <span>
            {text.length}/{MAX_REFLECTION_LENGTH}
          </span>
          <label>
            Mood (optional)
            <select value={mood} onChange={(e) => setMood(e.target.value as MoodTag | "")}>
              <option value="">—</option>
              {MOODS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <button className="btn-primary" onClick={() => recordAndClose("reflect")}>Save reflection</button>
        </div>
      )}

      <button className="btn-icon panel-close" onClick={onClose} aria-label="Close">
        ×
      </button>
    </div>
  );
}
