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

export const ROOMS: Partial<Record<RoomId, RoomDef>> = {
  bedroom: {
    id: "bedroom",
    name: "Bedroom",
    nameJa: "しんしつ",
    bounds: { x0: -8, x1: 0, z0: -11, z1: -4 },
    lamp: { x: -4.2, y: 2.4, z: -7.6, color: "#ffc98a", intensity: 9 }
  }
};

export type DoorId = "bedroom";

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

export const WALL_LINES: WallLine[] = [
  { id: "bed-n", axis: "x", at: -11, from: -8, to: 0, neg: null, pos: "bedroom" },
  {
    id: "bed-s",
    axis: "x",
    at: -4,
    from: -8,
    to: 0,
    neg: "bedroom",
    pos: null,
    openings: [{ from: -4.8, to: -3.2, top: DOOR_H, door: "bedroom" }]
  },
  { id: "bed-w", axis: "z", at: -8, from: -11, to: -4, neg: null, pos: "bedroom" },
  { id: "bed-e", axis: "z", at: 0, from: -11, to: -4, neg: "bedroom", pos: null }
];

export interface DoorDef {
  id: DoorId;
  axis: "x" | "z";
  at: number;
  from: number;
  to: number;
  /** The room the door leads into (it swings into this room). */
  room: RoomId;
}

export const DOORS: DoorDef[] = [{ id: "bedroom", axis: "x", at: -4, from: -4.8, to: -3.2, room: "bedroom" }];

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
    // Walls along x reach over the corners so the joints are closed.
    const ext = line.axis === "x" ? WALL_T / 2 : -WALL_T / 2;
    const start = line.from - ext;
    const end = line.to + ext;
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
  for (const room of Object.values(ROOMS)) {
    if (!room) continue;
    const b = room.bounds;
    if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) return room.id;
  }
  return null;
}
