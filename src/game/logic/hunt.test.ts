import { describe, expect, it } from "vitest";
import { PREPS, type Prep } from "../types";
import { getSpot, spotsInRoom, WORLD } from "../world/world";
import { clueText } from "./clues";
import {
  answerPrep,
  chooseSpot,
  createHunt,
  currentEncounter,
  currentSpot,
  searchSpot,
  type Encounter,
  type HuntState
} from "./hunt";
import { practicePlan } from "./plans";
import { mulberry32, pick } from "./rng";

const bedroom = spotsInRoom("bedroom");

function invariants(s: HuntState) {
  if (s.status === "done") return;
  const enc = currentEncounter(s);
  const spot = currentSpot(s);
  // The ghost is always somewhere valid in its own room...
  expect(spot.room).toBe(enc.room);
  // ...and the clue the student hears is made from exactly that spot.
  expect(clueText(spot)).toBe(`It's ${spot.prep} the ${spot.noun}.`);
}

describe("createHunt", () => {
  it("starts on the first encounter's spot", () => {
    const s = createHunt(practicePlan());
    expect(s.spotId).toBe("bedroom.bed.under");
    expect(s.status).toBe("hunting");
    invariants(s);
  });

  it("rejects a start spot outside the encounter's room", () => {
    expect(() =>
      createHunt([{ ghost: "sleepy", room: "dining", start: "bedroom.bed.under", rounds: 1, relocateAfter: null, maxRelocations: 0 }])
    ).toThrow();
  });
});

describe("searching", () => {
  it("finds the ghost only at its spot", () => {
    const rng = mulberry32(1);
    let s = createHunt(practicePlan());
    const empty = searchSpot(s, "bedroom.bed.on", rng);
    expect(empty.result.kind).toBe("empty");
    s = empty.state;
    expect(s.stats.wrongSearches).toBe(1);
    const found = searchSpot(s, "bedroom.bed.under", rng);
    expect(found.result.kind).toBe("found");
    expect(found.state.status).toBe("found");
  });

  it("never moves the ghost while it is found (answer / speech phase)", () => {
    const rng = mulberry32(2);
    let s = searchSpot(createHunt(practicePlan()), "bedroom.bed.under", rng).state;
    for (const spot of bedroom) {
      const r = searchSpot(s, spot.id, rng);
      expect(r.result.kind).toBe("ignored");
      expect(r.state.spotId).toBe("bedroom.bed.under");
      s = r.state;
    }
  });

  it("relocates after the configured number of empty searches, with a new clue", () => {
    const rng = mulberry32(3);
    let s = createHunt(practicePlan()); // relocateAfter 2, max 1
    const clue0 = s.clueId;
    s = searchSpot(s, "bedroom.bed.on", rng).state;
    expect(s.spotId).toBe("bedroom.bed.under");
    const r = searchSpot(s, "bedroom.desk.on", rng);
    expect(r.result.kind).toBe("empty");
    if (r.result.kind !== "empty") throw new Error();
    expect(r.result.relocatedTo).not.toBeNull();
    expect(r.state.spotId).toBe(r.result.relocatedTo);
    expect(r.state.spotId).not.toBe("bedroom.bed.under");
    expect(r.state.clueId).toBe(clue0 + 1);
    expect(r.state.wrongSearchesThisClue).toBe(0);
    // A new preposition on another object is preferred.
    const moved = getSpot(r.state.spotId);
    expect(moved.prep).not.toBe("under");
    expect(moved.objectId).not.toBe("bedroom.bed");
    invariants(r.state);
  });

  it("respects the relocation cap so a struggling student is not chased forever", () => {
    const rng = mulberry32(4);
    let s = createHunt(practicePlan());
    let moves = 0;
    for (let i = 0; i < 30; i++) {
      const wrong = bedroom.find((x) => x.id !== s.spotId)!;
      const r = searchSpot(s, wrong.id, rng);
      if (r.result.kind === "empty" && r.result.relocatedTo) moves++;
      s = r.state;
    }
    expect(moves).toBe(1);
  });

  it("never relocates a ghost with no relocation policy", () => {
    const rng = mulberry32(5);
    const plan: Encounter[] = [{ ghost: "sleepy", room: "bedroom", start: "bedroom.bed.under", rounds: 1, relocateAfter: null, maxRelocations: 0 }];
    let s = createHunt(plan);
    for (const spot of bedroom.filter((x) => x.id !== "bedroom.bed.under")) s = searchSpot(s, spot.id, rng).state;
    expect(s.spotId).toBe("bedroom.bed.under");
  });
});

