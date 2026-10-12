import type { Prep } from "../types";

/**
 * Speech answers are judged on the preposition only. Grammar, articles and the
 * noun are not graded: "under", "It's under bed" and "it's under the bed" all pass.
 *
 * Classroom rules carried over from the other ESL games:
 *  - Only the top hypothesis judges. Later alternatives are consulted only to
 *    rescue an utterance where no preposition was heard at all, so a child who
 *    said "on" is not accepted because "in" happened to be alternative #4.
 *  - Recognisers mishear Japanese-accented English; variants are listed
 *    explicitly (bye/buy for by, ander/anda for under).
 *  - Saying every word ("in on under by") is not an answer.
 */

const WORDS: Record<Prep, string[]> = {
  in: ["in", "inn", "inside", "into"],
  on: ["on", "onto", "upon", "own"],
  under: ["under", "underneath", "beneath", "below", "onder", "ander", "anda", "unda", "undah", "andar", "under's"],
  by: ["by", "bye", "buy", "bi", "bai", "bae", "beside", "near", "nearby"]
};

const PHRASES: Array<{ words: string[]; prep: Prep }> = [{ words: ["next", "to"], prep: "by" }];

const LOOKUP = new Map<string, Prep>();
for (const [prep, words] of Object.entries(WORDS) as Array<[Prep, string[]]>) {
  for (const w of words) LOOKUP.set(w, prep);
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/[^a-z0-9' -]+/g, " ")
    .replace(/-/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^'+|'+$/g, ""))
    .filter(Boolean);
}

/** Prepositions heard in a transcript, in order. */
export function detectPreps(text: string): Prep[] {
  const tokens = tokenize(text);
  const found: Prep[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const phrase = PHRASES.find((p) => p.words.every((w, k) => tokens[i + k] === w));
    if (phrase) {
      found.push(phrase.prep);
      i += phrase.words.length - 1;
      continue;
    }
    const prep = LOOKUP.get(tokens[i]);
    if (prep) found.push(prep);
  }
  return found;
}

export type Judgement =
  | { kind: "correct"; heard: string }
  | { kind: "wrong"; prep: Prep; heard: string }
  /** Three or more different prepositions: guessing every word. */
  | { kind: "unclear"; heard: string }
  | { kind: "none"; heard: string };

function judgeOne(text: string, target: Prep): Judgement | null {
  const preps = detectPreps(text);
  if (preps.length === 0) return null;
  const distinct = [...new Set(preps)];
  if (distinct.length >= 3) return { kind: "unclear", heard: text };
  if (distinct.includes(target)) return { kind: "correct", heard: text };
  return { kind: "wrong", prep: preps[0], heard: text };
}

/** Judge one recognition result (its ranked alternatives) against the target preposition. */
export function judgeSpeech(alternatives: readonly string[], target: Prep): Judgement {
  const [top = "", ...rest] = alternatives;
  const first = judgeOne(top, target);
  if (first) return first;
  for (const alt of rest) {
    const j = judgeOne(alt, target);
    if (j) return j;
  }
  return { kind: "none", heard: top };
}
