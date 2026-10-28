import { create } from "zustand";
import { audio, type SfxName } from "../../audio/audio";
import { tts } from "../../audio/tts";
import { director } from "../director";
import { getGame, setGame } from "../store";
import type { GhostId } from "../types";
import { WORLD } from "../world/world";
import {
  abilityTargets, answerEnglish, beginEnglish, cancelMove, chooseStart, createMatch,
  reachableSpots, requestMove, step, takeEvents, useAbility
} from "./match";
import type { CommandResult, EnglishLevel, MatchState, PlayRoom } from "./types";
import { sentenceFor } from "./english";
import { awarenessOf } from "./awareness";
import { recordVictory, type VictoryRecordResult } from "./records";

export type PickMode = "start" | "move" | "ability" | null;
export interface TimedDecision { phase: "decision" | "destination"; secondsLeft: number; searchNumber: number }
interface Session {
  match: MatchState | null;
  decision: TimedDecision | null;
  pendingDecision: boolean;
  revision: number;
  pickMode: PickMode;
  subtitle: string;
  message: string;
  clue: { kind: string; until: number } | null;
  fx: { ghost: GhostId; targetSpotId?: string; until: number } | null;
  /** Presentation event: emitted only after a decoy was actually inspected. */
  decoyPop: { spotId: string; at: number } | null;
  lossReason: "found" | "caughtInOpen" | null;
  /** performance.now() when the match ended: the closing camera shot plays before the results card. */
  endedAt: number | null;
  /** Persisted once on the actual victorious match event, not during results rendering. */
  recordResult: VictoryRecordResult | null;
}

/** The only live match owner. Views read it; commands and the render clock drive the core. */
export const useHideSeek = create<Session>(() => ({
  match: null, decision: null, pendingDecision: false, revision: 0, pickMode: null, subtitle: "", message: "", clue: null, fx: null, decoyPop: null, lossReason: null, endedAt: null, recordResult: null
}));
export const getHideSeek = useHideSeek.getState;
let timeScale = 1;
/** Written by the camera: a decision countdown never runs while the view is still moving. */
export const hsPresentation = { cameraSettling: false };
/** The closing shot (held first-person view, then the ghost) before Escaped!/Found!. */
export const RESULTS_DELAY_MS = 2600;
let subtitleUntil = 0;
let lastMusic = -100;

const FRIENDLY: Record<string, string> = {
  "not-playing": "Choose a hiding spot first.",
  "start-already-chosen": "Your hiding spot is already chosen.",
  "invalid-spot": "Choose one of the marked hiding spots.",
  "already-moving": "You're floating to your new spot. Wait until you arrive.",
  "no-relocations": "You've used your two moves. Keep hiding — you can still escape!",
  "one-move-per-search": "One move for each search. Wait for the detective's next search.",
  "inspection-locked": "The detective is looking here. Let's see what happens!",
  "english-open": "Tell us where you are first.",
  "unreachable-spot": "That spot is too far away. Choose a nearby marker.",
  "no-pending-move": "Choose your next hiding spot.",
  "no-english-panel": "You're ready to keep hiding!",
  "answer-not-accepted": "Try again. Think about where your ghost is.",
  "ability-used": "Your special ability helped once. Keep hiding!",
  "invalid-target": "Choose a marked spot for your distraction.",
  "match-finished": "This round is finished. Let's play again!",
  "decision-only": "Choose Stay or Move when the countdown appears."
};

function publish(result: CommandResult): CommandResult {
  const s = getHideSeek();
  useHideSeek.setState({ revision: s.revision + 1, message: result.ok ? "" : FRIENDLY[result.reason] ?? "Try a marked spot when you're ready." });
  return result;
}

export function speakModel(text: string) {
  const { settings } = getGame();
  tts.cancel();
  tts.setRate(settings.slowVoice ? 0.8 : 1);
  void tts.speak(text, { pitch: 1.05, volume: settings.sfx });
}

