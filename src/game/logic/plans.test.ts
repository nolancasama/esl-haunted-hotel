import { describe, expect, it } from "vitest";
import { PREPS } from "../types";
import { GHOSTS } from "../ghosts";
import { getSpot, spotsInRoom, WORLD } from "../world/world";
import { answerPrep, createHunt, currentEncounter, currentSpot, searchSpot, type Encounter, type HuntState } from "./hunt";
import { practicePlan, storyPlan } from "./plans";
import { replayPlan } from "./replay";
import { mulberry32, pick } from "./rng";

function checkPlan(plan: Encounter[]) {
  for (const e of plan) {
    const start = getSpot(e.start);
    expect(start.room).toBe(e.room);
    for (const id of e.roundSpots ?? []) expect(getSpot(id).room).toBe(e.room);
  }
}

/** A student who mostly guesses, sometimes follows the clue, and answers at random. */
function playRandomly(plan: Encounter[], seed: number): HuntState {
  const rng = mulberry32(seed);
  let s = createHunt(plan);
  let steps = 0;
  while (s.status !== "done") {
    steps++;
    if (steps > 5000) throw new Error(`stuck (seed ${seed})`);
    const enc = currentEncounter(s);
    const spot = currentSpot(s);
    expect(spot.room).toBe(enc.room);
    if (s.status === "hunting") {
      const target = rng() < 0.25 ? spot : pick(rng, spotsInRoom(enc.room));
      s = searchSpot(s, target.id, rng).state;
    } else {
      s = answerPrep(s, rng() < 0.4 ? spot.prep : pick(rng, PREPS), rng).state;
    }
  }
  return s;
}

describe("story plan", () => {
  it("visits the four rooms in order with their own ghosts", () => {
    const plan = storyPlan();
    checkPlan(plan);
    expect(plan.map((e) => e.ghost)).toEqual(["sleepy", "hungry", "sneaky", "mischief"]);
    for (const e of plan) expect(GHOSTS[e.ghost].room).toBe(e.room);
  });

  it("starts on four different prepositions, and Mischief's scripted rounds use the other three", () => {
    const plan = storyPlan();
    expect(new Set(plan.map((e) => getSpot(e.start).prep)).size).toBe(4);
    const m = plan[3];
    const mPreps = [m.start, ...(m.roundSpots ?? [])].map((id) => getSpot(id).prep);
    expect(new Set(mPreps).size).toBe(4);
  });

  it("Sleepy (the tutorial) never moves; later ghosts get livelier", () => {
    const plan = storyPlan();
    expect(plan[0].relocateAfter).toBeNull();
    expect(plan[3].rounds).toBe(4);
    expect(plan[3].relocateAfter).toBeLessThanOrEqual(plan[1].relocateAfter!);
  });

  it("a random student always finishes, catching all four ghosts and answering every preposition", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const s = playRandomly(storyPlan(), seed);
      expect(s.captured).toEqual(["sleepy", "hungry", "sneaky", "mischief"]);
      expect(s.stats.correctAnswers).toBe(7);
      const mischief = s.answers.filter((a) => a.ghost === "mischief").map((a) => a.prep);
      expect(new Set(mischief).size).toBe(4);
    }
  });
});

describe("replay plan", () => {
  it("only uses valid spots in the right rooms", () => {
    for (let seed = 1; seed <= 100; seed++) checkPlan(replayPlan(mulberry32(seed)));
  });

  it("varies between runs but repeats exactly for the same seed", () => {
    const a = replayPlan(mulberry32(42));
    const b = replayPlan(mulberry32(42));
    expect(a).toEqual(b);
    const starts = new Set(Array.from({ length: 30 }, (_, i) => replayPlan(mulberry32(i + 1)).map((e) => e.start).join()));
    expect(starts.size).toBeGreaterThan(20);
  });

  it("the first three ghosts start on three different prepositions; Mischief covers all four", () => {
    for (let seed = 1; seed <= 100; seed++) {
      const plan = replayPlan(mulberry32(seed));
      expect(new Set(plan.slice(0, 3).map((e) => getSpot(e.start).prep)).size).toBe(3);
      const m = plan[3];
      expect(new Set([m.start, ...(m.roundSpots ?? [])].map((id) => getSpot(id).prep)).size).toBe(4);
    }
  });

  it("a random student always finishes a random replay", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const s = playRandomly(replayPlan(mulberry32(seed * 7)), seed);
      expect(s.captured.length).toBe(4);
    }
  });
});

describe("practice plan", () => {
  it("stays in the bedroom", () => {
    checkPlan(practicePlan());
    expect(WORLD.spotById.get(practicePlan()[0].start)?.room).toBe("bedroom");
  });
});
