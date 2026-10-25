import { RELICS } from "../game/relics";
import { useGame } from "../state/GameProvider";

type Props = {
  onClose: () => void;
};

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

export default function RelicsPanel({ onClose }: Props) {
  const { revealedRelics, inscriptions, ruinReached } = useGame();

  return (
    <div className="panel" role="dialog" aria-label="Relics">
      <h2>Relics</h2>
      {revealedRelics.length === 0 ? (
        <p>Nothing uncovered yet. The roots grow at your own pace.</p>
      ) : (
        <ul className="relic-list">
          {revealedRelics.map((relic) => (
            <li key={relic.id}>
              <strong>{RELICS[relic.id].name}</strong>
              <p>{RELICS[relic.id].lore}</p>
              <small>Found {formatTime(relic.foundAt)}</small>
            </li>
          ))}
        </ul>
      )}

      <h3>Inscriptions</h3>
      {!ruinReached ? (
        <p>The ruin is still buried. Its tablets will be readable once the roots reach it.</p>
      ) : inscriptions.length === 0 ? (
        <p>The tablets are blank. Reflections you write will appear here.</p>
      ) : (
        <ol className="inscription-list">
          {inscriptions.map((log) => (
            <li key={log.id}>
              <small>{log.date}</small>
              {log.text && <p>“{log.text}”</p>}
              {log.mood && <span className="mood-tag">{log.mood}</span>}
            </li>
          ))}
        </ol>
      )}

      <button onClick={onClose}>Close</button>
    </div>
  );
}
