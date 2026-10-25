import { describe, expect, it } from "vitest";
import { GHOST_ORDER } from "../ghosts";
import { getSpot, spotsInRoom } from "../world/world";
import { sentenceFor } from "./english";
import {
  abilityTargets, answerEnglish, beginEnglish, cancelMove, chooseStart, createMatch,
  reachableSpots, requestMove, step, takeEvents, useAbility
} from "./match";
import type { MatchState } from "./types";

function started(ghost: MatchState["config"]["ghost"] = "sleepy") {
  const state = createMatch({ ghost, room: "bedroom", seed: 17, level: "standard" });
  expect(chooseStart(state, "bedroom.bed.under").ok).toBe(true);
  expect(answerEnglish(state, ["I'm under the bed."]).ok).toBe(true);
  takeEvents(state);
  return state;
}

function destination(state: MatchState) {
  const spot = reachableSpots(state).find((item) => item.id !== state.ghost.spotId);
  if (!spot) throw new Error("Expected a reachable relocation");
  return spot;
}

function commitMove(state: MatchState) {
  const spot = destination(state);
  expect(requestMove(state, spot.id).ok).toBe(true);
  expect(beginEnglish(state).ok).toBe(true);
  expect(answerEnglish(state, [sentenceFor(spot)]).ok).toBe(true);
  return spot;
}

function finishMovement(state: MatchState) {
  // Keep the detective observing far away to isolate command accounting.
  state.detective.x = 100;
  state.detective.z = 100;
  state.detective.phase = "observe";
  state.detective.elapsed = -1000;
  for (let i = 0; i < 400 && state.ghost.transit; i++) step(state, 0.05);
  expect(state.ghost.transit).toBe(false);
}

function inspect(state: MatchState, spotId: string) {
  state.detective.phase = "search";
  state.detective.target = spotId;
  state.detective.elapsed = 0;
  return step(state, 2.1);
}

describe("Hide & Seek commands", () => {
  it("requires accepted starting English and tracks first-try accuracy", () => {
    const state = createMatch({ ghost: "sleepy", room: "bedroom", seed: 1, level: "beginner" });
    expect(chooseStart(state, "bedroom.bed.under").ok).toBe(true);
    expect(state.status).toBe("setup");
    expect(answerEnglish(state, ["on"]).ok).toBe(false);
    expect(state.status).toBe("setup");
    expect(answerEnglish(state, ["I am under the bed."]).ok).toBe(true);
    expect(state.status).toBe("playing");
    expect(state.stats).toMatchObject({ questions: 1, acceptedAnswers: 1, firstTryAnswers: 0, wrongAnswers: 1, firstTryAccuracy: 0 });
    commitMove(state);
    expect(state.stats.firstTryAccuracy).toBe(0.5);
  });

  it("rejects foreign spots and commands without an active panel", () => {
    const state = started();
    expect(requestMove(state, "dining.table.under").ok).toBe(false);
    expect(answerEnglish(state, ["under"]).ok).toBe(false);
    expect(beginEnglish(state).ok).toBe(false);
    expect(chooseStart(state, "bedroom.box.in").ok).toBe(false);
  });

  it("cancelling spends neither relocation nor an English question", () => {
    const state = started();
    const spot = destination(state);
    expect(requestMove(state, spot.id).ok).toBe(true);
    expect(beginEnglish(state).ok).toBe(true);
    expect(cancelMove(state).ok).toBe(true);
    expect(state).toMatchObject({ relocationsLeft: 2, movedThisSearch: false, pendingMove: null, english: null });
    expect(state.ghost.transit).toBe(false);
    expect(state.stats.acceptedAnswers).toBe(1);
  });

  it("freezes every state field while the English panel is open", () => {
    const state = started();
    expect(requestMove(state, destination(state).id).ok).toBe(true);
    expect(beginEnglish(state).ok).toBe(true);
    const snapshot = JSON.stringify(state);
    expect(step(state, 100)).toEqual([]);
    expect(JSON.stringify(state)).toBe(snapshot);
  });

  it("rejects another relocation in transit and within the same search", () => {
    const state = started();
    commitMove(state);
    expect(state.relocationsLeft).toBe(1);
    expect(state.stats.relocations).toBe(1);
    expect(requestMove(state, "bedroom.bed.under").ok).toBe(false);
    finishMovement(state);
    expect(requestMove(state, "bedroom.bed.under").ok).toBe(false);
  });

  it("rejects a third relocation after two accepted moves", () => {
    const state = started();
    commitMove(state);
    finishMovement(state);
    const empty = spotsInRoom("bedroom").find((spot) => spot.id !== state.ghost.spotId)!;
    inspect(state, empty.id);
    expect(state.movedThisSearch).toBe(false);
    commitMove(state);
    finishMovement(state);
    inspect(state, spotsInRoom("bedroom").find((spot) => spot.id !== state.ghost.spotId)!.id);
    expect(state.relocationsLeft).toBe(0);
    expect(state.stats.relocations).toBe(2);
    expect(requestMove(state, "bedroom.bed.under").ok).toBe(false);
  });

  it("locks relocation when inspection of the occupied spot has begun", () => {
    const state = started();
    const spot = destination(state);
    state.detective.phase = "search";
    state.detective.target = state.ghost.spotId;
    expect(requestMove(state, spot.id).ok).toBe(false);
  });
});

