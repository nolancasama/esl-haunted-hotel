import type { Vec3 } from "../types";
import type { Rng } from "../logic/rng";
import { FLOOR_Y, ROOMS, WALL_H } from "../world/rooms";
import { WORLD } from "../world/world";
import type { ClueInput, ClueKind, PlayRoom, Point } from "./types";

export const CLUE_GAINS: Record<ClueKind, number> = {
  sound: 22, glimpse: 30, creak: 26, munch: 18, decoy: 30, music: 14, bubbles: 8
};

export interface PerceptionTimers {
  seenClose: number;
  glimpse: number;
  creak: number;
  sound: number;
}

export interface BubbleCloud extends Point {
  radius: number;
  remaining: number;
}

export interface PerceptionInput {
  room: PlayRoom;
  detective: Point & { yaw: number };
  ghost: Vec3 & {
    spotId: string | null;
    transit: boolean;
    speed: number;
    silent: boolean;
    invisible: boolean;
    loudness: number;
  };
  bubbles: readonly BubbleCloud[];
  music: boolean;
  sleepy: boolean;
  timers: PerceptionTimers;
}

export function initialPerceptionTimers(): PerceptionTimers {
  return { seenClose: 0, glimpse: 0, creak: 0, sound: 0 };
}

/** +z is forward at yaw zero, matching world actor poses. */
export function inVisionCone(observer: Point & { yaw: number }, target: Point): boolean {
  const dx = target.x - observer.x;
  const dz = target.z - observer.z;
  const distance = Math.hypot(dx, dz);
  if (distance > 5) return false;
  if (distance < 1e-8) return true;
  return (dx * Math.sin(observer.yaw) + dz * Math.cos(observer.yaw)) / distance >= Math.cos(35 * Math.PI / 180);
}

function hitsBox(from: Vec3, to: Vec3, low: Vec3, high: Vec3): boolean {
  let entry = 0.0001;
  let exit = 0.9999;
  for (const axis of ["x", "y", "z"] as const) {
    const direction = to[axis] - from[axis];
    if (Math.abs(direction) < 1e-9) {
      if (from[axis] < low[axis] || from[axis] > high[axis]) return false;
    } else {
      const a = (low[axis] - from[axis]) / direction;
      const b = (high[axis] - from[axis]) / direction;
      entry = Math.max(entry, Math.min(a, b));
      exit = Math.min(exit, Math.max(a, b));
      if (entry > exit) return false;
    }
  }
  return true;
}

function hitsCloud(from: Point, to: Point, cloud: BubbleCloud): boolean {
  if (cloud.remaining <= 0) return false;
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const length2 = dx * dx + dz * dz;
  const t = length2 === 0 ? 0 : Math.max(0, Math.min(1, ((cloud.x - from.x) * dx + (cloud.z - from.z) * dz) / length2));
  return Math.hypot(from.x + dx * t - cloud.x, from.z + dz * t - cloud.z) <= cloud.radius;
}

/** Room-floor heights matter upstairs; tall furniture and walls block the sight ray. */
export function hasLineOfSight(room: PlayRoom, from: Vec3, to: Vec3, bubbles: readonly BubbleCloud[] = []): boolean {
  if (bubbles.some((cloud) => hitsCloud(from, to, cloud))) return false;
  const floor = ROOMS[room].floor;
  const base = FLOOR_Y[floor];
  for (const collider of WORLD.colliders) {
    if (collider.floor !== floor && collider.floor !== "all") continue;
    const object = WORLD.objectById.get(collider.id);
    if (object && (object.room !== room || object.spec.h < 1.2)) continue;
    const height = object ? object.spec.h : WALL_H;
    const { rect } = collider;
    if (hitsBox(from, to, { x: rect.x0, y: base, z: rect.z0 }, { x: rect.x1, y: base + height, z: rect.z1 })) return false;
  }
  return true;
}

export function movementHearingRadius(speed: number, loudness = 1, music = false, silent = false): number {
  if (silent || speed <= 0) return 0;
  return (1.8 + speed * 1.6) * Math.max(0, loudness) * (music ? 0.25 : 1);
}

/** Uniform disk blur never leaks an exact sound origin or a truth-bearing spot id. */
export function blurredClue(kind: ClueKind, position: Point, rng: Rng, radius = 1): ClueInput {
  const angle = rng() * Math.PI * 2;
  const offset = Math.sqrt(rng()) * radius;
  return { kind, x: position.x + Math.sin(angle) * offset, z: position.z + Math.cos(angle) * offset, strength: CLUE_GAINS[kind] };
}

/** Only this boundary reads the ghost's true pose. Output clues carry no occupied spot. */
export function perceive(input: PerceptionInput, dt: number, rng: Rng): {
  clues: ClueInput[];
  caughtInOpen: boolean;
  visible: boolean;
  timers: PerceptionTimers;
} {
  const { ghost, detective } = input;
  const timers = {
    seenClose: input.timers.seenClose,
    glimpse: Math.max(0, input.timers.glimpse - dt),
    creak: Math.max(0, input.timers.creak - dt),
    sound: Math.max(0, input.timers.sound - dt)
  };
  const clues: ClueInput[] = [];
  const spot = ghost.spotId ? WORLD.spotById.get(ghost.spotId) : undefined;
  const base = FLOOR_Y[ROOMS[input.room].floor];
  const concealed = !ghost.transit && spot && (spot.prep === "in" || spot.prep === "under" || (spot.prep === "on" && spot.hidePos.y - base > 1.4));
  const visible = !ghost.invisible && !concealed && inVisionCone(detective, ghost) &&
    hasLineOfSight(input.room, { x: detective.x, y: base + 1.4, z: detective.z }, { x: ghost.x, y: ghost.y + 0.35, z: ghost.z }, input.bubbles);
  const distance = Math.hypot(ghost.x - detective.x, ghost.z - detective.z);
  timers.seenClose = ghost.transit && visible && distance <= 2.5 ? timers.seenClose + dt : 0;
  if (visible && timers.glimpse <= 0) {
    clues.push(blurredClue("glimpse", ghost, rng, 0.15));
    timers.glimpse = 2;
  }
  if (ghost.transit && distance <= movementHearingRadius(ghost.speed, ghost.loudness, input.music, ghost.silent) && timers.sound <= 0) {
    clues.push(blurredClue("sound", ghost, rng));
    timers.sound = 1.2;
  }
  if (!ghost.transit && !input.sleepy && distance <= 2.5 && timers.creak <= 0) {
    timers.creak = 3 + rng() * 3;
    if (rng() < 0.65) clues.push(blurredClue("creak", ghost, rng));
  }
  return { clues, visible: Boolean(visible), caughtInOpen: timers.seenClose >= 0.6 - 1e-9, timers };
}
