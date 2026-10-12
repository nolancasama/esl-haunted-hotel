import { PREPS, type GhostId, type Prep, type RoomId } from "../types";
import { getSpot, spotsInRoom, type HidingSpot, type World, WORLD } from "../world/world";
import type { Rng } from "./rng";

/**
 * The hunt is a pure state machine. The director animates it; tests drive it
 * directly. Invariants it guarantees:
 *  - the clue is always derived from `spotId`, so text, voice and the spot the
 *    search actually checks cannot drift apart;
 *  - a ghost only moves right after an empty search or a correct answer
 *    (a signalled escape), never while it is found and being answered;
 *  - every encounter ends: relocations are capped, answers always converge.
 */

export interface Encounter {
  ghost: GhostId;
  room: RoomId;
  /** Starting hiding spot id. */
  start: string;
  /** Correct answers needed to capture (Mischief: 4, one per preposition). */
  rounds: number;
  /** Empty searches on one clue before the ghost slips away (null = never). */
  relocateAfter: number | null;
  /** Relocations allowed per round. */
  maxRelocations: number;
  /** Scripted spots for rounds 2+ (story mode). Missing entries are chosen randomly. */
  roundSpots?: string[];
}

export type HuntStatus = "hunting" | "found" | "done";

export interface Stats {
  correctAnswers: number;
  firstTryAnswers: number;
  wrongAnswers: number;
  wrongSearches: number;
  relocations: number;
}

export interface AnswerRecord {
  ghost: GhostId;
  spotId: string;
  prep: Prep;
  noun: string;
  firstTry: boolean;
}

export interface HuntState {
  encounters: Encounter[];
  index: number;
  spotId: string;
  round: number;
  /** Prepositions already answered for the current ghost. */
  usedPreps: Prep[];
  /** Changes whenever the clue changes (new ghost, relocation, next round). */
  clueId: number;
  wrongSearchesThisClue: number;
  relocationsThisRound: number;
  searchedThisClue: string[];
  answerMisses: number;
  status: HuntStatus;
  stats: Stats;
  answers: AnswerRecord[];
  captured: GhostId[];
}

export function createHunt(encounters: Encounter[], world: World = WORLD): HuntState {
  if (encounters.length === 0) throw new Error("no encounters");
  for (const e of encounters) {
    const spot = getSpot(e.start, world);
    if (spot.room !== e.room) throw new Error(`${e.start} is not in ${e.room}`);
  }
  return {
    encounters,
    index: 0,
    spotId: encounters[0].start,
    round: 0,
    usedPreps: [],
    clueId: 1,
    wrongSearchesThisClue: 0,
    relocationsThisRound: 0,
    searchedThisClue: [],
    answerMisses: 0,
    status: "hunting",
    stats: { correctAnswers: 0, firstTryAnswers: 0, wrongAnswers: 0, wrongSearches: 0, relocations: 0 },
    answers: [],
    captured: []
  };
}

export function currentEncounter(s: HuntState): Encounter {
  return s.encounters[Math.min(s.index, s.encounters.length - 1)];
}

export function currentSpot(s: HuntState, world: World = WORLD): HidingSpot {
  return getSpot(s.spotId, world);
}

/**
 * Choose where a ghost goes next. Preference: a different preposition on a
 * different object, then a different preposition, then a different object.
 * Only spots with an `allowed` preposition qualify; when there is none the
 * ghost stays where it is (`current` is returned) - a multi-round ghost must
 * never drift back to a preposition the student has already answered.
 */
export function chooseSpot(
  candidates: readonly HidingSpot[],
  current: HidingSpot | null,
  allowed: readonly Prep[],
  rng: Rng
): HidingSpot {
  const allowedOthers = candidates.filter((c) => c.id !== current?.id && allowed.includes(c.prep));
  const tiers: HidingSpot[][] = [
    allowedOthers.filter((c) => c.prep !== current?.prep && c.objectId !== current?.objectId),
    allowedOthers.filter((c) => c.prep !== current?.prep),
    allowedOthers.filter((c) => c.objectId !== current?.objectId),
    allowedOthers
  ];
  for (const tier of tiers) {
    if (tier.length) return tier[Math.floor(rng() * tier.length) % tier.length];
  }
  if (current) return current;
  throw new Error("no hiding spots to choose from");
}

function resetClue(s: HuntState): HuntState {
  return { ...s, clueId: s.clueId + 1, wrongSearchesThisClue: 0, searchedThisClue: [], answerMisses: 0 };
}

export type SearchResult =
  | { kind: "found"; spot: HidingSpot }
  | { kind: "empty"; spot: HidingSpot; relocatedTo: string | null }
  /** A spot in a room the current ghost is not in (e.g. a cleared room): just a fun look. */
  | { kind: "elsewhere"; spot: HidingSpot }
  | { kind: "ignored" };