describe("search resolution", () => {
  it("loses only when an occupied spot finishes inspection", () => {
    const state = started();
    state.detective.phase = "search";
    state.detective.target = state.ghost.spotId;
    state.detective.elapsed = 0;
    expect(step(state, 1).some((event) => event.type === "lost")).toBe(false);
    expect(state.status).toBe("playing");
    const events = step(state, 1.1);
    expect(state.status).toBe("lost");
    expect(events.some((event) => event.type === "found")).toBe(true);
    expect(events.some((event) => event.type === "lost" && event.reason === "found")).toBe(true);
  });

  it("finds a ghost arriving at the inspected destination", () => {
    const state = started("shadow");
    expect(useAbility(state).ok).toBe(true);
    const spot = commitMove(state);
    state.detective.phase = "search";
    state.detective.target = spot.id;
    state.detective.elapsed = 1.95;
    const events = step(state, 0.1);
    expect(events.some((event) => event.type === "found")).toBe(true);
    expect(state.status).toBe("lost");
  });

  it("wins after exactly five completed empty searches", () => {
    const state = started();
    const empty = spotsInRoom("bedroom").filter((spot) => spot.id !== state.ghost.spotId);
    for (let i = 0; i < 5; i++) {
      const events = inspect(state, empty[i].id);
      expect(state.stats.completedSearches).toBe(i + 1);
      expect(state.searchesLeft).toBe(4 - i);
      expect(events.some((event) => event.type === "searchEmpty")).toBe(true);
      expect(state.status).toBe(i === 4 ? "won" : "playing");
    }
    expect(state.events.some((event) => event.type === "won")).toBe(true);
  });

  it("dissolves an inspected decoy and counts it as a completed search", () => {
    const state = started("mischief");
    const target = abilityTargets(state).find((spot) => spot.id !== state.ghost.spotId)!;
    expect(useAbility(state, target.id).ok).toBe(true);
    const events = inspect(state, target.id);
    expect(events.some((event) => event.type === "searchEmpty" && event.decoy)).toBe(true);
    expect(state.effects.decoy).toBeNull();
    expect(state.stats.completedSearches).toBe(1);
    expect(state.searchesLeft).toBe(4);
  });
});

describe("ability commands and deterministic state", () => {
  it.each(GHOST_ORDER)("allows exactly one %s ability activation", (ghost) => {
    const state = started(ghost);
    const target = abilityTargets(state).find((spot) => spot.id !== state.ghost.spotId);
    expect(useAbility(state, target?.id).ok).toBe(true);
    expect(state.abilityUsed).toBe(true);
    expect(useAbility(state, target?.id).ok).toBe(false);
    expect(state.events.some((event) => event.type === "abilityFx" && event.ghost === ghost)).toBe(true);
  });

  it.each(["sneaky", "bouncy", "shadow"] as const)("applies %s to the next relocation and still spends it", (ghost) => {
    const state = started(ghost);
    expect(useAbility(state).ok).toBe(true);
    commitMove(state);
    expect(state.relocationsLeft).toBe(1);
    expect(state.effects.nextMove).toBeNull();
    expect(state.ghost.silent).toBe(ghost === "sneaky");
    expect(state.ghost.invisible).toBe(ghost === "shadow");
    if (ghost === "bouncy") {
      expect(state.ghost.loudness).toBeCloseTo(1.6);
      expect(state.ghost.speed).toBeGreaterThan(2);
    }
  });

  it("does not spend a targeted ability for an invalid spot", () => {
    for (const ghost of ["hungry", "mischief"] as const) {
      const state = started(ghost);
      expect(useAbility(state, "dining.table.under").ok).toBe(false);
      expect(state.abilityUsed).toBe(false);
    }
  });

  it("has a JSON round trip with identical subsequent state and events", () => {
    const state = started();
    step(state, 3.75);
    const restored = JSON.parse(JSON.stringify(state)) as MatchState;
    expect(step(restored, 7.25)).toEqual(step(state, 7.25));
    expect(restored).toEqual(state);
  });

  it("repeats the same seeded match and drains events explicitly", () => {
    const first = started();
    const second = started();
    for (let i = 0; i < 180; i++) {
      expect(step(first, 0.25)).toEqual(step(second, 0.25));
      expect(first).toEqual(second);
    }
    const events = takeEvents(first);
    expect(events.length).toBeGreaterThan(0);
    expect(takeEvents(first)).toEqual([]);
    expect(first.events).toEqual([]);
    expect(getSpot(first.ghost.spotId!).room).toBe("bedroom");
  });
});
