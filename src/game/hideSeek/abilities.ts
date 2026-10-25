import type { HidingSpot } from "../world/world";
import { addClue } from "./evidence";
import { roomLayout } from "./navigation";
import { blurredClue, CLUE_GAINS } from "./perception";
import { random } from "./random";
import type { CommandResult, MatchState } from "./types";

export function abilityTargets(s: MatchState): HidingSpot[] {
  if (s.status !== "playing" || s.english || s.abilityUsed) return [];
  return s.config.ghost === "hungry" || s.config.ghost === "mischief" ? roomLayout(s.config.room).spots.slice() : [];
}

export function useAbility(s: MatchState, targetSpotId?: string): CommandResult {
  if (s.status !== "playing") return { ok: false, reason: "not-playing" };
  if (s.english) return { ok: false, reason: "english-open" };
  if (s.abilityUsed) return { ok: false, reason: "ability-used" };
  const targeted = s.config.ghost === "hungry" || s.config.ghost === "mischief";
  const target = targeted ? abilityTargets(s).find((spot) => spot.id === targetSpotId) : null;
  if (targeted && !target) return { ok: false, reason: "invalid-target" };
  const rng = () => random(s);
  s.abilityUsed = true;
  switch (s.config.ghost) {
    case "sleepy":
      s.effects.sleepySearch = s.stats.completedSearches;
      s.detective.suspicion = Math.max(0, s.detective.suspicion - 30);
      break;
    case "hungry":
      addClue(s, blurredClue("munch", target!.hidePos, rng));
      break;
    case "sneaky": s.effects.nextMove = "silent"; break;
    case "mischief":
      s.effects.decoy = { spotId: target!.id, x: target!.hidePos.x, z: target!.hidePos.z };
      addClue(s, { kind: "decoy", x: target!.hidePos.x, z: target!.hidePos.z, strength: CLUE_GAINS.decoy });
      break;
    case "bouncy": s.effects.nextMove = "bounce"; break;
    case "bubbles":
      s.effects.bubbles.push({ x: s.ghost.x, z: s.ghost.z, radius: 1.5, remaining: 8 });
      addClue(s, blurredClue("bubbles", s.ghost, rng));
      break;
    case "melody":
      s.effects.music = { x: s.ghost.x, z: s.ghost.z, remaining: 10 };
      addClue(s, blurredClue("music", s.ghost, rng));
      break;
    case "shadow": s.effects.nextMove = "invisible"; break;
  }
  s.events.push({ type: "abilityFx", ghost: s.config.ghost, active: true, ...(target ? { targetSpotId: target.id } : {}) });
  return { ok: true };
}
