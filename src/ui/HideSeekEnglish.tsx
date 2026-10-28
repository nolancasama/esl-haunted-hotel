import { useEffect, useRef, useState } from "react";
import { HARD_ERRORS, recognition } from "../audio/recognition";
import { audio } from "../audio/audio";
import { tts } from "../audio/tts";
import { useGame } from "../game/store";
import { PREPS } from "../game/types";
import { WORLD } from "../game/world/world";
import { sentenceFor, type MatchState } from "../game/hideSeek";
import { backFromHideSeekEnglish, command, speakModel } from "../game/hideSeek/session";

/** English is a view of the core's pending question; only the core grades it. */
export function HideSeekEnglish({ match }: { match: MatchState }) {
  const settings = useGame((s) => s.settings);
  const micState = useGame((s) => s.micState);
  const [listening, setListening] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [hint, setHint] = useState("");
  const [heard, setHeard] = useState("");
  const [words, setWords] = useState<string[]>([]);
  const cancel = useRef<(() => void) | null>(null);
  const panel = match.english!;
  const spot = WORLD.spotById.get(panel.spotId)!;
  const level = match.config.level;
  const mic = settings.mic && recognition.supported && !blocked && micState !== "blocked" && micState !== "unsupported";
  const ja = settings.japanese;

  useEffect(() => {
    // Let the room camera approach the ghost before the detective asks.
    // The question has no countdown; reduced-motion users hear it immediately.
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const id = window.setTimeout(() => {
      speakModel(level === "beginner" ? `Where are you? ${sentenceFor(spot)}` : "Where are you?");
    }, reduce ? 0 : 530);
    return () => { window.clearTimeout(id); cancel.current?.(); audio.setListening(false); };
  }, [level, spot]);

  const submit = (alternatives: string[]) => {
    const result = command("answerEnglish", alternatives);
    audio.setListening(false);
    if (result.ok) {
      if (level === "beginner") speakModel(sentenceFor(spot));
    } else {
      setHint("Try another place word. Look at your hiding place.");
      setWords([]);
    }
  };
  const listen = () => {
    cancel.current?.();
    tts.cancel();
    audio.setListening(true);
    setHeard("");
    setListening(true);
    let answered = false;
    cancel.current = recognition.listen({
      onResult(alternatives, final) {
        setHeard(alternatives[0] ?? "");
        if (final && !answered) { answered = true; submit(alternatives); }
      },
      onError(error) {
        audio.setListening(false);
        if (HARD_ERRORS.has(error)) { setBlocked(true); setHint("Let’s use the word tiles."); }
        else setHint("Try again, or use the word tiles.");
      },
      onEnd() {
        audio.setListening(false);
        setListening(false);
        if (!answered) setHint("Try speaking again, or use the word tiles.");
      }
    });
  };

  return (
    <section className={`answer-panel panel hs-english ui ${hint ? "wrong" : ""}`} data-testid="hs-english" data-level={level}>
      <div className="question">Where are you?</div>
      {ja && <span className="ja" lang="ja">どこに いるの？</span>}
      {level === "standard" && <div className="frame hs-frame" data-testid="hs-frame">I’m <span className="blank">___</span> the {spot.noun}.</div>}
      {level === "beginner" && <p className="hs-english-instruction">Listen, then choose the place word.</p>}
      {level === "advanced" && <><p className="hs-english-instruction">Say it, or build your sentence.</p><div className="hs-built-sentence" data-testid="hs-built-sentence" aria-live="polite">{words.length ? `${words.join(" ")}.` : "Choose your words…"}</div></>}
      {mic && <button className={`mic-button hs-mic ${listening ? "listening" : ""}`} aria-label="Speak your answer" data-testid="hs-mic" onClick={listen} disabled={listening}><svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><rect x="8" y="2" width="8" height="13" rx="4" fill="currentColor" /><path d="M5 11a7 7 0 0 0 14 0M12 18v4M8 22h8" stroke="currentColor" strokeWidth="2" fill="none" /></svg><span>{listening ? "Listening…" : "Speak"}</span></button>}
      <div className={`words hs-english-words ${level === "advanced" ? "hs-builder" : ""}`} role="group" aria-label="Answer word tiles">
        {level === "advanced" && <button className="word tap" onClick={() => setWords((v) => [...v, "I am"])}>I am</button>}
        {PREPS.map((prep) => <button className="word tap" key={prep} data-testid={`hs-word-${prep}`} onClick={() => level === "advanced" ? setWords((v) => [...v, prep]) : submit([prep])}>{prep}</button>)}
        {level === "advanced" && <><button className="word tap" onClick={() => setWords((v) => [...v, "the"])}>the</button><button className="word tap hs-noun-tile" onClick={() => setWords((v) => [...v, spot.noun])}>{spot.noun}</button></>}
      </div>
      {level === "advanced" && <div className="hs-english-tools"><button className="secondary" onClick={() => setWords([])}>Clear</button><button className="primary" data-testid="hs-check-sentence" disabled={!words.length} onClick={() => submit([words.join(" ")])}>Check</button></div>}
      <div className="status-line hs-english-status" role="status" data-testid="hs-english-status">{hint || (listening ? "I’m listening…" : "The detective waits while you answer.")}{heard && <span className="heard">“{heard}”</span>}</div>
      {panel.attempts > 0 && <button className="secondary hs-hear-model" data-testid="hs-hear-model" onClick={() => speakModel(sentenceFor(spot))}>Hear model</button>}
      <button type="button" className="secondary hs-cancel-answer" data-testid="hs-cancel-answer" onClick={backFromHideSeekEnglish}>Back</button>
    </section>
  );
}