const ABILITY_SOUND: Record<GhostId, SfxName> = {
  sleepy: "snore", hungry: "munch", sneaky: "whoosh", mischief: "poof",
  bouncy: "boing", bubbles: "bubbles", melody: "musicbox", shadow: "blackout"
};

/** A new decision is a real simulation pause, never just an overlay. */
function beginDecision(match: MatchState) {
  if (match.status !== "playing" || match.searchesLeft <= 0) return;
  if (match.ghost.transit) {
    useHideSeek.setState({ pendingDecision: true });
    return;
  }
  if (match.relocationsLeft <= 0 || reachableSpots(match).length === 0) {
    useHideSeek.setState({
      decision: null, pendingDecision: false, pickMode: null,
      message: "No moves left. Stay hidden and watch the detective!"
    });
    return;
  }
  useHideSeek.setState({
    decision: { phase: "decision", secondsLeft: 5, searchNumber: match.stats.completedSearches + 1 },
    pendingDecision: false, pickMode: null, message: ""
  });
}

export function decideHideSeek(choice: "stay" | "move"): CommandResult {
  const s = getHideSeek();
  if (!s.match || s.decision?.phase !== "decision") return publish({ ok: false, reason: "decision-only" });
  if (choice === "move" && s.match.relocationsLeft > 0 && reachableSpots(s.match).length > 0) {
    useHideSeek.setState({
      decision: { phase: "destination", secondsLeft: 10, searchNumber: s.decision.searchNumber },
      pickMode: "move", message: "Choose a nearby hiding place before the timer ends."
    });
    return publish({ ok: true });
  }
  useHideSeek.setState({ decision: null, pickMode: null });
  return command("stay");
}

/** Timed selection expired or was cancelled: the ghost stays; no move is spent. */
export function stayHere(): CommandResult {
  const s = getHideSeek();
  if (!s.match || s.decision?.phase !== "destination") return publish({ ok: false, reason: "decision-only" });
  useHideSeek.setState({ decision: null, pickMode: null });
  return command("stay");
}

function drain() {
  const s = getHideSeek();
  if (!s.match) return;
  const match = s.match;
  for (const event of takeEvents(match)) {
    switch (event.type) {
      case "announce":
      case "searchEmpty":
      case "found":
        useHideSeek.setState({ subtitle: event.line });
        subtitleUntil = performance.now() + 6500;
        speakModel(event.line);
        if (event.type === "searchEmpty") {
          beginDecision(match);
          audio.play(event.decoy ? "pop" : "rustle");
          if (event.decoy) useHideSeek.setState({ decoyPop: { spotId: event.spotId, at: match.time } });
        }
        break;
      case "searchStart": audio.play("flashlight"); break;
      case "clue":
        useHideSeek.setState({ clue: { kind: event.clue.kind, until: match.time + 2 } });
        break;
      case "abilityFx":
        useHideSeek.setState({ fx: event.active
          ? { ghost: event.ghost, targetSpotId: event.targetSpotId, until: match.time + 4 }
          : null });
        if (event.active) {
          audio.play(ABILITY_SOUND[event.ghost]);
          if (event.ghost === "melody") lastMusic = match.time;
        }
        else if (event.ghost === "mischief") audio.play("pop");
        break;
      case "won":
        useHideSeek.setState({ endedAt: performance.now(), recordResult: recordVictory(match) });
        audio.play("fanfare");
        break;
      case "lost":
        useHideSeek.setState({ lossReason: event.reason, endedAt: performance.now() });
        audio.play("poof", { pitch: 1.2 });
        audio.play("giggle", { pitch: 0.85 });
        break;
    }
  }
}

