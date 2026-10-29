export type Prep = "in" | "on" | "under" | "by";
export const PREPS: readonly Prep[] = ["in", "on", "under", "by"];

/** 0 = ground floor (Chapter 1), 1 = upstairs (Chapter 2). */
export type Floor = 0 | 1;

export type RoomId =
  | "lobby"
  | "bedroom"
  | "dining"
  | "storage"
  | "library"
  | "landing"
  | "playroom"
  | "bathroom"
  | "music"
  | "attic"
  // The Forgotten Guest Wing (upstairs, west of the landing): its corridor and six guest rooms.
  | "guesthall"
  | "g201"
  | "g202"
  | "g203"
  | "g204"
  | "g205"
  | "g206";
export type GhostId = "sleepy" | "hungry" | "sneaky" | "mischief" | "bouncy" | "bubbles" | "melody" | "shadow";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const v3 = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

/** Axis-aligned rectangle on the floor plane (x/z). */
export interface Rect {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

/** Rotation about the vertical axis, in degrees. Local +z is an object's front. */
export type Rot = 0 | 90 | 180 | 270;