export function searchSpot(
  s: HuntState,
  spotId: string,
  rng: Rng,
  world: World = WORLD
): { state: HuntState; result: SearchResult } {
  if (s.status !== "hunting") return { state: s, result: { kind: "ignored" } };
  const spot = getSpot(spotId, world);
  const enc = currentEncounter(s);
  if (spot.room !== enc.room) return { state: s, result: { kind: "elsewhere", spot } };
  if (spotId === s.spotId) {
    return { state: { ...s, status: "found", answerMisses: 0 }, result: { kind: "found", spot } };
  }

  let next: HuntState = {
    ...s,
    wrongSearchesThisClue: s.wrongSearchesThisClue + 1,
    searchedThisClue: [...s.searchedThisClue, spotId],
    stats: { ...s.stats, wrongSearches: s.stats.wrongSearches + 1 }
  };
  let relocatedTo: string | null = null;
  if (
    enc.relocateAfter !== null &&
    next.wrongSearchesThisClue >= enc.relocateAfter &&
    next.relocationsThisRound < enc.maxRelocations
  ) {
    const allowed = PREPS.filter((p) => !next.usedPreps.includes(p));
    const target = chooseSpot(spotsInRoom(enc.room, world), currentSpot(next, world), allowed, rng);
    if (target.id !== next.spotId) {
      relocatedTo = target.id;
      next = resetClue({
        ...next,
        spotId: target.id,
        relocationsThisRound: next.relocationsThisRound + 1,
        stats: { ...next.stats, relocations: next.stats.relocations + 1 }
      });
    }
  }
  return { state: next, result: { kind: "empty", spot, relocatedTo } };
}

export type AnswerResult =
  | { kind: "correct"; next: "escaped" | "captured" | "done"; record: AnswerRecord }
  | { kind: "wrong" }
  | { kind: "ignored" };

export function answerPrep(
  s: HuntState,
  prep: Prep,
  rng: Rng,
  world: World = WORLD
): { state: HuntState; result: AnswerResult } {
  if (s.status !== "found") return { state: s, result: { kind: "ignored" } };
  const spot = currentSpot(s, world);
  if (prep !== spot.prep) {
    return {
      state: { ...s, answerMisses: s.answerMisses + 1, stats: { ...s.stats, wrongAnswers: s.stats.wrongAnswers + 1 } },
      result: { kind: "wrong" }
    };
  }

  const enc = currentEncounter(s);
  const firstTry = s.answerMisses === 0;
  const record: AnswerRecord = { ghost: enc.ghost, spotId: spot.id, prep, noun: spot.noun, firstTry };
  const stats = {
    ...s.stats,
    correctAnswers: s.stats.correctAnswers + 1,
    firstTryAnswers: s.stats.firstTryAnswers + (firstTry ? 1 : 0)
  };
  const usedPreps = [...s.usedPreps, prep];
  const round = s.round + 1;
  let next: HuntState = { ...s, stats, usedPreps, round, answers: [...s.answers, record] };

  if (round < enc.rounds) {
    // The ghost escapes to a preposition it has not used yet.
    const scripted = enc.roundSpots?.[round - 1];
    const allowed = PREPS.filter((p) => !usedPreps.includes(p));
    const scriptedSpot = scripted ? getSpot(scripted, world) : null;
    const target =
      scriptedSpot && scriptedSpot.room === enc.room && allowed.includes(scriptedSpot.prep) && scriptedSpot.id !== spot.id
        ? scriptedSpot
        : chooseSpot(spotsInRoom(enc.room, world), spot, allowed, rng);
    next = resetClue({ ...next, spotId: target.id, status: "hunting", relocationsThisRound: 0 });
    return { state: next, result: { kind: "correct", next: "escaped", record } };
  }

  next = { ...next, captured: [...next.captured, enc.ghost] };
  const index = s.index + 1;
  if (index >= s.encounters.length) {
    return { state: { ...next, index, status: "done" }, result: { kind: "correct", next: "done", record } };
  }
  const following = s.encounters[index];
  next = resetClue({
    ...next,
    index,
    spotId: following.start,
    round: 0,
    usedPreps: [],
    relocationsThisRound: 0,
    status: "hunting"
  });
  return { state: next, result: { kind: "correct", next: "captured", record } };
}

/**
 * Search help ladder for the current clue:
 * 0 nothing, 1 Boo repeats the clue, 2 picture hint, 3 the right object glows, 4 the right spot glows.
 */
export function searchHelpLevel(s: HuntState): 0 | 1 | 2 | 3 | 4 {
  const n = s.wrongSearchesThisClue;
  if (n >= 7) return 4;
  if (n >= 5) return 3;
  if (n >= 3) return 2;
  if (n >= 2) return 1;
  return 0;
}
