import type { Prep } from "../game/types";

/**
 * The detective's search pose: a two-bone leg (thigh + shin) solved so the feet stay planted
 * while the hips drop and move back, with the torso leaning at the hip and the head tilting
 * toward the hiding place. Pure maths so it can be tested without a renderer.
 */

/** Hip pivot height above the figure's floor (matches HumanFigure). */
export const HIP_Y = 0.4;
/** Hip to knee. */
export const THIGH = 0.17;
/** Knee to ankle. */
export const SHIN = 0.16;
/** Ankle height above the floor when standing: the foot's sole sits on the floor. */
export const ANKLE_Y = HIP_Y - THIGH - SHIN;

/** Deepest crouch: hips dropped this far and pushed back this far, feet where they stood. */
const MAX_DROP = 0.2;
const MAX_BACK = 0.07;

export interface SearchPose {
  /** 0 = standing, 1 = a deep crouch to look underneath. */
  depth: number;
  /** Forward torso lean at the hip (radians). */
  lean: number;
  /** Head tilt; positive looks down (radians). */
  head: number;
  /** How far the lantern arm reaches forward (radians, positive = forward). */
  reach: number;
}

/**
 * How to search a place. `height` is what the detective looks at, above the floor: the top
 * of the object for "in" and "by", the surface the ghost would sit on for "on".
 */
export function searchPoseFor(prep: Prep, height: number): SearchPose {
  // Under a bed or table: right down low, peering underneath with the lantern.
  if (prep === "under") return { depth: 1, lean: 0.4, head: 0.42, reach: 1.3 };
  if (prep === "in") {
    if (height < 0.45) return { depth: 0.8, lean: 0.36, head: 0.4, reach: 1.1 }; // a low box
    if (height < 0.8) return { depth: 0.45, lean: 0.32, head: 0.34, reach: 1.0 };
    if (height < 1.2) return { depth: 0, lean: 0.24, head: 0.3, reach: 0.85 }; // looking down into it
    return { depth: 0, lean: 0.08, head: 0.05, reach: 0.9 }; // a wardrobe: straight in
  }
  if (prep === "on") {
    if (height < 0.4) return { depth: 0.6, lean: 0.34, head: 0.38, reach: 1.05 }; // a rug or a step
    if (height < 1.15) return { depth: 0, lean: 0.18, head: 0.3, reach: 0.8 }; // a table top
    return { depth: 0, lean: 0.02, head: -0.2, reach: 1.1 }; // a high shelf: look up
  }
  // Beside something: bend for low furniture, stand for tall.
  if (height < 0.6) return { depth: 0.45, lean: 0.3, head: 0.3, reach: 0.95 };
  if (height < 1.2) return { depth: 0, lean: 0.16, head: 0.22, reach: 0.75 };
  return { depth: 0, lean: 0.06, head: 0.06, reach: 0.7 };
}

export interface LegPose {
  /** Hip, knee and ankle rotations about x (HumanFigure convention: negative swings forward). */
  hip: number;
  knee: number;
  ankle: number;
}

export interface BodyOffset {
  /** Hips lowered by this much. */
  drop: number;
  /** Hips moved back (local -z) by this much. */
  back: number;
}

export function bodyOffset(k: number): BodyOffset {
  return { drop: MAX_DROP * k, back: MAX_BACK * k };
}

/**
 * Two-bone IK in the leg's side plane. The hip sits at (y = HIP_Y - drop, z = -back) and the
 * ankle stays at (ANKLE_Y, 0), so the knee bends forward and the foot is turned back to flat.
 */
export function solveLeg(k: number): LegPose {
  const { drop, back } = bodyOffset(k);
  const dy = ANKLE_Y - (HIP_Y - drop);
  const dz = back;
  const d = Math.min(THIGH + SHIN - 1e-6, Math.max(Math.abs(THIGH - SHIN) + 1e-6, Math.hypot(dy, dz)));
  // A leg pointing straight down, rotated by θ about x, points along (y = -cos θ, z = -sin θ).
  const direction = Math.atan2(-dz, -dy);
  const alpha = Math.acos(clamp((THIGH * THIGH + d * d - SHIN * SHIN) / (2 * THIGH * d)));
  const inner = Math.acos(clamp((THIGH * THIGH + SHIN * SHIN - d * d) / (2 * THIGH * SHIN)));
  const hip = direction - alpha;
  const knee = Math.PI - inner;
  return { hip, knee, ankle: -(hip + knee) };
}

/** How far the knees open outward at the deepest crouch (radians about the hip-ankle line). */
export const KNEE_SPLAY = 0.5;

/**
 * The hip-to-ankle direction (unit, in the hip's parent frame). Turning the leg about this line
 * opens the knees outward without moving the foot.
 */
export function legAxis(k: number): { y: number; z: number } {
  const { drop, back } = bodyOffset(k);
  const y = ANKLE_Y - (HIP_Y - drop);
  const length = Math.hypot(y, back);
  return { y: y / length, z: back / length };
}

/** Where the ankle ends up for a leg pose, relative to the figure's floor origin (for tests). */
export function ankleFrom(k: number, leg: LegPose): { y: number; z: number } {
  const { drop, back } = bodyOffset(k);
  const kneeY = HIP_Y - drop - Math.cos(leg.hip) * THIGH;
  const kneeZ = -back - Math.sin(leg.hip) * THIGH;
  const shin = leg.hip + leg.knee;
  return { y: kneeY - Math.cos(shin) * SHIN, z: kneeZ - Math.sin(shin) * SHIN };
}

/** Knee position, relative to the figure's floor origin. */
export function kneeFrom(k: number, leg: LegPose): { y: number; z: number } {
  const { drop, back } = bodyOffset(k);
  return { y: HIP_Y - drop - Math.cos(leg.hip) * THIGH, z: -back - Math.sin(leg.hip) * THIGH };
}

/** Smooth ease in and out for the lower / rise ramps. */
export function ease(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

function clamp(v: number): number {
  return Math.min(1, Math.max(-1, v));
}
