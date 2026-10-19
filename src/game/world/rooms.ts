import type { Floor, Rect, RoomId } from "../types";

export const WALL_H = 2.8;
export const WALL_T = 0.2;
export const DOOR_H = 2.15;
/** The front doors are taller, the attic door lower. Wall opening and door share these. */
export const ENTRANCE_H = 2.45;
export const ATTIC_DOOR_H = 1.95;

/** Height of each floor. Upstairs sits directly on top of the ground-floor walls. */
export const FLOOR_Y: Record<Floor, number> = { 0: 0, 1: WALL_H };

export interface RoomDef {
  id: RoomId;
  name: string;
  nameJa: string;
  floor: Floor;
  /** Wall centre lines. */
  bounds: Rect;
  /** Where the room's lamp hangs (world y): the single moving "room light" goes here. */
  lamp: { x: number; y: number; z: number; color: string; intensity: number };
}

/**
 *  Ground floor (Chapter 1)                 Upstairs (Chapter 2), directly above
 *            z = -11                                  z = -11
 *   +---------------+---------------+        +---------------+---------------+
 *   |    Bedroom    |    Dining     |        |   Playroom    |   Bathroom    |
 *   +------[ ]------+------[ ]------+ -4     +------[ ]------+------[ ]------+
 *  [E]            Lobby   [stairs>  |        |           Landing   [well]    |
 *   +------[ ]------+------[ ]------+  4     +------[ ]------+------[ ]------+
 *   |    Library    |    Storage    |        |     Music     |     Attic     |
 *   +---------------+---------------+        +---------------+---------------+
 *  x = -8           0               8
 *
 * The staircase rises east from the lobby (x 3.6 -> 6.4) and arrives on the
 * landing's east end; upstairs the stairwell is an opening with a railing.
 */
export const ROOMS: Record<RoomId, RoomDef> = {
  lobby: {
    id: "lobby",
    name: "Lobby",
    nameJa: "ロビー",
    floor: 0,
    bounds: { x0: -8, x1: 8, z0: -4, z1: 4 },
    lamp: { x: 0, y: 2.45, z: 0, color: "#ffcf91", intensity: 11 }
  },
  bedroom: {
    id: "bedroom",
    name: "Bedroom",
    nameJa: "しんしつ",
    floor: 0,
    bounds: { x0: -8, x1: 0, z0: -11, z1: -4 },
    lamp: { x: -4.2, y: 2.4, z: -7.6, color: "#ffc98a", intensity: 9 }
  },
  dining: {
    id: "dining",
    name: "Dining room",
    nameJa: "しょくどう",
    floor: 0,
    bounds: { x0: 0, x1: 8, z0: -11, z1: -4 },
    lamp: { x: 4, y: 2.35, z: -7.6, color: "#ffd08a", intensity: 10 }
  },
  storage: {
    id: "storage",
    name: "Storage room",
    nameJa: "ものおき",
    floor: 0,
    bounds: { x0: 0, x1: 8, z0: 4, z1: 11 },
    lamp: { x: 3.8, y: 2.45, z: 7.6, color: "#e8d6a0", intensity: 8 }
  },
  library: {
    id: "library",
    name: "Library",
    nameJa: "としょしつ",
    floor: 0,
    bounds: { x0: -8, x1: 0, z0: 4, z1: 11 },
    lamp: { x: -4.3, y: 2.3, z: 7.8, color: "#ffc27a", intensity: 9 }
  },
  landing: {
    id: "landing",
    name: "Landing",
    nameJa: "2かいの ろうか",
    floor: 1,
    bounds: { x0: -8, x1: 8, z0: -4, z1: 4 },
    lamp: { x: 0, y: WALL_H + 2.45, z: 0, color: "#c9b8ff", intensity: 9 }
  },
  playroom: {
    id: "playroom",
    name: "Playroom",
    nameJa: "あそびべや",
    floor: 1,
    bounds: { x0: -8, x1: 0, z0: -11, z1: -4 },
    lamp: { x: -4, y: WALL_H + 2.4, z: -7.6, color: "#ffd59a", intensity: 9 }
  },
  bathroom: {
    id: "bathroom",
    name: "Bathroom",
    nameJa: "おふろば",
    floor: 1,
    bounds: { x0: 0, x1: 8, z0: -11, z1: -4 },
    lamp: { x: 4, y: WALL_H + 2.4, z: -7.6, color: "#d8f2ff", intensity: 9 }
  },
  music: {
    id: "music",
    name: "Music room",
    nameJa: "おんがくしつ",
    floor: 1,
    bounds: { x0: -8, x1: 0, z0: 4, z1: 11 },
    lamp: { x: -4, y: WALL_H + 2.35, z: 7.6, color: "#ffc8e0", intensity: 9 }
  },
  attic: {
    id: "attic",
    name: "Attic",
    nameJa: "やねうら",
    floor: 1,
    bounds: { x0: 0, x1: 8, z0: 4, z1: 11 },
    lamp: { x: 4, y: WALL_H + 2.3, z: 7.4, color: "#c7b3ff", intensity: 7 }
  }
};