export function startHideSeek(ghost: GhostId, room: PlayRoom, seed = Date.now() >>> 0, level: EnglishLevel = getGame().settings.englishLevel) {
  const match = createMatch({ ghost, room, seed, level });
  tts.cancel();
  audio.unlock();
  audio.setVolumes(getGame().settings.music, getGame().settings.sfx);
  timeScale = 1;
  subtitleUntil = 0;
  lastMusic = -100;
  hsPresentation.cameraSettling = false;
  useHideSeek.setState({ match, decision: null, pendingDecision: false, pickMode: "start", subtitle: "", message: "Choose a spot to hide.", clue: null, fx: null, decoyPop: null, lossReason: null, endedAt: null, recordResult: null, revision: getHideSeek().revision + 1 });
  return { ok: true } as const;
}

export function leaveHideSeek() {
  tts.cancel();
  audio.setListening(false);
  audio.setHeartbeat(0);
  hsPresentation.cameraSettling = false;
  useHideSeek.setState({ match: null, decision: null, pendingDecision: false, pickMode: null, subtitle: "", message: "", clue: null, fx: null, decoyPop: null, lossReason: null, endedAt: null, recordResult: null, revision: getHideSeek().revision + 1 });
  timeScale = 1;
  director.toTitle();
}

/** Leave the match for the title screen (the HUD's Settings → Main Menu, or the results card). */
export function exitHideSeek() {
  leaveHideSeek();
  setGame({ screen: "title", hideSeekLink: null, settingsOpen: false });
}

export function setPickMode(mode: PickMode): CommandResult {
  const match = getHideSeek().match;
  if (!match) return publish({ ok: false, reason: "not-playing" });
  if (match.english) return publish({ ok: false, reason: "english-open" });
  if (mode === "move" && getHideSeek().decision?.phase === "decision") return decideHideSeek("move");
  if (mode === "move" && getHideSeek().decision?.phase !== "destination") {
    return publish({ ok: false, reason: "decision-only" });
  }
  if (mode === null && getHideSeek().decision?.phase === "destination") return stayHere();
  if (mode === "move" && !reachableSpots(match).length) {
    return publish(requestMove(match, match.ghost.spotId ?? ""));
  }
  if (mode === "ability" && !abilityTargets(match).length) return publish(useAbility(match));
  useHideSeek.setState({ pickMode: mode });
  return publish({ ok: true });
}

export function pickSpot(spotId: string): CommandResult {
  const { match, pickMode } = getHideSeek();
  if (!match) return publish({ ok: false, reason: "not-playing" });
  if (pickMode === "start") return command("chooseStart", spotId);
  if (pickMode === "ability") return command("useAbility", spotId);
  if (pickMode === "move") {
    const result = command("requestMove", spotId);
    if (!result.ok) return result;
    const englishResult = command("beginEnglish");
    if (englishResult.ok && getHideSeek().decision?.phase === "destination") {
      useHideSeek.setState({ decision: null, pickMode: null });
    }
    return englishResult;
  }
  return publish({ ok: false, reason: "no-pending-move" });
}

/** Names mirror the simulation API; only presentation modes are added here. */
export function command(name: string, ...args: unknown[]): CommandResult {
  const match = getHideSeek().match;
  if (!match) return publish({ ok: false, reason: "not-playing" });
  let result: CommandResult;
  let successMessage = "";
  switch (name) {
    case "chooseStart": result = chooseStart(match, String(args[0])); break;
    case "requestMove": result = requestMove(match, String(args[0])); break;
    case "beginEnglish": result = beginEnglish(match); break;
    case "answerEnglish": {
      const wasStarting = Boolean(match.english?.starting);
      const answeredSpot = match.english ? WORLD.spotById.get(match.english.spotId) : null;
      const alternatives = Array.isArray(args[0]) ? args[0].map(String) : args.map(String);
      result = answerEnglish(match, alternatives);
      if (result.ok) {
        audio.play("correct");
        useHideSeek.setState({ pickMode: null });
        successMessage = answeredSpot ? sentenceFor(answeredSpot) : "";
        if (wasStarting) beginDecision(match);
      }
      break;
    }
    case "cancelMove":
      result = cancelMove(match);
      if (result.ok) {
        if (getHideSeek().decision?.phase === "destination") useHideSeek.setState({ decision: null });
        useHideSeek.setState({ pickMode: match.status === "setup" ? "start" : null });
      }
      break;
    case "useAbility":
      result = useAbility(match, args[0] === undefined ? undefined : String(args[0]));
      if (result.ok) useHideSeek.setState({ pickMode: null });
      break;
    case "stay":
      result = match.english ? { ok: false, reason: "english-open" } : { ok: true };
      if (result.ok) {
        useHideSeek.setState({ pickMode: null });
        successMessage = "Keep quiet and watch the detective!";
      }
      break;
    default: result = { ok: false, reason: "unknown-command" };
  }
  drain();
  publish(result);
  if (successMessage) useHideSeek.setState({ message: successMessage });
  return result;
}

