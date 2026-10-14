import type { Encounter } from "./hunt";
import { ROOMS } from "../world/rooms";

/**
 * Which part of the hotel a game covers: the full adventure (both chapters),
 * Chapter 1 (the ground floor) or Chapter 2 (upstairs) on its own.
 */
export type Scope = "all" | "ch1" | "ch2";

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
 * Chapter 1: four rooms, four ghosts, each a little livelier than the last.
 * Starting prepositions are under / on / in / by, and Mischief then uses all
 * four - so every preposition comes up at least twice.
 */
export function chapter1Plan(): Encounter[] {
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

/**
 * Chapter 2, upstairs: the same English, livelier rooms. Bouncy starts
 * under, Bubbles in, Melody by; Shadow then needs all four (on, in, under,
 * by) - again every preposition comes up at least twice.
 */
export function chapter2Plan(): Encounter[] {
  return [
    // Bouncy: toys move by themselves (never a clue); slips away after two empty searches.
    { ghost: "bouncy", room: "playroom", start: "playroom.table.under", rounds: 1, relocateAfter: 2, maxRelocations: 2 },
    // Bubbles: steam drifts in; the fan switch clears it. Patient: slips away after three.
    { ghost: "bubbles", room: "bathroom", start: "bathroom.basket.in", rounds: 1, relocateAfter: 3, maxRelocations: 1 },
    // Melody: instruments play by themselves all over the room; the clue is what counts.
    { ghost: "melody", room: "music", start: "music.piano.by", rounds: 1, relocateAfter: 2, maxRelocations: 2 },
    // Shadow: the great hide-and-seek. Four finds, four different prepositions.
    {
      ghost: "shadow",
      room: "attic",
      start: "attic.sofa.on",
      rounds: 4,
      relocateAfter: 2,
      maxRelocations: 1,
      roundSpots: ["attic.clock.in", "attic.table.under", "attic.window.by"]
    }
  ];
}

/** The story (fixed hiding places, so a class shares one story). */
export function storyPlan(scope: Scope = "all"): Encounter[] {
  if (scope === "ch1") return chapter1Plan();
  if (scope === "ch2") return chapter2Plan();
  return [...chapter1Plan(), ...chapter2Plan()];
}

/** Chapter 1 is the ground floor, Chapter 2 upstairs. */
export function chapterOf(e: Encounter): 1 | 2 {
  return ROOMS[e.room].floor === 1 ? 2 : 1;
}

/** True when catching encounter `i` finishes Chapter 1 and the next ghost is upstairs. */
export function chapterBreakAfter(plan: Encounter[], i: number): boolean {
  return i + 1 < plan.length && chapterOf(plan[i]) === 1 && chapterOf(plan[i + 1]) === 2;
}
