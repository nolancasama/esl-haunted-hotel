import { afterEach, describe, expect, it, vi } from "vitest";
import { PREPS, type RoomId } from "../types";
import { CHAPTER_GHOSTS } from "../ghosts";
import { getSpot, spotsInRoom, WORLD } from "../world/world";
import { ROOMS } from "../world/rooms";
import { answerPrep, createHunt, currentEncounter, currentSpot, searchSpot, type HuntState } from "./hunt";
import { chapterBreakAfter, chapterOf, storyPlan } from "./plans";
import { replayPlan } from "./replay";
import { mulberry32, pick } from "./rng";
import {
  HARD_ROOMS,
  applyHardHint,
  candidateRooms,
  clueRooms,
  hardHintLines,
  hardPlan,
  isFairSpot,
  matchIn,
  medalFor,
  nextHardHint,
  notebook
} from "./hard";
import { earnsHardStory, getGame, loadHardUnlocked, saveHardUnlocked, setGame } from "../store";

const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1);

/** Search like a student: follow the clue to a room, maybe wrong, and listen to Boo's hints. */
function searchWithHints(s: HuntState, target: string, seed: number) {
  const rng = mulberry32(seed);
  const r = searchSpot(s, target, rng);
  let state = r.state;
  const hint = r.result.kind === "empty" ? nextHardHint(state, rng) : null;
  if (hint) state = applyHardHint(state, hint);
  return { state, result: r.result, hint };
}

describe("Hard Story plan", () => {
  it("keeps the eight ghosts in story order, Chapter 1 downstairs and Chapter 2 upstairs", () => {
    for (const seed of SEEDS) {
      const plan = hardPlan(mulberry32(seed));
      expect(plan.map((e) => e.ghost)).toEqual([...CHAPTER_GHOSTS[1], ...CHAPTER_GHOSTS[2]]);
      plan.forEach((e, i) => {
        const chapter = i < 4 ? 1 : 2;
        expect(chapterOf(e)).toBe(chapter);
        expect(e.searchRooms).toEqual(HARD_ROOMS[chapter]);
        for (const id of [e.start, ...(e.roundSpots ?? [])]) expect(HARD_ROOMS[chapter]).toContain(getSpot(id).room);
        expect(e.relocateAfter).toBeNull();
      });
      expect(chapterBreakAfter(plan, 3)).toBe(true);
      expect(() => createHunt(plan)).not.toThrow();
    }
  });

  it("only ever hides ghosts in real, searchable, unambiguous-in-room places", () => {
    for (const seed of SEEDS) {
      for (const e of hardPlan(mulberry32(seed))) {
        for (const id of [e.start, ...(e.roundSpots ?? [])]) {
          const spot = WORLD.spotById.get(id);
          expect(spot, id).toBeDefined();
          expect(WORLD.objectById.get(spot!.objectId)!.searchable).toBe(true);
          expect(isFairSpot(spot!)).toBe(true);
          expect(matchIn(spot!, spot!.room)!.id).toBe(id);
        }
      }
    }
  });

  it("chooses clues that fit two or more rooms of the chapter", () => {
    for (const seed of SEEDS) {
      for (const e of hardPlan(mulberry32(seed))) {
        for (const id of [e.start, ...(e.roundSpots ?? [])]) {
          expect(clueRooms(getSpot(id), e.searchRooms!).length, id).toBeGreaterThanOrEqual(2);
        }
      }
    }
  });

  it("spreads ghosts across every room of each chapter (rooms, not just spots, are random)", () => {
    const seen = new Map<string, Set<RoomId>>();
    for (const seed of SEEDS) {
      for (const e of hardPlan(mulberry32(seed))) {
        if (!seen.has(e.ghost)) seen.set(e.ghost, new Set());
        seen.get(e.ghost)!.add(e.room);
      }
    }
    for (const [ghost, rooms] of seen) {
      const chapter = (CHAPTER_GHOSTS[1] as readonly string[]).includes(ghost) ? 1 : 2;
      expect([...rooms].sort(), ghost).toEqual([...HARD_ROOMS[chapter]].sort());
    }
  });

  it("finale ghosts still use all four prepositions, and the same seed gives the same plan", () => {
    for (const seed of SEEDS.slice(0, 40)) {
      const plan = hardPlan(mulberry32(seed));
      for (const e of plan.filter((x) => x.rounds > 1)) {
        const preps = [e.start, ...e.roundSpots!].map((id) => getSpot(id).prep);
        expect([...preps].sort()).toEqual([...PREPS].sort());
      }
      expect(hardPlan(mulberry32(seed))).toEqual(plan);
    }
  });
});

