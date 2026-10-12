import type { Encounter } from "./hunt";

/**
 * Phase 1 prototype: one ghost in the bedroom. Each correct answer makes it
 * escape to a new hiding place with a preposition it has not used, so one
 * round practises in / on / under / by. It also slips away after two empty
 * searches on a clue (once per round).
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
