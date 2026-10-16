import { describe, expect, it } from "vitest";
import { HOP_HEIGHT, LAND, STARTLE_TIME, TAKE_OFF, TURN_TIME, startlePose, turnDelta } from "./startle";

describe("startlePose", () => {
  it("starts and ends at rest", () => {
    for (const t of [-0.05, 0]) expect(startlePose(t)).toEqual({ lift: 0, lean: -0, arms: 0, stretch: 1, turn: 0, done: false });
    const end = startlePose(STARTLE_TIME);
    expect(end.lift).toBe(0);
    expect(end.lean === 0).toBe(true);
    expect(end.arms).toBe(0);
    expect(end.stretch).toBe(1);
    expect(end.turn).toBe(1);
    expect(end.done).toBe(true);
  });

  it("flinches, then hops high enough to read from the cutscene camera, and lands softly", () => {
    expect(startlePose(TAKE_OFF / 2).lift).toBeLessThan(0); // the crouch before take-off
    expect(startlePose((TAKE_OFF + LAND) / 2).lift).toBeCloseTo(HOP_HEIGHT);
    let max = 0;
    let min = 0;
    for (let t = 0; t <= STARTLE_TIME; t += 0.005) {
      const { lift, stretch } = startlePose(t);
      max = Math.max(max, lift);
      min = Math.min(min, lift);
      expect(stretch).toBeGreaterThan(0.85);
      expect(stretch).toBeLessThan(1.1);
    }
    expect(max).toBeLessThanOrEqual(HOP_HEIGHT + 1e-9);
    expect(max).toBeGreaterThanOrEqual(0.25); // a quarter of the player's height: clearly a jump
    expect(max).toBeLessThan(0.4); // a hop, not a leap
    expect(min).toBeGreaterThan(-0.1); // a gentle squash
  });

  it("throws the arms up and recoils in the air", () => {
    const mid = startlePose((TAKE_OFF + LAND) / 2);
    expect(mid.arms).toBeGreaterThan(0.95);
    expect(mid.lean).toBeLessThan(-0.15);
  });

  it("turns smoothly, mostly in the air, never jumping", () => {
    expect(TURN_TIME).toBeGreaterThanOrEqual(0.6);
    expect(TURN_TIME).toBeLessThanOrEqual(0.9);
    let prev = 0;
    for (let t = 0; t <= STARTLE_TIME + 0.1; t += 1 / 60) {
      const { turn } = startlePose(t);
      expect(turn).toBeGreaterThanOrEqual(prev);
      expect(turn - prev).toBeLessThan(0.1); // at 60 fps no frame turns more than a tenth of the way
      prev = turn;
    }
    // one reaction, not two: the turn is well under way by the time the feet touch down
    expect(startlePose(LAND).turn).toBeGreaterThan(0.6);
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
