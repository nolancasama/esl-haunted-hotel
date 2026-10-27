import type { Vec3 } from "../types";
import { localToWorld } from "../world/geometry";
import { FLOOR_Y, ROOMS, WALL_H } from "../world/rooms";
import { GHOST_H, WORLD, type HidingSpot, type WorldObject } from "../world/world";
import type { MatchState } from "./types";
import type { PickMode } from "./session";

/**
 * Where the student's ghost looks from while hidden. Presentation only: the
 * simulation never reads these. Yaw follows the detective convention
 * (direction = sin(yaw), cos(yaw) in x/z); pitch is up-positive radians.
 */
export interface HidingView {
  eye: Vec3;
  yaw: number;
  pitch: number;
  /** How far the student may turn from `yaw` either way. */
  yawLimit: number;
  pitchMin: number;
  pitchMax: number;
  fov: number;
  near: number;
  /** How far a lidded container's lid is lifted while peeking (0..1 of the full opening). */
  lidAjar: number;
}

/** Containers whose model has a hinged lid part (bathtubs are open; the clock has a framed door). */
const LIDDED = new Set(["box", "basket", "crate"]);
const DEG = Math.PI / 180;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function roomCentre(spot: HidingSpot) {
  const b = ROOMS[spot.room].bounds;
  return { x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2 };
}

/** The object's local +z (its front) as a world yaw. */
function frontYaw(obj: WorldObject): number {
  const a = localToWorld(obj, obj.rot, { x: 0, y: 0, z: 0 });
  const b = localToWorld(obj, obj.rot, { x: 0, y: 0, z: 1 });
  return Math.atan2(b.x - a.x, b.z - a.z);
}

/** Look at a point about child height in the middle of the room, never far above or below. */
function pitchToRoom(eye: Vec3, floor: number, centre: { x: number; z: number }, lo: number, hi: number) {
  const dist = Math.max(1.5, Math.hypot(centre.x - eye.x, centre.z - eye.z));
  return clamp(Math.atan2(floor + 0.9 - eye.y, dist), lo, hi);
}

/** Distance along a yaw from a point to the room's walls. */
function openAhead(p: { x: number; z: number }, yaw: number, b: { x0: number; x1: number; z0: number; z1: number }) {
  const dx = Math.sin(yaw), dz = Math.cos(yaw);
  const tx = dx > 1e-6 ? (b.x1 - p.x) / dx : dx < -1e-6 ? (b.x0 - p.x) / dx : Infinity;
  const tz = dz > 1e-6 ? (b.z1 - p.z) / dz : dz < -1e-6 ? (b.z0 - p.z) / dz : Infinity;
  return Math.min(tx, tz);
}

/** Keep upward looks below the top of the far walls (there is no ceiling to see). */
function pitchCeiling(eye: Vec3, floor: number, pitch: number) {
  return clamp(Math.atan2(floor + WALL_H - 0.35 - eye.y, 4.5), pitch + 0.04, pitch + 0.3);
}

