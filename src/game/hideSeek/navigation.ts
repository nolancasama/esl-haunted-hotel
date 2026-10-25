import type { Rect, Rot, Vec3 } from "../types";
import { localToWorld, rectDistance, rotateXZ } from "../world/geometry";
import { GHOST_H, GHOST_R } from "../world/kinds";
import { PLAYER_R } from "../world/constants";
import { FLOOR_Y, ROOMS } from "../world/rooms";
import { WORLD, type HidingSpot, type WorldObject } from "../world/world";
import type { PlayRoom, Point } from "./types";

const CELL = 0.25;
const RADIUS = PLAYER_R + 0.04;
const SAMPLE = 0.04;
interface Node extends Point { edges: number[] }
interface Grid { nodes: Node[]; bounds: Rect; blockers: Rect[] }
export interface RoomLayout {
  spots: HidingSpot[];
  stands: Record<string, Point>;
  anchors: Record<string, Point>;
  /** From the floor anchor to hidePos, including both endpoints. */
  entries: Record<string, Vec3[]>;
  starts: Point[];
  reach: number;
  reachDiagnostics: { minimumForTwo: number; originalMinimumForTwo: number; tightestSpot: string };
}
const grids = new Map<PlayRoom, Grid>();
const layouts = new Map<PlayRoom, RoomLayout>();
const paths = new Map<string, Point[] | null>();

function free(grid: Grid, p: Point): boolean {
  const b = grid.bounds;
  return p.x > b.x0 + RADIUS + 0.1 && p.x < b.x1 - RADIUS - 0.1 &&
    p.z > b.z0 + RADIUS + 0.1 && p.z < b.z1 - RADIUS - 0.1 &&
    grid.blockers.every(rect => rectDistance(rect, p.x, p.z) >= RADIUS);
}

function clear(grid: Grid, a: Point, b: Point): boolean {
  const samples = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / SAMPLE));
  for (let i = 0; i <= samples; i++) {
    if (!free(grid, { x: a.x + (b.x - a.x) * i / samples, z: a.z + (b.z - a.z) * i / samples })) return false;
  }
  return true;
}

function gridFor(room: PlayRoom): Grid {
  const cached = grids.get(room);
  if (cached) return cached;
  const { bounds, floor } = ROOMS[room];
  const grid: Grid = {
    bounds,
    blockers: WORLD.colliders.filter(c => c.floor === floor || c.floor === "all").map(c => c.rect),
    nodes: []
  };
  const cells = new Map<string, number>();
  for (let iz = 1; iz < (bounds.z1 - bounds.z0) / CELL; iz++) {
    for (let ix = 1; ix < (bounds.x1 - bounds.x0) / CELL; ix++) {
      const p = { x: bounds.x0 + ix * CELL, z: bounds.z0 + iz * CELL };
      if (!free(grid, p)) continue;
      cells.set(`${ix},${iz}`, grid.nodes.length);
      grid.nodes.push({ ...p, edges: [] });
    }
  }
  for (const [key, i] of cells) {
    const [ix, iz] = key.split(",").map(Number);
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const j = cells.get(`${ix + dx},${iz + dz}`);
        if (j !== undefined && clear(grid, grid.nodes[i], grid.nodes[j])) grid.nodes[i].edges.push(j);
      }
    }
  }
  grids.set(room, grid);
  return grid;
}

/** Exact floor endpoints: blocked destinations are rejected, never silently snapped. */
export function canWalkRoomSegment(room: PlayRoom, a: Point, b: Point): boolean {
  return clear(gridFor(room), a, b);
}

