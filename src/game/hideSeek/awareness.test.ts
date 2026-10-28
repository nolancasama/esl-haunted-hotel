import { describe, expect, it } from "vitest";
import { heartbeatLevel } from "../../audio/heartbeat";
import { FLOOR_Y, ROOMS } from "../world/rooms";
import { answerEnglish, chooseStart, createMatch, step, takeEvents } from "./match";
import { awarenessOf, SPOTTED_HOLD, SUSPICIOUS_AT } from "./awareness";
import { hasLineOfSight } from "./perception";
import type { MatchState } from "./types";

const reading = (suspicion: number, sinceSeen = 100, status: MatchState["status"] = "playing") =>
  awarenessOf({ status, time: 50, seenAt: 50 - sinceSeen, detective: { suspicion } });

function hidden(spotId = "bedroom.bed.under") {
  const state = createMatch({ ghost: "sleepy", room: "bedroom", seed: 17, level: "standard" });
  expect(chooseStart(state, spotId).ok).toBe(true);
  expect(answerEnglish(state, [spotId.split(".")[2]]).ok).toBe(true);
  takeEvents(state);
  return state;
}

describe("stealth awareness", () => {
  it("keeps suspicion and sight apart", () => {
    expect(reading(0).state).toBe("hidden");
    expect(reading(SUSPICIOUS_AT - 1).state).toBe("hidden");
    expect(reading(SUSPICIOUS_AT).state).toBe("suspicious");
    // Even certain suspicion is not "spotted" without sight...
    expect(reading(100).state).toBe("suspicious");
    // ...and sight is "spotted" with no suspicion yet.
    expect(reading(0, 0).state).toBe("spotted");
    expect(reading(0, SPOTTED_HOLD + 0.05).state).toBe("hidden");
    // Losing sight but remembering the clue drops back to suspicious.
    expect(reading(40, 1).state).toBe("suspicious");
  });

  it("opens wider as suspicion rises and closes as it decays", () => {
    const low = reading(SUSPICIOUS_AT + 2).open, high = reading(90).open;
    expect(low).toBeGreaterThan(0);
    expect(high).toBeGreaterThan(low);
    expect(high).toBeLessThan(1);
    expect(reading(0, 0).open).toBe(1);
    expect(reading(5).open).toBe(0);
  });

  it("shows nothing once the match is over", () => {
    expect(reading(100, 0, "won").state).toBe("hidden");
    expect(reading(100, 0, "lost").state).toBe("hidden");
  });

  it("a close detective with no evidence raises the heartbeat but not the eye", () => {
    const s = hidden();
    s.effects.sleepySearch = s.stats.completedSearches; // no creaks: the ghost makes no sound
    s.detective.phase = "observe";
    s.detective.x = s.ghost.x + 0.9; s.detective.z = s.ghost.z;
    s.detective.yaw = -Math.PI / 2; // looking straight at the bed
    for (let i = 0; i < 6; i++) step(s, 0.05);
    expect(heartbeatLevel(Math.hypot(s.detective.x - s.ghost.x, s.detective.z - s.ghost.z))).toBeGreaterThan(0.5);
    expect(s.detective.suspicion).toBe(0);
    expect(awarenessOf(s).state).toBe("hidden");
  });

  it("a ghost in the open in front of the detective is spotted", () => {
    const s = hidden();
    const base = FLOOR_Y[ROOMS.bedroom.floor];
    const b = ROOMS.bedroom.bounds;
    // Find a clear line of sight inside the room and float the ghost there.
    let found = false;
    for (let a = 0; a < Math.PI * 2 && !found; a += Math.PI / 12) {
      const x = s.detective.x + Math.sin(a) * 3, z = s.detective.z + Math.cos(a) * 3;
      if (x < b.x0 + 0.3 || x > b.x1 - 0.3 || z < b.z0 + 0.3 || z > b.z1 - 0.3) continue;
      if (!hasLineOfSight("bedroom", { x: s.detective.x, y: base + 1.4, z: s.detective.z }, { x, y: base + 0.6, z })) continue;
      Object.assign(s.ghost, { x, y: base + 0.25, z, transit: true, hidden: false, path: [{ x, y: base + 0.25, z }] });
      s.detective.yaw = a;
      s.detective.phase = "observe";
      found = true;
    }
    expect(found).toBe(true);
    step(s, 0.05);
    expect(s.seenAt).toBe(s.time);
    expect(awarenessOf(s).state).toBe("spotted");
  });

  it("a concealed ghost is never spotted over a whole match", () => {
    const s = hidden();
    const states = new Set<string>();
    while (s.status === "playing" && s.time < 200) {
      step(s, 0.05);
      takeEvents(s);
      if (!s.ghost.transit) states.add(awarenessOf(s).state);
    }
    expect(states.has("spotted")).toBe(false);
    expect(s.seenAt).toBe(-100);
  });
});
