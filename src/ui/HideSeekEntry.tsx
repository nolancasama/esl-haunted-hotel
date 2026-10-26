import { useEffect, useState, type CSSProperties } from "react";
import { setGame, useGame } from "../game/store";
import { GHOSTS, GHOST_ORDER } from "../game/ghosts";
import type { GhostId } from "../game/types";
import { WORLD } from "../game/world/world";
import { ROOMS } from "../game/world/rooms";
import { abilityTargets, placePhrase, reachableSpots, type PlayRoom } from "../game/hideSeek";
import { command, decideHideSeek, leaveHideSeek, pickSpot, setPickMode, startHideSeek, stayHere, useHideSeek } from "../game/hideSeek/session";
import { GhostPortrait } from "./GhostPortrait";
import { HideSeekEnglish } from "./HideSeekEnglish";

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

/** Selection, match controls and results share the Hide & Seek screen. */
export function HideSeekEntry() {
  const screen = useGame((s) => s.screen);
  const settings = useGame((s) => s.settings);
  const link = useGame((s) => s.hideSeekLink);
  const session = useHideSeek();
  const [ghost, setGhost] = useState<GhostId | null>(link?.ghost ?? null);
  const [selection, setSelection] = useState<"ghost" | "room">(link?.ghost ? "room" : "ghost");
  const [booted, setBooted] = useState(false);
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
  };
  const anotherGhost = () => {
    leaveHideSeek();
    setGame({ screen: "hideseek", hideSeekLink: null });
    setGhost(null);
    setSelection("ghost");
  };
  const chooseRoom = (room: PlayRoom) => {
    if (ghost) startHideSeek(ghost, room, link?.seed, settings.englishLevel);
  };

  if (!match) return (
    <div className="hs-selection title-screen ui" data-testid="hideseek">
      <div className="panel hs-selection-card">
        <header className="hs-selection-heading">
          <span className="hs-eyebrow">Haunted Hotel · Hide &amp; Seek</span>
          <h1>{selection === "ghost" ? "Choose your ghost" : "Choose a room"}</h1>
          {ja && <span className="ja" lang="ja">{selection === "ghost" ? "おばけを えらぼう" : "へやを えらぼう"}</span>}
          <p>{selection === "ghost" ? "Hide from the detective. Every ghost has a special trick!" : "One room. Five searches. Can you stay hidden?"}</p>
        </header>
        {selection === "ghost" ? (
          <div className="hs-ghost-grid" data-testid="hs-ghost-select">
            {GHOST_ORDER.map((id) => (
              <button key={id} className={`hs-ghost-card ${ghost === id ? "selected" : ""}`} style={{ "--ghost-color": GHOSTS[id].color } as CSSProperties} data-testid={`hs-ghost-${id}`} onClick={() => { setGhost(id); const room = link?.room; if (isRoom(room)) startHideSeek(id, room, link?.seed, settings.englishLevel); else setSelection("room"); }}>
                <span className="hs-card-portrait"><GhostPortrait ghost={id} size={65} /></span>
                <span className="hs-card-name">{GHOSTS[id].name}</span>
                <strong>{HS_ABILITIES[id].name}</strong>
                <span className="hs-ability-explanation">{HS_ABILITIES[id].text}</span>
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
                    <button className="hs-room-card" key={room} data-testid={`hs-room-${room}`} onClick={() => chooseRoom(room)}>
                      <span className="hs-room-number" aria-hidden="true">{PLAY_ROOMS.indexOf(room) + 1}</span>
                      <strong>{ROOMS[room].name}</strong>
                      {ja && <span className="ja" lang="ja">{ROOMS[room].nameJa}</span>}
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
          </div>
        )}
        <footer className="hs-selection-footer">
          {selection === "room" && <button className="secondary" data-testid="hs-back" onClick={anotherGhost}>Back{ja && <small lang="ja">もどる</small>}</button>}
          <button className="secondary" data-testid="hideseek-back" onClick={menu}>Main Menu{ja && <small lang="ja">メニュー</small>}</button>
        </footer>
      </div>
    </div>
  );

  const def = GHOSTS[match.config.ghost];
  const ability = HS_ABILITIES[match.config.ghost];
  if (match.status === "won" || match.status === "lost") return (
    <div className="hs-results results-screen ui" data-testid="hideseek">
      <section className="panel hs-results-card" data-testid="hs-results" data-outcome={match.status}>
        <GhostPortrait ghost={def.id} size={86} face={match.status === "won" ? "giggle" : "smile"} />
        <h1>{match.status === "won" ? "Escaped!" : "Found!"}</h1>
        <p>{match.status === "won" ? "Five searches, and you stayed hidden. Clever hiding!" : "The detective found your hiding place. Let’s try another clever plan!"}</p>
        {ja && <p className="ja" lang="ja">{match.status === "won" ? "うまく かくれたね！" : "見つかったね。次は どこに かくれよう？"}</p>}
        <strong>{def.name} · {ROOMS[match.config.room].name}</strong>
        <dl className="hs-stats">
          <div><dt>Searches survived</dt><dd>{Math.max(0, match.stats.completedSearches - (session.lossReason === "found" ? 1 : 0))} / 5</dd></div>
          <div><dt>Relocations used</dt><dd>{match.stats.relocations} / 2</dd></div>
          <div><dt>English first try</dt><dd>{Math.round(match.stats.firstTryAccuracy * 100)}%</dd></div>
          <div><dt>{ability.name}</dt><dd>{match.abilityUsed ? "Used" : "Saved"}</dd></div>
        </dl>
        <footer className="hs-results-actions">
          <button className="primary" data-testid="hs-play-again" onClick={() => startHideSeek(def.id, match.config.room, (match.config.seed + 1) >>> 0, settings.englishLevel)}>Play Again</button>
          <button className="secondary" data-testid="hs-choose-ghost" onClick={anotherGhost}>Choose Another Ghost</button>
          <button className="secondary" data-testid="hs-menu" onClick={menu}>Main Menu</button>
        </footer>
      </section>
    </div>
  );

  const spot = match.ghost.spotId ? WORLD.spotById.get(match.ghost.spotId) : null;
  const choices = session.pickMode === "ability" ? abilityTargets(match) : session.pickMode ? reachableSpots(match) : [];
  const picking = session.pickMode === "start" ? "Choose your hiding place" : session.pickMode === "ability" ? "Choose a distraction spot" : "Choose where to move";
  const decision = session.decision;
  return (
    <div className="hs-container" data-testid="hideseek">
    <div className="hs-match" data-testid="hs-match" data-phase={match.detective.phase}>
      <aside className="hs-rail ui" aria-label="Hide and seek controls">
        <section className="panel hs-hud" data-testid="hs-hud">
          <header className="hs-hud-header">
            <GhostPortrait ghost={def.id} size={42} face={match.detective.suspicion > 65 ? "surprised" : "happy"} />
            <div><strong>{def.name}</strong><span>{ROOMS[match.config.room].name}</span></div>
            <button className="hs-menu-button" aria-label="Main Menu" onClick={menu}>⌂</button>
          </header>
          <div className="hs-current-spot" data-testid="hs-current-spot">{match.ghost.transit ? "Floating to a new hiding place…" : spot ? placePhrase(spot) : "Pick a hiding place to begin"}</div>
          <div className="hs-search-row"><span>Searches left</span><span className="hs-search-pips" aria-label={`${match.searchesLeft} searches left`}>{Array.from({ length: 5 }, (_, i) => <i key={i} className={i < match.searchesLeft ? "on" : ""} />)}</span></div>
          <div className="hs-search-row"><span>Relocations left</span><strong data-testid="hs-relocations">{match.relocationsLeft} / 2</strong></div>
          <label className="hs-suspicion">Suspicion <meter min="0" max="100" value={match.detective.suspicion} aria-label="Detective suspicion" /><span>{Math.round(match.detective.suspicion)}%</span></label>
          <div className="hs-ability-status"><strong>{ability.name}</strong><span data-testid="hs-ability-status">{match.abilityUsed ? "Used" : "Available · once"}</span></div>
          <div className="hs-actions">
            <button className="primary" data-testid="hs-ability" title={ability.text}
              disabled={match.status !== "playing" || Boolean(match.english) || match.abilityUsed || decision?.phase === "destination"}
              onClick={() => { if (def.id === "hungry" || def.id === "mischief") setPickMode("ability"); else command("useAbility"); }}>Ability · {ability.name}</button>
          </div>
          <p className="hs-action-message" role="status" data-testid="hs-message">{session.message || (match.status === "setup" ? "Choose a marker or a place below." : match.english ? "Take your time. The detective is waiting." : "Stay hidden, or choose a new place.")}</p>
        </section>
        {match.english ? <HideSeekEnglish key={`${match.english.spotId}-${match.stats.questions}`} match={match} /> : session.pickMode && (
          <section className="panel hs-picker" data-testid="hs-picker">
            <h2>{picking}</h2>
            {ja && <span className="ja" lang="ja">{session.pickMode === "start" ? "かくれる場所を えらぼう" : "場所を えらぼう"}</span>}
            <div className="hs-spot-list" role="group" aria-label={picking}>
              {choices.map((choice) => <button key={choice.id} className="hs-spot-option" data-testid={`hs-spot-${choice.id}`} onClick={() => pickSpot(choice.id)}><b>{choice.prep}</b> the {choice.noun}</button>)}
            </div>
            {!choices.length && <p className="hs-empty-choices">No move is available right now. Stay hidden until the next search.</p>}
            {session.pickMode !== "start" && <button className="secondary hs-picker-cancel" onClick={() => setPickMode(null)}>Cancel</button>}
          </section>
        )}
      </aside>
      {session.subtitle && !match.english && <div className="hs-subtitle subtitle panel" data-testid="hs-subtitle" role="status"><span>{session.subtitle}</span></div>}
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
