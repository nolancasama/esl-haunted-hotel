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

const CHOICES: Array<{ id: Choice; en: string; ja: string }> = [
  { id: "all", en: "All 8", ja: "ぜんぶ" },
  { id: "ch1", en: "Chapter 1", ja: "1かい" },
  { id: "ch2", en: "Chapter 2", ja: "2かい" },
  { id: "practice", en: "Practice", ja: "れんしゅう" }
];

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
      <div className="title-card">
        <div className={`title-ghosts ${ch2Unlocked ? "many" : ""}`}>
          {titleGhosts.slice(0, half).map((g, i) => (
            <GhostPortrait key={g} ghost={g} size={ch2Unlocked ? 44 : 58} face={g === "sleepy" ? "sleepy" : i % 2 ? "giggle" : "happy"} />
          ))}
          <GhostPortrait boo size={78} face="happy" />
          {titleGhosts.slice(half).map((g, i) => (
            <GhostPortrait key={g} ghost={g} size={ch2Unlocked ? 44 : 58} face={i % 2 ? "happy" : "giggle"} />
          ))}
        </div>
        <h1>
          Haunted Hotel
          <span>Ghost Hunt</span>
        </h1>
        <p className="tagline">
          <b className="prep">in</b> · <b className="prep">on</b> · <b className="prep">under</b> · <b className="prep">by</b>
        </p>
        <button className="primary big" onClick={start} disabled={starting} data-testid="start">
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
                className={`chip ${choice === c.id ? "on" : ""} ${locked ? "locked" : ""}`}
                disabled={locked || starting}
                onClick={() => choose({ choice: c.id })}
                title={locked ? "Finish Chapter 1 first" : undefined}
                data-testid={`choice-${c.id}`}
              >
                {locked && <span aria-hidden="true">🔒 </span>}
                {c.en}
                <small lang="ja">{c.ja}</small>
              </button>
            );
          })}
        </div>
        {randomOpen && choice !== "practice" && (
          <label className="random-toggle" data-testid="replay-mode">
            <input type="checkbox" checked={random} onChange={(e) => choose({ random: e.target.checked })} />
            <span>
              Random hiding places <small lang="ja">ランダム</small>
            </span>
          </label>
        )}
        <button className="secondary" onClick={() => setGame({ settingsOpen: true })}>
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
      <div className={`results-card ${many ? "many" : ""}`}>
        <h1>
          Great job!
          {ja && <small lang="ja">よくできました！</small>}
        </h1>
        <div className="results-ghosts" data-testid="results-ghosts">
          {hunt.captured.map((g) => {
            const answers = hunt.answers.filter((a) => a.ghost === g);
            return (
              <div className="results-ghost" key={g} data-testid={`result-${g}`}>
                <GhostPortrait ghost={g} size={many ? 52 : 72} face="happy" />
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
          <div>
            <b data-testid="stat-correct">{stats.correctAnswers}</b>
            <span>
              Correct answers
              {ja && <small lang="ja">ただしく こたえた</small>}
            </span>
          </div>
          <div>
            <b>{stats.firstTryAnswers}</b>
            <span>
              First try
              {ja && <small lang="ja">いっかいで せいかい</small>}
            </span>
          </div>
          <div>
            <b data-testid="stat-searches">{stats.wrongSearches}</b>
            <span>
              Empty searches
              {ja && <small lang="ja">はずれ</small>}
            </span>
          </div>
          {startedAt !== null && finishedAt !== null && (
            <div>
              <b data-testid="stat-time">{formatTime(finishedAt - startedAt)}</b>
              <span>
                Time
                {ja && <small lang="ja">かかった じかん</small>}
              </span>
            </div>
          )}
        </div>
        {mode === "story" && (
          <p className="unlocked" data-testid="replay-unlocked">
            Replay is open: the ghosts hide in new places!
            {ja && <small lang="ja">ランダム モードが あそべるように なったよ！</small>}
          </p>
        )}
        {mode !== "practice" && scope === "ch1" && (
          <p className="unlocked" data-testid="ch2-unlocked">
            Chapter 2 is open: four more ghosts upstairs!
            {ja && <small lang="ja">2かいの おばけ 4ひきに ちょうせんできるよ！</small>}
          </p>
        )}
        <div className="modal-buttons">
          <button className="secondary" onClick={() => director.toTitle()} data-testid="main-menu">
            Main Menu <small lang="ja">メニュー</small>
          </button>
          <button
            className="primary big"
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
