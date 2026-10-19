import { useEffect, useRef, useState } from "react";
import { useGame, setGame, visibleGhosts } from "../game/store";
import { WORLD } from "../game/world/world";
import { director } from "../game/director";
import { currentEncounter, currentSpot } from "../game/logic/hunt";
import { clueText } from "../game/logic/clues";
import { GhostPortrait } from "./GhostPortrait";
import { PrepIcon } from "./PrepIcon";
import { PrepText, Ja } from "./Text";
import { HINT } from "./i18n";
import { AnswerPanel } from "./AnswerPanel";

function SpeakerIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
      <path d="M4 9.5h3.5L12 5v14l-4.5-4.5H4z" fill="currentColor" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
      <path
        d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zm8.3 2.2-1.9-.3a6.6 6.6 0 0 0-.7-1.7l1.1-1.6-1.9-1.9-1.6 1.1a6.6 6.6 0 0 0-1.7-.7L13.3 3.7h-2.6l-.3 1.9a6.6 6.6 0 0 0-1.7.7L7.1 5.2 5.2 7.1l1.1 1.6a6.6 6.6 0 0 0-.7 1.7l-1.9.3v2.6l1.9.3c.2.6.4 1.2.7 1.7l-1.1 1.6 1.9 1.9 1.6-1.1c.5.3 1.1.5 1.7.7l.3 1.9h2.6l.3-1.9c.6-.2 1.2-.4 1.7-.7l1.6 1.1 1.9-1.9-1.1-1.6c.3-.5.5-1.1.7-1.7l1.9-.3z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * Ghosts captured (or, for a ghost that needs several answers, its remaining rounds).
 * In the full adventure the four upstairs ghosts only appear once Chapter 2 opens.
 */
function Counter() {
  const hunt = useGame((s) => s.hunt);
  const lantern = useGame((s) => s.lantern);
  const scope = useGame((s) => s.scope);
  const chapter = useGame((s) => s.chapter);
  const mode = useGame((s) => s.mode);
  // Seed from the current lantern: mounting an already-lit plaque never replays a capture.
  const previous = useRef(new Set(lantern));
  const [flashing, setFlashing] = useState(new Set<string>());
  useEffect(() => {
    setFlashing(new Set(lantern.filter((g) => !previous.current.has(g))));
    previous.current = new Set(lantern);
  }, [lantern]);
  if (!hunt) return null;
  const enc = currentEncounter(hunt);
  const single = hunt.encounters.length === 1;
  const ghosts = visibleGhosts({ hunt, scope, chapter, mode });
  const caught = lantern.filter((g) => ghosts.includes(g)).length;
  const rows = ghosts.length > 4 ? [ghosts.slice(0, 4), ghosts.slice(4)] : [ghosts];
  return (
    <div className="counter panel compact" data-testid="counter">
      <div className={`counter-ghosts ${rows.length > 1 ? "two" : ""}`}>
        {rows.map((row, r) => (
          <div className="counter-row" key={r}>
            {row.map((g) => (
              <span key={g} className={`ghost-medallion counter-portrait ${lantern.includes(g) ? "captured" : "uncaptured"} ${flashing.has(g) ? "capture-flash" : ""}`}>
                <GhostPortrait ghost={g} size={rows.length > 1 ? 22 : 30} dim={!lantern.includes(g)} face="smile" />
              </span>
            ))}
          </div>
        ))}
      </div>
      <div className="counter-text">
        {single ? (
          <span>
            {Math.min(hunt.round, enc.rounds)}/{enc.rounds}
          </span>
        ) : (
          <span>
            {caught}/{ghosts.length}
          </span>
        )}
      </div>
      {enc.rounds > 1 && hunt.status !== "done" && (
        <div className="pips" aria-label="rounds">
          {Array.from({ length: enc.rounds }, (_, i) => (
            <i key={i} className={i < hunt.round ? "on" : ""} />
          ))}
        </div>
      )}
    </div>
  );
}

function ClueCard() {
  const hunt = useGame((s) => s.hunt);
  const shown = useGame((s) => s.clueShown);
  const speaking = useGame((s) => s.clueSpeaking);
  const help = useGame((s) => s.helpLevel);
  const phase = useGame((s) => s.phase);
  const settings = useGame((s) => s.settings);
  if (!hunt || !shown || hunt.status !== "hunting") return null;
  const spot = currentSpot(hunt);
  return (
    <div className={`clue-card panel ${speaking ? "speaking" : ""}`} data-testid="clue" key={hunt.clueId}>
      <div className="clue-boo ghost-medallion">
        <GhostPortrait boo size={46} face={speaking ? "happy" : "smile"} />
        <span className="sound-waves" aria-hidden="true"><i /><i /><i /></span>
      </div>
      <div className="clue-text" data-testid="clue-text">
        <PrepText text={clueText(spot)} />
      </div>
      {help >= 2 && (
        <div className="clue-pic" data-testid="clue-pic">
          <PrepIcon prep={spot.prep} size={50} />
        </div>
      )}
      <button
        className="icon-button replay"
        onClick={() => director.replayClue()}
        disabled={phase !== "explore" && phase !== "search"}
        aria-label={HINT.replay.en}
        title={settings.japanese ? HINT.replay.ja : HINT.replay.en}
        data-testid="replay"
      >
        <SpeakerIcon />
      </button>
    </div>
  );
}

