import type { CameraShot } from "../game/runtime";
import type { Vec3 } from "../game/types";
import { rectCenter, rotateXZ } from "../game/world/geometry";
import { GHOST_H } from "../game/world/kinds";
import type { HidingSpot, WorldObject } from "../game/world/world";

/**
 * Close-up camera framings. The camera stays on the side the player came
 * from, but never more than ~55 degrees off the object's front, so it never
 * ends up behind a wall-mounted or wall-hugging object.
 */

const LIMIT = (55 * Math.PI) / 180;

/** Horizontal direction from the object towards the camera. */
export function viewDir(obj: WorldObject, from: { x: number; z: number }): { x: number; z: number } {
  const c = rectCenter(obj.rect);
  const front = rotateXZ(0, 1, obj.rot);
  const dx = from.x - c.x;
  const dz = from.z - c.z;
  if (Math.hypot(dx, dz) < 0.01) return front;
  const frontA = Math.atan2(front.x, front.z);
  let rel = Math.atan2(dx, dz) - frontA;
  while (rel > Math.PI) rel -= Math.PI * 2;
  while (rel < -Math.PI) rel += Math.PI * 2;
  const a = frontA + Math.max(-LIMIT, Math.min(LIMIT, rel));
  return { x: Math.sin(a), z: Math.cos(a) };
}

/** Framing while choosing a spot on an object. */
export function searchShot(obj: WorldObject, from: { x: number; z: number }): CameraShot {
  const c = rectCenter(obj.rect);
  const dir = viewDir(obj, from);
  const size = Math.max(obj.spec.w, obj.spec.d, obj.spec.wallMounted ? 1.6 : obj.spec.h * 0.9);
  const dist = Math.min(4.8, Math.max(2.7, size * 1.6 + 1.2));
  const ty = obj.spec.wallMounted ? 1.05 : Math.min(1.15, Math.max(0.35, obj.spec.h * 0.42));
  const pitch = obj.spec.h > 1.6 ? 0.36 : 0.34;
  const target: Vec3 = { x: c.x, y: ty, z: c.z };
  const pos: Vec3 = {
    x: c.x + dir.x * dist * Math.cos(pitch),
    y: ty + dist * Math.sin(pitch) + 0.15,
    z: c.z + dir.z * dist * Math.cos(pitch)
  };
  return { pos, target };
}

/**
 * Where the player steps to during a close-up: beside the object's front
 * corner, out of the camera's line - on the side away from a "by" spot so
 * the player never stands where a ghost could appear.
 */
export function standPoint(
  obj: WorldObject,
  dir: { x: number; z: number },
  player: { x: number; z: number },
  bySpot: { x: number; z: number } | null
): { x: number; z: number } {
  const c = rectCenter(obj.rect);
  const w = obj.rect.x1 - obj.rect.x0;
  const d = obj.rect.z1 - obj.rect.z0;
  const halfAlong = (Math.abs(dir.x) * w + Math.abs(dir.z) * d) / 2;
  const halfPerp = (Math.abs(dir.z) * w + Math.abs(dir.x) * d) / 2;
  const perp = { x: dir.z, z: -dir.x };
  let side = Math.sign((player.x - c.x) * perp.x + (player.z - c.z) * perp.z) || 1;
  if (bySpot) {
    const s = (bySpot.x - c.x) * perp.x + (bySpot.z - c.z) * perp.z;
    if (Math.abs(s) > 0.2) side = -Math.sign(s);
  }
  const out = halfAlong + 0.5;
  const sideways = Math.min(halfPerp + 0.45, 1.5);
  return { x: c.x + dir.x * out + perp.x * side * sideways, z: c.z + dir.z * out + perp.z * side * sideways };
}

/** Wider view for the capture, so the flight into the lantern is visible. */
export function captureShot(player: { x: number; z: number }, ghost: Vec3): CameraShot {
  const mx = (player.x + ghost.x) / 2;
  const mz = (player.z + ghost.z) / 2;
  let bx = player.x - ghost.x;
  let bz = player.z - ghost.z;
  const l = Math.hypot(bx, bz) || 1;
  bx /= l;
  bz /= l;
  // Back off behind the player and a little to the side.
  const sx = -bz * 0.45;
  const sz = bx * 0.45;
  return {
    pos: { x: player.x + bx * 2.4 + sx, y: 2.3, z: player.z + bz * 2.4 + sz },
    target: { x: mx, y: 0.75, z: mz }
  };
}

/** Framing for a found ghost, so the relationship is unmistakable (low for "under"). */
export function revealShot(spot: HidingSpot, obj: WorldObject, from: { x: number; z: number }): CameraShot {
  const dir = viewDir(obj, from);
  const h = GHOST_H * spot.scale[1];
  const gy = spot.pos.y + h * 0.5;
  let dist = 2.7;
  let camY = gy + 1.0;
  let ty = gy;
  const c = rectCenter(obj.rect);
  // Look at a point between the object and the ghost so both are framed.
  let tx = (c.x + spot.pos.x) / 2;
  let tz = (c.z + spot.pos.z) / 2;
  switch (spot.prep) {
    case "under":
      tx = spot.pos.x;
      tz = spot.pos.z;
      if (obj.spec.wallMounted) {
        // Under a window: keep the window in the frame above the ghost.
        dist = 3.1;
        camY = 1.05;
        ty = 0.95;
      } else {
        // Low, nearly floor level, so the sight line passes under the rail.
        dist = 2.2;
        camY = 0.4;
        ty = 0.24;
      }
      break;
    case "on":
      dist = 2.8;
      camY = gy + 1.0;
      ty = gy - 0.15;
      break;
    case "in":
      dist = 2.5;
      camY = gy + 1.15;
      ty = gy - 0.05;
      break;
    case "by":
      dist = 3.0;
      camY = gy + 0.9;
      ty = gy - 0.1;
      break;
  }
  return {
    pos: { x: tx + dir.x * dist, y: camY, z: tz + dir.z * dist },
    target: { x: tx, y: ty, z: tz }
  };
}
