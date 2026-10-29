import { useEffect, useRef, useState, type CSSProperties } from "react";
import { setGame, useGame } from "../game/store";
import { GHOSTS } from "../game/ghosts";
import { GUEST_INFO, ROOMS, isGuestRoom } from "../game/world/rooms";
import { WORLD } from "../game/world/world";
import { awarenessOf, placePhrase, type Awareness, type MatchState } from "../game/hideSeek";
import { command, setPickMode, type TimedDecision, type PickMode } from "../game/hideSeek/session";
import { GhostPortrait } from "./GhostPortrait";
import { GearIcon } from "./Hud";

const TOAST_MS = 3000;
/** The closed eye shows this long after hiding, or after danger passes, then fades. */
const EYE_LINGER = 2;

const EYE_TEXT: Record<Awareness, { en: string; ja: string }> = {
  hidden: { en: "Hidden", ja: "かくれている" },
  suspicious: { en: "Suspicious", ja: "あやしい" },
  spotted: { en: "Spotted!", ja: "みつかった！" }
};

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

interface Props {
  match: MatchState;
  decision: TimedDecision | null;
  pickMode: PickMode;
  message: string;
  ability: { name: string; text: string; ja: string };
  ja: boolean;
}

/**
 * The in-match HUD: a narrow top bar, a short-lived notice under it, the stealth eye, the
 * ability in the lower right and the gear in the upper right. Each part shows only in the
 * phases it matters (see `calm` and `dock` below); the English panel, spot list and the
 * timed decision card are drawn by HideSeekEntry.
 */
export function HideSeekHud({ match, decision, pickMode, message, ability, ja }: Props) {
  const def = GHOSTS[match.config.ghost];
  const playing = match.status === "playing";
  const english = Boolean(match.english);
  // Hiding (first person), relocating and the detective's searches: the eye and the ability belong here.
  const calm = playing && !english && !decision && !pickMode;
  const reading = awarenessOf(match);
  const spot = match.ghost.spotId ? WORLD.spotById.get(match.ghost.spotId) : null;
  const where = match.ghost.transit ? "Floating to a new hiding place…" : spot ? capital(placePhrase(spot)) : "Pick a hiding place";
  const done = 5 - match.searchesLeft;

  // ---- short notices: the room on arrival, the hiding place, "No moves left", status messages
  const [toast, setToast] = useState<{ text: string; ja?: string; id: number; until: number } | null>(null);
  const seen = useRef({ match: null as MatchState | null, hideKey: "", moves: 2, message: "", deciding: false, hiddenAt: -100, eyeUntil: -100 });
  const hideKey = `${match.status}|${match.ghost.transit}|${match.ghost.spotId}`;
  useEffect(() => {
    const r = seen.current;
    let next: { text: string; ja?: string } | null = null;
    if (message && message !== r.message) next = { text: message };
    if (r.match !== match) {
      const room = ROOMS[match.config.room];
      const guest = isGuestRoom(room.id) ? GUEST_INFO[room.id] : null;
      next = guest ? { text: `${room.name} · ${guest.title}`, ja: guest.titleJa } : { text: room.name, ja: room.nameJa };
      Object.assign(r, { match, hideKey, moves: match.relocationsLeft, hiddenAt: -100, eyeUntil: -100 });
    }
    // Back to hiding after Stay or Move: the hiding place, not the status line.
    if (r.deciding && !decision && playing && spot && !match.ghost.transit) next = { text: where };
    if (hideKey !== r.hideKey && playing) {
      if (match.ghost.transit) next = { text: where };
      else if (spot) { next = { text: where }; r.hiddenAt = match.time; }
    }
    if (match.relocationsLeft === 0 && r.moves > 0) next = { text: "No moves left", ja: "もう いどう できないよ" };
    r.hideKey = hideKey; r.moves = match.relocationsLeft; r.message = message; r.deciding = Boolean(decision);
    if (next) setToast({ ...next, id: performance.now(), until: performance.now() + TOAST_MS });
  }, [match, hideKey, message, decision, playing, where, spot, match.relocationsLeft, match.time]);
  const toastShown = toast && performance.now() < toast.until && !decision && !english;

  // ---- the eye: shown while the detective has noticed something, and briefly after hiding or calming down
  const r = seen.current;
  if (reading.state !== "hidden") r.eyeUntil = match.time + EYE_LINGER;
  const eyeShown = calm && (reading.state !== "hidden" || match.time < r.eyeUntil || match.time - r.hiddenAt < EYE_LINGER);

  return <>
    <header className="panel hs-topbar ui" data-testid="hs-hud" aria-label="Hide and seek progress">
      <div className="hs-top-ghost">
        <GhostPortrait ghost={def.id} size={30} face={reading.state === "spotted" ? "surprised" : "happy"} />
        <strong>{def.name}</strong>
      </div>
      <div className="hs-top-item" role="group" data-testid="hs-searches" aria-label={`${done} of 5 searches done`}>
        <span className="hs-top-label">Search{ja && <small lang="ja">さがした</small>}</span>
        <span className="hs-search-pips" aria-hidden="true">{Array.from({ length: 5 }, (_, i) => <i key={i} className={i < done ? "done" : ""} />)}</span>
        <b className="hs-top-count" aria-hidden="true">{done}/5</b>
      </div>
      <div className={`hs-top-item hs-top-moves ${match.relocationsLeft ? "" : "empty"}`} role="group" aria-label={`${match.relocationsLeft} of 2 moves left`}>
        <span className="hs-top-label">Moves{ja && <small lang="ja">いどう</small>}</span>
        <b data-testid="hs-relocations">{match.relocationsLeft}/2</b>
      </div>
      <button className="hs-where" data-testid="hs-where" aria-label="Where am I hiding?" title="Where am I hiding?"
        onClick={() => setToast({ text: where, id: performance.now(), until: performance.now() + TOAST_MS })}>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 2.5a7 7 0 0 0-7 7c0 5 7 12 7 12s7-7 7-12a7 7 0 0 0-7-7zm0 9.6a2.6 2.6 0 1 1 0-5.2 2.6 2.6 0 0 1 0 5.2z" fill="currentColor" /></svg>
      </button>
      <span className="sr-only" data-testid="hs-current-spot">{where}</span>
    </header>
    <button className="icon-button hs-gear ui" aria-label="Settings" data-testid="hs-settings" onClick={() => setGame({ settingsOpen: true })}><GearIcon /></button>

    <div className={`hs-toast ${toastShown ? "shown" : ""}`} data-testid="hs-toast" role="status" aria-live="polite">
      {toastShown && <span key={toast.id} className="panel">{toast.text}{ja && toast.ja && <small lang="ja">{toast.ja}</small>}</span>}
    </div>
    <span className="sr-only" data-testid="hs-message">{message}</span>

    {playing && <StealthEye state={reading.state} open={reading.open} level={reading.level} clue={match.clueId} shown={eyeShown} ja={ja} />}
    {/* Still usable beside the Stay/Move card (e.g. Vanish before moving), never during destination picking. */}
    {playing && !english && !pickMode && decision?.phase !== "destination" && <AbilityDock match={match} ability={ability} />}
  </>;
}

