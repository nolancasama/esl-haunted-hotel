export type Prep = "in" | "on" | "under" | "by";
export const PREPS: readonly Prep[] = ["in", "on", "under", "by"];

export type RoomId = "lobby" | "bedroom" | "dining" | "storage" | "library";
export type GhostId = "sleepy" | "hungry" | "sneaky" | "mischief";

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
