import { describe, expect, it } from "vitest";
import { EXIT_END_X, EXIT_START, exitIntent } from "./exitTrack";

describe("exit track", () => {
  it("starts inside the foyer and ends outside the front door (at x -8)", () => {
    expect(EXIT_START.x).toBeGreaterThan(-8);
    expect(EXIT_END_X).toBeLessThan(-8.5);
  });

  it("walks forward (west) for forward or sideways input and for a tap", () => {
    for (const [x, z] of [[-1, 0], [0, 1], [0, -1], [-0.7, 0.7]]) expect(exitIntent(x, z, false, 0).x).toBeLessThan(-0.5);
    expect(exitIntent(0, 0, true, 0).x).toBeCloseTo(-1);
    expect(exitIntent(1, 0, true, 0).x).toBeCloseTo(-1);
  });

  it("never walks back into the house", () => {
    expect(exitIntent(1, 0, false, 0)).toEqual({ x: 0, z: 0 });
    expect(exitIntent(0.9, 0.2, false, 0)).toEqual({ x: 0, z: 0 });
    expect(exitIntent(0, 0, false, 0)).toEqual({ x: 0, z: 0 });
    for (const [x, z] of [[-1, 0], [0, 1], [1, 0], [0.3, -1]]) for (const t of [false, true]) expect(exitIntent(x, z, t, 0.4).x).toBeLessThanOrEqual(0);
  });

  it("steers back to the middle of the doorway, whichever way the input points", () => {
    expect(exitIntent(0, 1, false, 0.5).z).toBeLessThan(0);
    expect(exitIntent(0, 1, false, -0.5).z).toBeGreaterThan(0);
    expect(exitIntent(-1, 0, false, 0).z).toBeCloseTo(0);
  });
});
