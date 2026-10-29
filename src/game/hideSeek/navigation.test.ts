import { describe, expect, it } from "vitest";
import { PLAY_ROOMS as PLAY_ROOM_LIST } from "./records";
import { writeFileSync } from "node:fs";
import { ROOMS } from "../world/rooms";
import { WORLD } from "../world/world";
import {
  canWalkRoomSegment, ghostEntryClear, ghostRoute, pathBetween, pathLength, roomLayout
} from "./navigation";
import type { PlayRoom, Point } from "./types";

const rooms: readonly PlayRoom[] = PLAY_ROOM_LIST;

describe("Hide & Seek room navigation", () => {
  for (const room of rooms) {
    it(`${room}: every public spot has a physical entry and a reachable detective stand`, () => {
      const layout = roomLayout(room);
      expect(layout.spots.map(s => s.id)).toEqual(WORLD.spots.filter(s => s.room === room).map(s => s.id));
      expect(layout.spots.length).toBeGreaterThanOrEqual(8);
      expect(layout.starts.length).toBeGreaterThan(2);
      const start = layout.starts[0];
      for (const spot of layout.spots) {
        const entry = layout.entries[spot.id];
        expect(entry.at(-1), spot.id).toEqual(spot.hidePos);
        expect(ghostEntryClear(spot, entry), spot.id).toBe(true);
        expect(entry[0].x).toBe(layout.anchors[spot.id].x);
        expect(entry[0].z).toBe(layout.anchors[spot.id].z);
        const path = pathBetween(room, start, layout.stands[spot.id]);
        expect(path, spot.id).not.toBeNull();
        expect(path!.at(-1), spot.id).toEqual(layout.stands[spot.id]);
        let previous: Point = start;
        for (const waypoint of path!) {
          expect(canWalkRoomSegment(room, previous, waypoint), spot.id).toBe(true);
          previous = waypoint;
        }
      }
    });

    it(`${room}: every spot can relocate locally and every pair has a valid floor connection`, () => {
      const layout = roomLayout(room);
      for (const from of layout.spots) {
        let nearby = 0;
        for (const to of layout.spots) {
          if (from.id === to.id) continue;
          const route = ghostRoute(room, from.id, to.id);
          expect(route, `${from.id} -> ${to.id}`).not.toBeNull();
          expect(route!.at(-1)).toEqual(to.hidePos);
          if (pathLength(from.hidePos, route!) <= layout.reach) nearby++;
        }
        expect(nearby, from.id).toBeGreaterThanOrEqual(2);
      }
    });

    it(`${room}: starts stay inside the selected room and routes cannot escape through its door`, () => {
      const layout = roomLayout(room);
      const b = ROOMS[room].bounds;
      for (const start of layout.starts) {
        expect(start.x).toBeGreaterThan(b.x0);
        expect(start.x).toBeLessThan(b.x1);
        expect(start.z).toBeGreaterThan(b.z0);
        expect(start.z).toBeLessThan(b.z1);
        expect(pathBetween(room, start, { x: b.x0 - 0.5, z: start.z })).toBeNull();
      }
    });
  }

  it("routes around the storage table and refuses exact blocked floor endpoints", () => {
    const start = { x: 1.6, z: 7.6 };
    const end = { x: 5.7, z: 7.6 };
    expect(canWalkRoomSegment("storage", start, end)).toBe(false);
    const route = pathBetween("storage", start, end)!;
    expect(route.length).toBeGreaterThan(1);
    expect(route.at(-1)).toEqual(end);
    expect(pathLength(start, route)).toBeGreaterThan(Math.hypot(end.x - start.x, end.z - start.z));
    expect(pathBetween("storage", start, { x: 3.6, z: 7.6 })).toBeNull();
  });

  it("models floor-to-surface rises and underside entry instead of walking through furniture", () => {
    const layout = roomLayout("bedroom");
    const on = layout.spots.find(s => s.id === "bedroom.bed.on")!;
    const under = layout.spots.find(s => s.id === "bedroom.bed.under")!;
    expect(layout.entries[on.id].some(p => p.y > on.hidePos.y)).toBe(true);
    expect(ghostEntryClear(on, [{ ...on.hidePos, y: 0.02 }, on.hidePos])).toBe(false);
    expect(ghostEntryClear(under, layout.entries[under.id])).toBe(true);
    expect(ghostEntryClear(under, layout.entries[under.id].map(p => ({ ...p, y: p.y + 0.6 })))).toBe(false);
    expect(ghostRoute("bedroom", "missing", under.id)).toBeNull();
  });

  it("returns independent cached paths and stable room data", () => {
    const layout = roomLayout("storage");
    const from = layout.anchors["storage.red.in"];
    const to = layout.anchors["storage.yellow.in"];
    const original = pathBetween("storage", from, to)!;
    const copy = pathBetween("storage", from, to)!;
    copy[0].x += 100;
    expect(pathBetween("storage", from, to)).toEqual(original);
    expect(roomLayout("storage")).toBe(layout);
  });

  it("tunes only dining's reach from actual second-nearest path distances", () => {
    const dining = roomLayout("dining");
    expect(dining.reach).toBeGreaterThanOrEqual(4.5);
    expect(dining.reach).toBeLessThanOrEqual(6);
    expect(dining.reach).toBeGreaterThanOrEqual(dining.reachDiagnostics.minimumForTwo - 0.000001);
    for (const room of rooms.filter(room => room !== "dining")) expect(roomLayout(room).reach).toBe(4.5);
    const report = { reach: dining.reach, ...dining.reachDiagnostics };
    writeFileSync("src/game/hideSeek/navigation-results.json", `${JSON.stringify(report, null, 2)}\n`);
    console.info("Dining reach geometry", JSON.stringify(report));
  });
});
