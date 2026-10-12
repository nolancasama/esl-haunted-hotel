import { PREPS, type Prep, type RoomId } from "../types";
import { spotsInRoom, WORLD, type World } from "../world/world";
import type { Encounter } from "./hunt";
import { pick, shuffle, type Rng } from "./rng";

/**
 * Replay mode: same rooms and ghost personalities, random hiding places.
 * Only predefined, tested spots are used, so every clue stays unambiguous.
 * Sleepy, Hungry and Sneaky start on three different prepositions; Mischief
 * still runs through all four, in a random order.
 */
export function replayPlan(rng: Rng, world: World = WORLD): Encounter[] {
  const spotFor = (room: RoomId, prep: Prep) => pick(rng, spotsInRoom(room, world).filter((s) => s.prep === prep)).id;
  const starts = shuffle(rng, PREPS);
  const rounds = shuffle(rng, PREPS);
  return [
    { ghost: "sleepy", room: "bedroom", start: spotFor("bedroom", starts[0]), rounds: 1, relocateAfter: null, maxRelocations: 0 },
    { ghost: "hungry", room: "dining", start: spotFor("dining", starts[1]), rounds: 1, relocateAfter: 2, maxRelocations: 2 },
    { ghost: "sneaky", room: "storage", start: spotFor("storage", starts[2]), rounds: 1, relocateAfter: 3, maxRelocations: 2 },
    {
      ghost: "mischief",
      room: "library",
      start: spotFor("library", rounds[0]),
      rounds: 4,
      relocateAfter: 2,
      maxRelocations: 1,
      roundSpots: rounds.slice(1).map((p) => spotFor("library", p))
    }
  ];
}
