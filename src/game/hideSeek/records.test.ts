import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { createMatch } from "./match";
import {
  ACHIEVEMENTS, CHALLENGE_AREAS, GUEST_WINS_KEY, PLAY_ROOMS, RECORDS_STORAGE_KEY, collectionMilestones,
  collectionProgress, completionFor, ghostCompleted, loadCompletionBook, loadGuestRoomWins,
  recordVictory, resetCompletionBook
} from "./records";
import type { MatchState, PlayRoom } from "./types";

let store: Map<string, string>;
beforeEach(() => {
  store = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); }
  });
});
afterEach(() => vi.unstubAllGlobals());

function won(ghost: MatchState["config"]["ghost"] = "sleepy", room: PlayRoom = "bedroom",
  accuracy = 1, moves = 0, abilityUsed = false) {
  const match = createMatch({ ghost, room, seed: 123, level: "standard" });
  match.status = "won";
  match.searchesLeft = 0;
  match.stats.completedSearches = 5;
  match.stats.questions = 3;
  match.stats.acceptedAnswers = 3;
  match.stats.firstTryAnswers = Math.round(accuracy * 3);
  match.stats.firstTryAccuracy = accuracy;
  match.stats.relocations = moves;
  match.abilityUsed = abilityUsed;
  return match;
}