export function floorOf(room: RoomId): Floor {
  return ROOMS[room].floor;
}

/** World height of a room's floor. */
export function floorYOf(room: RoomId): number {
  return FLOOR_Y[ROOMS[room].floor];
}

/**
 * The staircase. `walk` is where the player's centre can be while on the
 * steps (the banisters are colliders); its height rises from the bottom
 * edge (x0, ground floor) to the top edge (x1, upstairs).
 */
export const STAIRS = {
  /** Footprint of the steps. */
  rect: { x0: 3.6, x1: 6.4, z0: -1.2, z1: 1.2 } as Rect,
  walk: { x0: 3.6, x1: 6.4, z0: -1.1, z1: 1.1 } as Rect,
  /** Gate at the foot of the stairs (the "stairs" door). */
  gateX: 3.45,
  /** Where the beacon floats when the next room is upstairs. */
  beacon: { x: 2.85, z: 0 }
};

/** Floor holes (the stairwell opening on the landing). */
export const FLOOR_HOLES: Partial<Record<RoomId, Rect[]>> = {
  landing: [STAIRS.rect]
};

export type DoorId =
  | "bedroom"
  | "dining"
  | "storage"
  | "library"
  | "entrance"
  | "playroom"
  | "bathroom"
  | "music"
  | "attic"
  | "stairs";

export interface Opening {
  from: number;
  to: number;
  /** Top of the opening above the floor (a lintel fills the wall above). */
  top: number;
  /** A window: bottom of the opening above the floor (a sill-height wall piece fills below). */
  bottom?: number;
  door?: DoorId;
}

/**
 * A straight wall. axis "x" runs along x at z = at; axis "z" runs along z at x = at.
 * `neg`/`pos` name the room on each side (null = outside the hotel).
 */
export interface WallLine {
  id: string;
  floor: Floor;
  axis: "x" | "z";
  at: number;
  from: number;
  to: number;
  neg: RoomId | null;
  pos: RoomId | null;
  openings?: Opening[];
}

const door = (from: number, to: number, id: DoorId, top = DOOR_H): Opening => ({ from, to, top, door: id });

/**
 * Real holes in the outer walls behind the window models (models/bedroom.ts window,
 * models/upstairs.ts roundwindow), so the glass looks out at the actual garden and rain.
 * Matches the glass: 1.3 wide, 0.95 to 2.3 above the floor (the round one's square
 * hole is hidden behind a wooden surround). world.test.ts checks every window has one.
 */
export const WINDOW_GLASS = { half: 0.65, bottom: 0.95, top: 2.3 };
export const ROUND_GLASS = { half: 0.68, bottom: 0.94, top: 2.3 };
const win = (at: number, g = WINDOW_GLASS): Opening => ({ from: at - g.half, to: at + g.half, top: g.top, bottom: g.bottom });

