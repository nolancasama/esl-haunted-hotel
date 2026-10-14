import { PREPS, type GhostId, type Prep, type RoomId } from "../types";
import { spotsInRoom, WORLD, type World } from "../world/world";
import type { Encounter } from "./hunt";
import { chapter1Plan, chapter2Plan, type Scope } from "./plans";
import { pick, shuffle, type Rng } from "./rng";

/**
 * Replay mode: same rooms and ghost personalities, random hiding places.
 * Only predefined, tested spots are used, so every clue stays unambiguous.
 * In each chapter the first three ghosts start on three different
 * prepositions; the finale ghost (Mischief, Shadow) still runs through all
 * four, in a random order.
 */
function randomise(template: Encounter[], rng: Rng, world: World): Encounter[] {
  const spotFor = (room: RoomId, prep: Prep) => pick(rng, spotsInRoom(room, world).filter((s) => s.prep === prep)).id;
  const starts = shuffle(rng, PREPS);
  const rounds = shuffle(rng, PREPS);
  return template.map((e, i) => {
    if (e.rounds > 1) {
      return { ...e, start: spotFor(e.room, rounds[0]), roundSpots: rounds.slice(1).map((p) => spotFor(e.room, p)) };
    }
    return { ...e, start: spotFor(e.room, starts[i % starts.length]) };
  });
}

export function replayPlan(rng: Rng, world: World = WORLD, scope: Scope = "all"): Encounter[] {
  const ch1 = scope !== "ch2" ? randomise(chapter1Plan(), rng, world) : [];
  const ch2 = scope !== "ch1" ? randomise(chapter2Plan(), rng, world) : [];
  return [...ch1, ...ch2];
}

/** The ghosts a scope covers, in order. */
export function scopeGhosts(scope: Scope): GhostId[] {
  return [...(scope !== "ch2" ? chapter1Plan() : []), ...(scope !== "ch1" ? chapter2Plan() : [])].map((e) => e.ghost);
}
