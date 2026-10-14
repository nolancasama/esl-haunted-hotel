import { describe, expect, it } from "vitest";
import { PREPS } from "../types";
import { CHAPTER_GHOSTS, GHOSTS } from "../ghosts";
import { getSpot, spotsInRoom, WORLD } from "../world/world";
import { ROOMS } from "../world/rooms";
import { answerPrep, createHunt, currentEncounter, currentSpot, searchSpot, type Encounter, type HuntState } from "./hunt";
import { chapterBreakAfter, chapterOf, practicePlan, storyPlan, type Scope } from "./plans";
import { replayPlan, scopeGhosts } from "./replay";
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
    if (steps > 10000) throw new Error(`stuck (seed ${seed})`);
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

/** Correct answers needed: one per ghost, four for a finale ghost. */
const answersFor = (plan: Encounter[]) => plan.reduce((n, e) => n + e.rounds, 0);

describe("Chapter 1 (the ground floor)", () => {
  it("visits the four rooms in order with their own ghosts", () => {
    const plan = storyPlan("ch1");
    checkPlan(plan);
    expect(plan.map((e) => e.ghost)).toEqual(["sleepy", "hungry", "sneaky", "mischief"]);
    for (const e of plan) {
      expect(GHOSTS[e.ghost].room).toBe(e.room);
      expect(chapterOf(e)).toBe(1);
    }
  });

  it("starts on four different prepositions, and Mischief's scripted rounds use the other three", () => {
    const plan = storyPlan("ch1");
    expect(new Set(plan.map((e) => getSpot(e.start).prep)).size).toBe(4);
    const m = plan[3];
    const mPreps = [m.start, ...(m.roundSpots ?? [])].map((id) => getSpot(id).prep);
    expect(new Set(mPreps).size).toBe(4);
  });

  it("Sleepy (the tutorial) never moves; later ghosts get livelier", () => {
    const plan = storyPlan("ch1");
    expect(plan[0].relocateAfter).toBeNull();
    expect(plan[3].rounds).toBe(4);
    expect(plan[3].relocateAfter).toBeLessThanOrEqual(plan[1].relocateAfter!);
  });

  it("a random student always finishes, catching all four ghosts and answering every preposition", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const s = playRandomly(storyPlan("ch1"), seed);
      expect(s.captured).toEqual(["sleepy", "hungry", "sneaky", "mischief"]);
      expect(s.stats.correctAnswers).toBe(7);
      const mischief = s.answers.filter((a) => a.ghost === "mischief").map((a) => a.prep);
      expect(new Set(mischief).size).toBe(4);
    }
  });
});

describe("Chapter 2 (upstairs)", () => {
  it("visits the four upstairs rooms in order with their own ghosts", () => {
    const plan = storyPlan("ch2");
    checkPlan(plan);
    expect(plan.map((e) => e.ghost)).toEqual(["bouncy", "bubbles", "melody", "shadow"]);
    for (const e of plan) {
      expect(GHOSTS[e.ghost].room).toBe(e.room);
      expect(ROOMS[e.room].floor).toBe(1);
      expect(chapterOf(e)).toBe(2);
    }
  });

  it("uses the brief's clues: under the table, in the basket, by the piano", () => {
    const [bouncy, bubbles, melody] = storyPlan("ch2");
    expect(getSpot(bouncy.start)).toMatchObject({ prep: "under", noun: "table" });
    expect(getSpot(bubbles.start)).toMatchObject({ prep: "in", noun: "basket" });
    expect(getSpot(melody.start)).toMatchObject({ prep: "by", noun: "piano" });
  });

  it("starts on four different prepositions, and Shadow's four finds use all four", () => {
    const plan = storyPlan("ch2");
    expect(new Set(plan.map((e) => getSpot(e.start).prep)).size).toBe(4);
    const shadow = plan[3];
    expect(shadow.ghost).toBe("shadow");
    expect(shadow.rounds).toBe(4);
    expect(new Set([shadow.start, ...(shadow.roundSpots ?? [])].map((id) => getSpot(id).prep)).size).toBe(4);
  });

  it("a random student always finishes; Shadow always ends up answered with all four prepositions", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const s = playRandomly(storyPlan("ch2"), seed);
      expect(s.captured).toEqual(["bouncy", "bubbles", "melody", "shadow"]);
      expect(s.stats.correctAnswers).toBe(7);
      const shadow = s.answers.filter((a) => a.ghost === "shadow").map((a) => a.prep);
      expect(new Set(shadow).size).toBe(4);
      // Every clue named a real spot in the right room.
      for (const a of s.answers) expect(getSpot(a.spotId).room).toBe(GHOSTS[a.ghost].room);
    }
  });
});

