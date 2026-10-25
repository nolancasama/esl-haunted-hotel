import type { Prep } from "../types";
import type { Rng } from "../logic/rng";
import { pick } from "../logic/rng";
import { detectPreps, judgeSpeech } from "../logic/speechMatch";

export interface EnglishSpot {
  prep: Prep;
  noun: string;
}

/** Existing room nouns (including red box and toy box) all take "the". */
export function placePhrase(spot: EnglishSpot): string {
  const noun = spot.noun.trim().replace(/[.!?]+$/, "");
  const article = /^(the|a|an|my|your|our|their|this|that|these|those)\s/i.test(noun) ? "" : "the ";
  return `${spot.prep} ${article}${noun}`;
}

export function sentenceFor(spot: EnglishSpot): string {
  return `I'm ${placePhrase(spot)}.`;
}

export function announceLine(spot: EnglishSpot, rng: Rng): string {
  return pick(rng, [`Maybe ${placePhrase(spot)}!`, `Let's look ${placePhrase(spot)}.`, `Is someone ${placePhrase(spot)}?`]);
}

export function emptyLine(spot: EnglishSpot, rng: Rng): string {
  return pick(rng, [`No ghost ${placePhrase(spot)}.`, `Nobody ${placePhrase(spot)}!`, `Nothing ${placePhrase(spot)}.`]);
}

export function foundLine(spot: EnglishSpot, rng: Rng): string {
  return pick(rng, [`You're ${placePhrase(spot)}!`, `Found you ${placePhrase(spot)}!`, `There you are, ${placePhrase(spot)}!`]);
}

/** Grammar is not graded; the ranked-alternative rules remain those of speechMatch. */
export function accept(spokenAlternatives: readonly string[], spot: EnglishSpot): boolean {
  if (!spokenAlternatives.some((text) => detectPreps(text).length > 0)) return false;
  return judgeSpeech(spokenAlternatives, spot.prep).kind === "correct";
}
