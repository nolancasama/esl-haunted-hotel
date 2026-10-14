import type { Collider } from "./world";
import { WORLD } from "./world";
import { rectCenter, rectDistance } from "./geometry";
import { INTERACT_RANGE, PLAYER_R } from "./constants";
import { FLOOR_Y, STAIRS, roomAt } from "./rooms";
import type { Floor } from "../types";

/** True while a body's centre is on the steps (between the banisters). */
export function onStairs(x: number, z: number): boolean {
  const w = STAIRS.walk;
  return x >= w.x0 && x <= w.x1 && z > w.z0 && z < w.z1;
}

/** How far up the stairs (0 = bottom step, 1 = top). */
export function stairsT(x: number): number {
  const w = STAIRS.walk;
  return Math.min(1, Math.max(0, (x - w.x0) / (w.x1 - w.x0)));
}

export interface FloorState {
  floor: Floor;
  /** Height of the feet. */
  y: number;
  stairs: boolean;
}

/**
 * Floor and height of a body at (x, z) that was on `prev` a moment ago.
 * On the steps the height follows the slope and the floor flips at the
 * halfway point, so you leave the bottom on the ground floor and the top
 * upstairs. Off the steps the floor does not change.
 */
export function floorState(x: number, z: number, prev: Floor): FloorState {
  if (onStairs(x, z)) {
    const t = stairsT(x);
    return { floor: t > 0.5 ? 1 : 0, y: t * FLOOR_Y[1], stairs: true };
  }
  return { floor: prev, y: FLOOR_Y[prev], stairs: false };
}

const sets = new Map<string, Collider[]>();

/** Colliders that apply on a floor, or on the steps (only the banisters there). */
export function collidersFor(floor: Floor, stairs: boolean, all: Collider[] = WORLD.colliders): Collider[] {
  const key = stairs ? "stairs" : `f${floor}`;
  if (all === WORLD.colliders) {
    const hit = sets.get(key);
    if (hit) return hit;
  }
  const out = all.filter((c) => (stairs ? c.floor === "all" : c.floor === "all" || c.floor === floor));
  if (all === WORLD.colliders) sets.set(key, out);
  return out;
}

/** Push a circle out of every collider. Door blockers are skipped while their door is open. */
export function resolveCollisions(
  x: number,
  z: number,
  isDoorOpen: (door: string) => boolean,
  colliders: Collider[] = collidersFor(0, false),
  r = PLAYER_R
): { x: number; z: number } {
  for (let iter = 0; iter < 4; iter++) {
    let moved = false;
    for (const c of colliders) {
      if (c.door && isDoorOpen(c.door)) continue;
      const b = c.rect;
      const cx = Math.min(Math.max(x, b.x0), b.x1);
      const cz = Math.min(Math.max(z, b.z0), b.z1);
      const dx = x - cx;
      const dz = z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      moved = true;
      if (d2 > 1e-10) {
        const d = Math.sqrt(d2);
        x = cx + (dx / d) * r;
        z = cz + (dz / d) * r;
      } else {
        const left = x - b.x0;
        const right = b.x1 - x;
        const top = z - b.z0;
        const bottom = b.z1 - z;
        const m = Math.min(left, right, top, bottom);
        if (m === left) x = b.x0 - r;
        else if (m === right) x = b.x1 + r;
        else if (m === top) z = b.z0 - r;
        else z = b.z1 + r;
      }
    }
    if (!moved) break;
  }
  return { x, z };
}

/**
 * Move a body on a floor (or the stairs) and resolve collisions against
 * whatever applies where it ends up. Returns its new floor state.
 */
export function moveBody(
  x: number,
  z: number,
  prev: Floor,
  isDoorOpen: (door: string) => boolean,
  r = PLAYER_R
): { x: number; z: number } & FloorState {
  const want = floorState(x, z, prev);
  const p = resolveCollisions(x, z, isDoorOpen, collidersFor(want.floor, want.stairs), r);
  return { ...p, ...floorState(p.x, p.z, want.floor) };
}

function angleDiff(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** The searchable (or usable) object the player can reach, preferring what they face. Same room only. */
export function nearestSearchable(x: number, z: number, facing: number, floor: Floor = 0): string | null {
  const room = roomAt(x, z, floor);
  let best: string | null = null;
  let bestScore = Infinity;
  for (const o of WORLD.objects) {
    if (!o.interactive || o.floor !== floor) continue;
    if (room && o.room !== room) continue;
    const d = rectDistance(o.rect, x, z);
    if (d > INTERACT_RANGE) continue;
    const c = rectCenter(o.rect);
    const diff = Math.abs(angleDiff(Math.atan2(c.x - x, c.z - z), facing));
    const score = d + diff * 0.28;
    if (score < bestScore) {
      bestScore = score;
      best = o.id;
    }
  }
  return best;
}
