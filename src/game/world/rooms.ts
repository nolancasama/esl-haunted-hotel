import type { Rect, RoomId } from "../types";

export const WALL_H = 2.8;
export const WALL_T = 0.2;
export const DOOR_H = 2.15;

export interface RoomDef {
  id: RoomId;
  name: string;
  nameJa: string;
  /** Wall centre lines. */
  bounds: Rect;
  /** Where the room's lamp hangs: the single moving "room light" goes here. */
  lamp: { x: number; y: number; z: number; color: string; intensity: number };
}

/**
 *            z = -11
 *   +---------------+---------------+
 *   |    Bedroom    |    Dining     |
 *   +------[ ]------+------[ ]------+   z = -4
 *  [E]            Lobby        stairs
 *   +------[ ]------+------[ ]------+   z = 4
 *   |    Library    |    Storage    |
 *   +---------------+---------------+
 *  x = -8           0               8      [E] = entrance (west)
 */
export const ROOMS: Record<RoomId, RoomDef> = {
  lobby: {
    id: "lobby",
    name: "Lobby",
    nameJa: "ロビー",
    bounds: { x0: -8, x1: 8, z0: -4, z1: 4 },
    lamp: { x: 0, y: 2.45, z: 0, color: "#ffcf91", intensity: 11 }
  },
  bedroom: {
    id: "bedroom",
    name: "Bedroom",
    nameJa: "しんしつ",
    bounds: { x0: -8, x1: 0, z0: -11, z1: -4 },
    lamp: { x: -4.2, y: 2.4, z: -7.6, color: "#ffc98a", intensity: 9 }
  },
  dining: {
    id: "dining",
    name: "Dining room",
    nameJa: "しょくどう",
    bounds: { x0: 0, x1: 8, z0: -11, z1: -4 },
    lamp: { x: 4, y: 2.35, z: -7.6, color: "#ffd08a", intensity: 10 }
  },
  storage: {
    id: "storage",
    name: "Storage room",
    nameJa: "ものおき",
    bounds: { x0: 0, x1: 8, z0: 4, z1: 11 },
    lamp: { x: 3.8, y: 2.45, z: 7.6, color: "#e8d6a0", intensity: 8 }
  },
  library: {
    id: "library",
    name: "Library",
    nameJa: "としょしつ",
    bounds: { x0: -8, x1: 0, z0: 4, z1: 11 },
    lamp: { x: -4.3, y: 2.3, z: 7.8, color: "#ffc27a", intensity: 9 }
  }
};

export type DoorId = "bedroom" | "dining" | "storage" | "library" | "entrance";

export interface Opening {
  from: number;
  to: number;
  /** Top of the opening (a lintel fills the wall above). */
  top: number;
  door?: DoorId;
}

/**
 * A straight wall. axis "x" runs along x at z = at; axis "z" runs along z at x = at.
 * `neg`/`pos` name the room on each side (null = outside the hotel).
 */
export interface WallLine {
  id: string;
  axis: "x" | "z";
  at: number;
  from: number;
  to: number;
  neg: RoomId | null;
  pos: RoomId | null;
  openings?: Opening[];
}

const door = (from: number, to: number, id: DoorId): Opening => ({ from, to, top: DOOR_H, door: id });

export const WALL_LINES: WallLine[] = [
  // north (outside)
  { id: "n-bed", axis: "x", at: -11, from: -8, to: 0, neg: null, pos: "bedroom" },
  { id: "n-din", axis: "x", at: -11, from: 0, to: 8, neg: null, pos: "dining" },
  // lobby north wall
  { id: "m1-bed", axis: "x", at: -4, from: -8, to: 0, neg: "bedroom", pos: "lobby", openings: [door(-4.8, -3.2, "bedroom")] },
  { id: "m1-din", axis: "x", at: -4, from: 0, to: 8, neg: "dining", pos: "lobby", openings: [door(3.2, 4.8, "dining")] },
  // lobby south wall
  { id: "m2-lib", axis: "x", at: 4, from: -8, to: 0, neg: "lobby", pos: "library", openings: [door(-4.8, -3.2, "library")] },
  { id: "m2-sto", axis: "x", at: 4, from: 0, to: 8, neg: "lobby", pos: "storage", openings: [door(3.2, 4.8, "storage")] },
  // south (outside)
  { id: "s-lib", axis: "x", at: 11, from: -8, to: 0, neg: "library", pos: null },
  { id: "s-sto", axis: "x", at: 11, from: 0, to: 8, neg: "storage", pos: null },
  // west (outside), with the entrance
  { id: "w-bed", axis: "z", at: -8, from: -11, to: -4, neg: null, pos: "bedroom" },
  { id: "w-lob", axis: "z", at: -8, from: -4, to: 4, neg: null, pos: "lobby", openings: [{ from: -1.1, to: 1.1, top: 2.45, door: "entrance" }] },
  { id: "w-lib", axis: "z", at: -8, from: 4, to: 11, neg: null, pos: "library" },
  // east (outside)
  { id: "e-din", axis: "z", at: 8, from: -11, to: -4, neg: "dining", pos: null },
  { id: "e-lob", axis: "z", at: 8, from: -4, to: 4, neg: "lobby", pos: null },
  { id: "e-sto", axis: "z", at: 8, from: 4, to: 11, neg: "storage", pos: null },
  // between rooms
  { id: "x-up", axis: "z", at: 0, from: -11, to: -4, neg: "bedroom", pos: "dining" },
  { id: "x-down", axis: "z", at: 0, from: 4, to: 11, neg: "library", pos: "storage" }
];

