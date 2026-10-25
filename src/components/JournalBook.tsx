import { useEffect, useState } from "react";
import { ACTIVITIES } from "../game/activities";
import { journalPages } from "../game/journal";
import { MOODS } from "../game/moods";
import { useGame } from "../state/GameProvider";
import {
  isCustomColor,
  type ActivityId,
  type LeafColor,
  type MoodTag,
  type SelfCareLog,
} from "../types";
import { leafShades } from "../world";
import ReflectionImages from "./ReflectionImages";

type Props = {
  onClose: () => void;
  /** Open on the page with this record and mark it (its leaves were clicked). */
  focusLogId?: string | null;
  /** Close the book and show a record's leaves on the tree. */
  onShowOnTree: (logId: string) => void;
};

const LABELS = Object.fromEntries(
  ACTIVITIES.map((a) => [a.id, a.label]),
) as Record<ActivityId, string>;
const MOOD_LABELS = Object.fromEntries(
  MOODS.map((m) => [m.id, m.label]),
) as Record<MoodTag, string>;

const formatDate = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

/**
 * A record's leaves as they are on the tree: painted with a preset or a mixed
 * colour, or the activity's own colour.
 */
function leafOf(
  log: SelfCareLog,
  paint: Readonly<Record<string, LeafColor>>,
): { color: string; label: string } {
  const painted = paint[`${log.id}:b`];
  const color = leafShades(painted ?? log.activityId).mid;
  if (!painted) return { color, label: "" };
  if (isCustomColor(painted)) return { color, label: `, leaves mixed ${painted}` };
  const name = painted === "base" ? "base green" : LABELS[painted].toLowerCase();
  return { color, label: `, leaves painted ${name}` };
}

/** A pixel page-turn arrow, pointing right unless `back`. */
function Arrow({ back }: { back?: boolean }) {
  // [x, width] of each row, top to bottom, on a 16x10 grid.
  const rows = [
    [11, 1],
    [11, 2],
    [11, 3],
    [0, 15],
    [0, 16],
    [0, 16],
    [0, 15],
    [11, 3],
    [11, 2],
    [11, 1],
  ];
  return (
    <svg
      viewBox="0 0 16 10"
      width="32"
      height="20"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      <g
        transform={back ? "translate(16 0) scale(-1 1)" : undefined}
        fill="currentColor"
      >
        {rows.map(([x, w], y) => (
          <rect key={y} x={x} y={y} width={w} height={1} />
        ))}
      </g>
    </svg>
  );
}

/**
 * The self-care journal as a Minecraft-style book: one page at a time, opened
 * on the newest (or on the record whose leaves were clicked), turned with the
 * arrows or the arrow keys. Each record links back to its leaves on the tree.
 */
export default function JournalBook({
  onClose,
  focusLogId,
  onShowOnTree,
}: Props) {
  const { state } = useGame();
  const pages = journalPages(state.selfCareLogs);
  const last = Math.max(0, pages.length - 1);
  const focusPage = pages.findIndex((p) =>
    p.entries.some((log) => log.id === focusLogId),
  );
  const [page, setPage] = useState(focusPage >= 0 ? focusPage : last);
  const current = Math.min(page, last);
  const shown = pages[current];

  useEffect(() => {
    // Capture, so the arrow keys turn pages instead of also panning the tree behind the book.
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft")
        setPage((p) => Math.max(0, Math.min(p, last) - 1));
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
      <div
        className="book"
        role="dialog"
        aria-modal="true"
        aria-label="Journal"
        onClick={(e) => e.stopPropagation()}
      >
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
                  {shown.entries.map((log) => {
                    const leaf = leafOf(log, state.leafPaint);
                    return (
                      <li
                        key={log.id}
                        className={
                          log.id === focusLogId ? "book-entry-focus" : undefined
                        }
                      >
                        <button
                          className="book-entry-link"
                          title="Show its leaves on the tree"
                          aria-label={`${LABELS[log.activityId]} at ${formatTime(log.createdAt)}${leaf.label}. Show its leaves on the tree.`}
                          onClick={() => onShowOnTree(log.id)}
                        >
                          <span
                            className="book-leaf"
                            style={{ background: leaf.color }}
                            aria-hidden="true"
                          />
                          {LABELS[log.activityId]}{" "}
                          <span className="book-time">
                            {formatTime(log.createdAt)}
                          </span>
                        </button>
                        {log.text && <p className="book-text">“{log.text}”</p>}
                        {log.mood && (
                          <p className="book-mood">
                            Feeling {MOOD_LABELS[log.mood].toLowerCase()}
                          </p>
                        )}
                        <ReflectionImages
                          ids={log.images}
                          className="book-photos"
                        />
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : (
              <p className="book-empty">
                This book is empty. Look after yourself and its pages will fill
                in.
              </p>
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