describe("Hard Story searching", () => {
  it("counts searches in other rooms of the chapter, and ignores rooms outside it", () => {
    const plan = hardPlan(mulberry32(7));
    let s = createHunt(plan);
    const spot = currentSpot(s);
    const otherRoom = HARD_ROOMS[1].find((r) => r !== spot.room)!;
    const elsewhere = spotsInRoom(otherRoom)[0];
    const r = searchSpot(s, elsewhere.id, mulberry32(1));
    expect(r.result.kind).toBe("empty");
    expect(r.state.wrongSearchesThisClue).toBe(1);
    s = r.state;
    // The same place again is remembered: no extra miss.
    expect(searchSpot(s, elsewhere.id, mulberry32(1)).state.wrongSearchesThisClue).toBe(1);
    // Upstairs is not part of Chapter 1.
    expect(searchSpot(s, spotsInRoom("attic")[0].id, mulberry32(1)).result.kind).toBe("elsewhere");
    expect(searchSpot(s, spot.id, mulberry32(1)).result.kind).toBe("found");
  });

  it("never lets the ghost move while it is hidden", () => {
    for (const seed of SEEDS.slice(0, 50)) {
      const rng = mulberry32(seed);
      let s = createHunt(hardPlan(mulberry32(seed)));
      const start = s.spotId;
      const rooms = currentEncounter(s).searchRooms!;
      for (let i = 0; i < 30; i++) {
        const target = pick(rng, rooms.flatMap((r) => spotsInRoom(r)).filter((x) => x.id !== start));
        s = searchSpot(s, target.id, rng).state;
        expect(s.spotId).toBe(start);
      }
      expect(s.stats.relocations).toBe(0);
    }
  });

  it("gives truthful, non-repeating room clues: never excludes the real room, always names it in the end", () => {
    for (const seed of SEEDS) {
      const rng = mulberry32(seed);
      let s = createHunt(hardPlan(mulberry32(seed)));
      for (let enc = 0; enc < 3; enc++) {
        const truth = currentSpot(s).room;
        const rooms = currentEncounter(s).searchRooms!;
        const wrongSpots = rooms.flatMap((r) => spotsInRoom(r)).filter((x) => x.id !== s.spotId);
        const said: string[] = [];
        while (!s.hardClue!.roomTold) {
          const r = searchWithHints(s, pick(rng, wrongSpots).id, seed);
          s = r.state;
          if (r.hint) {
            expect(r.hint.kind === "in" ? r.hint.room === truth : r.hint.room !== truth).toBe(true);
            const key = `${r.hint.kind}:${r.hint.room}`;
            expect(said).not.toContain(key);
            said.push(key);
          }
          expect(candidateRooms(s)).toContain(truth);
          expect(s.wrongSearchesThisClue).toBeLessThanOrEqual(4);
        }
        expect(hardHintLines(s).at(-1)).toBe(`It's in the ${ROOMS[truth].name.toLowerCase()}.`);
        s = searchSpot(s, s.spotId, rng).state;
        while (s.status === "found") s = answerPrep(s, currentSpot(s).prep, rng).state;
        if (s.status === "done") break;
        expect(s.hardClue).toEqual({ notIn: [], roomTold: false });
      }
    }
  });

  it("names a room after two misses that cannot be the real one, then the room after four", () => {
    const s0 = createHunt(hardPlan(mulberry32(3)));
    const truth = currentSpot(s0).room;
    // Misses on places that do not match the clue, so every candidate room stays open.
    const misses = currentEncounter(s0)
      .searchRooms!.flatMap((r) => spotsInRoom(r))
      .filter((x) => x.prep !== currentSpot(s0).prep || x.noun !== currentSpot(s0).noun);
    let s = s0;
    const hints = [];
    for (let i = 0; i < 4; i++) {
      const r = searchWithHints(s, misses[i].id, 11);
      s = r.state;
      hints.push(r.hint);
    }
    const cands = clueRooms(currentSpot(s0), currentEncounter(s0).searchRooms!);
    if (cands.length > 2) {
      expect(hints[1]).toMatchObject({ kind: "notIn" });
      expect(hints[1]!.room).not.toBe(truth);
    } else {
      expect(hints[1]).toEqual({ kind: "in", room: truth });
    }
    expect(s.hardClue!.roomTold).toBe(true);
  });

  it("names the room as soon as only one room can be left", () => {
    for (const seed of SEEDS) {
      let s = createHunt(hardPlan(mulberry32(seed)));
      const spot = currentSpot(s);
      const others = clueRooms(spot, currentEncounter(s).searchRooms!).filter((r) => r !== spot.room);
      // Check the matching place in every other room: after the last one, Boo names the room.
      for (const [i, r] of others.entries()) {
        const res = searchWithHints(s, matchIn(spot, r)!.id, seed);
        s = res.state;
        if (i === others.length - 1) expect(s.hardClue!.roomTold).toBe(true);
      }
    }
  });
});

