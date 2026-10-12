import { describe, expect, it } from "vitest";
import { PREPS, type Rot, type Vec3 } from "../types";
import { circleHitsRect, rectContains, rectDistance, rotateXZ } from "./geometry";
import { GHOST_H, GHOST_R } from "./kinds";
import { ROOMS, WALL_T } from "./rooms";
import { WORLD, type HidingSpot, type WorldObject } from "./world";
import { INTERACT_RANGE, PLAYER_R, PRACTICE_START } from "./constants";

const EPS = 1e-6;

function toLocal(obj: WorldObject, p: Vec3): Vec3 {
  const back = ((360 - obj.rot) % 360) as Rot;
  const r = rotateXZ(p.x - obj.x, p.z - obj.z, back);
  return { x: r.x, y: p.y, z: r.z };
}

/** Worst-case floor radius of a (possibly squashed) ghost that turns to face the camera. */
function radius(spot: HidingSpot): number {
  return GHOST_R * Math.max(spot.scale[0], spot.scale[2]);
}

function height(spot: HidingSpot): number {
  return GHOST_H * spot.scale[1];
}

function inArea(area: { x0: number; x1: number; z0: number; z1: number }, p: Vec3, r: number): boolean {
  return p.x - r >= area.x0 - EPS && p.x + r <= area.x1 + EPS && p.z - r >= area.z0 - EPS && p.z + r <= area.z1 + EPS;
}

const objectOf = (spot: HidingSpot) => WORLD.objectById.get(spot.objectId)!;

describe("hiding spots are physically what the clue says", () => {
  for (const spot of WORLD.spots) {
    const obj = objectOf(spot);
    const spec = obj.spec;
    const r = radius(spot);
    const h = height(spot);

    it(`${spot.id}: "${spot.prep} the ${spot.noun}"`, () => {
      const local = toLocal(obj, spot.pos);
      const hidden = toLocal(obj, spot.hidePos);
      switch (spot.prep) {
        case "on": {
          const on = spec.on!;
          expect(local.y).toBeGreaterThanOrEqual(on.y - EPS);
          expect(local.y - on.y).toBeLessThan(0.05); // sitting, not floating away
          expect(inArea(on.area, local, r)).toBe(true);
          // The surface belongs to the object.
          expect(on.area.x0).toBeGreaterThanOrEqual(-spec.w / 2 - EPS);
          expect(on.area.x1).toBeLessThanOrEqual(spec.w / 2 + EPS);
          expect(on.area.z0).toBeGreaterThanOrEqual(-spec.d / 2 - EPS);
          expect(on.area.z1).toBeLessThanOrEqual(spec.d / 2 + EPS);
          break;
        }
        case "under": {
          const u = spec.under!;
          expect(local.y).toBeGreaterThanOrEqual(0);
          expect(local.y + h).toBeLessThanOrEqual(u.clearance - 0.01);
          expect(inArea(u.area, local, r)).toBe(true);
          if (spec.wallMounted) {
            // Below a window: in front of the wall, under its lowest edge.
            expect(u.area.z0).toBeGreaterThanOrEqual(0);
            expect(Math.abs(local.x)).toBeLessThan(spec.w / 2);
          } else {
            expect(u.area.x0).toBeGreaterThanOrEqual(-spec.w / 2 - EPS);
            expect(u.area.x1).toBeLessThanOrEqual(spec.w / 2 + EPS);
            expect(u.area.z0).toBeGreaterThanOrEqual(-spec.d / 2 - EPS);
            expect(u.area.z1).toBeLessThanOrEqual(spec.d / 2 + EPS);
          }
          break;
        }
        case "in": {
          const inn = spec.in!;
          const b = inn.box;
          expect(inArea(b, hidden, r)).toBe(true);
          expect(hidden.y).toBeGreaterThanOrEqual(b.y0 - EPS);
          expect(b.y1).toBeLessThanOrEqual(spec.h + EPS);
          if (inn.reveal === "rise") {
            // Revealed: still in it (bottom below the rim) but peeking out (head above it).
            expect(inArea(b, local, r)).toBe(true);
            expect(local.y).toBeLessThan(b.y1);
            expect(local.y + h).toBeGreaterThan(b.y1);
          } else {
            expect(local.y + h).toBeLessThanOrEqual(b.y1 + EPS);
          }
          break;
        }
        case "by": {
          // Beside it: not overlapping, but close.
          const gap = rectDistance(obj.rect, spot.pos.x, spot.pos.z);
          expect(gap).toBeGreaterThanOrEqual(r - EPS);
          expect(gap).toBeLessThanOrEqual(r + 0.35);
          // And it is the nearest thing, so "by the X" is the natural description.
          const others = WORLD.objects.filter((o) => o.room === obj.room && o.id !== obj.id && !o.spec.flat);
          for (const o of others) {
            expect(rectDistance(o.rect, spot.pos.x, spot.pos.z), `${o.id} is closer`).toBeGreaterThan(gap + 0.15);
          }
          break;
        }
      }
    });
  }
});

