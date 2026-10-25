import { useEffect, useState } from "react";
import { ACTIVITIES } from "../game/activities";
import { journalPages } from "../game/journal";
import { MOODS } from "../game/moods";
import { useGame } from "../state/GameProvider";
import type { ActivityId, MoodTag } from "../types";
import { LEAF } from "../world";

type Props = {
  onClose: () => void;
};

const LABELS = Object.fromEntries(ACTIVITIES.map((a) => [a.id, a.label])) as Record<ActivityId, string>;
const MOOD_LABELS = Object.fromEntries(MOODS.map((m) => [m.id, m.label])) as Record<MoodTag, string>;

const formatDate = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
const formatTime = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

/** A pixel page-turn arrow, pointing right unless `back`. */
function Arrow({ back }: { back?: boolean }) {
  // [x, width] of each row, top to bottom, on a 16x10 grid.
  const rows = [[11, 1], [11, 2], [11, 3], [0, 15], [0, 16], [0, 16], [0, 15], [11, 3], [11, 2], [11, 1]];
  return (
    <svg viewBox="0 0 16 10" width="32" height="20" shapeRendering="crispEdges" aria-hidden="true">
      <g transform={back ? "translate(16 0) scale(-1 1)" : undefined} fill="currentColor">
        {rows.map(([x, w], y) => (
          <rect key={y} x={x} y={y} width={w} height={1} />
        ))}
      </g>
    </svg>
  );
}

/**
 * The self-care journal as a Minecraft-style book: one page at a time, opened
 * on the newest, turned with the arrows or the arrow keys.
 */
export default function JournalBook({ onClose }: Props) {
  const { state } = useGame();
  const pages = journalPages(state.selfCareLogs);
  const last = Math.max(0, pages.length - 1);
  const [page, setPage] = useState(last);
  const current = Math.min(page, last);
  const shown = pages[current];

  useEffect(() => {
    // Capture, so the arrow keys turn pages instead of also panning the tree behind the book.
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") setPage((p) => Math.max(0, Math.min(p, last) - 1));
      else if (e.key === "ArrowRight") setPage((p) => Math.min(last, p + 1));
      else return;
      e.preventDefault();
      e.stopPropagation();
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [last, onClose]);

  return (
    <div className="book-backdrop" onClick={onClose}>
      <div className="book" role="dialog" aria-modal="true" aria-label="Journal" onClick={(e) => e.stopPropagation()}>
        <div className="book-cover">
          <div className="book-page">
            <p className="book-page-number" aria-live="polite">
              Page {current + 1} of {Math.max(1, pages.length)}
            </p>
            {shown ? (
              <>
                <h2 className="book-date">
                  {formatDate(shown.date)}
                  {shown.continued && " (cont.)"}
                </h2>
                <ul className="book-entries">
                  {shown.entries.map((log) => (
                    <li key={log.id}>
                      <span className="book-leaf" style={{ background: LEAF[log.activityId].mid }} aria-hidden="true" />
                      {LABELS[log.activityId]} <span className="book-time">{formatTime(log.createdAt)}</span>
                      {log.text && <p className="book-text">“{log.text}”</p>}
                      {log.mood && <p className="book-mood">Feeling {MOOD_LABELS[log.mood].toLowerCase()}</p>}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="book-empty">This book is empty. Look after yourself and its pages will fill in.</p>
            )}
            <button
              className="book-arrow book-arrow-back"
              aria-label="Previous page"
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
            >
              <Arrow back />
            </button>
            <button
              className="book-arrow book-arrow-next"
              aria-label="Next page"
              disabled={current >= last}
              onClick={() => setPage(current + 1)}
            >
              <Arrow />
            </button>
          </div>
        </div>
        <button className="book-done" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}
