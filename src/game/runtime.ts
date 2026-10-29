import type { Floor, GhostId, Vec3 } from "./types";
import type { NavPoint } from "./world/nav";

export interface WalkPath extends NavPoint {
  auto?: { dirX: number; dirZ: number; ramp?: boolean };
  objectId: string | null;
  t0: number;
  path: NavPoint[];
  index: number;
  replans: number;
  checkT: number;
  checkX: number;
  checkZ: number;
}

/**
 * Mutable per-frame state shared by the scene, input and director.
 * Kept out of React so 60 fps updates never re-render components.
 */

export type GhostAnim =
  | { mode: "hidden" }
  /** Pops out at a spot and stays (answer phase). */
  | { mode: "found"; spotId: string; t0: number }
  /** Found and giggling at a wrong answer. */
  | { mode: "giggle"; spotId: string; t0: number }
  /** Correct answer: surprised, then sucked into the lantern (`big`: the last ghost, a grander flight). */
  | { mode: "capture"; spotId: string; t0: number; big?: boolean }
  /** Emerges at `spotId`, zooms around the room and vanishes. */
  | { mode: "escape"; spotId: string; t0: number };

export type SearchAnim = { spotId: string; t0: number; open: boolean } | null;

export interface Gag {
  id: number;
  spotId: string;
  item: "sock" | "duck" | "mouse" | "cookie" | "spider" | "ball";
  t0: number;
}

export interface CameraShot {
  pos: Vec3;
  target: Vec3;
  /** The player is the subject of this shot: never fade them out for standing in the way. */
  keepPlayer?: boolean;
}

/** A harmless shake, wobble or rock of one object (Sneaky's rattles, Bouncy's toys, the chandelier). */
export interface Rattle {
  objectId: string;
  t0: number;
  /** Seconds. */
  dur: number;
  /** 1 = normal. */
  amp: number;
}

/** A floating music note (Melody's instruments). */
export interface Note {
  id: number;
  x: number;
  y: number;
  z: number;
  t0: number;
  color: string;
}