export interface DoorDef {
  id: DoorId;
  axis: "x" | "z";
  at: number;
  from: number;
  to: number;
  /** The room the door swings into. */
  room: RoomId;
  double?: boolean;
  height?: number;
}

export const DOORS: DoorDef[] = [
  { id: "bedroom", axis: "x", at: -4, from: -4.8, to: -3.2, room: "bedroom" },
  { id: "dining", axis: "x", at: -4, from: 3.2, to: 4.8, room: "dining" },
  { id: "library", axis: "x", at: 4, from: -4.8, to: -3.2, room: "library" },
  { id: "storage", axis: "x", at: 4, from: 3.2, to: 4.8, room: "storage" },
  { id: "entrance", axis: "z", at: -8, from: -1.1, to: 1.1, room: "lobby", double: true, height: 2.4 }
];

/** Which door leads into each ghost room. */
export const ROOM_DOOR: Partial<Record<RoomId, DoorId>> = {
  bedroom: "bedroom",
  dining: "dining",
  storage: "storage",
  library: "library"
};

export interface WallPiece {
  id: string;
  line: WallLine;
  rect: Rect;
  y0: number;
  y1: number;
}

/** Split wall lines into solid pieces and lintels above openings. */
export function wallPieces(lines: WallLine[] = WALL_LINES): WallPiece[] {
  const pieces: WallPiece[] = [];
  for (const line of lines) {
    // Walls along x close the corners - but only at ends no other x wall continues from
    // (two coplanar overlapping boxes would flicker).
    const continues = (v: number) => lines.some((o) => o !== line && o.axis === "x" && o.at === line.at && (o.from === v || o.to === v));
    const start = line.axis === "x" ? line.from - (continues(line.from) ? 0 : WALL_T / 2) : line.from + WALL_T / 2;
    const end = line.axis === "x" ? line.to + (continues(line.to) ? 0 : WALL_T / 2) : line.to - WALL_T / 2;
    const openings = [...(line.openings ?? [])].sort((a, b) => a.from - b.from);
    let cursor = start;
    let n = 0;
    const rectFor = (a: number, b: number): Rect =>
      line.axis === "x"
        ? { x0: a, x1: b, z0: line.at - WALL_T / 2, z1: line.at + WALL_T / 2 }
        : { x0: line.at - WALL_T / 2, x1: line.at + WALL_T / 2, z0: a, z1: b };
    for (const o of openings) {
      if (o.from > cursor) pieces.push({ id: `${line.id}-${n++}`, line, rect: rectFor(cursor, o.from), y0: 0, y1: WALL_H });
      pieces.push({ id: `${line.id}-${n++}`, line, rect: rectFor(o.from, o.to), y0: o.top, y1: WALL_H });
      cursor = o.to;
    }
    if (end > cursor) pieces.push({ id: `${line.id}-${n++}`, line, rect: rectFor(cursor, end), y0: 0, y1: WALL_H });
  }
  return pieces;
}

export function roomAt(x: number, z: number): RoomId | null {
  // Ghost rooms first so a doorway counts as the room you are stepping into.
  for (const id of ["bedroom", "dining", "storage", "library", "lobby"] as RoomId[]) {
    const b = ROOMS[id].bounds;
    if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) return id;
  }
  return null;
}
