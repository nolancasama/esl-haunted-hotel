import { describe, expect, it } from "vitest";
import { floorState, moveBody, nearestSearchable } from "./collision";
import { PLAYER_R } from "./constants";
import { rectCenter, rectDistance } from "./geometry";
import { canWalkSegment, findPath, type NavPoint } from "./nav";
import { WORLD } from "./world";

const open = () => true;
const point = (x: number, z: number, floor: 0 | 1 = 0): NavPoint => ({ x, z, floor });

/** Verify samples with the real movement resolver, including floor transitions. */
function walkPath(start: NavPoint, path: NavPoint[], doorOpen: (id: string) => boolean = open): NavPoint[] {
  const samples: NavPoint[] = [];
  let current = start;
  for (const end of path) {
    expect(canWalkSegment(current, end, doorOpen)).toBe(true);
    const from = current;
    const count = Math.max(1, Math.ceil(Math.hypot(end.x - from.x, end.z - from.z) / 0.04));
    for (let i = 1; i <= count; i++) {
      const x = from.x + (end.x - from.x) * i / count;
      const z = from.z + (end.z - from.z) * i / count;
      const moved = moveBody(x, z, current.floor, doorOpen);
      expect(moved.x).toBeCloseTo(x, 6);
      expect(moved.z).toBeCloseTo(z, 6);
      current = { x: moved.x, z: moved.z, floor: moved.floor };
      samples.push(current);
    }
    expect(current.floor).toBe(end.floor);
  }
  return samples;
}

describe("tap navigation", () => {
  it("routes around furniture instead of crossing its footprint", () => {
    const start = point(1.6, 7.6);
    const end = point(5.7, 7.6);
    const table = WORLD.objectById.get("storage.table")!;
    expect(canWalkSegment(start, end, open)).toBe(false);
    const path = findPath(start, end, open)!;
    expect(path).not.toBeNull();
    expect(path.length).toBeGreaterThan(1);
    expect(path.length).toBeLessThan(7);
    for (const sample of walkPath(start, path)) {
      expect(rectDistance(table.rect, sample.x, sample.z)).toBeGreaterThanOrEqual(PLAYER_R);
    }
  });

  it("passes through an open doorway and refuses the same locked door", () => {
    const start = point(-4, -2);
    const end = point(-4, -6);
    const path = findPath(start, end, id => id === "bedroom")!;
    expect(path).not.toBeNull();
    expect(path.length).toBe(1);
    walkPath(start, path, id => id === "bedroom");
    expect(findPath(start, end, () => false)).toBeNull();
    expect(findPath(start, point(-6, -9.75), () => false)).toBeNull();
  });

  it("updates passability when a door opens and closes without rebuilding geometry", () => {
    const start = point(4, -2);
    const end = point(4, -5.2);
    expect(findPath(start, end, () => false)).toBeNull();
    expect(findPath(start, end, id => id === "dining")).not.toBeNull();
    expect(findPath(start, end, () => false)).toBeNull();
  });

  it("uses the stairs for both floor changes and respects the closed gate", () => {
    const start = point(2, 0);
    const end = point(7.1, 0, 1);
    expect(findPath(start, end, id => id !== "stairs")).toBeNull();
    const up = findPath(start, end, open)!;
    expect(up).not.toBeNull();
    expect(up.length).toBeLessThan(7);
    const climbed = walkPath(start, up);
    expect(climbed.some(p => p.floor === 0 && floorState(p.x, p.z, p.floor).stairs)).toBe(true);
    expect(climbed.some(p => p.floor === 1 && floorState(p.x, p.z, p.floor).stairs)).toBe(true);
    expect(climbed.at(-1)?.floor).toBe(1);
    const down = findPath(end, start, open)!;
    expect(down).not.toBeNull();
    expect(walkPath(end, down).at(-1)?.floor).toBe(0);
  });

  it("cannot shortcut vertically between stacked rooms", () => {
    const start = point(-4, -6);
    const end = point(-4, -6, 1);
    expect(canWalkSegment(start, end, open)).toBe(false);
    const path = findPath(start, end, open)!;
    expect(path).not.toBeNull();
    const samples = walkPath(start, path);
    const transition = samples.findIndex((sample, i) => i > 0 && sample.floor !== samples[i - 1].floor);
    expect(transition).toBeGreaterThan(0);
    expect(floorState(samples[transition].x, samples[transition].z, 0).stairs).toBe(true);
  });

  it("snaps a furniture-interior tap to a reachable cell in that room", () => {
    const start = point(1.6, 7.6);
    const path = findPath(start, point(3.6, 7.6), open)!;
    expect(path).not.toBeNull();
    const last = path.at(-1)!;
    expect(rectDistance(WORLD.objectById.get("storage.table")!.rect, last.x, last.z)).toBeGreaterThan(PLAYER_R);
    walkPath(start, path);
  });

  it("snaps an exact interior wall tap locally instead of navigating to the porch", () => {
    const start = point(-4, -6);
    const destination = point(0, -6);
    const path = findPath(start, destination, open)!;
    expect(path).not.toBeNull();
    const end = path.at(-1)!;
    expect(Math.hypot(end.x - destination.x, end.z - destination.z)).toBeLessThanOrEqual(1);
    walkPath(start, path);
  });

  it("keeps targets inside a locked adjacent room from snapping across its wall", () => {
    const start = point(-4, -6);
    const doorOpen = (id: string) => id === "bedroom" || id === "entrance";
    const path = findPath(start, point(0, -6), doorOpen)!;
    expect(path).not.toBeNull();
    expect(path.at(-1)!.x).toBeLessThan(0);
    expect(findPath(start, point(0.01, -6), doorOpen)).toBeNull();
    walkPath(start, path, doorOpen);
  });

  it("string-pulls open floor paths to a single precise waypoint", () => {
    const start = point(-6.3, 0);
    const end = point(1.13, -0.24);
    expect(findPath(start, end, open)).toEqual([end]);
  });

  it("can leave a collision-valid start at the edge of furniture", () => {
    const table = WORLD.objectById.get("storage.table")!;
    const start = point(table.rect.x0 - PLAYER_R, 7.6);
    expect(moveBody(start.x, start.z, 0, open).x).toBeCloseTo(start.x);
    const path = findPath(start, point(1.6, 6), open);
    expect(path).not.toBeNull();
    expect(path!.at(-1)).toEqual(point(1.6, 6));
  });

  it("can exit through the open entrance but keeps the porch locked before then", () => {
    const start = point(-6.3, 0);
    const end = point(-9.5, 0);
    expect(findPath(start, end, () => false)).toBeNull();
    const path = findPath(start, end, id => id === "entrance")!;
    expect(path).not.toBeNull();
    expect(path.at(-1)).toEqual(end);
    walkPath(start, path, id => id === "entrance");
  });

  it("finds an approach accepted by nearestSearchable for every interactive object", () => {
    const start = point(-6.3, 0);
    for (const object of WORLD.objects.filter(o => o.interactive)) {
      const centre = rectCenter(object.rect);
      const path = findPath(start, { ...centre, floor: object.floor }, open, object.id);
      expect(path, object.id).not.toBeNull();
      const end = path!.at(-1)!;
      const facing = Math.atan2(centre.x - end.x, centre.z - end.z);
      expect(nearestSearchable(end.x, end.z, facing, end.floor), object.id).toBe(object.id);
      walkPath(start, path!);
    }
  });
});
