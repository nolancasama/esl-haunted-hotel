import { describe, expect, expectTypeOf, it } from "vitest";
import { chooseTarget, decaySuspicion, investigateClue, receiveClue } from "./detective";
import { detectiveView, addClue } from "./evidence";
import { chooseStart, answerEnglish, createMatch, step, useAbility } from "./match";
import { roomLayout } from "./navigation";
import type { Clue, DetectiveView } from "./types";

function fixture(seed = 23): DetectiveView {
  return detectiveView(createMatch({ ghost: "sleepy", room: "bedroom", seed, level: "standard" }));
}

describe("detective fairness and memory", () => {
  it("has no truth fields in its structural input and never reads ghost truth", () => {
    expectTypeOf<"ghost">().not.toExtend<keyof DetectiveView>();
    expectTypeOf<"spotId">().not.toExtend<keyof DetectiveView>();
    for (let seed = 1; seed <= 30; seed++) {
      const a = createMatch({ ghost: "sleepy", room: "bedroom", seed, level: "standard" });
      const b = JSON.parse(JSON.stringify(a)) as typeof a;
      a.ghost.spotId = "bedroom.bed.under";
      b.ghost.spotId = "bedroom.desk.on";
      a.ghost.x = -7; b.ghost.x = -1;
      const chosenA: string[] = [];
      const chosenB: string[] = [];
      for (let i = 0; i < 5; i++) {
        const p = roomLayout("bedroom").spots[i].hidePos;
        const clue: Clue = { id: i + 1, time: i * 10, kind: "sound", x: p.x + 0.7, z: p.z - 0.2, strength: 22 };
        for (const state of [a, b]) {
          state.time = clue.time;
          receiveClue(detectiveView(state), clue);
          const target = chooseTarget(detectiveView(state));
          (state === a ? chosenA : chosenB).push(target.id);
          state.detective.searched[target.id] = clue.id;
        }
      }
      expect(chosenA).toEqual(chosenB);
    }
  });

  it("avoids searched empty spots until a newer local clue reopens them", () => {
    const view = fixture();
    const spot = view.spots[0];
    view.detective.searched[spot.id] = 10;
    receiveClue(view, { id: 9, time: 0, kind: "glimpse", ...spot.hidePos, strength: 30 });
    for (let i = 0; i < 100; i++) expect(chooseTarget(view).id).not.toBe(spot.id);
    receiveClue(view, { id: 11, time: 0, kind: "glimpse", ...spot.hidePos, strength: 30 });
    const choices = Array.from({ length: 200 }, () => chooseTarget(view).id);
    expect(choices).toContain(spot.id);
  });

  it("raises, clamps, decays and focuses suspicion on public clue regions", () => {
    const view = fixture();
    const spot = view.spots[3];
    const clue: Clue = { id: 1, time: 0, kind: "glimpse", ...spot.hidePos, strength: 30 };
    receiveClue(view, clue);
    expect(view.detective.suspicion).toBe(30);
    receiveClue(view, { ...clue, id: 2, strength: 100 });
    expect(view.detective.suspicion).toBe(100);
    expect(view.detective.focusClue).toBe(2);
    const chosen = chooseTarget(view);
    expect(Math.hypot(chosen.hidePos.x - clue.x, chosen.hidePos.z - clue.z)).toBe(0);
    view.time = 20;
    decaySuspicion(view, 10);
    expect(view.detective.suspicion).toBe(80);
    decaySuspicion(view, 100);
    expect(view.detective.suspicion).toBe(0);
  });

  it("usually follows munching but discounts searched spots and conflicting suspicion", () => {
    function follows(searched: boolean, conflicting: boolean): number {
      let count = 0;
      for (let seed = 1; seed <= 400; seed++) {
        const view = fixture(seed);
        const spot = view.spots[0];
        view.detective.phase = "approach";
        if (searched) view.detective.searched[spot.id] = 0;
        if (conflicting) {
          view.detective.suspicion = 70;
          receiveClue(view, { id: 1, time: 0, kind: "sound", x: spot.hidePos.x + 5, z: spot.hidePos.z, strength: 0 });
        }
        receiveClue(view, { id: 2, time: 0, kind: "munch", ...spot.hidePos, strength: 18 });
        if (investigateClue(view)) count++;
      }
      return count;
    }
    const normal = follows(false, false);
    expect(normal).toBeGreaterThan(280);
    expect(normal).toBeLessThan(400);
    expect(follows(true, false)).toBeLessThan(normal / 2);
    expect(follows(false, true)).toBeLessThan(normal / 2);
  });

  it("sometimes sees through decoys, more often when suspicious", () => {
    const counts = [0, 0];
    for (let seed = 1; seed <= 200; seed++) for (let suspicious = 0; suspicious < 2; suspicious++) {
      const view = fixture(seed);
      const spot = view.spots[0];
      view.detective.phase = "approach";
      view.detective.suspicion = suspicious ? 68 : 0;
      receiveClue(view, { id: 1, time: 0, kind: "decoy", ...spot.hidePos, strength: 0 });
      if (investigateClue(view)) counts[suspicious]++;
    }
    expect(counts[0]).toBeGreaterThan(counts[1]);
    expect(counts[1]).toBeGreaterThan(0);
    expect(counts[0]).toBeLessThan(200);
  });

  it("Deep Sleep subtracts thirty and halves clue gains until the search completes", () => {
    const state = createMatch({ ghost: "sleepy", room: "bedroom", seed: 10, level: "standard" });
    chooseStart(state, "bedroom.bed.under");
    answerEnglish(state, ["under"]);
    state.detective.suspicion = 60;
    useAbility(state);
    expect(state.detective.suspicion).toBe(30);
    addClue(state, { kind: "sound", x: 0, z: 0, strength: 20 });
    expect(state.detective.suspicion).toBe(40);
    state.detective.phase = "search";
    state.detective.target = "bedroom.bed.on";
    state.detective.elapsed = 1.95;
    step(state, 0.05);
    expect(state.effects.sleepySearch).toBeNull();
    const before = state.detective.suspicion;
    addClue(state, { kind: "sound", x: 0, z: 0, strength: 20 });
    expect(state.detective.suspicion).toBe(before + 20);
  });
});
