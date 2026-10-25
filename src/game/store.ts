import { create } from "zustand";
import type { GhostId, Prep, RoomId } from "./types";
import type { HuntState } from "./logic/hunt";
import type { Scope } from "./logic/plans";

export type { Scope };

export type Screen = "title" | "game" | "results" | "hideseek";
export type Mode = "practice" | "story" | "replay";

export interface HideSeekLink {
  ghost?: GhostId;
  room?: RoomId;
  seed?: number;
}

function loadHideSeekLink(): HideSeekLink | null {
  if (typeof location === "undefined") return null;
  const params = new URLSearchParams(location.search);
  if (params.get("mode") !== "hideseek") return null;
  const ghosts: Record<GhostId, true> = { sleepy: true, hungry: true, sneaky: true, mischief: true, bouncy: true, bubbles: true, melody: true, shadow: true };
  const rooms: Record<RoomId, true> = { lobby: true, bedroom: true, dining: true, storage: true, library: true, landing: true, playroom: true, bathroom: true, music: true, attic: true };
  const ghost = params.get("ghost");
  const room = params.get("room");
  const seed = params.get("seed");
  return {
    ...(ghost && Object.hasOwn(ghosts, ghost) ? { ghost: ghost as GhostId } : {}),
    ...(room && Object.hasOwn(rooms, room) ? { room: room as RoomId } : {}),
    ...(seed && /^-?\d+$/.test(seed) && Number.isSafeInteger(Number(seed)) ? { seed: Number(seed) } : {})
  };
}

const HIDE_SEEK_LINK = loadHideSeekLink();

/**
 * explore: walking around.  search: close-up of one object, choosing a spot.
 * answer: the ghost is found, the student says where it is.
 * busy: a scripted moment is playing (search animation, capture, escape, dialogue).
 */
export type Phase = "intro" | "explore" | "search" | "answer" | "busy" | "outro";

export interface Settings {
  /** Speak answers into the microphone (teacher can switch to buttons). */
  mic: boolean;
  music: number;
  sfx: number;
  /** Japanese instruction hints. */
  japanese: boolean;
  cameraSensitivity: number;
  slowVoice: boolean;
  englishLevel: "beginner" | "standard" | "advanced";
}

export type MicState = "unknown" | "ready" | "blocked" | "unsupported";

export interface AnswerUi {
  /** The spot being answered about (the hunt may already have moved on after a correct answer). */
  spotId: string | null;
  listening: boolean;
  /** Live transcript while listening. */
  heard: string;
  status: "idle" | "listening" | "wrong" | "none" | "correct";
  /** Failed spoken attempts (wrong, unclear or nothing heard). Three opens the word buttons. */
  misses: number;
  /** Word buttons are tappable (mic-free mode or rescue). */
  buttons: boolean;
  disabled: Prep[];
  filled: Prep | null;
  wrongWord: Prep | null;
}

export interface Caption {
  id: number;
  /** Text with the preposition marked: "No ghost [under] the bed." */
  text: string;
  tone: "empty" | "info" | "good";
}

export interface Line {
  id: number;
  en: string;
  ja?: string;
  speaker: "boo" | "ghost";
  /** Waits for the student to press Next. */
  wait?: boolean;
}

export type HintId =
  | "move"
  | "search"
  | "choose"
  | "speak"
  | "buttons"
  | "goDoor"
  | "locked"
  | "cantGo"
  | "micBlocked"
  | "exit"
  | "goStairs"
  | "fan";

/** The full-screen chapter title ("CHAPTER 2 — UPSTAIRS"). */
export interface ChapterCard {
  key: number;
  title: string;
  sub: string;
  ja: string;
}