describe("Hide & Seek completion book", () => {
  it("starts with 72 challenges from eight ghosts and nine areas (the Guest Wing counts once)", () => {
    const p = collectionProgress(loadCompletionBook());
    expect(CHALLENGE_AREAS).toHaveLength(9);
    expect(PLAY_ROOMS).toHaveLength(14);
    expect(p).toMatchObject({ completed: 0, total: 72, percentage: 0, fullGhosts: 0, fullAreas: 0 });
  });

  it("saves the first win once, persists achievements and is idempotent for the same match", () => {
    const match = won();
    const first = recordVictory(match)!;
    expect(first).toMatchObject({ saved: true, firstCompletion: true, progress: { completed: 1, total: 72 } });
    expect(first.newAchievements).toEqual(Object.keys(ACHIEVEMENTS));
    expect(recordVictory(match)).toBe(first);
    expect(completionFor(loadCompletionBook(), "sleepy", "bedroom")).toMatchObject({
      wins: 1, fewestMoves: 0, bestEnglishAccuracy: 1
    });
  });

  it("losing or incomplete victories do not create records", () => {
    const match = won();
    match.status = "lost";
    expect(recordVictory(match)).toBeNull();
    match.status = "won";
    match.stats.completedSearches = 4;
    expect(recordVictory(match)).toBeNull();
    expect(store.has(RECORDS_STORAGE_KEY)).toBe(false);
  });

  it("keeps the first completion date, accumulates wins and only improves personal bests", () => {
    recordVictory(won("shadow", "attic", 0.5, 2, true));
    const first = completionFor(loadCompletionBook(), "shadow", "attic")!;
    expect(first.achievements).toEqual(["escaped"]);
    const second = recordVictory(won("shadow", "attic", 0.1, 2, true))!;
    expect(second.firstCompletion).toBe(false);
    expect(second.personalBest).toBe(false);
    const third = recordVictory(won("shadow", "attic", 1, 0, false))!;
    expect(third.personalBest).toBe(true);
    const saved = completionFor(loadCompletionBook(), "shadow", "attic")!;
    expect(saved.firstCompletedAt).toBe(first.firstCompletedAt);
    expect(saved.wins).toBe(3);
    expect(saved.bestEnglishAccuracy).toBe(1);
    expect(saved.fewestMoves).toBe(0);
    expect(saved.achievements).toEqual(Object.keys(ACHIEVEMENTS));
  });

  it("keeps records independent across ghosts and rooms", () => {
    recordVictory(won("sleepy", "bedroom"));
    recordVictory(won("sleepy", "dining"));
    recordVictory(won("hungry", "bedroom"));
    const book = loadCompletionBook();
    expect(collectionProgress(book).completed).toBe(3);
    expect(ghostCompleted(book, "sleepy")).toBe(2);
    expect(ghostCompleted(book, "hungry")).toBe(1);
    expect(completionFor(book, "hungry", "dining")).toBeUndefined();
  });

  it("unlocks Hotel Explorer with one victory in every area, not all combinations", () => {
    for (const area of CHALLENGE_AREAS) recordVictory(won("sleepy", area.rooms[0]));
    const book = loadCompletionBook();
    expect(collectionProgress(book).completed).toBe(9);
    expect(collectionMilestones(book)).toContain("hotelExplorer");
    expect(collectionMilestones(book)).toContain("specialist:sleepy");
    expect(collectionMilestones(book)).not.toContain("hotelMaster");
  });

  it("awards all milestones after a full collection, without changing already won awards", () => {
    for (const ghost of ["sleepy", "hungry", "sneaky", "mischief", "bouncy", "bubbles", "melody", "shadow"] as const)
      for (const area of CHALLENGE_AREAS) recordVictory(won(ghost, area.rooms[0]));
    const book = loadCompletionBook();
    expect(collectionProgress(book)).toMatchObject({ completed: 72, total: 72, fullGhosts: 8, fullAreas: 9 });
    expect(collectionMilestones(book)).toContain("hotelMaster");
    expect(book.milestones).toContain("hotelMaster");
    expect(book.milestones).toContain("ghostMaster");
    expect(book.milestones).toContain("hotelExplorer");
    expect(book.milestones).toContain("specialist:shadow");
  });

  it("a win in any guest room completes the one Guest Wing area for that ghost", () => {
    const first = recordVictory(won("bubbles", "g203"))!;
    expect(first).toMatchObject({ firstCompletion: true, progress: { completed: 1, total: 72 } });
    const second = recordVictory(won("bubbles", "g206"))!;
    expect(second.firstCompletion).toBe(false);
    const book = loadCompletionBook();
    expect(Object.keys(book.entries)).toEqual(["bubbles:guestwing"]);
    expect(book.entries["bubbles:guestwing"].wins).toBe(2);
    for (const room of ["g201", "g202", "g203", "g204", "g205", "g206"]) expect(completionFor(book, "bubbles", room)).toBeDefined();
    expect(completionFor(book, "bubbles", "guestwing")).toBeDefined();
    // The rooms won in are remembered for information, outside the completion total.
    expect(loadGuestRoomWins()).toEqual(["g203", "g206"]);
    expect(collectionProgress(book).completed).toBe(1);
  });

  it("keeps a previously saved 64-entry book (and its milestones) intact", () => {
    const entries: Record<string, unknown> = {};
    for (const ghost of ["sleepy", "hungry", "sneaky", "mischief", "bouncy", "bubbles", "melody", "shadow"])
      for (const area of ["bedroom", "dining", "storage", "library", "playroom", "bathroom", "music", "attic"])
        entries[`${ghost}:${area}`] = { firstCompletedAt: "2026-10-20T10:00:00.000Z", wins: 2, bestEnglishAccuracy: 0.5, fewestMoves: 1, achievements: ["escaped"] };
    store.set(RECORDS_STORAGE_KEY, JSON.stringify({ version: 1, entries, milestones: ["hotelMaster", "hotelExplorer", "ghostMaster"] }));
    const book = loadCompletionBook();
    expect(Object.keys(book.entries)).toHaveLength(64);
    expect(collectionProgress(book)).toMatchObject({ completed: 64, total: 72, fullAreas: 8, fullGhosts: 0 });
    // Earned awards stay earned now that there is more to collect.
    expect(book.milestones).toContain("hotelMaster");
    const result = recordVictory(won("sleepy", "g201"))!;
    expect(result.progress.completed).toBe(65);
    const after = loadCompletionBook();
    expect(Object.keys(after.entries)).toHaveLength(65);
    expect(after.entries["shadow:attic"]).toMatchObject({ wins: 2, firstCompletedAt: "2026-10-20T10:00:00.000Z" });
    expect(after.milestones).toContain("hotelMaster");
  });

  it("recovers from corrupt storage and discards malformed entries", () => {
    store.set(RECORDS_STORAGE_KEY, "{not valid");
    expect(collectionProgress(loadCompletionBook()).completed).toBe(0);
    store.set(RECORDS_STORAGE_KEY, JSON.stringify({ version: 1, entries: {
      "sleepy:bedroom": { firstCompletedAt: "not a date", wins: -9, bestEnglishAccuracy: 3, fewestMoves: 7 }
    }, milestones: [17, "ghostMaster"] }));
    expect(loadCompletionBook().entries).toEqual({});
    expect(loadCompletionBook().milestones).toEqual(["ghostMaster"]);
  });

  it("reset clears only Hide & Seek records, not unrelated unlocks", () => {
    store.set("hh.ch2.v1", "true");
    recordVictory(won());
    expect(resetCompletionBook()).toBe(true);
    expect(collectionProgress(loadCompletionBook()).completed).toBe(0);
    expect(store.get("hh.ch2.v1")).toBe("true");
    expect(store.has(GUEST_WINS_KEY)).toBe(false);
  });

  it("does not crash if browser storage is blocked", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
      removeItem: () => { throw new Error("blocked"); }
    });
    expect(collectionProgress(loadCompletionBook()).completed).toBe(0);
    expect(recordVictory(won())?.saved).toBe(false);
    expect(resetCompletionBook()).toBe(false);
  });
});
