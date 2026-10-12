import { create } from "zustand";
import type { GhostId, Prep } from "./types";
import type { HuntState } from "./logic/hunt";

export type Screen = "title" | "game" | "results";
export type Mode = "practice" | "story" | "replay";

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
  | "micBlocked"
  | "exit";

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
}

const SETTINGS_KEY = "hh.settings.v1";
const REPLAY_KEY = "hh.replay.v1";

export const DEFAULT_SETTINGS: Settings = {
  mic: true,
  music: 0.5,
  sfx: 0.75,
  japanese: true,
  cameraSensitivity: 1,
  slowVoice: false
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

function loadReplay(): boolean {
  try {
    return localStorage.getItem(REPLAY_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function saveReplayUnlocked() {
  try {
    localStorage.setItem(REPLAY_KEY, "1");
  } catch {
    /* ignore */
  }
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
  screen: "title",
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
  replayUnlocked: loadReplay()
}));

export const setGame = useGame.setState;
export const getGame = useGame.getState;