describe("detective notebook", () => {
  it("marks a room clear only when that is certain", () => {
    for (const seed of SEEDS.slice(0, 60)) {
      const rng = mulberry32(seed);
      let s = createHunt(hardPlan(mulberry32(seed)));
      const spot = currentSpot(s);
      const rooms = currentEncounter(s).searchRooms!;
      for (let i = 0; i < 6 && !s.hardClue!.roomTold; i++) {
        const target = pick(rng, rooms.flatMap((r) => spotsInRoom(r)).filter((x) => x.id !== spot.id));
        s = searchWithHints(s, target.id, seed + i).state;
        for (const row of notebook(s)) {
          if (row.status === "clear") expect(row.room).not.toBe(spot.room);
          if (row.status === "here") expect(row.room).toBe(spot.room);
          // Before Boo names the room, the notebook never gives the answer away.
          if (!s.hardClue!.roomTold) expect(row.status).not.toBe("here");
          // One empty place in a room does not clear it unless it was the place the clue names.
          if (row.status === "clear" && !s.hardClue!.roomTold && !s.hardClue!.notIn.includes(row.room)) {
            expect(row.searched).toContain(matchIn(spot, row.room)!.id);
          }
        }
      }
    }
  });

  it("lists the chapter's four rooms", () => {
    const s = createHunt(hardPlan(mulberry32(5)));
    expect(notebook(s).map((r) => r.room)).toEqual(HARD_ROOMS[1]);
    expect(notebook(s).every((r) => r.status === "unchecked")).toBe(true);
  });
});

