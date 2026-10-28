import { useEffect, useState, type CSSProperties } from "react";
import { setGame, useGame } from "../game/store";
import { GHOSTS, GHOST_ORDER } from "../game/ghosts";
import type { GhostId } from "../game/types";
import { WORLD } from "../game/world/world";
import { ROOMS } from "../game/world/rooms";
import { abilityTargets, placePhrase, reachableSpots, type PlayRoom } from "../game/hideSeek";
import { RESULTS_DELAY_MS, decideHideSeek, leaveHideSeek, pickSpot, setPickMode, startHideSeek, stayHere, useHideSeek } from "../game/hideSeek/session";
import { GhostPortrait } from "./GhostPortrait";
import { HideSeekEnglish } from "./HideSeekEnglish";
import { HideSeekHud } from "./HideSeekHud";
import { HideSeekRecords } from "./HideSeekRecords";
import { CHALLENGE_AREAS, completionFor, collectionProgress, emptyBook, ghostCompleted, loadCompletionBook } from "../game/hideSeek/records";

export const HS_ABILITIES: Record<GhostId, { name: string; text: string; ja: string }> = {
  sleepy: { name: "Deep Sleep", text: "Rest quietly and lower the detective’s suspicion.", ja: "しずかに休んで、気づかれにくくしよう。" },
  hungry: { name: "Snack Distraction", text: "Choose a spot to make a distracting munching sound.", ja: "好きな場所で、もぐもぐ音を出そう。" },
  sneaky: { name: "Silent Move", text: "Your next move makes no sound.", ja: "次の移動は、音がしないよ。" },
  mischief: { name: "Decoy", text: "Leave a pretend ghost at a spot you choose.", ja: "好きな場所に、にせもののおばけを置こう。" },
  bouncy: { name: "Super Bounce", text: "Your next move can go farther and faster, but is louder.", ja: "次は遠くへ速く動けるけど、大きな音がするよ。" },
  bubbles: { name: "Bubble Screen", text: "Make bubbles that hide you from the detective’s view.", ja: "あわで、たんていの目からかくれよう。" },
  melody: { name: "Phantom Music", text: "Play music to cover the sound of your moves.", ja: "音楽で、移動する音をかくそう。" },
  shadow: { name: "Vanish", text: "Your next move is invisible, but still makes sound.", ja: "次の移動は見えないよ。でも音には気をつけて。" }
};

const PLAY_ROOMS: PlayRoom[] = ["bedroom", "dining", "storage", "library", "playroom", "bathroom", "music", "attic"];
const isRoom = (room: string | undefined): room is PlayRoom => PLAY_ROOMS.includes(room as PlayRoom);
const EMPTY_BOOK = emptyBook();
const EMPTY_PROGRESS = collectionProgress(EMPTY_BOOK);

