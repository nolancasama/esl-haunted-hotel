import { useState } from "react";
import { useGame, setGame, type Mode } from "../game/store";
import { director } from "../game/director";
import { GhostPortrait } from "./GhostPortrait";
import { PrepText } from "./Text";
import { GHOSTS } from "../game/ghosts";
import { sentenceWith } from "../game/logic/clues";

/** `?mode=practice` starts the one-room prototype (bedroom, one ghost, four rounds). */
const START_MODE: Mode = new URLSearchParams(location.search).get("mode") === "story" ? "story" : "practice";

export function TitleScreen() {
  const screen = useGame((s) => s.screen);
  const [starting, setStarting] = useState(false);
  if (screen !== "title") return null;
  const start = () => {
    if (starting) return;
    setStarting(true);
    void director.startGame(START_MODE).finally(() => setStarting(false));
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
        <button className="primary big" onClick={start} disabled={starting} data-testid="start">
          {starting ? "…" : "Start"} <small lang="ja">はじめる</small>
        </button>
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
        <div className="modal-buttons">
          <button className="secondary" onClick={() => director.toTitle()}>
            Title <small lang="ja">タイトル</small>
          </button>
          <button className="primary big" onClick={() => void director.startGame("practice")} data-testid="play-again">
            Play Again <small lang="ja">もういちど</small>
          </button>
        </div>
      </div>
    </div>
  );
}
