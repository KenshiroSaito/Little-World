import { useEffect, useRef, useState } from "react";
import { MOODS } from "../game/moods";
import { RELICS } from "../game/relics";
import { MAX_REFLECTION_IMAGES } from "../game/rules";
import { useGame } from "../state/GameProvider";
import { deleteImage, saveImage } from "../state/images";
import type { MoodTag, SelfCareLog } from "../types";
import { leafShades } from "../world";
import ReflectionImages from "./ReflectionImages";

type Props = {
  onClose: () => void;
  /** Open on this reflection's keepsake (it was clicked in the roots). */
  focusLogId?: string | null;
  /** Close the panel and show where a reflection's keepsake is buried. */
  onShowOnTree: (logId: string) => void;
};

const MOOD_LABELS = Object.fromEntries(MOODS.map((m) => [m.id, m.label])) as Record<MoodTag, string>;

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

/**
 * Relics are your reflections: each one is inscribed on a keepsake buried at
 * the tip of its root, holding what you wrote, how you felt and the photos you
 * kept, which can be added to later. The milestone finds (the carved stone and
 * the heartwood) follow them.
 */
export default function RelicsPanel({ onClose, focusLogId, onShowOnTree }: Props) {
  const { state, dispatch, history, revealedRelics } = useGame();
  const reflections = history.filter((log) => log.activityId === "reflect");
  const focused = useRef<HTMLLIElement>(null);

  useEffect(() => {
    focused.current?.scrollIntoView({ block: "nearest" });
  }, [focusLogId]);

  return (
    <div className="panel relics-panel" role="dialog" aria-label="Relics">
      <h2>Relics</h2>
      <p className="relics-intro">
        Every reflection is inscribed on a keepsake buried at the tip of its root, with what you wrote and the photos
        you kept.
      </p>
      <h3>Inscriptions</h3>
      {reflections.length === 0 ? (
        <p>No keepsakes yet. Choose Reflect in Self-Care to bury your first.</p>
      ) : (
        <ul className="keepsake-list">
          {reflections.map((log) => {
            const focus = log.id === focusLogId;
            // The keepsake shines in its reflection's leaf colour, painted or mixed.
            const color = leafShades(state.leafPaint[`${log.id}:b`] ?? "reflect").mid;
            return (
              <li key={log.id} ref={focus ? focused : undefined} className={focus ? "keepsake-focus" : undefined}>
                <div className="keepsake-head">
                  <span className="keepsake-gem" style={{ background: color }} aria-hidden="true" />
                  <small>{formatTime(log.createdAt)}</small>
                  <button className="keepsake-find" onClick={() => onShowOnTree(log.id)}>
                    Find in the roots
                  </button>
                </div>
                {log.text && <p>“{log.text}”</p>}
                {!log.text && !log.mood && !log.images?.length && <p className="keepsake-quiet">A quiet reflection.</p>}
                {log.mood && <span className="mood-tag">{MOOD_LABELS[log.mood]}</span>}
                <InscriptionPhotos log={log} onChange={(images) => dispatch({ type: "setImages", logId: log.id, images })} />
              </li>
            );
          })}
        </ul>
      )}

      {revealedRelics.length > 0 && (
        <>
          <h3>Found in the roots</h3>
          <ul className="relic-list">
            {revealedRelics.map((relic) => (
              <li key={relic.id}>
                <strong>{RELICS[relic.id].name}</strong>
                <p>{RELICS[relic.id].lore}</p>
                <small>Found {formatTime(relic.foundAt)}</small>
              </li>
            ))}
          </ul>
        </>
      )}

      <button className="btn-icon panel-close" onClick={onClose} aria-label="Close">
        ×
      </button>
    </div>
  );
}

/** An inscription's photos, with room to keep more (up to the limit) or take them off. */
function InscriptionPhotos({ log, onChange }: { log: SelfCareLog; onChange: (images: string[]) => void }) {
  const images = log.images ?? [];
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  async function add(files: File[]) {
    const room = MAX_REFLECTION_IMAGES - images.length;
    if (room <= 0 || files.length === 0) return;
    setSaving(true);
    setFailed(false);
    try {
      const ids = await Promise.all(files.slice(0, room).map(saveImage));
      onChange([...images, ...ids]);
    } catch (error) {
      console.warn("Unable to keep the inscription's photos", error);
      setFailed(true);
    }
    setSaving(false);
  }

  function remove(id: string) {
    onChange(images.filter((i) => i !== id));
    deleteImage(id).catch((error) => console.warn("Unable to forget the photo", error));
  }

  return (
    <>
      <ReflectionImages ids={images} onRemove={remove} />
      {images.length < MAX_REFLECTION_IMAGES && (
        <label className="keepsake-add">
          {saving ? "Keeping photo…" : "+ Add photo"}
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={saving}
            onChange={(e) => {
              add(Array.from(e.target.files ?? []).filter((f) => f.type.startsWith("image/")));
              e.target.value = "";
            }}
          />
        </label>
      )}
      {failed && <p role="alert">That photo could not be kept on this device.</p>}
    </>
  );
}
