import type { HidingSpot } from "../world/world";
import { random } from "./random";
import type { Clue, DetectiveView, Point } from "./types";

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);

/** Only public evidence crosses this boundary. A clue's id orders evidence
 * against completed inspections, including clues received at the same time. */
export function receiveClue(view: DetectiveView, clue: Clue, gainScale = 1): void {
  const d = view.detective;
  d.clues.push({ ...clue });
  if (d.clues.length > 24) d.clues.shift();
  d.lastEvidence = view.time;
  d.suspicion = Math.min(100, d.suspicion + clue.strength * gainScale);
  if (d.suspicion >= 100) d.focusClue = clue.id;
}

export function decaySuspicion(view: DetectiveView, dt: number): void {
  const d = view.detective;
  if (view.time - d.lastEvidence > 2) d.suspicion = Math.max(0, d.suspicion - dt * 2);
}

function freshClue(view: DetectiveView, spot: HidingSpot): Clue | undefined {
  const searched = view.detective.searched[spot.id];
  return [...view.detective.clues].reverse().find((c) =>
    (searched === undefined || c.id > searched) && distance(c, spot.hidePos) < 1.25
  );
}

/** Empty spots are excluded until local evidence newer than the inspection.
 * The seed randomizes public priors; no probability uses the occupied spot. */
export function chooseTarget(view: DetectiveView): HidingSpot {
  const d = view.detective;
  const candidates = view.spots.filter((s) => d.searched[s.id] === undefined || freshClue(view, s));
  if (!candidates.length) throw new Error("No unsearched hiding spots");
  const focus = d.clues.find((c) => c.id === d.focusClue);
  if (focus) {
    d.focusClue = 0;
    const unsearched = candidates.filter((s) => d.searched[s.id] === undefined);
    return [...(unsearched.length ? unsearched : candidates)].sort((a, b) => distance(a.hidePos, focus) - distance(b.hidePos, focus))[0];
  }
  const last = d.clues.at(-1);
  const weighted = candidates.map((spot) => {
    const concealed = spot.prep === "in" || spot.prep === "under";
    let weight = (concealed ? 2.3 : 1) * d.priorities[spot.id];
    const evidence = freshClue(view, spot);
    if (evidence && view.time - evidence.time < 18) {
      const proximity = Math.max(0, 1 - distance(evidence, spot.hidePos) / 1.25);
      weight += proximity * (3 + d.suspicion * 0.09);
    }
    // A distracted detective investigates the region, not the exact emitter.
    if (last && (last.kind === "munch" || last.kind === "decoy") && last.id === d.handledClue) {
      weight += Math.max(0, 1 - distance(last, spot.hidePos) / 1.5) * 18;
    }
    return { spot, weight };
  });
  let roll = random(d) * weighted.reduce((n, c) => n + c.weight, 0);
  for (const entry of weighted) {
    roll -= entry.weight;
    if (roll <= 0) return entry.spot;
  }
  return weighted[weighted.length - 1].spot;
}

/** Decide whether to interrupt an approach. Never interrupt an inspection. */
export function investigateClue(view: DetectiveView): boolean {
  const d = view.detective;
  const clue = d.clues.at(-1);
  if (!clue || clue.id <= d.handledClue || d.phase === "search" || d.phase === "react" || d.phase === "finish") return false;
  d.handledClue = clue.id;
  if (d.focusClue) {
    const target = view.spots.find((s) => s.id === d.target);
    // New evidence in the region already being approached does not restart
    // the announce beat and strand the detective in repeated thinking.
    return !target || distance(target.hidePos, clue) > 1.25;
  }
  if (clue.kind !== "munch" && clue.kind !== "decoy" && clue.kind !== "music") return false;
  const nearest = [...view.spots].sort((a, b) => distance(a.hidePos, clue) - distance(b.hidePos, clue))[0];
  const searched = d.searched[nearest.id] !== undefined;
  const previous = d.clues.at(-2);
  const conflict = d.suspicion > 60 && previous && distance(previous, clue) > 2;
  const chance = clue.kind === "munch" ? (searched ? 0.28 : 0.86)
    : clue.kind === "decoy" ? (d.suspicion > 65 ? 0.35 : 0.88) : 0.55;
  return random(d) < chance * (conflict ? 0.45 : 1);
}
