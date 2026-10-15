import { describe, expect, it } from "vitest";
import { HOP_HEIGHT, HOP_TIME, STARTLE_TIME, TURN_TIME, startlePose, turnDelta } from "./startle";

describe("startlePose", () => {
  it("starts and ends at rest", () => {
    for (const t of [-0.05, 0]) expect(startlePose(t)).toEqual({ lift: 0, lean: -0, arms: 0, turn: 0, done: false });
    const end = startlePose(STARTLE_TIME);
    expect(end.lift).toBe(0);
    expect(end.lean === 0).toBe(true);
    expect(end.arms).toBe(0);
    expect(end.turn).toBe(1);
    expect(end.done).toBe(true);
  });

  it("hops in a small arc with a soft landing", () => {
    expect(startlePose(HOP_TIME / 2).lift).toBeCloseTo(HOP_HEIGHT);
    let max = 0;
    let min = 0;
    for (let t = 0; t <= STARTLE_TIME; t += 0.005) {
      const { lift } = startlePose(t);
      max = Math.max(max, lift);
      min = Math.min(min, lift);
    }
    expect(max).toBeLessThanOrEqual(HOP_HEIGHT + 1e-9);
    expect(max).toBeLessThan(0.25); // a small hop, not a leap
    expect(min).toBeGreaterThan(-0.05); // a gentle squash on landing
  });

  it("turns smoothly in about half a second, never jumping", () => {
    expect(TURN_TIME).toBeGreaterThanOrEqual(0.4);
    expect(TURN_TIME).toBeLessThanOrEqual(0.7);
    let prev = 0;
    for (let t = 0; t <= STARTLE_TIME + 0.1; t += 1 / 60) {
      const { turn } = startlePose(t);
      expect(turn).toBeGreaterThanOrEqual(prev);
      expect(turn - prev).toBeLessThan(0.1); // at 60 fps no frame turns more than a tenth of the way
      prev = turn;
    }
    // the turn begins while still in the air: one reaction, not two
    expect(startlePose(HOP_TIME - 0.01).turn).toBeGreaterThan(0);
  });
});

describe("turnDelta", () => {
  it("takes the short way round", () => {
    expect(turnDelta(0, 1, 1)).toBeCloseTo(1);
    expect(turnDelta(0.2, -0.3, 1)).toBeCloseTo(-0.5);
    expect(turnDelta(3, -3, 1)).toBeCloseTo(2 * Math.PI - 6);
  });

  it("goes round the preferred side for a half-turn", () => {
    expect(turnDelta(Math.PI / 2, -Math.PI / 2, -1)).toBeCloseTo(-Math.PI);
    expect(turnDelta(Math.PI / 2, -Math.PI / 2, 1)).toBeCloseTo(Math.PI);
    expect(turnDelta(Math.PI / 2, -Math.PI / 2 + 0.1, 1)).toBeCloseTo(Math.PI + 0.1);
  });
});