const GROUND_WALLS: WallLine[] = [
  // north (outside)
  { id: "n-bed", openings: [win(-3)], floor: 0, axis: "x", at: -11, from: -8, to: 0, neg: null, pos: "bedroom" },
  { id: "n-din", openings: [win(2.2)], floor: 0, axis: "x", at: -11, from: 0, to: 8, neg: null, pos: "dining" },
  // lobby north wall
  { id: "m1-bed", floor: 0, axis: "x", at: -4, from: -8, to: 0, neg: "bedroom", pos: "lobby", openings: [door(-4.8, -3.2, "bedroom")] },
  { id: "m1-din", floor: 0, axis: "x", at: -4, from: 0, to: 8, neg: "dining", pos: "lobby", openings: [door(3.2, 4.8, "dining")] },
  // lobby south wall
  { id: "m2-lib", floor: 0, axis: "x", at: 4, from: -8, to: 0, neg: "lobby", pos: "library", openings: [door(-4.8, -3.2, "library")] },
  { id: "m2-sto", floor: 0, axis: "x", at: 4, from: 0, to: 8, neg: "lobby", pos: "storage", openings: [door(3.2, 4.8, "storage")] },
  // south (outside)
  { id: "s-lib", floor: 0, axis: "x", at: 11, from: -8, to: 0, neg: "library", pos: null },
  { id: "s-sto", floor: 0, axis: "x", at: 11, from: 0, to: 8, neg: "storage", pos: null },
  // west (outside), with the entrance
  { id: "w-bed", floor: 0, axis: "z", at: -8, from: -11, to: -4, neg: null, pos: "bedroom" },
  { id: "w-lob", floor: 0, axis: "z", at: -8, from: -4, to: 4, neg: null, pos: "lobby", openings: [door(-1.1, 1.1, "entrance", ENTRANCE_H)] },
  { id: "w-lib", openings: [win(6.2)], floor: 0, axis: "z", at: -8, from: 4, to: 11, neg: null, pos: "library" },
  // east (outside)
  { id: "e-din", floor: 0, axis: "z", at: 8, from: -11, to: -4, neg: "dining", pos: null },
  { id: "e-lob", floor: 0, axis: "z", at: 8, from: -4, to: 4, neg: "lobby", pos: null },
  { id: "e-sto", floor: 0, axis: "z", at: 8, from: 4, to: 11, neg: "storage", pos: null },
  // between rooms
  { id: "x-up", floor: 0, axis: "z", at: 0, from: -11, to: -4, neg: "bedroom", pos: "dining" },
  { id: "x-down", floor: 0, axis: "z", at: 0, from: 4, to: 11, neg: "library", pos: "storage" }
];

const UPPER_WALLS: WallLine[] = [
  { id: "u-n-play", openings: [win(-4.6)], floor: 1, axis: "x", at: -11, from: -8, to: 0, neg: null, pos: "playroom" },
  { id: "u-n-bath", openings: [win(2.6)], floor: 1, axis: "x", at: -11, from: 0, to: 8, neg: null, pos: "bathroom" },
  { id: "u-m1-play", floor: 1, axis: "x", at: -4, from: -8, to: 0, neg: "playroom", pos: "landing", openings: [door(-4.8, -3.2, "playroom")] },
  { id: "u-m1-bath", floor: 1, axis: "x", at: -4, from: 0, to: 8, neg: "bathroom", pos: "landing", openings: [door(3.2, 4.8, "bathroom")] },
  { id: "u-m2-mus", floor: 1, axis: "x", at: 4, from: -8, to: 0, neg: "landing", pos: "music", openings: [door(-4.8, -3.2, "music")] },
  // The attic door is lower and narrower than the others.
  { id: "u-m2-att", floor: 1, axis: "x", at: 4, from: 0, to: 8, neg: "landing", pos: "attic", openings: [door(3.4, 4.6, "attic", ATTIC_DOOR_H)] },
  { id: "u-s-mus", openings: [win(-3.4)], floor: 1, axis: "x", at: 11, from: -8, to: 0, neg: "music", pos: null },
  { id: "u-s-att", openings: [win(5.6, ROUND_GLASS)], floor: 1, axis: "x", at: 11, from: 0, to: 8, neg: "attic", pos: null },
  { id: "u-w-play", floor: 1, axis: "z", at: -8, from: -11, to: -4, neg: null, pos: "playroom" },
  { id: "u-w-lan", openings: [win(0)], floor: 1, axis: "z", at: -8, from: -4, to: 4, neg: null, pos: "landing" },
  { id: "u-w-mus", floor: 1, axis: "z", at: -8, from: 4, to: 11, neg: null, pos: "music" },
  { id: "u-e-bath", floor: 1, axis: "z", at: 8, from: -11, to: -4, neg: "bathroom", pos: null },
  { id: "u-e-lan", floor: 1, axis: "z", at: 8, from: -4, to: 4, neg: "landing", pos: null },
  { id: "u-e-att", floor: 1, axis: "z", at: 8, from: 4, to: 11, neg: "attic", pos: null },
  { id: "u-x-up", floor: 1, axis: "z", at: 0, from: -11, to: -4, neg: "playroom", pos: "bathroom" },
  { id: "u-x-down", floor: 1, axis: "z", at: 0, from: 4, to: 11, neg: "music", pos: "attic" }
];

export const WALL_LINES: WallLine[] = [...GROUND_WALLS, ...UPPER_WALLS];

export interface DoorDef {
  id: DoorId;
  floor: Floor;
  axis: "x" | "z";
  at: number;
  from: number;
  to: number;
  /** The room the door swings into. */
  room: RoomId;
  double?: boolean;
  height?: number;
  /** "attic": weathered planks; "gate": the iron gate at the foot of the stairs. */
  style?: "attic" | "gate";
}

