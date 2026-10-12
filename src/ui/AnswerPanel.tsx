import { useGame } from "../game/store";
import { director } from "../game/director";
import { currentSpot } from "../game/logic/hunt";
import { answerFrame, QUESTION } from "../game/logic/clues";
import { PREPS } from "../game/types";
import { WORLD } from "../game/world/world";
import { recognition } from "../audio/recognition";
import { HINT } from "./i18n";

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true">
      <rect x="8" y="2.5" width="8" height="12" rx="4" fill="currentColor" />
      <path d="M5 11.5a7 7 0 0 0 14 0M12 18.5v3M8.5 21.5h7" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/**
 * One panel, read top to bottom: the question, the sentence frame with a
 * blank, then the way to answer. The four words are always visible (a child
 * cannot say a word they have not seen); they are only tappable in mic-free
 * mode or after three missed spoken tries.
 */
export function AnswerPanel() {
  const phase = useGame((s) => s.phase);
  const answer = useGame((s) => s.answer);
  const hunt = useGame((s) => s.hunt);
  const revealed = useGame((s) => s.revealed);
  const settings = useGame((s) => s.settings);
  const micState = useGame((s) => s.micState);
  const touch = useGame((s) => s.touch);
  const showing = phase === "answer" || (answer.status === "correct" && revealed !== null);
  const spot = answer.spotId ? WORLD.spotById.get(answer.spotId) : hunt ? currentSpot(hunt) : null;
  if (!showing || !spot) return null;
  const frame = answerFrame(spot);
  const micOn = settings.mic && recognition.supported && micState !== "blocked" && micState !== "unsupported";
  const ja = settings.japanese;

  let status: { en: string; ja: string } = touch ? HINT.speakTouch : HINT.speakKeys;
  if (!micOn) status = HINT.buttons;
  else if (answer.listening) status = HINT.listening;
  else if (answer.status === "wrong") status = HINT.wrong;
  else if (answer.status === "none") status = HINT.noHear;
  else if (answer.buttons) status = HINT.rescue;

  const blank = answer.filled ?? (answer.status === "wrong" && answer.wrongWord ? answer.wrongWord : "");

  return (
    <div className={`answer-panel ${answer.status}`} data-testid="answer-panel">
      <div className="question" data-testid="question">
        {QUESTION}
      </div>
      <div className="frame" data-testid="frame">
        {frame.before}{" "}
        <span className={`blank ${answer.filled ? "filled" : answer.status === "wrong" ? "wrong" : ""}`} data-testid="blank">
          {blank || " "}
        </span>{" "}
        {frame.after}
      </div>
      <div className="answer-row">
        {micOn && answer.status !== "correct" && (
          <button
            className={`mic-button ${answer.listening ? "listening" : ""}`}
            onClick={() => director.mic()}
            data-testid="mic"
            aria-label="Speak"
          >
            <MicIcon />
            {!touch && <span className="key-cap">SPACE</span>}
          </button>
        )}
        <div className="words" role="group" aria-label="in, on, under, by">
          {PREPS.map((p, i) => {
            const tappable = answer.buttons && !answer.disabled.includes(p) && answer.status !== "correct";
            return (
              <button
                key={p}
                className={`word ${answer.buttons ? "tap" : "inert"} ${answer.disabled.includes(p) ? "used" : ""} ${answer.filled === p ? "right" : ""}`}
                disabled={!tappable}
                onClick={() => director.answerButton(p)}
                data-testid={`word-${p}`}
              >
                {p.toUpperCase()}
                {answer.buttons && !touch && <small>{i + 1}</small>}
              </button>
            );
          })}
        </div>
      </div>
      {answer.status !== "correct" && (
        <div className="status-line" data-testid="answer-status">
          {ja ? <span lang="ja">{status.ja}</span> : status.en}
          {answer.listening && answer.heard && <span className="heard">“{answer.heard}”</span>}
        </div>
      )}
    </div>
  );
}