export function hidingView(spot: HidingSpot): HidingView {
  const obj = WORLD.objectById.get(spot.objectId)!;
  const { spec } = obj;
  const floor = FLOOR_Y[ROOMS[spot.room].floor];
  const centre = roomCentre(spot);
  const local = (p: Vec3) => localToWorld({ x: obj.x, z: obj.z, y: floor }, obj.rot, p);
  switch (spot.prep) {
    case "under": {
      // Low to the floor, a little way under, looking out of whichever open side faces the most room
      // (a bed's side or foot, a table's long side) — never into the wall behind it.
      const u = spec.under!;
      const y = (u.y ?? 0) + Math.min(u.clearance * 0.5, 0.3);
      const cx = (u.area.x0 + u.area.x1) / 2;
      const cz = (u.area.z0 + u.area.z1) / 2;
      // Far enough back that the underside frames the top of the view.
      const inX = Math.min(0.45, (u.area.x1 - u.area.x0) / 2 - 0.05);
      const inZ = Math.min(0.45, (u.area.z1 - u.area.z0) / 2 - 0.05);
      const sides = [
        { dx: 0, dz: 1, edge: u.area.z1, half: spec.d / 2, at: { x: cx, y, z: u.area.z1 - inZ } },
        { dx: 0, dz: -1, edge: -u.area.z0, half: spec.d / 2, at: { x: cx, y, z: u.area.z0 + inZ } },
        { dx: 1, dz: 0, edge: u.area.x1, half: spec.w / 2, at: { x: u.area.x1 - inX, y, z: cz } },
        { dx: -1, dz: 0, edge: -u.area.x0, half: spec.w / 2, at: { x: u.area.x0 + inX, y, z: cz } }
      ].filter((s) => s.edge >= s.half - 0.15);
      const b = ROOMS[spot.room].bounds;
      let best = { eye: local(sides[0].at), yaw: frontYaw(obj), open: -1 };
      for (const side of sides) {
        const eye = local(side.at);
        const tip = local({ x: side.at.x + side.dx, y, z: side.at.z + side.dz });
        const dir = { x: tip.x - eye.x, z: tip.z - eye.z };
        const open = Math.min(
          dir.x > 0.5 ? b.x1 - eye.x : dir.x < -0.5 ? eye.x - b.x0 : Infinity,
          dir.z > 0.5 ? b.z1 - eye.z : dir.z < -0.5 ? eye.z - b.z0 : Infinity
        );
        if (open > best.open + 0.3) best = { eye, yaw: Math.atan2(dir.x, dir.z), open };
      }
      return { eye: best.eye, yaw: best.yaw, pitch: 0.06, yawLimit: 40 * DEG, pitchMin: -0.08, pitchMax: 0.2, fov: 74, near: 0.03, lidAjar: 0 };
    }
    case "in": {
      const inn = spec.in!;
      if (obj.kind === "clock") {
        // Behind the framed door, the side walls and frame around a narrow view.
        const eye = local({ x: 0, y: 0.92, z: (inn.box.z0 + inn.box.z1) / 2 - 0.02 });
        return { eye, yaw: frontYaw(obj), pitch: -0.04, yawLimit: 32 * DEG, pitchMin: -0.22, pitchMax: 0.12, fov: 70, near: 0.03, lidAjar: 0 };
      }
      // Peeking out through the slit under a lifted lid (front wall below, lid above), or over an open rim.
      const lid = LIDDED.has(obj.kind);
      const cx = (inn.box.x0 + inn.box.x1) / 2;
      const eye = lid
        ? local({ x: cx, y: inn.box.y1 + 0.015, z: (inn.box.z0 + inn.box.z1) / 2 + 0.06 })
        : local({ x: cx, y: inn.box.y1 + 0.06, z: inn.box.z1 - 0.07 });
      return { eye, yaw: frontYaw(obj), pitch: lid ? 0.02 : -0.02, yawLimit: 38 * DEG, pitchMin: -0.12, pitchMax: lid ? 0.08 : 0.1, fov: 72, near: 0.03, lidAjar: lid ? 0.1 : 0 };
    }
    case "on": {
      const eye = { x: spot.hidePos.x, y: spot.hidePos.y + GHOST_H * spot.scale[1] * 0.72, z: spot.hidePos.z };
      const yaw = Math.atan2(centre.x - eye.x, centre.z - eye.z);
      const pitch = pitchToRoom(eye, floor, centre, -0.55, 0);
      return { eye, yaw, pitch, yawLimit: 45 * DEG, pitchMin: pitch - 0.35, pitchMax: pitchCeiling(eye, floor, pitch), fov: 66, near: 0.05, lidAjar: 0 };
    }
    case "by": {
      // Beside the object, looking past it into the room: the object covers one side of the view.
      const eye = { x: spot.hidePos.x, y: spot.hidePos.y + GHOST_H * spot.scale[1] * 0.7, z: spot.hidePos.z };
      // The object's angular extent from the eye; turn so its near edge sits a little off-centre.
      const r = obj.rect;
      const toObj = Math.atan2((r.x0 + r.x1) / 2 - eye.x, (r.z0 + r.z1) / 2 - eye.z);
      const rel = [[r.x0, r.z0], [r.x0, r.z1], [r.x1, r.z0], [r.x1, r.z1]].map(([x, z]) => {
        let a = Math.atan2(x - eye.x, z - eye.z) - toObj;
        while (a > Math.PI) a -= Math.PI * 2;
        while (a < -Math.PI) a += Math.PI * 2;
        return a;
      });
      const b = ROOMS[spot.room].bounds;
      const yaw = [toObj + Math.max(...rel) + 0.42, toObj + Math.min(...rel) - 0.42]
        .sort((p, q) => openAhead(eye, q, b) - openAhead(eye, p, b))[0];
      const pitch = pitchToRoom(eye, floor, centre, -0.45, 0.06);
      return { eye, yaw, pitch, yawLimit: 45 * DEG, pitchMin: pitch - 0.3, pitchMax: pitchCeiling(eye, floor, pitch), fov: 66, near: 0.05, lidAjar: 0 };
    }
  }
}

const cache = new Map<string, HidingView>();
export function hidingViewFor(spotId: string): HidingView | null {
  const hit = cache.get(spotId);
  if (hit) return hit;
  const spot = WORLD.spotById.get(spotId);
  if (!spot) return null;
  const view = hidingView(spot);
  cache.set(spotId, view);
  return view;
}

export type HsCameraMode = "overview" | "reveal" | "firstPerson" | "destinationSelection" | "relocating" | "discovered" | "victory";

export interface CameraInput {
  enabled: boolean;
  status: MatchState["status"];
  english: boolean;
  pickMode: PickMode;
  decisionPhase: "decision" | "destination" | null;
  transit: boolean;
  /** A short presentation hold in the room view (the first hide, an ability firing). */
  holding: boolean;
  /** Seconds since the match ended. */
  sinceEnd: number;
  lossReason: "found" | "caughtInOpen" | null;
}

/** Seconds the first-person view is held after being found, before the reveal shot. */
export const FOUND_HOLD = 1.1;

/** One camera mode from the match/session state; strategy decisions stay in the overhead view. */
export function cameraMode(i: CameraInput): HsCameraMode {
  if (i.status === "setup" || !i.enabled) return "overview";
  if (i.status === "won") return "victory";
  if (i.status === "lost") return i.lossReason === "found" && i.sinceEnd < FOUND_HOLD ? "firstPerson" : "discovered";
  if (i.transit) return "relocating";
  if (i.english || i.pickMode || i.decisionPhase === "destination") return "destinationSelection";
  if (i.holding) return "reveal";
  return "firstPerson";
}

export { heartbeatBpm, heartbeatGain, heartbeatLevel } from "../../audio/heartbeat";
