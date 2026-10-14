import { describe, expect, it } from "vitest";
import { PREPS, type Floor, type RoomId, type Rot, type Vec3 } from "../types";
import { circleHitsRect, rectContains, rectDistance, rotateXZ } from "./geometry";
import { GHOST_H, GHOST_R, HAT_FLAT_TOP } from "./kinds";
import { FLOOR_Y, ROOMS, STAIRS, WALL_T, roomAt } from "./rooms";
import { WORLD, type HidingSpot, type WorldObject } from "./world";
import { INTERACT_RANGE, PLAYER_R, PRACTICE_START, STORY_START, UPSTAIRS_START } from "./constants";
import { collidersFor, floorState, moveBody } from "./collision";

const EPS = 1e-6;
const GHOST_ROOMS: RoomId[] = ["bedroom", "dining", "storage", "library", "playroom", "bathroom", "music", "attic"];

function toLocal(obj: WorldObject, p: Vec3): Vec3 {
  const back = ((360 - obj.rot) % 360) as Rot;
  const r = rotateXZ(p.x - obj.x, p.z - obj.z, back);
  return { x: r.x, y: p.y - obj.y, z: r.z };
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
          // ...and so does a hat, pressed flat.
          expect(local.y + HAT_FLAT_TOP * spot.scale[1]).toBeLessThanOrEqual(u.clearance + 0.005);
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

  it("every ghost room offers all four prepositions (random replays, Mischief's and Shadow's four rounds)", () => {
    for (const room of GHOST_ROOMS) {
      const preps = new Set(WORLD.spots.filter((s) => s.room === room).map((s) => s.prep));
      for (const p of PREPS) expect(preps.has(p), `${room} ${p}`).toBe(true);
    }
  });

  it("every spot stands on its room's floor", () => {
    for (const s of WORLD.spots) {
      const base = FLOOR_Y[ROOMS[s.room].floor];
      expect(s.pos.y, s.id).toBeGreaterThanOrEqual(base - EPS);
      expect(s.pos.y, s.id).toBeLessThan(base + 2.6);
      expect(s.hidePos.y, s.id).toBeGreaterThanOrEqual(base - EPS);
    }
  });

  it("everything hung on a wall knows its wall (so it fades with it in the cutaway view)", () => {
    for (const o of WORLD.objects) {
      if (o.spec.wallMounted) expect(o.wallLines.length, o.id).toBeGreaterThan(0);
      else expect(o.wallLines, o.id).toEqual([]);
    }
  });

  it("the lobby and the landing have nothing to search (ghosts hide only in the eight rooms)", () => {
    expect(WORLD.spots.some((s) => s.room === "lobby" || s.room === "landing")).toBe(false);
  });

  it("the fan switch is something to use, not a hiding place", () => {
    const sw = WORLD.objectById.get("bathroom.switch")!;
    expect(sw.interactive).toBe(true);
    expect(sw.searchable).toBe(false);
  });
});

interface Cell {
  x: number;
  z: number;
  floor: Floor;
}

/**
 * Flood-fill the walkable floors from a start point, the way the player
 * moves: on the steps only the banisters block, and the floor changes at
 * the top and bottom of the stairs. Returns reachable cell centres.
 */
function reachable(start: { x: number; z: number }, openDoors: (id: string) => boolean, startFloor: Floor = 0): Cell[] {
  const b = { x0: -8, x1: 8, z0: -11, z1: 11 };
  const step = 0.1;
  const nx = Math.round((b.x1 - b.x0) / step);
  const nz = Math.round((b.z1 - b.z0) / step);
  const blocks = (i: number, k: number, from: Floor): Cell | null => {
    const x = b.x0 + i * step;
    const z = b.z0 + k * step;
    const st = floorState(x, z, from);
    const hit = collidersFor(st.floor, st.stairs).some((c) => !(c.door && openDoors(c.door)) && circleHitsRect(c.rect, x, z, PLAYER_R));
    return hit ? null : { x, z, floor: st.floor };
  };
  const si = Math.round((start.x - b.x0) / step);
  const sk = Math.round((start.z - b.z0) / step);
  expect(blocks(si, sk, startFloor), "start is free").not.toBeNull();
  const key = (i: number, k: number, f: Floor) => (i * 10000 + k) * 2 + f;
  const seen = new Map<number, Cell>([[key(si, sk, startFloor), { x: start.x, z: start.z, floor: startFloor }]]);
  const queue: Array<[number, number, Floor]> = [[si, sk, startFloor]];
  while (queue.length) {
    const [i, k, f] = queue.pop()!;
    for (const [di, dk] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1]
    ]) {
      const a = i + di;
      const c = k + dk;
      if (a < 0 || c < 0 || a > nx || c > nz) continue;
      const cell = blocks(a, c, f);
      if (!cell) continue;
      const id = key(a, c, cell.floor);
      if (seen.has(id)) continue;
      seen.set(id, cell);
      queue.push([a, c, cell.floor]);
    }
  }
  return [...seen.values()];
}