export function pathBetween(room: PlayRoom, from: Point, to: Point): Point[] | null {
  const key = `${room}:${from.x},${from.z}:${to.x},${to.z}`;
  if (paths.has(key)) return paths.get(key)!.map(p => ({ ...p }));
  const grid = gridFor(room);
  if (!free(grid, from) || !free(grid, to)) return null;
  if (clear(grid, from, to)) return [{ x: to.x, z: to.z }];
  const nearest = (p: Point): number => {
    let best = -1;
    let distance = Infinity;
    grid.nodes.forEach((node, i) => {
      const d = Math.hypot(node.x - p.x, node.z - p.z);
      if (d < distance && clear(grid, p, node)) { best = i; distance = d; }
    });
    return best;
  };
  const first = nearest(from);
  const last = nearest(to);
  if (first < 0 || last < 0) return null;
  const distance = new Float64Array(grid.nodes.length).fill(Infinity);
  const previous = new Int32Array(grid.nodes.length).fill(-1);
  const closed = new Uint8Array(grid.nodes.length);
  distance[first] = 0;
  for (;;) {
    let current = -1;
    let score = Infinity;
    for (let i = 0; i < grid.nodes.length; i++) {
      if (closed[i] || !Number.isFinite(distance[i])) continue;
      const node = grid.nodes[i];
      const f = distance[i] + Math.hypot(node.x - grid.nodes[last].x, node.z - grid.nodes[last].z);
      if (f < score) { current = i; score = f; }
    }
    if (current < 0) return null;
    if (current === last) break;
    closed[current] = 1;
    const node = grid.nodes[current];
    for (const next of node.edges) {
      const other = grid.nodes[next];
      const d = distance[current] + Math.hypot(node.x - other.x, node.z - other.z);
      if (d < distance[next]) { distance[next] = d; previous[next] = current; }
    }
  }
  const raw: Point[] = [{ x: to.x, z: to.z }];
  for (let i = last; i >= 0; i = previous[i]) raw.push({ x: grid.nodes[i].x, z: grid.nodes[i].z });
  raw.reverse();
  const result: Point[] = [];
  let anchor = from;
  for (let i = 0; i < raw.length;) {
    let end = raw.length - 1;
    while (end > i && !clear(grid, anchor, raw[end])) end--;
    result.push(raw[end]);
    anchor = raw[end];
    i = end + 1;
  }
  paths.set(key, result);
  return result.map(p => ({ ...p }));
}

export function pathLength(from: Point, path: readonly Point[]): number {
  let length = 0;
  let last = from;
  for (const p of path) { length += Math.hypot(p.x - last.x, p.z - last.z); last = p; }
  return length;
}

function local(object: WorldObject, p: Vec3): Vec3 {
  const offset = rotateXZ(p.x - object.x, p.z - object.z, ((360 - object.rot) % 360) as Rot);
  return { ...offset, y: p.y - object.y };
}

/** Furniture footprints are solid for walking. Ghost entry additionally models the
 * documented underside tunnel, free top surface and open container/clock cavity.
 * Other furniture remains solid at its real height, so short rises may cross low
 * objects but cannot pass through walls or tall furniture. */
export function ghostEntryClear(spot: HidingSpot, path: readonly Vec3[]): boolean {
  const room = ROOMS[spot.room];
  const object = WORLD.objectById.get(spot.objectId)!;
  const radius = GHOST_R * Math.max(spot.scale[0], spot.scale[2]);
  const height = GHOST_H * spot.scale[1];
  const inside = (v: number, a: number, b: number) => v >= a + radius - 0.015 && v <= b - radius + 0.015;
  const valid = (p: Vec3): boolean => {
    const bounds = room.bounds;
    if (p.x - radius < bounds.x0 + 0.1 || p.x + radius > bounds.x1 - 0.1 ||
      p.z - radius < bounds.z0 + 0.1 || p.z + radius > bounds.z1 - 0.1 || p.y < object.y) return false;
    for (const wall of WORLD.walls) {
      if (wall.line.floor !== room.floor || p.y + height <= wall.y0 || p.y >= wall.y1) continue;
      if (rectDistance(wall.rect, p.x, p.z) < radius - 0.001) return false;
    }
    for (const other of WORLD.objects) {
      if (other.floor !== room.floor || !other.spec.solid || p.y >= other.y + other.spec.h || p.y + height <= other.y) continue;
      if (rectDistance(other.rect, p.x, p.z) >= radius - 0.001) continue;
      if (other.id !== object.id) return false;
      const q = local(object, p);
      const spec = object.spec;
      if (spot.prep === "on" && spec.on && q.y >= spec.on.y - 0.001) continue;
      if (spot.prep === "under" && spec.under && q.y + height <= spec.under.clearance + 0.001 &&
        (inside(q.x, spec.under.area.x0, spec.under.area.x1) || inside(q.z, spec.under.area.z0, spec.under.area.z1))) continue;
      if (spot.prep === "in" && spec.in) {
        const box = spec.in.box;
        if (q.y >= box.y1 || (q.y >= box.y0 && inside(q.x, box.x0, box.x1) &&
          (spec.in.reveal === "stay" ? q.z >= box.z0 + radius - 0.015 : inside(q.z, box.z0, box.z1)))) continue;
      }
      return false;
    }
    return true;
  };
  if (!path.length || !valid(path[0])) return false;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const samples = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) / SAMPLE));
    for (let j = 1; j <= samples; j++) {
      const t = j / samples;
      if (!valid({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t })) return false;
    }
  }
  return true;
}

function entryFromAnchor(spot: HidingSpot, anchor: Point): Vec3[] {
  const object = WORLD.objectById.get(spot.objectId)!;
  const floor = FLOOR_Y[object.floor] + 0.02;
  const end = spot.hidePos;
  const start = { x: anchor.x, y: floor, z: anchor.z };
  if (spot.prep === "on" || (spot.prep === "in" && object.spec.in?.reveal === "rise")) {
    const y = object.y + Math.max(object.spec.h + 0.04, end.y - object.y);
    return [start, { ...start, y }, { ...end, y }, { ...end }];
  }
  return [start, { ...start, y: end.y }, { ...end }];
}

