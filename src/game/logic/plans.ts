import type { Encounter } from "./hunt";

/**
 * Practice (`?mode=practice`, the Phase 1 prototype): one ghost in the
 * bedroom. Each correct answer makes it escape to a new hiding place with a
 * preposition it has not used, so one round practises in / on / under / by.
 * It also slips away after two empty searches on a clue (once per round).
 */
export function practicePlan(): Encounter[] {
  return [
    {
      ghost: "sleepy",
      room: "bedroom",
      start: "bedroom.bed.under",
      rounds: 4,
      relocateAfter: 2,
      maxRelocations: 1,
      roundSpots: ["bedroom.box.in", "bedroom.desk.on", "bedroom.window.by"]
    }
  ];
}

/**
 * The story: four rooms, four ghosts, each a little livelier than the last.
 * Starting prepositions are under / on / in / by, and Mischief then uses all
 * four - so every preposition comes up at least twice.
 */
export function storyPlan(): Encounter[] {
  return [
    // Sleepy: the tutorial. Never moves.
    { ghost: "sleepy", room: "bedroom", start: "bedroom.bed.under", rounds: 1, relocateAfter: null, maxRelocations: 0 },
    // Hungry: sitting by the cake; slips away after two empty searches.
    { ghost: "hungry", room: "dining", start: "dining.table.on", rounds: 1, relocateAfter: 2, maxRelocations: 2 },
    // Sneaky: needs careful listening (red / blue / yellow box) and rattles other things.
    { ghost: "sneaky", room: "storage", start: "storage.red.in", rounds: 1, relocateAfter: 3, maxRelocations: 2 },
    // Mischief: the finale. Escapes after each answer until all four prepositions are used.
    {
      ghost: "mischief",
      room: "library",
      start: "library.bookshelf.by",
      rounds: 4,
      relocateAfter: 2,
      maxRelocations: 1,
      roundSpots: ["library.clock.in", "library.chair.on", "library.desk.under"]
    }
  ];
}