export const DOORS: DoorDef[] = [
  { id: "bedroom", floor: 0, axis: "x", at: -4, from: -4.8, to: -3.2, room: "bedroom" },
  { id: "dining", floor: 0, axis: "x", at: -4, from: 3.2, to: 4.8, room: "dining" },
  { id: "library", floor: 0, axis: "x", at: 4, from: -4.8, to: -3.2, room: "library" },
  { id: "storage", floor: 0, axis: "x", at: 4, from: 3.2, to: 4.8, room: "storage" },
  { id: "entrance", floor: 0, axis: "z", at: -8, from: -1.1, to: 1.1, room: "lobby", double: true, height: ENTRANCE_H },
  { id: "stairs", floor: 0, axis: "z", at: STAIRS.gateX, from: -1.25, to: 1.25, room: "lobby", double: true, height: 1.15, style: "gate" },
  { id: "playroom", floor: 1, axis: "x", at: -4, from: -4.8, to: -3.2, room: "playroom" },
  { id: "bathroom", floor: 1, axis: "x", at: -4, from: 3.2, to: 4.8, room: "bathroom" },
  { id: "music", floor: 1, axis: "x", at: 4, from: -4.8, to: -3.2, room: "music" },
  { id: "attic", floor: 1, axis: "x", at: 4, from: 3.4, to: 4.6, room: "attic", height: ATTIC_DOOR_H, style: "attic" }
];

/** Gap between a closed leaf's top and the head of its frame: a hairline, not a slot. */
export const LEAF_CLEARANCE = 0.003;

/**
 * Door heights. `head` is the underside of the frame's head piece, which is the top of the
 * wall opening (doors.test.ts checks they agree), and a closed leaf fills the opening up to it.
 * The iron gate stands free of any wall and keeps its open bar construction.
 */
export function doorFit(door: DoorDef): { head: number; leaf: number } {
  const head = door.height ?? DOOR_H;
  return { head, leaf: door.style === "gate" ? head - 0.04 : head - LEAF_CLEARANCE };
}

/** Which door leads into each ghost room. */
export const ROOM_DOOR: Partial<Record<RoomId, DoorId>> = {
  bedroom: "bedroom",
  dining: "dining",
  storage: "storage",
  library: "library",
  playroom: "playroom",
  bathroom: "bathroom",
  music: "music",
  attic: "attic"
};

export interface WallPiece {
  id: string;
  line: WallLine;
  rect: Rect;
  /** World heights. */
  y0: number;
  y1: number;
}

/** Split wall lines into solid pieces and lintels above openings. */
export function wallPieces(lines: WallLine[] = WALL_LINES): WallPiece[] {
  const pieces: WallPiece[] = [];
  for (const line of lines) {
    const base = FLOOR_Y[line.floor];
    // Walls along x close the corners - but only at ends no other x wall continues from
    // (two coplanar overlapping boxes would flicker).
    const continues = (v: number) =>
      lines.some((o) => o !== line && o.floor === line.floor && o.axis === "x" && o.at === line.at && (o.from === v || o.to === v));
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
      if (o.from > cursor) pieces.push({ id: `${line.id}-${n++}`, line, rect: rectFor(cursor, o.from), y0: base, y1: base + WALL_H });
      // Below a window: a sill-height piece (it starts at the floor, so it still collides).
      if (o.bottom) pieces.push({ id: `${line.id}-${n++}`, line, rect: rectFor(o.from, o.to), y0: base, y1: base + o.bottom });
      pieces.push({ id: `${line.id}-${n++}`, line, rect: rectFor(o.from, o.to), y0: base + o.top, y1: base + WALL_H });
      cursor = o.to;
    }
    if (end > cursor) pieces.push({ id: `${line.id}-${n++}`, line, rect: rectFor(cursor, end), y0: base, y1: base + WALL_H });
  }
  return pieces;
}

// Ghost rooms first so a doorway counts as the room you are stepping into.
const LOOKUP: Record<Floor, RoomId[]> = {
  0: ["bedroom", "dining", "storage", "library", "lobby"],
  1: ["playroom", "bathroom", "music", "attic", "landing"]
};

export function roomAt(x: number, z: number, floor: Floor = 0): RoomId | null {
  for (const id of LOOKUP[floor]) {
    const b = ROOMS[id].bounds;
    if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) return id;
  }
  return null;
}
