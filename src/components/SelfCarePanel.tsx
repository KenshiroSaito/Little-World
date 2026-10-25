import { useState } from "react";
import { ACTIVITIES } from "../game/activities";
import { MOODS } from "../game/moods";
import { MAX_REFLECTION_IMAGES, MAX_REFLECTION_LENGTH } from "../game/rules";
import { useGame } from "../state/GameProvider";
import { saveImage } from "../state/images";
import type { ActivityId, MoodTag } from "../types";
import { PhotoPreview } from "./ReflectionImages";

type Props = {
  onClose: () => void;
};

export default function SelfCarePanel({ onClose }: Props) {
  const { record, doneToday } = useGame();
  const [reflectOpen, setReflectOpen] = useState(false);
  const [text, setText] = useState("");
  const [mood, setMood] = useState<MoodTag | "">("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [photoError, setPhotoError] = useState(false);

  function recordAndClose(activityId: ActivityId) {
    record(activityId);
    onClose();
  }

  /** Photos are kept first, so the reflection is only recorded with photos that were really saved. */
  async function saveReflection() {
    setSaving(true);
    setPhotoError(false);
    try {
      const images = await Promise.all(photos.map(saveImage));
      record("reflect", { text, mood: mood || undefined, images });
      onClose();
    } catch (error) {
      console.warn("Unable to keep the reflection's photos", error);
      setPhotoError(true);
      setSaving(false);
    }
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
          <label>
            Photos (optional, up to {MAX_REFLECTION_IMAGES})
            <input
              type="file"
              accept="image/*"
              multiple
              disabled={photos.length >= MAX_REFLECTION_IMAGES}
              onChange={(e) => {
                const picked = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith("image/"));
                setPhotos((list) => [...list, ...picked].slice(0, MAX_REFLECTION_IMAGES));
                e.target.value = "";
              }}
            />
          </label>
          {photos.length > 0 && (
            <div className="photo-previews">
              {photos.map((file, i) => (
                <PhotoPreview key={`${file.name}-${file.lastModified}-${i}`} file={file} onRemove={() => setPhotos((list) => list.filter((_, j) => j !== i))} />
              ))}
            </div>
          )}
          {photoError && <p role="alert">Those photos could not be kept on this device. Try again, or save without them.</p>}
          <p className="reflect-note">Each reflection buries a keepsake at the tip of its root. Find it in Relics.</p>
          <button className="btn-primary" disabled={saving} onClick={saveReflection}>
            {saving ? "Saving…" : "Save reflection"}
          </button>
        </div>
      )}

      <button className="btn-icon panel-close" onClick={onClose} aria-label="Close">
        ×
      </button>
    </div>
  );
}