describe("Hard Story full run and medals", () => {
  it("every ghost can be caught and the hunt ends", () => {
    for (const seed of SEEDS) {
      const rng = mulberry32(seed);
      let s = createHunt(hardPlan(mulberry32(seed)));
      let steps = 0;
      while (s.status !== "done") {
        if (++steps > 5000) throw new Error(`stuck (seed ${seed})`);
        if (s.status === "hunting") {
          const rooms = currentEncounter(s).searchRooms!;
          const target = rng() < 0.3 ? currentSpot(s) : pick(rng, rooms.flatMap((r) => spotsInRoom(r)));
          s = searchWithHints(s, target.id, seed + steps).state;
        } else {
          s = answerPrep(s, rng() < 0.5 ? currentSpot(s).prep : pick(rng, PREPS), rng).state;
        }
      }
      expect(s.captured).toEqual([...CHAPTER_GHOSTS[1], ...CHAPTER_GHOSTS[2]]);
    }
  });

  it("awards gold for 0-1 empty searches, silver for 2-3, bronze for 4+", () => {
    const a = (n: number) => ({ ghost: "sleepy" as const, spotId: "x", prep: "in" as const, noun: "box", firstTry: true, searchMisses: n });
    expect(medalFor([a(0)])).toBe("gold");
    expect(medalFor([a(1)])).toBe("gold");
    expect(medalFor([a(2)])).toBe("silver");
    expect(medalFor([a(3)])).toBe("silver");
    expect(medalFor([a(4)])).toBe("bronze");
    expect(medalFor([a(0), a(1), a(2), a(1)])).toBe("gold");
    expect(medalFor([a(4), a(4), a(0), a(4)])).toBe("silver");
  });

  it("records empty searches per find", () => {
    let s = createHunt(hardPlan(mulberry32(9)));
    const miss = currentEncounter(s).searchRooms!.flatMap((r) => spotsInRoom(r)).find((x) => x.id !== s.spotId)!;
    s = searchSpot(s, miss.id, mulberry32(1)).state;
    s = searchSpot(s, s.spotId, mulberry32(1)).state;
    s = answerPrep(s, currentSpot(s).prep, mulberry32(1)).state;
    expect(s.answers[0].searchMisses).toBe(1);
  });
});

describe("Normal modes are unchanged", () => {
  it("the Normal Story and random replay plans have no Hard rooms", () => {
    for (const e of storyPlan("all")) expect(e.searchRooms).toBeUndefined();
    for (const e of replayPlan(mulberry32(4))) expect(e.searchRooms).toBeUndefined();
    expect(createHunt(storyPlan("all")).hardClue).toBeUndefined();
  });

  it("a Normal Story ghost is still searched only in its own room", () => {
    const s = createHunt(storyPlan("all"));
    expect(searchSpot(s, "dining.table.on", mulberry32(1)).result.kind).toBe("elsewhere");
  });
});

describe("Hard Story unlock", () => {
  const values = new Map<string, string>();
  const old = { hardUnlocked: getGame().hardUnlocked };
  afterEach(() => {
    setGame(old);
    vi.unstubAllGlobals();
    values.clear();
  });
  const stub = () =>
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => values.get(k) ?? null,
      setItem: (k: string, v: string) => void values.set(k, v),
      removeItem: (k: string) => void values.delete(k)
    });
  const done = (scope: "all" | "ch1" | "ch2", count: number): HuntState => {
    const plan = storyPlan(scope);
    return { ...createHunt(plan), status: "done", captured: plan.map((e) => e.ghost).slice(0, count) };
  };

  it("stays locked for old saves: no existing flag proves the full story was finished", () => {
    stub();
    for (const k of ["hh.replay.v1", "hh.finish.v2", "hh.ch2.v1", "hh.hideseek.v1", "hh.guestwing.chapter2.v2"]) values.set(k, "1");
    expect(loadHardUnlocked()).toBe(false);
  });

  it("opens only after the full Normal Story with all eight ghosts", () => {
    expect(earnsHardStory({ mode: "story", scope: "all", hard: false, hunt: done("all", 8) })).toBe(true);
    expect(earnsHardStory({ mode: "story", scope: "ch1", hard: false, hunt: done("ch1", 4) })).toBe(false);
    expect(earnsHardStory({ mode: "story", scope: "ch2", hard: false, hunt: done("ch2", 4) })).toBe(false);
    expect(earnsHardStory({ mode: "replay", scope: "all", hard: false, hunt: done("all", 8) })).toBe(false);
    expect(earnsHardStory({ mode: "practice", scope: "ch1", hard: false, hunt: done("ch1", 1) })).toBe(false);
    expect(earnsHardStory({ mode: "story", scope: "all", hard: false, hunt: { ...done("all", 8), status: "hunting" } })).toBe(false);
  });

  it("is saved and survives a reload", () => {
    stub();
    expect(loadHardUnlocked()).toBe(false);
    saveHardUnlocked();
    expect(getGame().hardUnlocked).toBe(true);
    expect(loadHardUnlocked()).toBe(true);
  });
});