function entry(spot: HidingSpot, nodes: Node[]): Vec3[] | null {
  const end = spot.hidePos;
  const candidates = [...nodes].sort((a, b) => Math.hypot(a.x - end.x, a.z - end.z) - Math.hypot(b.x - end.x, b.z - end.z));
  for (const anchor of candidates) {
    if (Math.hypot(anchor.x - end.x, anchor.z - end.z) > 2.8) break;
    const path = entryFromAnchor(spot, anchor);
    if (ghostEntryClear(spot, path)) return path;
  }
  return null;
}

export function roomLayout(room: PlayRoom): RoomLayout {
  const cached = layouts.get(room);
  if (cached) return cached;
  const { nodes } = gridFor(room);
  const spots = WORLD.spots.filter(s => s.room === room);
  const result: RoomLayout = {
    spots: [], stands: {}, anchors: {}, entries: {}, starts: [], reach: 4.5,
    reachDiagnostics: { minimumForTwo: 0, originalMinimumForTwo: 0, tightestSpot: "" }
  };
  for (const spot of spots) {
    const route = entry(spot, nodes);
    if (!route) throw new Error(`No collision-safe entry for ${spot.id}`);
    const anchor = { x: route[0].x, z: route[0].z };
    const object = WORLD.objectById.get(spot.objectId)!;
    const ideal = localToWorld(object, object.rot, { x: 0, y: 0, z: object.spec.d / 2 + 0.65 });
    const stand = [...nodes].sort((a, b) => Math.hypot(a.x - ideal.x, a.z - ideal.z) - Math.hypot(b.x - ideal.x, b.z - ideal.z))[0];
    result.spots.push(spot);
    result.anchors[spot.id] = anchor;
    result.stands[spot.id] = { x: stand.x, z: stand.z };
    result.entries[spot.id] = route;
  }
  const centre = { x: (ROOMS[room].bounds.x0 + ROOMS[room].bounds.x1) / 2, z: (ROOMS[room].bounds.z0 + ROOMS[room].bounds.z1) / 2 };
  result.starts = nodes.filter(p => Math.hypot(p.x - centre.x, p.z - centre.z) < 2.6)
    .filter((_, i) => i % 9 === 0).map(p => ({ x: p.x, z: p.z }));
  if (room === "dining") {
    const requiredReach = () => {
      let minimumForTwo = 0;
      let tightestSpot = "";
      for (const from of result.spots) {
        const distances = result.spots.filter(to => to.id !== from.id).map(to => {
          const a = result.entries[from.id];
          const b = result.entries[to.id];
          const path = pathBetween(room, a[0], b[0]);
          return path ? pathLength(from.hidePos, [...a].reverse()) + pathLength(a[0], path) + pathLength(b[0], b) : Infinity;
        }).sort((a, b) => a - b);
        if (distances[1] > minimumForTwo) { minimumForTwo = distances[1]; tightestSpot = from.id; }
      }
      return { minimumForTwo, tightestSpot };
    };
    let required = requiredReach();
    const originalMinimumForTwo = required.minimumForTwo;
    // Dining chairs split the two nearest table entries. Share the underside's
    // safe side only when a reach increase would otherwise exceed six metres.
    if (required.minimumForTwo > 6) {
      const on = result.spots.find(s => s.id === "dining.table.on")!;
      const anchor = result.anchors["dining.table.under"];
      const route = entryFromAnchor(on, anchor);
      if (ghostEntryClear(on, route)) {
        result.entries[on.id] = route;
        result.anchors[on.id] = { ...anchor };
        required = requiredReach();
      }
    }
    result.reach = Math.max(4.5, Math.ceil(required.minimumForTwo * 10 - 0.000001) / 10);
    result.reachDiagnostics = { ...required, originalMinimumForTwo };
  }
  layouts.set(room, result);
  return result;
}

/** Entries reverse on departure, with a collision-safe floor route between them. */
export function ghostRoute(room: PlayRoom, fromSpotId: string, toSpotId: string): Vec3[] | null {
  const layout = roomLayout(room);
  const from = layout.entries[fromSpotId];
  const to = layout.entries[toSpotId];
  if (!from || !to) return null;
  const floor = pathBetween(room, from[0], to[0]);
  if (!floor) return null;
  const y = FLOOR_Y[ROOMS[room].floor] + 0.02;
  return [...from].reverse().slice(1).map(p => ({ ...p }))
    .concat(floor.map(p => ({ ...p, y })), to.slice(1).map(p => ({ ...p })));
}
