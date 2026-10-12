import { useState } from "react";
import { useGame, setGame, type Mode } from "../game/store";
import { director } from "../game/director";
import { GhostPortrait } from "./GhostPortrait";
import { PrepText } from "./Text";
import { GHOSTS } from "../game/ghosts";
import { sentenceWith } from "../game/logic/clues";

/**
 * Start plays the story. `?mode=practice` makes it the one-room prototype
 * (bedroom, one ghost, four rounds); `?mode=replay` jumps to random replay.
 */
const URL_MODE = new URLSearchParams(location.search).get("mode");
const START_MODE: Mode = URL_MODE === "practice" ? "practice" : URL_MODE === "replay" ? "replay" : "story";

export function TitleScreen() {
  const screen = useGame((s) => s.screen);
  const replayUnlocked = useGame((s) => s.replayUnlocked);
  const [starting, setStarting] = useState(false);
  if (screen !== "title") return null;
  const start = (mode: Mode) => {
    if (starting) return;
    setStarting(true);
    void director.startGame(mode).finally(() => setStarting(false));
  };
  return (
    <div className="title-screen ui" data-testid="title">
      <div className="title-card">
        <div className="title-ghosts">
          <GhostPortrait ghost="sleepy" size={58} face="sleepy" />
          <GhostPortrait ghost="hungry" size={58} face="giggle" />
          <GhostPortrait boo size={78} face="happy" />
          <GhostPortrait ghost="sneaky" size={58} face="happy" />
          <GhostPortrait ghost="mischief" size={58} face="giggle" />
        </div>
        <h1>
          Haunted Hotel
          <span>Ghost Hunt</span>
        </h1>
        <p className="tagline">
          <b className="prep">in</b> · <b className="prep">on</b> · <b className="prep">under</b> · <b className="prep">by</b>
        </p>
        <button className="primary big" onClick={() => start(START_MODE)} disabled={starting} data-testid="start">
          {starting ? "…" : "Start"} <small lang="ja">はじめる</small>
        </button>
        {replayUnlocked && START_MODE === "story" && (
          <button className="secondary replay-button" onClick={() => start("replay")} disabled={starting} data-testid="replay-mode">
            Replay <small lang="ja">ランダム モード</small>
          </button>
        )}
        <button className="secondary" onClick={() => setGame({ settingsOpen: true })}>
          Settings <small lang="ja">せってい</small>
        </button>
      </div>
    </div>
  );
}

export function ResultsScreen() {
  const screen = useGame((s) => s.screen);
  const hunt = useGame((s) => s.hunt);
  const mode = useGame((s) => s.mode);
  const ja = useGame((s) => s.settings.japanese);
  if (screen !== "results" || !hunt) return null;
  const { stats } = hunt;
  return (
    <div className="results-screen ui" data-testid="results">
      <div className="results-card">
        <h1>
          Great job!
          {ja && <small lang="ja">よくできました！</small>}
        </h1>
        <div className="results-ghosts">
          {hunt.captured.map((g) => {
            const answers = hunt.answers.filter((a) => a.ghost === g);
            return (
              <div className="results-ghost" key={g}>
                <GhostPortrait ghost={g} size={72} face="happy" />
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
        </div>
        {mode === "story" && (
          <p className="unlocked" data-testid="replay-unlocked">
            Replay mode is open: the ghosts hide in new places!
            {ja && <small lang="ja">ランダム モードが あそべるように なったよ！</small>}
          </p>
        )}
        <div className="modal-buttons">
          <button className="secondary" onClick={() => director.toTitle()}>
            Title <small lang="ja">タイトル</small>
          </button>
          <button
            className="primary big"
            onClick={() => void director.startGame(mode === "practice" ? "practice" : "replay")}
            data-testid="play-again"
          >
            Play Again <small lang="ja">もういちど</small>
          </button>
        </div>
      </div>
    </div>
  );
}