function Subtitle() {
  const line = useGame((s) => s.line);
  const ja = useGame((s) => s.settings.japanese);
  if (!line) return null;
  return (
    <div className={`subtitle panel ${line.speaker} ${line.wait ? "wait" : ""}`} key={line.id} data-testid="subtitle">
      {line.speaker === "boo" && <span className="ghost-medallion subtitle-portrait"><GhostPortrait boo size={line.wait ? 52 : 36} face="happy" /></span>}
      <div>
        <div className="subtitle-en">
          <PrepText text={line.en} />
        </div>
        {line.ja && <Ja on={ja}>{line.ja}</Ja>}
      </div>
      {line.wait && (
        <button className="next-button icon-button" onClick={() => director.next()} aria-label="Next" data-testid="next">
          ▶
        </button>
      )}
    </div>
  );
}

function SkipButton() {
  const phase = useGame((s) => s.phase);
  const ja = useGame((s) => s.settings.japanese);
  if (phase !== "intro") return null;
  return (
    <button className="skip-button btn-secondary" onClick={() => director.skipIntro()} data-testid="skip">
      {ja ? "スキップ" : "Skip"} ▶▶
    </button>
  );
}

/** "CHAPTER 2 — UPSTAIRS": a title across the middle of the screen for a moment. */
function ChapterTitle() {
  const card = useGame((s) => s.chapterCard);
  const ja = useGame((s) => s.settings.japanese);
  if (!card) return null;
  return (
    <div className="chapter-card" key={card.key} data-testid="chapter-card">
      <div className="chapter-title">{card.title}</div>
      <div className="chapter-sub">{card.sub}</div>
      {ja && (
        <div className="chapter-ja" lang="ja">
          {card.ja}
        </div>
      )}
    </div>
  );
}

function Caption() {
  const caption = useGame((s) => s.caption);
  if (!caption) return null;
  return (
    <div className={`caption ${caption.tone}`} key={caption.id} data-testid="caption">
      <PrepText text={caption.text} />
    </div>
  );
}

/** Short contextual hint - never a permanent control guide. */
function HintBar() {
  const phase = useGame((s) => s.phase);
  const focus = useGame((s) => s.focusId);
  const hint = useGame((s) => s.hint);
  const toast = useGame((s) => s.toast?.id ?? null);
  const touch = useGame((s) => s.touch);
  const ja = useGame((s) => s.settings.japanese);
  const [moveHintGone, setMoveHintGone] = useState(false);
  useEffect(() => {
    if (hint !== "move") return;
    setMoveHintGone(false);
    const t = window.setTimeout(() => setMoveHintGone(true), 9000);
    return () => window.clearTimeout(t);
  }, [hint]);

  const usable = focus ? WORLD.objectById.get(focus)?.action : undefined;
  let h: { en: string; ja: string } | null = null;
  if (toast === "micBlocked") h = HINT.micBlocked;
  else if (toast === "locked") h = HINT.locked;
  else if (toast === "fan") h = HINT.fan;
  else if (phase === "explore" && hint === "exit") h = HINT.exit;
  else if (phase === "explore" && focus && usable) h = touch ? HINT.fanTouch : HINT.fanKeys;
  else if (phase === "explore" && focus) h = touch ? HINT.searchTouch : HINT.searchKeys;
  else if (phase === "explore" && hint === "goDoor") h = HINT.goDoor;
  else if (phase === "explore" && hint === "goStairs") h = HINT.goStairs;
  else if (phase === "explore" && hint === "move" && !moveHintGone) h = touch ? HINT.moveTouch : HINT.moveKeys;
  else if (phase === "search") h = touch ? HINT.chooseTouch : HINT.chooseKeys;
  if (!h) return null;
  return (
    <div className="hint-bar" data-testid="hint">
      {ja ? <span lang="ja">{h.ja}</span> : h.en}
      {phase === "search" && (
        <button className="back-button btn-secondary" onClick={() => director.back()} data-testid="back">
          {ja ? "もどる" : "Back"}
        </button>
      )}
    </div>
  );
}

export function Hud() {
  const screen = useGame((s) => s.screen);
  if (screen !== "game") return null;
  return (
    <div className="hud">
      <Counter />
      <ClueCard />
      <div className="top-right">
        <button className="icon-button" onClick={() => setGame({ settingsOpen: true })} aria-label="Settings" data-testid="settings">
          <GearIcon />
        </button>
      </div>
      <Caption />
      <ChapterTitle />
      <SkipButton />
      <div className="bottom">
        <Subtitle />
        <AnswerPanel />
        <HintBar />
      </div>
    </div>
  );
}
