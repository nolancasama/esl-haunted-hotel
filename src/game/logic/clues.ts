import type { Prep } from "../types";
import type { HidingSpot } from "../world/world";

/** The one question the whole game asks. */
export const QUESTION = "Where is the ghost?";

type SpotLike = Pick<HidingSpot, "prep" | "noun">;

/** Displayed clue, e.g. "It's under the bed." */
export function clueText(spot: SpotLike): string {
  return `It's ${spot.prep} the ${spot.noun}.`;
}

/** Spoken clue (Boo's voice), e.g. "It's under the bed!" */
export function clueSpoken(spot: SpotLike): string {
  return `It's ${spot.prep} the ${spot.noun}!`;
}

/** Sentence frame shown while the student answers: "It's ____ the bed." */
export function answerFrame(spot: SpotLike): { before: string; after: string } {
  return { before: "It's", after: `the ${spot.noun}.` };
}

/** Full sentence with a chosen preposition, used to show and speak the answer. */
export function sentenceWith(prep: Prep, spot: SpotLike): string {
  return `It's ${prep} the ${spot.noun}.`;
}

/** Caption after searching an empty spot - names the place the student chose. */
export function emptyCaption(spot: SpotLike): string {
  return `No ghost ${spot.prep} the ${spot.noun}.`;
}