export function tickHideSeek(dt: number) {
  const { match } = getHideSeek();
  if (!match || getGame().screen !== "hideseek" || getGame().settingsOpen) return;
  // A background tab must never secretly consume the student's decision timer.
  if (typeof document !== "undefined" && document.hidden) return;
  // Fixed-size steps let us stop the simulation at exactly the next completed search.
  // This also allows accelerated e2e playback to pass through several decision cycles.
  let budget = Math.min(Math.max(dt, 0), 0.5) * timeScale;
  let iterations = 0;
  while (budget > 1e-8 && iterations++ < 2000) {
    const prompt = getHideSeek().decision;
    if (prompt) {
      if (hsPresentation.cameraSettling) break;
      const spent = Math.min(budget, prompt.secondsLeft);
      budget -= spent;
      const remaining = Math.max(0, prompt.secondsLeft - spent);
      if (remaining <= 1e-8) {
        if (prompt.phase === "decision") decideHideSeek("stay");
        else stayHere();
      } else {
        useHideSeek.setState({ decision: { ...prompt, secondsLeft: remaining } });
        break;
      }
      continue;
    }
    if (match.status !== "playing" || match.english) break;
    const slice = Math.min(0.05, budget);
    step(match, slice);
    budget -= slice;
    drain();
    if (getHideSeek().pendingDecision && !match.ghost.transit) beginDecision(match);
  }
  // Melody's music is tied to simulation time and does not continue while paused.
  if (match.status === "playing" && !match.english && !getHideSeek().decision &&
    match.effects.music && match.time - lastMusic >= 1.8) {
    audio.play("musicbox");
    lastMusic = match.time;
  }
  const s = getHideSeek();
  useHideSeek.setState({
    revision: s.revision + 1,
    ...(s.subtitle && performance.now() > subtitleUntil ? { subtitle: "" } : {})
  });
}

export function setHideSeekTimeScale(scale: number) {
  if (!Number.isFinite(scale) || scale < 0 || scale > 100) throw new Error("Hide & Seek time scale must be between 0 and 100");
  timeScale = scale;
}

/** Read-only, detached semantic state for e2e/acceptance; no mutable simulation references. */
export function hideSeekSnapshot() {
  const { match, pickMode, decision, pendingDecision, lossReason, decoyPop } = getHideSeek();
  if (!match) return null;
  return JSON.parse(JSON.stringify({
    ...match, phase: match.detective.phase, englishOpen: Boolean(match.english),
    suspicion: match.detective.suspicion, awareness: awarenessOf(match).state, pickMode, decision, pendingDecision, timeScale, lossReason, decoyPopSpotId: decoyPop?.spotId ?? null,
    spots: WORLD.spots.filter((spot) => spot.room === match.config.room),
    reachable: reachableSpots(match), targets: abilityTargets(match)
  })) as MatchState & {
    phase: string; englishOpen: boolean; suspicion: number; awareness: ReturnType<typeof awarenessOf>["state"]; pickMode: PickMode; decision: TimedDecision | null; pendingDecision: boolean; timeScale: number; lossReason: Session["lossReason"]; decoyPopSpotId: string | null;
    spots: typeof WORLD.spots; reachable: typeof WORLD.spots; targets: typeof WORLD.spots;
  };
}
