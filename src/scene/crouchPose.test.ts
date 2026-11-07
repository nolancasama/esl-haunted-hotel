import { describe, expect, it } from "vitest";
import { ANKLE_Y, ankleFrom, bodyOffset, ease, kneeFrom, searchPoseFor, solveLeg } from "./crouchPose";

const depths = Array.from({ length: 21 }, (_, i) => i / 20);

describe("detective crouch", () => {
  it("stands with straight legs", () => {
    const leg = solveLeg(0);
    expect(Math.abs(leg.hip)).toBeLessThan(0.01);
    expect(Math.abs(leg.knee)).toBeLessThan(0.01);
  });

  it("keeps the feet planted at every depth", () => {
    for (const k of depths) {
      const ankle = ankleFrom(k, solveLeg(k));
      expect(ankle.y).toBeCloseTo(ANKLE_Y, 3);
      expect(ankle.z).toBeCloseTo(0, 3);
    }
  });

  it("bends the knees forward, never backward, and keeps the foot flat", () => {
    for (const k of depths.slice(1)) {
      const leg = solveLeg(k);
      expect(leg.knee).toBeGreaterThan(0);
      expect(leg.hip).toBeLessThan(0); // thigh swings forward
      expect(kneeFrom(k, leg).z).toBeGreaterThan(0); // knee ahead of the feet
      expect(leg.hip + leg.knee + leg.ankle).toBeCloseTo(0, 6);
    }
  });

  it("lowers the hips smoothly as the knees bend", () => {
    let last = -1;
    for (const k of depths) {
      const { drop } = bodyOffset(k);
      expect(drop).toBeGreaterThanOrEqual(last);
      last = drop;
      expect(kneeFrom(k, solveLeg(k)).y).toBeGreaterThan(ANKLE_Y); // knee never through the floor
    }
  });

  it("chooses a pose from the hiding place", () => {
    expect(searchPoseFor("under", 0.3).depth).toBe(1);
    expect(searchPoseFor("in", 0.3).depth).toBeGreaterThan(0.5); // a low box
    expect(searchPoseFor("in", 2).depth).toBe(0); // a wardrobe
    expect(searchPoseFor("on", 0.75).depth).toBe(0); // a table top
    expect(searchPoseFor("on", 1.8).head).toBeLessThan(0); // looks up at a high shelf
    expect(searchPoseFor("by", 1.9).depth).toBe(0); // tall furniture
    expect(searchPoseFor("by", 0.4).depth).toBeGreaterThan(0);
  });

  it("eases from 0 to 1", () => {
    expect(ease(-1)).toBe(0);
    expect(ease(0.5)).toBe(0.5);
    expect(ease(2)).toBe(1);
  });
});