/**
 * Closed, half-open or wide open; pale, amber or coral; with a word under it, so the state
 * never rests on colour alone. CSS transitions do the opening and colour changes.
 */
function StealthEye({ state, open, level, clue, shown, ja }: { state: Awareness; open: number; level: number; clue: number; shown: boolean; ja: boolean }) {
  const text = EYE_TEXT[state];
  return <div className={`hs-awareness ${shown ? "shown" : ""}`} data-testid="hs-awareness" data-state={state} data-shown={shown}
    style={{ "--open": open, "--level": state === "spotted" ? 1 : level } as CSSProperties}
    role="img" aria-label={shown ? `Detective: ${text.en}` : undefined} aria-hidden={!shown}>
    {state !== "hidden" && <span key={clue} className="hs-eye-pulse" aria-hidden="true" />}
    <svg className="hs-eye" viewBox="0 0 64 44" aria-hidden="true">
      <path className="hs-eye-arc-track" d="M8 38 A26 26 0 0 1 56 38" pathLength={100} />
      <path className="hs-eye-arc" d="M8 38 A26 26 0 0 1 56 38" pathLength={100} />
      <g className="hs-eye-open">
        <path className="hs-eye-white" d="M10 26 Q32 8 54 26 Q32 44 10 26 Z" />
        <circle className="hs-eye-iris" cx="32" cy="26" r="7.5" />
        <circle className="hs-eye-pupil" cx="32" cy="26" r="3.4" />
        <circle className="hs-eye-glint" cx="34.5" cy="23.5" r="1.4" />
      </g>
      <g className="hs-eye-closed">
        <path d="M10 26 Q32 40 54 26" />
        <path d="M18 31.5 l-3 5 M26 34.5 l-1.5 5.5 M38 34.5 l1.5 5.5 M46 31.5 l3 5" />
      </g>
    </svg>
    <span className="hs-eye-label">{text.en}{ja && <small lang="ja">{text.ja}</small>}</span>
  </div>;
}

/** Targeted abilities (Hungry, Mischief) open the spot list in the dock; nothing is spent until a spot is picked. */
function AbilityDock({ match, ability }: { match: MatchState; ability: Props["ability"] }) {
  const touch = useGame((s) => s.touch);
  const ghost = match.config.ghost;
  const targeted = ghost === "hungry" || ghost === "mischief";
  const disabled = match.status !== "playing" || Boolean(match.english) || match.abilityUsed;
  const use = () => { if (targeted) setPickMode("ability"); else command("useAbility"); };
  // E uses the ability from the keyboard, under the same rules as the button.
  const latest = useRef({ disabled, use });
  latest.current = { disabled, use };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.code !== "KeyE" || e.repeat || (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA"))) return;
      if (latest.current.disabled) return;
      e.preventDefault();
      latest.current.use();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  return <section className={`panel hs-ability-dock ui ${match.abilityUsed ? "used" : ""}`} data-testid="hs-ability-dock" aria-label="Ghost ability">
    <div className="hs-ability-head">
      <GhostPortrait ghost={ghost} size={28} dim={match.abilityUsed} />
      <div>
        <span className="hs-ability-ghost">{GHOSTS[ghost].name}</span>
        <strong>{ability.name}</strong>
      </div>
    </div>
    <span className="hs-ability-state" data-testid="hs-ability-status">{match.abilityUsed ? "Used" : "Available · once"}</span>
    <button className="primary" data-testid="hs-ability" title={ability.text} disabled={disabled} onClick={use}
      aria-keyshortcuts="E" aria-label={match.abilityUsed ? `${ability.name}: used` : `Use ability: ${ability.name}`}>
      {match.abilityUsed ? "Used" : "Use Ability"}{!match.abilityUsed && !touch && <kbd aria-hidden="true">E</kbd>}
    </button>
  </section>;
}
