import type { Rect, Rot, Vec3 } from "../types";

const DEG = Math.PI / 180;

/** Rotate a local (x, z) offset about +y by `rot` degrees (three.js convention). */
export function rotateXZ(x: number, z: number, rot: Rot): { x: number; z: number } {
  switch (rot) {
    case 0:
      return { x, z };
    case 90:
      return { x: z, z: -x };
    case 180:
      return { x: -x, z: -z };
    case 270:
      return { x: -z, z: x };
  }
}

export function rotRadians(rot: Rot): number {
  return rot * DEG;
}

/** Local point (relative to an object's floor centre) to world space. */
export function localToWorld(
  origin: { x: number; z: number; y?: number },
  rot: Rot,
  p: Vec3
): Vec3 {
  const r = rotateXZ(p.x, p.z, rot);
  return { x: origin.x + r.x, y: (origin.y ?? 0) + p.y, z: origin.z + r.z };
}

/** World-space floor footprint of a local box w (x) by d (z) centred at the origin. */
export function footprint(origin: { x: number; z: number }, rot: Rot, w: number, d: number): Rect {
  const swap = rot === 90 || rot === 270;
  const hw = (swap ? d : w) / 2;
  const hd = (swap ? w : d) / 2;
  return { x0: origin.x - hw, x1: origin.x + hw, z0: origin.z - hd, z1: origin.z + hd };
}

export function rectContains(r: Rect, x: number, z: number, margin = 0): boolean {
  return x >= r.x0 + margin && x <= r.x1 - margin && z >= r.z0 + margin && z <= r.z1 - margin;
}

/** Distance from a point to a rectangle (0 when inside). */
export function rectDistance(r: Rect, x: number, z: number): number {
  const dx = Math.max(r.x0 - x, 0, x - r.x1);
  const dz = Math.max(r.z0 - z, 0, z - r.z1);
  return Math.hypot(dx, dz);
}

/** True when a circle overlaps a rectangle. */
export function circleHitsRect(r: Rect, x: number, z: number, radius: number): boolean {
  return rectDistance(r, x, z) < radius;
}

export function rectsOverlap(a: Rect, b: Rect, margin = 0): boolean {
  return a.x0 < b.x1 - margin && a.x1 > b.x0 + margin && a.z0 < b.z1 - margin && a.z1 > b.z0 + margin;
}

export function rectCenter(r: Rect): { x: number; z: number } {
  return { x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2 };
}

export function expandRect(r: Rect, by: number): Rect {
  return { x0: r.x0 - by, x1: r.x1 + by, z0: r.z0 - by, z1: r.z1 + by };
}

/** 2D segment (p→q) against an axis-aligned rectangle (slab method). Returns entry t in [0,1] or null. */
export function segmentRectT(
  px: number,
  pz: number,
  qx: number,
  qz: number,
  r: Rect
): number | null {
  let t0 = 0;
  let t1 = 1;
  const dx = qx - px;
  const dz = qz - pz;
  const clip = (p: number, q: number): boolean => {
    if (p === 0) return q >= 0;
    const t = q / p;
    if (p < 0) {
      if (t > t1) return false;
      if (t > t0) t0 = t;
    } else {
      if (t < t0) return false;
      if (t < t1) t1 = t;
    }
    return true;
  };
  if (
    clip(-dx, px - r.x0) &&
    clip(dx, r.x1 - px) &&
    clip(-dz, pz - r.z0) &&
    clip(dz, r.z1 - pz)
  ) {
    return t0;
  }
  return null;
}
