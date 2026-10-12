import type { Prep, Rect, RoomId, Vec3 } from "../types";
import { footprint, localToWorld } from "./geometry";
import { GHOST_H, GHOST_R, KINDS, type KindSpec } from "./kinds";
import { PLACEMENTS, type Placement, type SpotRule } from "./furniture";
import { DOORS, ROOMS, WALL_LINES, WALL_T, wallPieces, type DoorId, type WallPiece } from "./rooms";

export interface WorldObject extends Placement {
  spec: KindSpec;
  /** Floor footprint in world space. */
  rect: Rect;
  searchable: boolean;
  /** Wall lines a wall-mounted object hangs on (it fades with them in the cutaway view). */
  wallLines: string[];
}

/** The wall line(s) a wall-mounted object hangs on. */
function wallLinesFor(p: Placement, spec: KindSpec): string[] {
  if (!spec.wallMounted) return [];
  const alongX = p.rot === 0 || p.rot === 180;
  const coord = alongX ? p.z : p.x;
  const pos = alongX ? p.x : p.z;
  return WALL_LINES.filter(
    (l) => l.axis === (alongX ? "x" : "z") && Math.abs(l.at - coord) <= 0.15 && pos + spec.w / 2 > l.from && pos - spec.w / 2 < l.to
  ).map((l) => l.id);
}

export interface HidingSpot {
  /** `${objectId}.${prep}` */
  id: string;
  room: RoomId;
  objectId: string;
  prep: Prep;
  noun: string;
  /** Ghost base (bottom of the hem) once revealed. */
  pos: Vec3;
  /** Ghost base while still hidden (lower for ghosts that rise out of containers). */
  hidePos: Vec3;
  scale: [number, number, number];
  /** Search marker shown in the close-up view. */
  marker: Vec3;
}

function objectFrom(p: Placement): WorldObject {
  const spec: KindSpec = KINDS[p.kind];
  let rect = footprint(p, p.rot, spec.w, spec.d);
  if (spec.wallMounted) {
    // x/z sit on the wall face; the object sticks out into the room along its local +z.
    const centre = localToWorld(p, p.rot, { x: 0, y: 0, z: spec.d / 2 });
    rect = footprint(centre, p.rot, spec.w, spec.d);
  }
  return { ...p, spec, rect, searchable: Boolean(p.noun && p.spots?.length), wallLines: wallLinesFor(p, spec) };
}

function spotFor(obj: WorldObject, rule: SpotRule): HidingSpot {
  const { spec } = obj;
  const toWorld = (p: Vec3): Vec3 => localToWorld(obj, obj.rot, p);
  const base = { id: `${obj.id}.${rule.prep}`, room: obj.room, objectId: obj.id, prep: rule.prep, noun: obj.noun! };

  switch (rule.prep) {
    case "on": {
      const on = spec.on;
      if (!on) throw new Error(`${obj.id} has no "on" surface`);
      const s = on.scale;
      const pos = toWorld({ x: on.at.x, y: on.y + 0.01, z: on.at.z });
      return {
        ...base,
        pos,
        hidePos: pos,
        scale: [s, s, s],
        marker: toWorld({ x: on.at.x, y: on.y + 0.3, z: on.at.z })
      };
    }
    case "under": {
      const u = spec.under;
      if (!u) throw new Error(`${obj.id} has no "under" space`);
      const cx = (u.area.x0 + u.area.x1) / 2;
      // Fully underneath, but near the front edge so it can be seen peeking out.
      const r = GHOST_R * Math.max(u.scale[0], u.scale[2]);
      const cz = Math.max((u.area.z0 + u.area.z1) / 2, u.area.z1 - r - 0.03);
      const pos = toWorld({ x: cx, y: u.y ?? 0.02, z: cz });
      return {
        ...base,
        pos,
        hidePos: pos,
        scale: [...u.scale],
        marker: toWorld({ x: cx, y: Math.min(u.clearance * 0.5, 0.45), z: u.area.z1 - 0.02 })
      };
    }
    case "in": {
      const inn = spec.in;
      if (!inn) throw new Error(`${obj.id} has no inside`);
      const s = inn.scale;
      const cx = (inn.box.x0 + inn.box.x1) / 2;
      const cz = (inn.box.z0 + inn.box.z1) / 2;
      const hidePos = toWorld({ x: cx, y: inn.box.y0 + 0.01, z: cz });
      const pos =
        inn.reveal === "rise" ? toWorld({ x: cx, y: inn.box.y1 - GHOST_H * s * 0.55, z: cz }) : hidePos;
      return { ...base, pos, hidePos, scale: [s, s, s], marker: toWorld(inn.marker) };
    }
    case "by": {
      const by = spec.by;
      if (!by) throw new Error(`${obj.id} has no "by" rule`);
      const s = by.scale ?? 1;
      const r = GHOST_R * s;
      const side = rule.side ?? "right";
      let local: Vec3;
      if (side === "front") local = { x: 0, y: by.y, z: spec.d / 2 + by.gap + r };
      else {
        const edge = by.edge ?? spec.w / 2;
        const x = edge + by.gap + r;
        local = { x: side === "right" ? x : -x, y: by.y, z: by.z ?? 0 };
      }
      const pos = toWorld(local);
      return {
        ...base,
        pos,
        hidePos: pos,
        scale: [s, s, s],
        marker: { x: pos.x, y: pos.y + GHOST_H * s * 0.6, z: pos.z }
      };
    }
  }
}

export interface Collider {
  id: string;
  rect: Rect;
  /** Door blockers only apply while their door is closed. */
  door?: DoorId;
}

export interface World {
  objects: WorldObject[];
  objectById: Map<string, WorldObject>;
  spots: HidingSpot[];
  spotById: Map<string, HidingSpot>;
  walls: WallPiece[];
  colliders: Collider[];
}

export function buildWorld(placements: Placement[] = PLACEMENTS): World {
  const objects = placements.map(objectFrom);
  const spots = objects.flatMap((o) => (o.searchable ? o.spots!.map((rule) => spotFor(o, rule)) : []));
  const walls = wallPieces();
  const colliders: Collider[] = [
    ...walls.filter((w) => w.y0 === 0).map((w) => ({ id: w.id, rect: w.rect })),
    ...DOORS.map((d) => ({
      id: `door-${d.id}`,
      door: d.id,
      rect:
        d.axis === "x"
          ? { x0: d.from, x1: d.to, z0: d.at - WALL_T / 2, z1: d.at + WALL_T / 2 }
          : { x0: d.at - WALL_T / 2, x1: d.at + WALL_T / 2, z0: d.from, z1: d.to }
    })),
    ...objects.filter((o) => o.spec.solid).map((o) => ({ id: o.id, rect: o.rect }))
  ];
  return {
    objects,
    objectById: new Map(objects.map((o) => [o.id, o])),
    spots,
    spotById: new Map(spots.map((s) => [s.id, s])),
    walls,
    colliders
  };
}

export const WORLD = buildWorld();

export function spotsInRoom(room: RoomId, world: World = WORLD): HidingSpot[] {
  return world.spots.filter((s) => s.room === room);
}

export function getSpot(id: string, world: World = WORLD): HidingSpot {
  const spot = world.spotById.get(id);
  if (!spot) throw new Error(`Unknown hiding spot: ${id}`);
  return spot;
}

export function getObject(id: string, world: World = WORLD): WorldObject {
  const obj = world.objectById.get(id);
  if (!obj) throw new Error(`Unknown object: ${id}`);
  return obj;
}

export { ROOMS, GHOST_H, GHOST_R };
