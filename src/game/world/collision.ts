import type { Collider } from "./world";
import { WORLD } from "./world";
import { rectCenter, rectDistance } from "./geometry";
import { INTERACT_RANGE, PLAYER_R } from "./constants";
import { roomAt } from "./rooms";

/** Push a circle out of every collider. Door blockers are skipped while their door is open. */
export function resolveCollisions(
  x: number,
  z: number,
  isDoorOpen: (door: string) => boolean,
  colliders: Collider[] = WORLD.colliders,
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

function angleDiff(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** The searchable object the player can reach, preferring what they face. Same room only. */
export function nearestSearchable(x: number, z: number, facing: number): string | null {
  const room = roomAt(x, z);
  let best: string | null = null;
  let bestScore = Infinity;
  for (const o of WORLD.objects) {
    if (!o.searchable) continue;
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
