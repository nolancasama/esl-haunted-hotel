import { useState } from "react";
import { useGame, setGame, type Mode, type Scope } from "../game/store";
import { director } from "../game/director";
import { GhostPortrait } from "./GhostPortrait";
import { PrepText } from "./Text";
import { CHAPTER_GHOSTS, GHOSTS } from "../game/ghosts";
import { sentenceWith } from "../game/logic/clues";

/**
 * Start plays the chosen part of the hotel: the full adventure (both
 * chapters), Chapter 1 or Chapter 2 on its own, or the one-room practice.
 * Links still work: `?mode=practice`, `?mode=replay` (random hiding places),
 * `?chapter=1` / `?chapter=2`.
 */
type Choice = Scope | "practice";

const PARAMS = new URLSearchParams(location.search);
const URL_MODE = PARAMS.get("mode");
const URL_CHAPTER = PARAMS.get("chapter");
const URL_CHOICE: Choice | null = URL_MODE === "practice" ? "practice" : URL_CHAPTER === "1" ? "ch1" : URL_CHAPTER === "2" ? "ch2" : null;
const URL_RANDOM = URL_MODE === "replay";
const MENU_KEY = "hh.menu.v1";

function loadMenu(): { choice: Choice; random: boolean } {
  try {
    const raw = localStorage.getItem(MENU_KEY);
    if (raw) {
      const m = JSON.parse(raw) as { choice?: Choice; random?: boolean };
      return { choice: m.choice ?? "all", random: Boolean(m.random) };
    }
  } catch {
    /* storage blocked */
  }
  return { choice: "all", random: false };
}

function saveMenu(m: { choice: Choice; random: boolean }) {
  try {
    localStorage.setItem(MENU_KEY, JSON.stringify(m));
  } catch {
    /* ignore */
  }
}

const CHOICES: Array<{ id: Choice; en: string; ja: string; count: number }> = [
  { id: "all", en: "Full Adventure", ja: "ぜんぶ", count: 8 },
  { id: "ch1", en: "Chapter 1", ja: "1かい", count: 4 },
  { id: "ch2", en: "Chapter 2", ja: "2かい", count: 4 },
  { id: "practice", en: "Practice", ja: "れんしゅう", count: 1 }
];

function GhostCountMark() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path d="M5 20V10a7 7 0 0 1 14 0v10l-3-2-4 2-4-2z" fill="currentColor" />
      <circle cx="9" cy="10" r="1" fill="var(--plum-900)" />
      <circle cx="15" cy="10" r="1" fill="var(--plum-900)" />
    </svg>
  );
}

export function TitleScreen() {
  const screen = useGame((s) => s.screen);
  const replayUnlocked = useGame((s) => s.replayUnlocked);
  const ch2Unlocked = useGame((s) => s.ch2Unlocked);
  const [starting, setStarting] = useState(false);
  const [menu, setMenu] = useState(() => {
    const m = loadMenu();
    return { choice: URL_CHOICE ?? m.choice, random: URL_RANDOM || m.random };
  });
  if (screen !== "title") return null;
  // Chapter 2 on its own opens once Chapter 1 has been finished here (a link can open it for a class).
  const ch2Open = ch2Unlocked || URL_CHAPTER === "2";
  const choice: Choice = menu.choice === "ch2" && !ch2Open ? "all" : menu.choice;
  const randomOpen = replayUnlocked || URL_RANDOM;
  const random = menu.random && randomOpen && choice !== "practice";
  const choose = (patch: Partial<typeof menu>) => {
    const next = { ...menu, ...patch };
    setMenu(next);
    saveMenu(next);
  };
  const start = () => {
    if (starting) return;
    setStarting(true);
    const mode: Mode = choice === "practice" ? "practice" : random ? "replay" : "story";
    const scope: Scope = choice === "practice" ? "ch1" : choice;
    void director.startGame(mode, scope).finally(() => setStarting(false));
  };
  const titleGhosts = ch2Unlocked ? [...CHAPTER_GHOSTS[1], ...CHAPTER_GHOSTS[2]] : CHAPTER_GHOSTS[1];
  const half = titleGhosts.length / 2;
  return (
    <div className="title-screen ui" data-testid="title">
      <div className="panel title-card">
        <div className="title-crest">
          <div className={`title-ghosts ${ch2Unlocked ? "many" : ""}`}>
            {titleGhosts.slice(0, half).map((g, i) => (
              <span className="ghost-medallion title-portrait" key={g}>
                <GhostPortrait ghost={g} size={ch2Unlocked ? 44 : 58} face={g === "sleepy" ? "sleepy" : i % 2 ? "giggle" : "happy"} />
              </span>
            ))}
            <span className="ghost-medallion title-portrait boo">
              <GhostPortrait boo size={78} face="happy" />
            </span>
            {titleGhosts.slice(half).map((g, i) => (
              <span className="ghost-medallion title-portrait" key={g}>
                <GhostPortrait ghost={g} size={ch2Unlocked ? 44 : 58} face={i % 2 ? "happy" : "giggle"} />
              </span>
            ))}
          </div>
        </div>
        <h1 className="title-heading">
          <span className="title-name">HAUNTED HOTEL</span>
          <span className="title-ribbon">Ghost Hunt</span>
        </h1>
        <p className="tagline">
          <b className="prep">in</b><b className="prep">on</b><b className="prep">under</b><b className="prep">by</b>
        </p>
        <button className="btn-primary primary big" onClick={start} disabled={starting} data-testid="start">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M7 4v16l14-8z" fill="currentColor" /></svg>
          {starting ? "…" : "Start"} <small lang="ja">はじめる</small>
        </button>
        <div className="mode-choice" role="radiogroup" aria-label="What to play" data-testid="mode-choice">
          {CHOICES.map((c) => {
            const locked = c.id === "ch2" && !ch2Open;
            return (
              <button
                key={c.id}
                role="radio"
                aria-checked={choice === c.id}
                className={`chip mode-card ${choice === c.id ? "on" : ""} ${locked ? "locked" : ""}`}
                disabled={locked || starting}
                onClick={() => choose({ choice: c.id })}
                title={locked ? "Finish Chapter 1 first" : undefined}
                data-testid={`choice-${c.id}`}
              >
                {locked ? (
                  <span className="choice-badge lock" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="15" height="15"><rect x="5" y="10" width="14" height="11" rx="2" fill="currentColor" /><path d="M8 10V6a4 4 0 0 1 8 0v4" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
                  </span>
                ) : choice === c.id ? <span className="choice-badge selected" aria-hidden="true">✓</span> : null}
                <span className="mode-label">{c.en}</span>
                <small lang="ja">{c.ja}</small>
                <span className="mode-count"><GhostCountMark /> {c.count}</span>
                {locked && <span className="lock-note">Finish Chapter 1<small lang="ja">さきに 1かいを クリア</small></span>}
              </button>
            );
          })}
        </div>
        {randomOpen && choice !== "practice" && (
          <label className="random-toggle" data-testid="replay-mode">
            <input type="checkbox" checked={random} onChange={(e) => choose({ random: e.target.checked })} />
            <span className="switch-track" aria-hidden="true" />
            <span>
              Random hiding places <small lang="ja">ランダム</small>
            </span>
          </label>
        )}
        <button className="btn-secondary secondary title-settings" onClick={() => setGame({ settingsOpen: true })}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="m10 2-1 3-3 1-3-1-2 4 3 2v3l-2 2 2 4 3-1 3 1 1 3h4l1-3 3-1 3 1 2-4-3-2v-3l2-2-2-4-3 1-3-1-1-3z" fill="none" stroke="currentColor" strokeWidth="1.8" /><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>
          Settings <small lang="ja">せってい</small>
        </button>
      </div>
    </div>
  );
}