/** Selection, match controls and results share the Hide & Seek screen. */
export function HideSeekEntry() {
  const screen = useGame((s) => s.screen);
  const settings = useGame((s) => s.settings);
  const link = useGame((s) => s.hideSeekLink);
  const session = useHideSeek();
  const [ghost, setGhost] = useState<GhostId | null>(link?.ghost ?? null);
  const [selection, setSelection] = useState<"ghost" | "room">(link?.ghost ? "room" : "ghost");
  const [booted, setBooted] = useState(false);
  const [recordsOpen, setRecordsOpen] = useState(false);
  const ja = settings.japanese;

  useEffect(() => {
    if (screen !== "hideseek") { setBooted(false); return; }
    if (booted) return;
    setBooted(true);
    setGhost(link?.ghost ?? null);
    setSelection(link?.ghost ? "room" : "ghost");
    if (link?.ghost && isRoom(link.room)) startHideSeek(link.ghost, link.room, link.seed, settings.englishLevel);
  }, [screen, booted, link, settings.englishLevel]);

  if (screen !== "hideseek") return null;
  const match = session.match;
  const menu = () => {
    leaveHideSeek();
    setGame({ screen: "title", hideSeekLink: null });
    setSelection("ghost");
    setGhost(null);
    setRecordsOpen(false);
  };
  const anotherGhost = () => {
    leaveHideSeek();
    setGame({ screen: "hideseek", hideSeekLink: null });
    setGhost(null);
    setSelection("ghost");
    setRecordsOpen(false);
  };
  const chooseRoom = (room: PlayRoom) => {
    if (ghost) startHideSeek(ghost, room, link?.seed, settings.englishLevel);
  };

  // Live simulation rerenders frequently: never read localStorage on gameplay frames.
  const book = match ? EMPTY_BOOK : loadCompletionBook();
  const progress = match ? EMPTY_PROGRESS : collectionProgress(book);
  if (!match && recordsOpen) return <HideSeekRecords japanese={ja} onBack={() => setRecordsOpen(false)}
    onPlay={(id, room) => { setGhost(id); setSelection("room"); setRecordsOpen(false); startHideSeek(id, room, undefined, settings.englishLevel); }} />;

  if (!match) return (
    <div className="hs-selection title-screen ui" data-testid="hideseek">
      <div className="panel hs-selection-card">
        <header className="hs-selection-heading">
          <span className="hs-eyebrow">Haunted Hotel · Hide &amp; Seek</span>
          <h1>{selection === "ghost" ? "Choose your ghost" : "Choose a room"}</h1>
          {ja && <span className="ja" lang="ja">{selection === "ghost" ? "おばけを えらぼう" : "へやを えらぼう"}</span>}
          <p>{selection === "ghost" ? "Hide from the detective. Every ghost has a special trick!" : "One room. Five searches. Can you stay hidden?"}</p>
          <div className="hs-collection-summary" data-testid="hs-collection-summary">Collection: {progress.completed}/{progress.total} escaped · {progress.percentage}%</div>
        </header>
        {selection === "ghost" ? (
          <div className="hs-ghost-grid" data-testid="hs-ghost-select">
            {GHOST_ORDER.map((id) => (
              <button key={id} className={`hs-ghost-card ${ghost === id ? "selected" : ""}`} style={{ "--ghost-color": GHOSTS[id].color } as CSSProperties} data-testid={`hs-ghost-${id}`} onClick={() => { setGhost(id); const room = link?.room; if (isRoom(room)) startHideSeek(id, room, link?.seed, settings.englishLevel); else setSelection("room"); }}>
                <span className="hs-card-portrait"><GhostPortrait ghost={id} size={65} /></span>
                <span className="hs-card-name">{GHOSTS[id].name}</span>
                <strong>{HS_ABILITIES[id].name}</strong>
                <span className="hs-ability-explanation">{HS_ABILITIES[id].text}</span>
                <span className="hs-card-records" data-testid={`hs-ghost-progress-${id}`}>★ {ghostCompleted(book, id)} / {CHALLENGE_AREAS.length} rooms</span>
                {ja && <span className="ja" lang="ja">{HS_ABILITIES[id].ja}</span>}
              </button>
            ))}
          </div>
        ) : (
          <div data-testid="hs-room-select">
          {ghost && <div className="hs-chosen-ghost" style={{ "--ghost-color": GHOSTS[ghost].color } as CSSProperties}><GhostPortrait ghost={ghost} size={38} /><strong>{GHOSTS[ghost].name}</strong><span>{HS_ABILITIES[ghost].name}</span></div>}
          <div className="hs-room-selection">
            {([0, 1] as const).map((floor) => (
              <section className="hs-floor" key={floor} aria-label={floor === 0 ? "Ground floor" : "Upstairs"}>
                <h2>{floor === 0 ? "Ground floor" : "Upstairs"}</h2>
                <div className="hs-room-grid">
                  {PLAY_ROOMS.filter((room) => ROOMS[room].floor === floor).map((room) => (
                    <button className={`hs-room-card ${ghost && completionFor(book, ghost, room) ? "hs-room-complete" : ""}`} key={room} data-testid={`hs-room-${room}`} onClick={() => chooseRoom(room)}>
                      <span className="hs-room-number" aria-hidden="true">{PLAY_ROOMS.indexOf(room) + 1}</span>
                      <strong>{ROOMS[room].name}</strong>
                      {ja && <span className="ja" lang="ja">{ROOMS[room].nameJa}</span>}
                      {ghost && <span className="hs-room-record" data-testid={`hs-room-complete-${room}`}>{completionFor(book, ghost, room) ? "✓ Completed" : "○ Not completed"}</span>}
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
          </div>
        )}
        <footer className="hs-selection-footer">
          <button className="secondary" data-testid="hs-open-records" onClick={() => setRecordsOpen(true)}>★ Records ({progress.completed}/{progress.total})</button>
          {selection === "room" && <button className="secondary" data-testid="hs-back" onClick={anotherGhost}>Back{ja && <small lang="ja">もどる</small>}</button>}
          <button className="secondary" data-testid="hideseek-back" onClick={menu}>Main Menu{ja && <small lang="ja">メニュー</small>}</button>
        </footer>
      </div>
    </div>
  );

  const def = GHOSTS[match.config.ghost];
  const ability = HS_ABILITIES[match.config.ghost];
  // The closing shot (found, or celebrating) plays out before the results card.
  const ended = match.status === "won" || match.status === "lost";
  if (ended && (session.endedAt === null || performance.now() - session.endedAt < RESULTS_DELAY_MS)) return (
    <div className="hs-container" data-testid="hideseek">
      {session.subtitle && <div className="hs-subtitle subtitle panel" data-testid="hs-subtitle" role="status"><span className="hs-speaker">Detective</span><span>{session.subtitle}</span></div>}
    </div>
  );
  if (ended) return (
    <div className="hs-results results-screen ui" data-testid="hideseek">
      <section className="panel hs-results-card" data-testid="hs-results" data-outcome={match.status}>
        <GhostPortrait ghost={def.id} size={86} face={match.status === "won" ? "giggle" : "smile"} />
        <h1>{match.status === "won" ? "Escaped!" : "Found!"}</h1>
        <p>{match.status === "won" ? "Five searches, and you stayed hidden. Clever hiding!" : "The detective found your hiding place. Let’s try another clever plan!"}</p>
        {ja && <p className="ja" lang="ja">{match.status === "won" ? "うまく かくれたね！" : "見つかったね。次は どこに かくれよう？"}</p>}
        <strong>{def.name} · {ROOMS[match.config.room].name}</strong>
        {match.status === "won" && session.recordResult && <div className="hs-victory-record" data-testid="hs-victory-record">
          <strong>{!session.recordResult.saved ? "Record could not be saved" : session.recordResult.firstCompletion ? "★ NEW RECORD!" : "✓ COMPLETED AGAIN!"}</strong>
          {session.recordResult.saved && <span>{session.recordResult.progress.completed} / {session.recordResult.progress.total} challenges completed</span>}
          {session.recordResult.newAchievements.length > 0 && <small>New awards: {session.recordResult.newAchievements.map((award) => award === "masterHider" ? "Master Hider" : award === "naturalTalent" ? "Natural Talent" : award === "englishExpert" ? "English Expert" : "Escaped").join(", ")}</small>}
          {session.recordResult.newMilestones.length > 0 && <small>Collection milestone unlocked!</small>}
          {session.recordResult.personalBest && <small>New personal best!</small>}
        </div>}
        <dl className="hs-stats">
          <div><dt>Searches survived</dt><dd>{Math.max(0, match.stats.completedSearches - (session.lossReason === "found" ? 1 : 0))} / 5</dd></div>
          <div><dt>Relocations used</dt><dd>{match.stats.relocations} / 2</dd></div>
          <div><dt>English first try</dt><dd>{Math.round(match.stats.firstTryAccuracy * 100)}%</dd></div>
          <div><dt>{ability.name}</dt><dd>{match.abilityUsed ? "Used" : "Saved"}</dd></div>
        </dl>
        <footer className="hs-results-actions">
          <button className="primary" data-testid="hs-play-again" onClick={() => startHideSeek(def.id, match.config.room, (match.config.seed + 1) >>> 0, settings.englishLevel)}>Play Again</button>
          <button className="secondary" data-testid="hs-choose-ghost" onClick={anotherGhost}>Choose Another Ghost</button>
          <button className="secondary" data-testid="hs-results-records" onClick={() => { leaveHideSeek(); setGame({ screen: "hideseek", hideSeekLink: null }); setRecordsOpen(true); setSelection("ghost"); setGhost(null); }}>Records</button>
          <button className="secondary" data-testid="hs-menu" onClick={menu}>Main Menu</button>
        </footer>
      </section>
    </div>
  );

  const spot = match.ghost.spotId ? WORLD.spotById.get(match.ghost.spotId) : null;
  const choices = session.pickMode === "ability" ? abilityTargets(match) : session.pickMode ? reachableSpots(match) : [];
  const picking = session.pickMode === "start" ? "Choose your hiding place" : session.pickMode === "ability" ? "Choose a distraction spot" : "Choose where to move";
  const decision = session.decision;
  // The left dock exists only while English or a spot list is open; the camera frames the room beside it.
  const dock = Boolean(match.english || session.pickMode);
  return (
    <div className="hs-container" data-testid="hideseek">
    <div className={`hs-match ${dock ? "has-dock" : ""}`} data-testid="hs-match" data-phase={match.detective.phase}
      data-english={Boolean(match.english)} data-decision={decision?.phase ?? "none"}>
      <HideSeekHud match={match} decision={decision} pickMode={session.pickMode} message={session.message} ability={ability} ja={ja} />
      {dock && <aside className="hs-dock ui" data-testid="hs-dock" aria-label="Hide and seek choices">
        {match.english ? <HideSeekEnglish key={`${match.english.spotId}-${match.stats.questions}`} match={match} /> : session.pickMode && (
          <section className="panel hs-picker" data-testid="hs-picker">
            <h2>{picking}</h2>
            {ja && <span className="ja" lang="ja">{session.pickMode === "start" ? "かくれる場所を えらぼう" : "場所を えらぼう"}</span>}
            {session.pickMode === "start" && <p className="hs-picker-hint">Tap a marker in the room, or choose a place below.</p>}
            <div className="hs-spot-list" role="group" aria-label={picking}>
              {choices.map((choice) => <button key={choice.id} className="hs-spot-option" data-testid={`hs-spot-${choice.id}`} onClick={() => pickSpot(choice.id)}><b>{choice.prep}</b> the {choice.noun}</button>)}
            </div>
            {!choices.length && <p className="hs-empty-choices">No move is available right now. Stay hidden until the next search.</p>}
            {session.pickMode !== "start" && <button className="secondary hs-picker-cancel" onClick={() => setPickMode(null)}>Cancel</button>}
          </section>
        )}
      </aside>}
      {session.subtitle && !match.english && <div className="hs-subtitle subtitle panel" data-testid="hs-subtitle" role="status"><span className="hs-speaker">Detective</span><span>{session.subtitle}</span></div>}
      {decision && !match.english && (
        <section className={`hs-decision-overlay ${decision.phase === "destination" ? "picking" : ""}`}
          data-testid="hs-decision-overlay" data-phase={decision.phase}
          aria-label={decision.phase === "decision" ? "Stay or move decision" : "Choose a hiding place"}>
          <div className="panel hs-decision-card" role="group">
            <div className="hs-decision-eyebrow">{decision.searchNumber === 1 ? "HIDE & SEEK!" : "NEXT SEARCH"}</div>
            <div className="hs-decision-round">Search {decision.searchNumber} of 5</div>
            <h2>{decision.phase === "decision" ? "STAY OR MOVE?" : "CHOOSE YOUR HIDING PLACE"}</h2>
            {ja && <span className="ja" lang="ja">{decision.phase === "decision" ? "ここに いる？ いどうする？" : "かくれる ばしょを えらぼう"}</span>}
            <div className="hs-decision-time" aria-live="off" data-testid="hs-decision-time">
              {Math.ceil(decision.secondsLeft)}
            </div>
            <div className="hs-decision-track" aria-hidden="true">
              <div style={{ width: `${Math.max(0, Math.min(100, decision.secondsLeft / (decision.phase === "decision" ? 5 : 10) * 100))}%` }} />
            </div>
            {decision.phase === "decision" ? (
              <>
                <p>Current hiding place: <strong>{spot ? placePhrase(spot) : "Unknown"}</strong></p>
                <div className="hs-decision-buttons">
                  <button className="secondary" data-testid="hs-stay" onClick={() => decideHideSeek("stay")}>
                    STAY <small lang="ja">ここに いる</small>
                  </button>
                  <button className="primary" data-testid="hs-move" onClick={() => decideHideSeek("move")}>
                    MOVE <small lang="ja">いどうする</small>
                  </button>
                </div>
              </>
            ) : (
              <>
                <p>Tap a highlighted hiding place in the room or choose one from the list.</p>
                <p className="hs-decision-note">English practice starts after you choose. You can take your time.</p>
                <button className="secondary hs-decision-cancel" data-testid="hs-stay-here" onClick={() => stayHere()}>
                  Stay Here <small lang="ja">ここに いる</small>
                </button>
              </>
            )}
          </div>
        </section>
      )}
    </div>
    </div>
  );
}
