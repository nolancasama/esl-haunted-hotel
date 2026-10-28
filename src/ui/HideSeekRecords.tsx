import { useState } from "react";
import { GHOST_ORDER, GHOSTS } from "../game/ghosts";
import type { GhostId } from "../game/types";
import {
  ACHIEVEMENTS, CHALLENGE_AREAS, collectionMilestones, collectionProgress,
  completionFor, ghostCompleted, loadCompletionBook, resetCompletionBook
} from "../game/hideSeek/records";
import type { PlayRoom } from "../game/hideSeek/types";
import { GhostPortrait } from "./GhostPortrait";

interface Props {
  japanese: boolean;
  onBack: () => void;
  onPlay: (ghost: GhostId, room: PlayRoom) => void;
}
const milestoneLabel = (id: string) =>
  id.startsWith("specialist:") ? `${GHOSTS[id.split(":")[1] as GhostId]?.name ?? "Ghost"} Specialist` :
    id === "ghostMaster" ? "Ghost Master" :
    id === "hotelExplorer" ? "Hotel Explorer" :
    id === "hotelMaster" ? "Master of the Haunted Hotel" : id;

/** Progress book is a separate selection screen, not an overlay atop the active match. */
export function HideSeekRecords({ japanese, onBack, onPlay }: Props) {
  const [book, setBook] = useState(loadCompletionBook);
  const [selected, setSelected] = useState<{ ghost: GhostId; area: string } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetError, setResetError] = useState(false);
  const progress = collectionProgress(book);
  const selectedArea = CHALLENGE_AREAS.find((area) => area.id === selected?.area);
  const selectedRecord = selected ? completionFor(book, selected.ghost, selected.area) : undefined;
  const awarded = [...new Set([...book.milestones, ...collectionMilestones(book)])];

  return <div className="hs-selection title-screen ui" data-testid="hideseek">
    <section className="panel hs-records-card" data-testid="hs-records" aria-label="Hide and Seek records">
      <header className="hs-records-heading">
        <span className="hs-eyebrow">Haunted Hotel · Hide &amp; Seek</span>
        <h1>Ghost Collection</h1>
        {japanese && <small lang="ja">おばけの コレクション</small>}
        <div className="hs-records-total" data-testid="hs-records-total">
          <strong>{progress.completed} / {progress.total}</strong>
          <span>Challenges completed · {progress.percentage}%</span>
        </div>
        <div className="hs-records-progress" role="progressbar" aria-valuenow={progress.completed}
          aria-valuemin={0} aria-valuemax={progress.total} aria-label="Collection progress">
          <span style={{ width: `${progress.percentage}%` }} />
        </div>
        <div className="hs-records-summary">
          <span>{progress.fullGhosts} ghost specialists</span>
          <span>{progress.fullAreas} areas mastered</span>
        </div>
      </header>

      <p className="hs-records-instruction">Choose a ghost and room to view its record or play that challenge.</p>
      <div className="hs-records-scroll" role="region" tabIndex={0} aria-label="Ghost and room completion grid">
        <table className="hs-records-grid">
          <thead><tr><th scope="col">Ghost</th>
            {CHALLENGE_AREAS.map((area) => <th scope="col" key={area.id} title={area.name}>{area.name}</th>)}
          </tr></thead>
          <tbody>{GHOST_ORDER.map((ghost) => <tr key={ghost}>
            <th scope="row"><span className="hs-records-ghost">
              <GhostPortrait ghost={ghost} size={30} />
              <span>{GHOSTS[ghost].name}<small>{ghostCompleted(book, ghost)}/{CHALLENGE_AREAS.length}</small></span>
            </span></th>
            {CHALLENGE_AREAS.map((area) => {
              const record = completionFor(book, ghost, area.id);
              const active = selected?.ghost === ghost && selected.area === area.id;
              return <td key={area.id}>
                <button className={`hs-record-cell ${record ? "complete" : ""} ${active ? "selected" : ""}`}
                  data-testid={`hs-record-${ghost}-${area.id}`}
                  aria-label={`${GHOSTS[ghost].name}, ${area.name}, ${record ? "completed" : "not completed"}`}
                  aria-pressed={active}
                  onClick={() => setSelected({ ghost, area: area.id })}>
                  <span aria-hidden="true">{record ? "✓" : "○"}</span>
                </button>
              </td>;
            })}
          </tr>)}</tbody>
        </table>
      </div>

      {selected && selectedArea && <section className="hs-record-detail" data-testid="hs-record-detail">
        <div className="hs-record-detail-title">
          <GhostPortrait ghost={selected.ghost} size={40} />
          <div><strong>{GHOSTS[selected.ghost].name} · {selectedArea.name}</strong>
            <small>{selectedRecord ? "✓ Completed" : "Not completed yet"}</small>
          </div>
        </div>
        {selectedRecord ? <>
          <div className="hs-record-detail-stats">
            <span>First win: {new Date(selectedRecord.firstCompletedAt).toLocaleDateString()}</span>
            <span>Wins: {selectedRecord.wins}</span>
            <span>Best English: {Math.round(selectedRecord.bestEnglishAccuracy * 100)}%</span>
            <span>Fewest moves: {selectedRecord.fewestMoves}</span>
          </div>
          <div className="hs-record-achievements">
            {(Object.entries(ACHIEVEMENTS) as [keyof typeof ACHIEVEMENTS, (typeof ACHIEVEMENTS)[keyof typeof ACHIEVEMENTS]][]).map(([id, award]) =>
              <span key={id} className={selectedRecord.achievements.includes(id) ? "earned" : "unearned"}
                title={award.detail}>{selectedRecord.achievements.includes(id) ? "★" : "○"} {award.name}</span>)}
          </div>
        </> : <p>Survive all five searches to add this combination to your collection!</p>}
        <button className="primary" data-testid="hs-record-play" onClick={() => onPlay(selected.ghost, selectedArea.rooms[0])}>
          {selectedRecord ? "Play Again" : "Play This Challenge"}
        </button>
      </section>}

      {awarded.length > 0 && <div className="hs-record-milestones">
        <strong>Collection Awards</strong>
        <div>{awarded.map((id) => <span key={id}>★ {milestoneLabel(id)}</span>)}</div>
      </div>}

      <footer className="hs-records-footer">
        <button className="secondary" data-testid="hs-records-back" onClick={onBack}>Back</button>
        {confirmReset ? <div className="hs-record-reset-confirm" role="group" aria-label="Confirm clear Hide and Seek records">
          <span>Clear Hide &amp; Seek records only?</span>
          <button className="secondary" onClick={() => setConfirmReset(false)}>Cancel</button>
          <button className="secondary" data-testid="hs-records-reset-confirm" onClick={() => {
            if (resetCompletionBook()) { setBook(loadCompletionBook()); setSelected(null); setConfirmReset(false); setResetError(false); }
            else { setResetError(true); }
          }}>Yes, Clear</button>
        </div> : <button className="secondary hs-record-reset-button" data-testid="hs-records-reset"
          onClick={() => setConfirmReset(true)}>Reset Records</button>}
      </footer>
      {resetError && <p role="alert">Could not clear the records on this device.</p>}
    </section>
  </div>;
}