describe("the full adventure", () => {
  it("is Chapter 1 then Chapter 2: eight ghosts, ground floor first", () => {
    const plan = storyPlan("all");
    checkPlan(plan);
    expect(plan.map((e) => e.ghost)).toEqual([...CHAPTER_GHOSTS[1], ...CHAPTER_GHOSTS[2]]);
    expect(plan.map(chapterOf)).toEqual([1, 1, 1, 1, 2, 2, 2, 2]);
  });

  it("the stairs open after exactly the fourth capture, and only then", () => {
    const plan = storyPlan("all");
    const breaks = plan.map((_, i) => chapterBreakAfter(plan, i));
    expect(breaks).toEqual([false, false, false, true, false, false, false, false]);
    // A single chapter never breaks.
    for (const scope of ["ch1", "ch2"] as Scope[]) {
      const p = storyPlan(scope);
      expect(p.some((_, i) => chapterBreakAfter(p, i))).toBe(false);
    }
  });

  it("a random student always finishes all eight, with no dead ends on either floor", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const s = playRandomly(storyPlan("all"), seed);
      expect(s.captured).toEqual([...CHAPTER_GHOSTS[1], ...CHAPTER_GHOSTS[2]]);
      expect(s.stats.correctAnswers).toBe(14);
    }
  });

  it("the hunt only finishes after the eighth ghost (the ending cannot come early)", () => {
    const rng = mulberry32(5);
    let s = createHunt(storyPlan("all"));
    let doneAt = -1;
    for (let step = 0; step < 200 && s.status !== "done"; step++) {
      if (s.status === "hunting") s = searchSpot(s, s.spotId, rng).state;
      else {
        const r = answerPrep(s, currentSpot(s).prep, rng);
        s = r.state;
        if (r.result.kind === "correct" && r.result.next === "done") doneAt = s.captured.length;
        else expect(s.status).not.toBe("done");
      }
    }
    expect(doneAt).toBe(8);
  });
});

describe("replay plan", () => {
  it("only uses valid spots in the right rooms, for every scope", () => {
    for (const scope of ["all", "ch1", "ch2"] as Scope[]) {
      for (let seed = 1; seed <= 100; seed++) {
        const plan = replayPlan(mulberry32(seed), WORLD, scope);
        checkPlan(plan);
        expect(plan.map((e) => e.ghost)).toEqual(scopeGhosts(scope));
      }
    }
  });

  it("varies between runs but repeats exactly for the same seed", () => {
    const a = replayPlan(mulberry32(42));
    const b = replayPlan(mulberry32(42));
    expect(a).toEqual(b);
    const starts = new Set(Array.from({ length: 30 }, (_, i) => replayPlan(mulberry32(i + 1)).map((e) => e.start).join()));
    expect(starts.size).toBeGreaterThan(20);
    // Upstairs varies too.
    const upstairs = new Set(Array.from({ length: 30 }, (_, i) => replayPlan(mulberry32(i + 1), WORLD, "ch2").map((e) => e.start).join()));
    expect(upstairs.size).toBeGreaterThan(20);
  });

  it("in each chapter the first three ghosts start on three different prepositions; the finale covers all four", () => {
    for (let seed = 1; seed <= 100; seed++) {
      const plan = replayPlan(mulberry32(seed));
      for (const chapter of [plan.slice(0, 4), plan.slice(4, 8)]) {
        expect(new Set(chapter.slice(0, 3).map((e) => getSpot(e.start).prep)).size).toBe(3);
        const finale = chapter[3];
        expect(finale.rounds).toBe(4);
        expect(new Set([finale.start, ...(finale.roundSpots ?? [])].map((id) => getSpot(id).prep)).size).toBe(4);
      }
    }
  });

  it("a random student always finishes a random replay, on either floor or both", () => {
    for (const scope of ["all", "ch1", "ch2"] as Scope[]) {
      for (let seed = 1; seed <= 120; seed++) {
        const plan = replayPlan(mulberry32(seed * 7), WORLD, scope);
        const s = playRandomly(plan, seed);
        expect(s.captured.length).toBe(plan.length);
        expect(s.stats.correctAnswers).toBe(answersFor(plan));
      }
    }
  });
});

describe("practice plan", () => {
  it("stays in the bedroom", () => {
    checkPlan(practicePlan());
    expect(WORLD.spotById.get(practicePlan()[0].start)?.room).toBe("bedroom");
  });
});