function expectAllReachable(cells: Cell[], objects: WorldObject[]) {
  for (const o of objects) {
    const inRoom = cells.filter((c) => c.floor === o.floor && roomAt(c.x, c.z, c.floor) === o.room);
    const best = Math.min(...inRoom.map((c) => rectDistance(o.rect, c.x, c.z)));
    expect(best, o.id).toBeLessThanOrEqual(INTERACT_RANGE - 0.2);
  }
}

describe("every searchable object can be reached", () => {
  it("in practice mode, from the bedroom start with the door shut", () => {
    const cells = reachable(PRACTICE_START, () => false);
    expectAllReachable(
      cells,
      WORLD.objects.filter((x) => x.searchable && x.room === "bedroom")
    );
  });

  it("in the full adventure, from the lobby (and up the stairs) once every door is open", () => {
    const cells = reachable(STORY_START, (id) => id !== "entrance");
    expectAllReachable(cells, WORLD.objects.filter((x) => x.interactive));
  });

  it("in Chapter 2 on its own, from the top of the stairs (and back down to the lobby)", () => {
    const cells = reachable(UPSTAIRS_START, (id) => id !== "entrance", 1);
    expectAllReachable(cells, WORLD.objects.filter((x) => x.interactive && x.floor === 1));
    expect(cells.some((c) => c.floor === 0 && roomAt(c.x, c.z, 0) === "lobby")).toBe(true);
  });

  it("closed doors really close the rooms off, and the stairs gate keeps you downstairs", () => {
    const cells = reachable(STORY_START, () => false);
    for (const c of cells) {
      expect(c.floor).toBe(0);
      expect(roomAt(c.x, c.z, 0), `${c.x},${c.z}`).toBe("lobby");
    }
  });

  it("with only the gate open you can climb to the landing, but no further", () => {
    const cells = reachable(STORY_START, (id) => id === "stairs");
    expect(cells.some((c) => c.floor === 1)).toBe(true);
    for (const c of cells) expect(roomAt(c.x, c.z, c.floor), `${c.x},${c.z},${c.floor}`).toMatch(/^(lobby|landing)$/);
  });

});

describe("walking the stairs", () => {
  const open = () => true;
  function walk(from: { x: number; z: number }, floor: Floor, dx: number, steps: number) {
    let s = { x: from.x, z: from.z, floor, y: FLOOR_Y[floor], stairs: false };
    const ys: number[] = [];
    for (let i = 0; i < steps; i++) {
      s = moveBody(s.x + dx, s.z, s.floor, open);
      ys.push(s.y);
    }
    return { end: s, ys };
  }

  it("walking east from the lobby climbs to the landing, rising steadily", () => {
    const { end, ys } = walk({ x: 2.8, z: 0 }, 0, 0.05, 120);
    expect(end.floor).toBe(1);
    expect(end.y).toBeCloseTo(FLOOR_Y[1]);
    expect(roomAt(end.x, end.z, end.floor)).toBe("landing");
    for (let i = 1; i < ys.length; i++) expect(ys[i]).toBeGreaterThanOrEqual(ys[i - 1] - 1e-9);
  });

  it("walking west from the landing goes back down to the lobby", () => {
    const { end } = walk(UPSTAIRS_START, 1, -0.05, 120);
    expect(end.floor).toBe(0);
    expect(end.y).toBe(0);
    expect(roomAt(end.x, end.z, end.floor)).toBe("lobby");
  });

  it("upstairs, the railing round the stairwell stops you walking into the hole", () => {
    // From the west end of the landing, and from the corridors beside the well.
    expect(walk({ x: 2.6, z: 0 }, 1, 0.05, 60).end.x).toBeLessThan(STAIRS.rect.x0 - 0.2);
    for (const z of [-2.2, 2.2]) {
      let s = { x: 5.0, z, floor: 1 as Floor };
      for (let i = 0; i < 60; i++) s = moveBody(s.x, s.z - Math.sign(z) * 0.05, s.floor, open);
      expect(s.floor).toBe(1);
      expect(Math.abs(s.z)).toBeGreaterThan(STAIRS.rect.z1 + 0.2);
    }
  });

  it("the closed gate blocks the foot of the stairs", () => {
    let s = { x: 2.8, z: 0, floor: 0 as Floor };
    for (let i = 0; i < 60; i++) s = moveBody(s.x + 0.05, s.z, s.floor, (id) => id !== "stairs");
    expect(s.floor).toBe(0);
    expect(s.x).toBeLessThan(STAIRS.gateX);
  });
});