export interface GameState {
  screen: Screen;
  mode: Mode;
  phase: Phase;
  hunt: HuntState | null;
  settings: Settings;
  micState: MicState;
  clueShown: boolean;
  /** Boo is reading the clue aloud right now (the clue card pulses). */
  clueSpeaking: boolean;
  helpLevel: number;
  line: Line | null;
  /** Standing hint for the current situation (go to the open door, walk out...). */
  hint: HintId | null;
  /** A short message on top of it (locked door, microphone blocked); it expires by itself. */
  toast: { id: HintId; key: number } | null;
  /** Last toast shown (kept for tests). */
  lastToast: HintId | null;
  caption: Caption | null;
  focusId: string | null;
  searchId: string | null;
  selectedSpot: string | null;
  revealed: { spotId: string; ghost: GhostId } | null;
  answer: AnswerUi;
  lantern: GhostId[];
  settingsOpen: boolean;
  touch: boolean;
  fade: number;
  replayUnlocked: boolean;
  /** Which part of the hotel this game covers. */
  scope: Scope;
  /** The chapter being played (the HUD shows only this chapter's ghosts until Chapter 2 opens). */
  chapter: 1 | 2;
  /** Chapter 2 on its own is offered once Chapter 1 has been finished on this device. */
  ch2Unlocked: boolean;
  hideSeekUnlocked: boolean;
  hideSeekLink: HideSeekLink | null;
  chapterCard: ChapterCard | null;
  /** performance.now() when the hunt started and when the last ghost was caught. */
  startedAt: number | null;
  finishedAt: number | null;
}

const SETTINGS_KEY = "hh.settings.v1";
const REPLAY_KEY = "hh.replay.v1";

export const DEFAULT_SETTINGS: Settings = {
  mic: true,
  music: 0.5,
  sfx: 0.75,
  japanese: true,
  cameraSensitivity: 1,
  slowVoice: false,
  englishLevel: "standard"
};

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    /* storage blocked on some managed devices */
  }
  return { ...DEFAULT_SETTINGS };
}

const CH2_KEY = "hh.ch2.v1";
const HIDE_SEEK_KEY = "hh.hideseek.v1";

function loadFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function saveFlag(key: string) {
  try {
    localStorage.setItem(key, "1");
  } catch {
    /* ignore */
  }
}

/** Chapter 1 has been finished on this device: Chapter 2 can be played on its own. */
export function saveCh2Unlocked() {
  saveFlag(CH2_KEY);
  saveFlag(HIDE_SEEK_KEY);
  setGame({ hideSeekUnlocked: true });
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function saveReplayUnlocked() {
  saveFlag(REPLAY_KEY);
}

export const EMPTY_ANSWER: AnswerUi = {
  spotId: null,
  listening: false,
  heard: "",
  status: "idle",
  misses: 0,
  buttons: false,
  disabled: [],
  filled: null,
  wrongWord: null
};

export const useGame = create<GameState>(() => ({
  screen: HIDE_SEEK_LINK ? "hideseek" : "title",
  mode: "practice",
  phase: "intro",
  hunt: null,
  settings: loadSettings(),
  micState: "unknown",
  clueShown: false,
  clueSpeaking: false,
  helpLevel: 0,
  line: null,
  hint: null,
  toast: null,
  lastToast: null,
  caption: null,
  focusId: null,
  searchId: null,
  selectedSpot: null,
  revealed: null,
  answer: EMPTY_ANSWER,
  lantern: [],
  settingsOpen: false,
  touch: false,
  fade: 0,
  replayUnlocked: loadFlag(REPLAY_KEY),
  scope: "all",
  chapter: 1,
  ch2Unlocked: loadFlag(CH2_KEY),
  hideSeekUnlocked: loadFlag(HIDE_SEEK_KEY) || loadFlag(CH2_KEY),
  hideSeekLink: HIDE_SEEK_LINK,
  chapterCard: null,
  startedAt: null,
  finishedAt: null
}));

export const setGame = useGame.setState;
export const getGame = useGame.getState;

/**
 * The ghosts the HUD and the lobby board show. In the full adventure the
 * four upstairs ghosts stay a surprise until Chapter 2 opens.
 */
export function visibleGhosts(g: Pick<GameState, "hunt" | "scope" | "chapter" | "mode">): GhostId[] {
  if (!g.hunt) return [];
  const all = g.hunt.encounters.map((e) => e.ghost);
  if (g.mode !== "practice" && g.scope === "all" && g.chapter === 1) return all.slice(0, 4);
  return all;
}