describe("answering", () => {
  it("is ignored until the ghost is found", () => {
    const s = createHunt(practicePlan());
    expect(answerPrep(s, "under", mulberry32(1)).result.kind).toBe("ignored");
  });

  it("wrong answers allow retries; the right one captures and starts the next encounter", () => {
    const rng = mulberry32(6);
    const one = { room: "bedroom" as const, rounds: 1, relocateAfter: null, maxRelocations: 0 };
    const plan: Encounter[] = [
      { ...one, ghost: "sleepy", start: "bedroom.bed.under" },
      { ...one, ghost: "hungry", start: "bedroom.box.in" }
    ];
    let s = searchSpot(createHunt(plan), "bedroom.bed.under", rng).state;
    let r = answerPrep(s, "on", rng);
    expect(r.result.kind).toBe("wrong");
    s = r.state;
    expect(s.status).toBe("found");
    expect(s.spotId).toBe("bedroom.bed.under");
    r = answerPrep(s, "under", rng);
    expect(r.result).toMatchObject({ kind: "correct", next: "captured" });
    s = r.state;
    expect(s.index).toBe(1);
    expect(s.captured).toEqual(["sleepy"]);
    expect(s.spotId).toBe("bedroom.box.in");
    expect(s.status).toBe("hunting");
    expect(s.stats).toMatchObject({ correctAnswers: 1, firstTryAnswers: 0, wrongAnswers: 1 });
    expect(s.answers[0]).toMatchObject({ prep: "under", noun: "bed", firstTry: false });
    r = answerPrep(searchSpot(s, "bedroom.box.in", rng).state, "in", rng);
    expect(r.result).toMatchObject({ kind: "correct", next: "done" });
    expect(r.state.status).toBe("done");
  });

  it("the practice ghost escapes along its scripted spots, then is captured", () => {
    const rng = mulberry32(7);
    let s = createHunt(practicePlan());
    const visited: string[] = [];
    for (let round = 0; round < 4; round++) {
      visited.push(s.spotId);
      s = searchSpot(s, s.spotId, rng).state;
      const r = answerPrep(s, currentSpot(s).prep, rng);
      expect(r.result).toMatchObject({ kind: "correct", next: round < 3 ? "escaped" : "done" });
      s = r.state;
    }
    expect(visited).toEqual(["bedroom.bed.under", "bedroom.box.in", "bedroom.desk.on", "bedroom.window.by"]);
    expect(s.captured).toEqual(["sleepy"]);
  });

  it("a multi-round ghost escapes to unused prepositions until all four are answered", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const rng = mulberry32(seed);
      const plan: Encounter[] = [
        { ghost: "mischief", room: "bedroom", start: pick(rng, bedroom).id, rounds: 4, relocateAfter: 2, maxRelocations: 1 }
      ];
      let s = createHunt(plan);
      const answered: Prep[] = [];
      for (let round = 0; round < 4; round++) {
        s = searchSpot(s, s.spotId, rng).state;
        const prep = currentSpot(s).prep;
        expect(answered).not.toContain(prep);
        const r = answerPrep(s, prep, rng);
        answered.push(prep);
        s = r.state;
        expect(r.result).toMatchObject({ kind: "correct", next: round < 3 ? "escaped" : "done" });
      }
      expect([...answered].sort()).toEqual([...PREPS].sort());
    }
  });
});

describe("chooseSpot", () => {
  it("prefers a new preposition on a different object", () => {
    const current = getSpot("bedroom.bed.under");
    for (let seed = 0; seed < 40; seed++) {
      const c = chooseSpot(bedroom, current, PREPS, mulberry32(seed));
      expect(c.prep).not.toBe("under");
      expect(c.objectId).not.toBe("bedroom.bed");
    }
  });

  it("stays within allowed prepositions when it can", () => {
    const current = getSpot("bedroom.bed.under");
    for (let seed = 0; seed < 40; seed++) {
      expect(chooseSpot(bedroom, current, ["in"], mulberry32(seed)).prep).toBe("in");
    }
  });

  it("stays put rather than moving to an already-answered preposition", () => {
    // The box is the bedroom's only "in" spot.
    const current = getSpot("bedroom.box.in");
    expect(chooseSpot(bedroom, current, ["in"], mulberry32(1)).id).toBe("bedroom.box.in");
  });

  it("a multi-round ghost hiding in the only spot left for its last preposition does not relocate", () => {
    const rng = mulberry32(9);
    const plan: Encounter[] = [
      {
        ghost: "mischief",
        room: "bedroom",
        start: "bedroom.bed.under",
        rounds: 4,
        relocateAfter: 2,
        maxRelocations: 1,
        roundSpots: ["bedroom.desk.on", "bedroom.window.by", "bedroom.box.in"]
      }
    ];
    let s = createHunt(plan);
    for (let round = 0; round < 3; round++) {
      s = searchSpot(s, s.spotId, rng).state;
      s = answerPrep(s, currentSpot(s).prep, rng).state;
    }
    expect(s.spotId).toBe("bedroom.box.in");
    s = searchSpot(s, "bedroom.bed.on", rng).state;
    const r = searchSpot(s, "bedroom.desk.on", rng);
    expect(r.result).toMatchObject({ kind: "empty", relocatedTo: null });
    expect(r.state.spotId).toBe("bedroom.box.in");
  });
});

describe("no dead ends", () => {
  it("a random student always finishes the practice round", () => {
    for (let seed = 1; seed <= 300; seed++) {
      const rng = mulberry32(seed);
      let s = createHunt(practicePlan());
      let steps = 0;
      while (s.status !== "done") {
        steps++;
        expect(steps).toBeLessThan(2000);
        invariants(s);
        if (s.status === "hunting") {
          // Random searches, but a student who was told the clue gets there eventually.
          const spot = rng() < 0.25 ? currentSpot(s) : pick(rng, bedroom);
          s = searchSpot(s, spot.id, rng).state;
        } else {
          const prep = rng() < 0.4 ? currentSpot(s).prep : pick(rng, PREPS);
          s = answerPrep(s, prep, rng).state;
        }
      }
      expect(s.captured).toEqual(["sleepy"]);
      expect(s.stats.correctAnswers).toBe(4);
      // One practice round always covers every preposition.
      expect(new Set(s.answers.map((a) => a.prep)).size).toBe(4);
    }
  });

  it("every practice start is a real bedroom spot", () => {
    for (const e of practicePlan()) expect(WORLD.spotById.get(e.start)?.room).toBe("bedroom");
  });
});