function formatTime(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function ResultsScreen() {
  const screen = useGame((s) => s.screen);
  const hunt = useGame((s) => s.hunt);
  const mode = useGame((s) => s.mode);
  const scope = useGame((s) => s.scope);
  const ja = useGame((s) => s.settings.japanese);
  const startedAt = useGame((s) => s.startedAt);
  const finishedAt = useGame((s) => s.finishedAt);
  if (screen !== "results" || !hunt) return null;
  const { stats } = hunt;
  const many = hunt.captured.length > 4;
  return (
    <div className="results-screen ui" data-testid="results">
      <div className={`panel results-card ${many ? "many" : ""}`}>
        <div className="results-stars" aria-hidden="true">{Array.from({ length: 6 }, (_, i) => <span key={i}>✦</span>)}</div>
        <h1 className="results-heading">
          <span className="results-ribbon">Great job!</span>
          {ja && <small lang="ja">よくできました！</small>}
        </h1>
        <div className="results-ghosts" data-testid="results-ghosts">
          {hunt.captured.map((g) => {
            const answers = hunt.answers.filter((a) => a.ghost === g);
            return (
              <div className="results-ghost" key={g} data-testid={`result-${g}`}>
                <span className="ghost-medallion result-portrait"><GhostPortrait ghost={g} size={many ? 40 : 72} face="happy" /></span>
                <div className="results-name">{GHOSTS[g].name}</div>
                <ul>
                  {answers.map((a, i) => (
                    <li key={i}>
                      <PrepText text={sentenceWith(a.prep, a)} />
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
        <div className="stats">
          <div className="stat-plaque">
            <b data-testid="stat-correct">{stats.correctAnswers}</b>
            <span>
              Correct answers
              {ja && <small lang="ja">ただしく こたえた</small>}
            </span>
          </div>
          <div className="stat-plaque">
            <b>{stats.firstTryAnswers}</b>
            <span>
              First try
              {ja && <small lang="ja">いっかいで せいかい</small>}
            </span>
          </div>
          <div className="stat-plaque">
            <b data-testid="stat-searches">{stats.wrongSearches}</b>
            <span>
              Empty searches
              {ja && <small lang="ja">はずれ</small>}
            </span>
          </div>
          {startedAt !== null && finishedAt !== null && (
            <div className="stat-plaque">
              <b data-testid="stat-time">{formatTime(finishedAt - startedAt)}</b>
              <span>
                Time
                {ja && <small lang="ja">かかった じかん</small>}
              </span>
            </div>
          )}
        </div>
        {mode === "story" && (
          <p className="unlocked ticket" data-testid="replay-unlocked">
            Replay is open: the ghosts hide in new places!
            {ja && <small lang="ja">ランダム モードが あそべるように なったよ！</small>}
          </p>
        )}
        {mode !== "practice" && scope === "ch1" && (
          <p className="unlocked ticket" data-testid="ch2-unlocked">
            Chapter 2 is open: four more ghosts upstairs!
            {ja && <small lang="ja">2かいの おばけ 4ひきに ちょうせんできるよ！</small>}
          </p>
        )}
        <div className="modal-buttons">
          <button className="btn-secondary secondary" onClick={() => director.toTitle()} data-testid="main-menu">
            Main Menu <small lang="ja">メニュー</small>
          </button>
          <button
            className="btn-primary primary big"
            onClick={() => void director.startGame(mode === "practice" ? "practice" : "replay", scope)}
            data-testid="play-again"
          >
            Play Again <small lang="ja">もういちど</small>
          </button>
        </div>
      </div>
    </div>
  );
}
