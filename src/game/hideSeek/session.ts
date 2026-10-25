import { create } from "zustand";
import { audio, type SfxName } from "../../audio/audio";
import { tts } from "../../audio/tts";
import { director } from "../director";
import { getGame } from "../store";
import type { GhostId } from "../types";
import { WORLD } from "../world/world";
import {
  abilityTargets, answerEnglish, beginEnglish, cancelMove, chooseStart, createMatch,
  reachableSpots, requestMove, step, takeEvents, useAbility
} from "./match";
import type { CommandResult, EnglishLevel, MatchState, PlayRoom } from "./types";
import { sentenceFor } from "./english";

export type PickMode = "start" | "move" | "ability" | null;
interface Session {
  match: MatchState | null;
  revision: number;
  pickMode: PickMode;
  subtitle: string;
  message: string;
  clue: { kind: string; until: number } | null;
  fx: { ghost: GhostId; targetSpotId?: string; until: number } | null;
  /** Presentation event: emitted only after a decoy was actually inspected. */
  decoyPop: { spotId: string; at: number } | null;
  lossReason: "found" | "caughtInOpen" | null;
}

/** The only live match owner. Views read it; commands and the render clock drive the core. */
export const useHideSeek = create<Session>(() => ({
  match: null, revision: 0, pickMode: null, subtitle: "", message: "", clue: null, fx: null, decoyPop: null, lossReason: null
}));
export const getHideSeek = useHideSeek.getState;
let timeScale = 1;
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
  "match-finished": "This round is finished. Let's play again!"
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
      case "won": audio.play("fanfare"); break;
      case "lost":
        useHideSeek.setState({ lossReason: event.reason });
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
  useHideSeek.setState({ match, pickMode: "start", subtitle: "", message: "Choose a spot to hide.", clue: null, fx: null, decoyPop: null, lossReason: null, revision: getHideSeek().revision + 1 });
  return { ok: true } as const;
}

export function leaveHideSeek() {
  tts.cancel();
  audio.setListening(false);
  useHideSeek.setState({ match: null, pickMode: null, subtitle: "", message: "", clue: null, fx: null, decoyPop: null, lossReason: null, revision: getHideSeek().revision + 1 });
  timeScale = 1;
  director.toTitle();
}

export function setPickMode(mode: PickMode): CommandResult {
  const match = getHideSeek().match;
  if (!match) return publish({ ok: false, reason: "not-playing" });
  if (match.english) return publish({ ok: false, reason: "english-open" });
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
    return result.ok ? command("beginEnglish") : result;
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
      const answeredSpot = match.english ? WORLD.spotById.get(match.english.spotId) : null;
      const alternatives = Array.isArray(args[0]) ? args[0].map(String) : args.map(String);
      result = answerEnglish(match, alternatives);
      if (result.ok) {
        audio.play("correct");
        useHideSeek.setState({ pickMode: null });
        successMessage = answeredSpot ? sentenceFor(answeredSpot) : "";
      }
      break;
    }
    case "cancelMove":
      result = cancelMove(match);
      if (result.ok) useHideSeek.setState({ pickMode: match.status === "setup" ? "start" : null });
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
  // Bound long background-tab gaps; software rendering still advances at the requested test pace.
  step(match, Math.min(Math.max(dt, 0), 0.5) * timeScale);
  drain();
  // Continue Melody's motif for the core effect's lifetime, on the same frozen clock.
  if (match.status === "playing" && !match.english && match.effects.music && match.time - lastMusic >= 1.8) {
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
  const { match, pickMode, lossReason, decoyPop } = getHideSeek();
  if (!match) return null;
  return JSON.parse(JSON.stringify({
    ...match, phase: match.detective.phase, englishOpen: Boolean(match.english),
    suspicion: match.detective.suspicion, pickMode, timeScale, lossReason, decoyPopSpotId: decoyPop?.spotId ?? null,
    spots: WORLD.spots.filter((spot) => spot.room === match.config.room),
    reachable: reachableSpots(match), targets: abilityTargets(match)
  })) as MatchState & {
    phase: string; englishOpen: boolean; suspicion: number; pickMode: PickMode; timeScale: number; lossReason: Session["lossReason"]; decoyPopSpotId: string | null;
    spots: typeof WORLD.spots; reachable: typeof WORLD.spots; targets: typeof WORLD.spots;
  };
}
