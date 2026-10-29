import type { GhostId, RoomId, Vec3 } from "../types";
import type { HidingSpot } from "../world/world";
import type { PerceptionTimers } from "./perception";

/** Rooms a Hide & Seek match can be played in: never the lobby, the landing or the guest corridor. */
export type PlayRoom = Exclude<RoomId, "lobby" | "landing" | "guesthall">;
export type EnglishLevel = "beginner" | "standard" | "advanced";
export interface Point { x: number; z: number }
export interface MatchConfig { ghost: GhostId; room: PlayRoom; seed: number; level: EnglishLevel }
export type ClueKind = "sound" | "glimpse" | "creak" | "munch" | "decoy" | "music" | "bubbles";
export interface ClueInput extends Point { kind: ClueKind; strength: number }
export interface Clue extends ClueInput { id: number; time: number }
export type DetectivePhase = "observe" | "choose" | "approach" | "search" | "react" | "continue" | "finish" | "investigate-clue";
export interface DetectiveState extends Point {
  yaw: number;
  anim: "walk" | "think" | "inspect" | "react" | "celebrate";
  phase: DetectivePhase;
  elapsed: number;
  target: string | null;
  path: Point[];
  searched: Record<string, number>;
  priorities: Record<string, number>;
  suspicion: number;
  clues: Clue[];
  lastEvidence: number;
  focusClue: number;
  handledClue: number;
  rng: number;
}
/** Deliberately no ghost, occupied spot, movement, or truth-bearing state. */
export interface DetectiveView {
  spots: readonly HidingSpot[];
  detective: DetectiveState;
  time: number;
}
export interface GhostPose extends Vec3 {
  spotId: string | null;
  destination: string | null;
  transit: boolean;
  hidden: boolean;
  path: Vec3[];
  speed: number;
  silent: boolean;
  invisible: boolean;
  loudness: number;
}
export interface Effects {
  sleepySearch: number | null;
  nextMove: "silent" | "bounce" | "invisible" | null;
  decoy: { spotId: string; x: number; z: number } | null;
  bubbles: { x: number; z: number; radius: number; remaining: number }[];
  music: { x: number; z: number; remaining: number } | null;
}
export interface EnglishPanel { spotId: string; starting: boolean; attempts: number }
export interface MatchStats {
  completedSearches: number;
  relocations: number;
  questions: number;
  acceptedAnswers: number;
  firstTryAnswers: number;
  wrongAnswers: number;
  firstTryAccuracy: number;
  clues: number;
  elapsed: number;
}
export type MatchEvent =
  | { type: "announce"; spotId: string; line: string; highlight: boolean }
  | { type: "detectivePath"; spotId: string; path: Point[] }
  | { type: "detectiveArrive" | "searchStart"; spotId: string }
  | { type: "searchEmpty"; spotId: string; line: string; decoy: boolean }
  | { type: "found"; spotId: string; line: string }
  | { type: "caughtInOpen"; x: number; z: number }
  | { type: "clue"; clue: Clue }
  | { type: "abilityFx"; ghost: GhostId; active: boolean; targetSpotId?: string }
  | { type: "won"; stats: MatchStats }
  | { type: "lost"; reason: "found" | "caughtInOpen"; stats: MatchStats };
export interface MatchState {
  config: MatchConfig;
  status: "setup" | "playing" | "won" | "lost";
  time: number;
  /** Fractional time retained for a deterministic 50 ms simulation tick. */
  remainder: number;
  rng: number;
  clueId: number;
  detective: DetectiveState;
  ghost: GhostPose;
  english: EnglishPanel | null;
  pendingMove: string | null;
  searchesLeft: number;
  relocationsLeft: number;
  movedThisSearch: boolean;
  abilityUsed: boolean;
  effects: Effects;
  perception: PerceptionTimers;
  /** Time the detective last had the ghost in plain sight. Presentation only: never in DetectiveView. */
  seenAt: number;
  stats: MatchStats;
  events: MatchEvent[];
}
export type CommandResult = { ok: true } | { ok: false; reason: string };