describe("hiding spots fit the room", () => {
  for (const spot of WORLD.spots) {
    it(`${spot.id} stays inside its room and clear of other furniture`, () => {
      const room = ROOMS[spot.room]!;
      const r = radius(spot);
      const interior = {
        x0: room.bounds.x0 + WALL_T / 2,
        x1: room.bounds.x1 - WALL_T / 2,
        z0: room.bounds.z0 + WALL_T / 2,
        z1: room.bounds.z1 - WALL_T / 2
      };
      for (const p of [spot.pos, spot.hidePos]) {
        expect(rectContains(interior, p.x, p.z, r - EPS)).toBe(true);
      }
      expect(rectContains(interior, spot.marker.x, spot.marker.z)).toBe(true);
      for (const o of WORLD.objects) {
        if (o.id === spot.objectId || o.spec.flat || o.room !== spot.room) continue;
        expect(circleHitsRect(o.rect, spot.pos.x, spot.pos.z, r), `overlaps ${o.id}`).toBe(false);
      }
    });
  }

  it("different spots are clearly different places", () => {
    for (const a of WORLD.spots) {
      for (const b of WORLD.spots) {
        if (a.id >= b.id || a.room !== b.room) continue;
        const d = Math.hypot(a.pos.x - b.pos.x, (a.pos.y - b.pos.y) * 1.5, a.pos.z - b.pos.z);
        expect(d, `${a.id} vs ${b.id}`).toBeGreaterThan(0.5);
      }
    }
  });
});

describe("clues are unambiguous", () => {
  it("each room uses each noun for exactly one searchable object", () => {
    const seen = new Map<string, string>();
    for (const o of WORLD.objects.filter((x) => x.searchable)) {
      const key = `${o.room}:${o.noun}`;
      expect(seen.has(key), `${key} used by ${seen.get(key)} and ${o.id}`).toBe(false);
      seen.set(key, o.id);
    }
  });

  it("each (room, preposition, noun) names exactly one spot", () => {
    const keys = WORLD.spots.map((s) => `${s.room}:${s.prep}:${s.noun}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("the preposition matters: every searchable object has at least two spots", () => {
    for (const o of WORLD.objects.filter((x) => x.searchable)) {
      expect(o.spots!.length, o.id).toBeGreaterThanOrEqual(2);
      expect(new Set(o.spots!.map((s) => s.prep)).size).toBe(o.spots!.length);
    }
  });

  it("the bedroom offers all four prepositions", () => {
    const preps = new Set(WORLD.spots.filter((s) => s.room === "bedroom").map((s) => s.prep));
    for (const p of PREPS) expect(preps.has(p), p).toBe(true);
  });
});

describe("every searchable object can be reached", () => {
  it("from the bedroom start", () => {
    const room = ROOMS.bedroom!;
    const step = 0.1;
    const solid = WORLD.colliders; // door blocker included: the bedroom door is shut in Phase 1
    const nx = Math.round((room.bounds.x1 - room.bounds.x0) / step);
    const nz = Math.round((room.bounds.z1 - room.bounds.z0) / step);
    const free = (i: number, k: number) => {
      const x = room.bounds.x0 + i * step;
      const z = room.bounds.z0 + k * step;
      return !solid.some((c) => circleHitsRect(c.rect, x, z, PLAYER_R));
    };
    const seen = new Set<number>();
    const si = Math.round((PRACTICE_START.x - room.bounds.x0) / step);
    const sk = Math.round((PRACTICE_START.z - room.bounds.z0) / step);
    expect(free(si, sk)).toBe(true);
    const queue: Array<[number, number]> = [[si, sk]];
    seen.add(si * 10000 + sk);
    while (queue.length) {
      const [i, k] = queue.pop()!;
      for (const [di, dk] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1]
      ]) {
        const a = i + di;
        const b = k + dk;
        if (a < 0 || b < 0 || a > nx || b > nz) continue;
        const key = a * 10000 + b;
        if (seen.has(key) || !free(a, b)) continue;
        seen.add(key);
        queue.push([a, b]);
      }
    }
    const cells = [...seen].map((key) => ({
      x: room.bounds.x0 + Math.floor(key / 10000) * step,
      z: room.bounds.z0 + (key % 10000) * step
    }));
    for (const o of WORLD.objects.filter((x) => x.searchable && x.room === "bedroom")) {
      const best = Math.min(...cells.map((c) => rectDistance(o.rect, c.x, c.z)));
      expect(best, o.id).toBeLessThanOrEqual(INTERACT_RANGE - 0.2);
    }
  });
});
