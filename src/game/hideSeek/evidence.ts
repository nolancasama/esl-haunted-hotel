import { receiveClue } from "./detective";
import { roomLayout } from "./navigation";
import type { ClueInput, DetectiveView, MatchState } from "./types";

export function detectiveView(s: MatchState): DetectiveView {
  return { spots: roomLayout(s.config.room).spots, detective: s.detective, time: s.time };
}

export function addClue(s: MatchState, input: ClueInput): void {
  const clue = { ...input, id: ++s.clueId, time: s.time };
  receiveClue(detectiveView(s), clue, s.effects.sleepySearch === s.stats.completedSearches ? 0.5 : 1);
  s.stats.clues++;
  s.events.push({ type: "clue", clue });
}
