import { describe, expect, it } from "vitest";
import { mulberry32 } from "../logic/rng";
import { FLOOR_Y, ROOMS } from "../world/rooms";
import { WORLD } from "../world/world";
import {
  blurredClue, hasLineOfSight, initialPerceptionTimers, inVisionCone,
  movementHearingRadius, perceive, type PerceptionInput
} from "./perception";

function scene(overrides: Partial<PerceptionInput> = {}): PerceptionInput {
  return {
    room: "bedroom",
    detective: { x: -4, z: -7.5, yaw: 0 },
    ghost: {
      x: -4, y: 0.1, z: -6.5, spotId: "bedroom.window.by", transit: false,
      speed: 0, silent: false, invisible: false, loudness: 1
    },
    bubbles: [], music: false, sleepy: false, timers: initialPerceptionTimers(),
    ...overrides
  };
}

describe("Hide & Seek perception", () => {
  it("uses a 70 degree, 5 metre forward vision cone", () => {
    const observer = { x: 0, z: 0, yaw: 0 };
    expect(inVisionCone(observer, { x: 0, z: 5 })).toBe(true);
    expect(inVisionCone(observer, { x: 0, z: 5.01 })).toBe(false);
    expect(inVisionCone(observer, { x: 2, z: 1 })).toBe(false);
    expect(inVisionCone(observer, { x: 0, z: -1 })).toBe(false);
    expect(inVisionCone({ ...observer, yaw: Math.PI / 2 }, { x: 4, z: 0 })).toBe(true);
  });

  it("conceals in/under and high on spots, but glimpses exposed on/by", () => {
    const input = scene();
    for (const spotId of ["bedroom.box.in", "bedroom.bed.under"]) {
      expect(perceive({ ...input, ghost: { ...input.ghost, spotId } }, 0.05, mulberry32(1)).visible).toBe(false);
    }
    for (const spotId of ["bedroom.bed.on", "bedroom.window.by"]) {
      const result = perceive({ ...input, ghost: { ...input.ghost, spotId } }, 0.05, mulberry32(1));
      expect(result.visible).toBe(true);
      expect(result.clues.some((clue) => clue.kind === "glimpse")).toBe(true);
      expect(result.caughtInOpen).toBe(false);
    }
    const high = scene({ room: "storage", ghost: { ...input.ghost, spotId: "storage.shelf.on" } });
    expect(perceive(high, 0.05, mulberry32(1)).visible).toBe(false);
    const upstairs = scene({ room: "playroom", ghost: { ...input.ghost, spotId: "playroom.table.on", y: FLOOR_Y[1] + 0.61 } });
    // A low upstairs table is still exposed; eye line is relative to its own floor.
    expect(perceive(upstairs, 0.05, mulberry32(1)).visible).toBe(true);
  });

  it("occludes sight with actual WORLD tall furniture and room walls", () => {
    const shelf = WORLD.objectById.get("storage.shelf")!;
    const y = FLOOR_Y[ROOMS.storage.floor] + 1.3;
    const z = (shelf.rect.z0 + shelf.rect.z1) / 2;
    expect(hasLineOfSight("storage", { x: shelf.rect.x0 - 0.3, y, z }, { x: shelf.rect.x1 + 0.3, y, z })).toBe(false);
    expect(hasLineOfSight("bedroom", { x: -4, y: 1.4, z: -7.5 }, { x: -4, y: 0.5, z: -6.5 })).toBe(true);
    expect(hasLineOfSight("bedroom", { x: -4, y: 1.4, z: -10 }, { x: -4, y: 1.4, z: -12 })).toBe(false);
  });

  it("Bubble Screen blocks a crossing ray and expires without blocking", () => {
    const input = scene();
    const cloud = { x: -4, z: -7, radius: 1.5, remaining: 8 };
    expect(perceive({ ...input, bubbles: [cloud] }, 0.05, mulberry32(1)).visible).toBe(false);
    expect(perceive({ ...input, bubbles: [{ ...cloud, remaining: 0 }] }, 0.05, mulberry32(1)).visible).toBe(true);
  });

  it("requires continuous close sight in transit for a caught-in-open loss", () => {
    const input = scene();
    input.ghost = { ...input.ghost, transit: true, spotId: null, speed: 1 };
    const first = perceive(input, 0.35, mulberry32(1));
    expect(first.caughtInOpen).toBe(false);
    expect(first.clues.some((clue) => clue.kind === "glimpse")).toBe(true);
    const caught = perceive({ ...input, timers: first.timers }, 0.25, mulberry32(2));
    expect(caught.caughtInOpen).toBe(true);
    const broken = perceive({ ...input, timers: first.timers, ghost: { ...input.ghost, invisible: true } }, 0.1, mulberry32(3));
    expect(broken.timers.seenClose).toBe(0);
    expect(perceive({ ...input, timers: broken.timers }, 0.35, mulberry32(4)).caughtInOpen).toBe(false);
    const far = scene({ detective: { x: -4, z: -9.5, yaw: 0 }, ghost: input.ghost });
    expect(perceive(far, 1, mulberry32(1)).caughtInOpen).toBe(false);
  });

  it("Vanish removes visual clues while leaving normal movement sound", () => {
    const input = scene();
    input.ghost = { ...input.ghost, transit: true, speed: 1, invisible: true };
    const result = perceive(input, 1, mulberry32(1));
    expect(result.visible).toBe(false);
    expect(result.caughtInOpen).toBe(false);
    expect(result.clues.map((clue) => clue.kind)).toEqual(["sound"]);
  });

  it("Silent Move masks sound; Bounce raises hearing reach; Music masks it by one quarter", () => {
    expect(movementHearingRadius(1, 1, true)).toBeCloseTo(movementHearingRadius(1) * 0.25);
    expect(movementHearingRadius(2, 1.6)).toBeGreaterThan(movementHearingRadius(1));
    expect(movementHearingRadius(1, 1, false, true)).toBe(0);
    expect(movementHearingRadius(0)).toBe(0);
    const input = scene();
    input.ghost = { ...input.ghost, transit: true, speed: 1, silent: true };
    expect(perceive(input, 0.05, mulberry32(1)).clues.some((clue) => clue.kind === "sound")).toBe(false);
    input.ghost.silent = false;
    expect(perceive(input, 0.05, mulberry32(1)).clues.some((clue) => clue.kind === "sound")).toBe(true);
    expect(perceive({ ...input, music: true }, 0.05, mulberry32(1)).clues.some((clue) => clue.kind === "sound")).toBe(false);
  });

  it("Deep Sleep suppresses incidental hidden creaks", () => {
    const input = scene();
    input.ghost.spotId = "bedroom.box.in";
    const audible = perceive(input, 0.05, () => 0.1);
    expect(audible.clues.map((clue) => clue.kind)).toEqual(["creak"]);
    expect(perceive({ ...input, sleepy: true }, 0.05, () => 0.1).clues).toEqual([]);
    expect(perceive({ ...input, timers: audible.timers }, 0.05, () => 0.1).clues).toEqual([]);
    expect(perceive({ ...input, detective: { ...input.detective, z: -10 } }, 0.05, () => 0.1).clues).toEqual([]);
  });

  it("blurs sound within one metre and produces deterministic serializable clues", () => {
    const rng = mulberry32(16);
    for (let i = 0; i < 50; i++) {
      const clue = blurredClue("sound", { x: 2, z: 4 }, rng);
      expect(Math.hypot(clue.x - 2, clue.z - 4)).toBeLessThanOrEqual(1);
      expect(clue).not.toHaveProperty("spotId");
    }
    const input = scene();
    expect(perceive(input, 0.05, mulberry32(8))).toEqual(perceive(input, 0.05, mulberry32(8)));
    const before = JSON.stringify(input);
    perceive(input, 0.1, mulberry32(8));
    expect(JSON.stringify(input)).toBe(before);
  });
});
