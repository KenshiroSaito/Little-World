import { useState } from "react";
import { ACTIVITIES } from "../game/activities";
import { MOODS } from "../game/moods";
import { MAX_REFLECTION_IMAGES, MAX_REFLECTION_LENGTH } from "../game/rules";
import { useGame } from "../state/GameProvider";
import { saveImage } from "../state/images";
import type { MoodTag } from "../types";
import ActivityIcon from "./ActivityIcon";
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


  /** Photos are kept first, so the reflection is only recorded with photos that were really saved. */
  async function saveReflection() {
    setSaving(true);
    setPhotoError(false);
    try {
      const images = await Promise.all(photos.map(saveImage));
      record("reflect", { text, mood: mood || undefined, images });
      // Stay open: clear the form and fold Reflect back into its card.
      setText("");
      setMood("");
      setPhotos([]);
      setReflectOpen(false);
    } catch (error) {
      console.warn("Unable to keep the reflection's photos", error);
      setPhotoError(true);
    }
    setSaving(false);
  }

  const reflectForm = (
    <div className="reflect-form">
      <label>
        One sentence about how you are today (everything here is optional)
        <input value={text} maxLength={MAX_REFLECTION_LENGTH} onChange={(e) => setText(e.target.value)} />
      </label>
      <span className="reflect-count">
        {text.length} / {MAX_REFLECTION_LENGTH}
      </span>
      <div className="mood-chips" role="group" aria-label="Mood">
        {MOODS.map((m) => (
          <button
            key={m.id}
            type="button"
            className="mood-chip"
            aria-pressed={mood === m.id}
            onClick={() => setMood((current) => (current === m.id ? "" : m.id))}
          >
            {m.label}
          </button>
        ))}
      </div>
      <label className="photo-add">
        Add photos ({photos.length}/{MAX_REFLECTION_IMAGES})
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
        {saving ? "Saving…" : "Save reflection · +5 LP"}
      </button>
    </div>
  );

  return (
    <div className="panel selfcare-panel" role="dialog" aria-label="Self-Care">
      <h2>Self-Care</h2>
      <p className="selfcare-intro">Every act of care counts. Nothing is lost when you rest.</p>
      <ul className="activity-list">
        {ACTIVITIES.map((a) => {
          const times = doneToday.filter((id) => id === a.id).length;
          const open = a.id === "reflect" && reflectOpen;
          return (
            <li key={a.id} className={`activity-card${open ? " is-open" : ""}`}>
              <div className="activity-row">
                <ActivityIcon id={a.id} />
                <div className="activity-text">
                  <strong>{a.label}</strong>
                  <span>{a.colorName} leaves</span>
                  {times > 0 && <span className="activity-done">✓ Done today{times > 1 ? ` ×${times}` : ""}</span>}
                </div>
                {!open && (
                  <button
                    className="btn-primary activity-add"
                    onClick={() => (a.id === "reflect" ? setReflectOpen(true) : record(a.id))}
                    aria-label={`Record ${a.label}, plus 5 LP`}
                  >
                    +5 LP
                  </button>
                )}
              </div>
              {open && reflectForm}
            </li>
          );
        })}
      </ul>

      <button className="btn-icon panel-close" onClick={onClose} aria-label="Close">
        ×
      </button>
    </div>
  );
}