export const rt = {
  time: 0,
  player: {
    x: -3.6,
    z: -5.4,
    /** Height of the feet (rises on the stairs). */
    y: 0,
    floor: 0 as Floor,
    stairs: false,
    yaw: Math.PI,
    vx: 0,
    vz: 0,
    speed: 0,
    step: 0,
    frozen: true,
    /** Follow collision-safe waypoints, then search `objectId` on arrival. */
    walkTo: null as WalkPath | null,
    /** Scripted step (any phase): move here, then face `face`. Used to step aside in close-ups. */
    stepTo: null as null | { x: number; z: number; face: { x: number; z: number } },
    /** The intro's startled hop and turn (logic/startle.ts), from `t0` (rt.time). */
    startle: null as null | { t0: number; from: number; delta: number },
    /** How visible the player is drawn (0..1; they fade out when in the camera's way). */
    opacity: 1
  },
  /** Which floor is drawn (switches halfway up the stairs). */
  view: { floor: 0 as Floor },
  destination: { x: 0, z: 0, floor: 0 as Floor, t0: -100, arrived: -1, visible: false },
  /** Movement intent in camera space: x = right, y = forward (-1..1). */
  move: { x: 0, y: 0 },
  joy: { x: 0, y: 0, active: false },
  camera: {
    yaw: 0,
    pitch: 0.9,
    dist: 7.4,
    mode: "follow" as "follow" | "search" | "shot",
    shot: null as CameraShot | null,
    /** Jump to the wanted pose next frame (scene cuts). */
    snap: false,
    /** A gentle automatic turn (entering a ghost's room); dragging cancels it. */
    yawTarget: null as number | null,
    /**
     * While keys are held through an automatic turn, walking keeps the
     * direction it had when the turn began (no accidental U-turn).
     */
    inputLock: null as number | null,
    /** A short shake (the bang upstairs, the last capture). */
    shake: { t0: -10, amp: 0 },
    /** Set by the camera each frame: real camera position (for wall fading). */
    pos: { x: 0, y: 6, z: 6 } as Vec3,
    target: { x: 0, y: 1, z: 0 } as Vec3
  },
  ghost: { anim: { mode: "hidden" } as GhostAnim, id: "sleepy" as GhostId },
  boo: { visible: false, talking: false, appearT0: -10, target: null as Vec3 | null, surprisedT0: -10 },
  search: null as SearchAnim,
  gags: [] as Gag[],
  /** World position of the lantern (capture target). */
  lantern: { x: 0, y: 0.6, z: 0 } as Vec3,
  /** The lantern blazes with every ghost caught (the ending). */
  lanternBurstT0: -100,
  /** Lightning flash start time. */
  flashT0: -100,
  /** Object glow help (search ladder level 3) and spot glow (level 4). */
  helpObject: null as string | null,
  helpSpot: null as string | null,
  /** A gentle "look here" glow on something to use (the fan switch when the steam is thick). */
  attention: null as string | null,
  /** Objects wobbling right now. */
  rattles: [] as Rattle[],
  /** Doors that are open (id -> time opened). */
  doorsOpen: new Map<string, number>(),
  /** Doors that bang shut instead of swinging closed. */
  doorSlam: new Set<string>(),
  /** The door to walk to next (a beacon floats over it); "stairs" floats at the foot of the stairs. */
  beaconDoor: null as string | null,
  beaconEntry: { door: null as string | null, spent: false, starts: 0, introductions: 0 },
  /** The ending's one-way walk out of the front door (logic/exitTrack.ts). `tapped`: a tap walks the rest of the way. */
  exit: { active: false, tapped: false },
  /** Lights flicker from this time (intro, the bang upstairs). */
  flickerT0: -100,
  /** Shadow switches the lights off for a moment. */
  blackoutT0: -100,
  /** Sunrise started at this time (ending); negative = night. */
  sunriseT0: -1,
  /** Bathroom steam: level eases towards target; the fan clears it until fanUntil. */
  steam: { level: 0, target: 0, fanOnT0: -100, fanUntil: -100, silhouetteT0: -100 },
  notes: [] as Note[],
  /** The Guest Wing mystery in this playthrough: the 206 key, the clues read, the ending seen. */
  wing: { key: false, read: new Set<string>(), solved: false },
  timeScale: 1
};

export function rattle(objectId: string, dur = 0.8, amp = 1) {
  rt.rattles = rt.rattles.filter((r) => r.objectId !== objectId && rt.time - r.t0 < r.dur);
  rt.rattles.push({ objectId, t0: rt.time, dur, amp });
}

export function resetRuntime() {
  rt.ghost.anim = { mode: "hidden" };
  rt.boo.visible = false;
  rt.boo.talking = false;
  rt.boo.target = null;
  rt.boo.surprisedT0 = -10;
  rt.search = null;
  rt.gags = [];
  rt.helpObject = null;
  rt.helpSpot = null;
  rt.attention = null;
  rt.camera.mode = "follow";
  rt.camera.shot = null;
  rt.camera.shake = { t0: -10, amp: 0 };
  rt.player.frozen = true;
  rt.player.walkTo = null;
  rt.destination.visible = false;
  rt.player.stepTo = null;
  rt.player.startle = null;
  rt.player.floor = 0;
  rt.player.y = 0;
  rt.player.stairs = false;
  rt.view.floor = 0;
  rt.doorsOpen.clear();
  rt.doorSlam.clear();
  rt.beaconDoor = null;
  Object.assign(rt.beaconEntry, { door: null, spent: false, starts: 0, introductions: 0 });
  rt.exit.active = false;
  rt.exit.tapped = false;
  rt.flickerT0 = -100;
  rt.blackoutT0 = -100;
  rt.sunriseT0 = -1;
  rt.lanternBurstT0 = -100;
  rt.rattles = [];
  rt.notes = [];
  rt.steam = { level: 0, target: 0, fanOnT0: -100, fanUntil: -100, silhouetteT0: -100 };
  rt.wing = { key: false, read: new Set<string>(), solved: false };
}
