import type { GhostId, Vec3 } from "./types";

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
  /** Correct answer: surprised, then sucked into the lantern. */
  | { mode: "capture"; spotId: string; t0: number }
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
}

export const rt = {
  time: 0,
  player: {
    x: -3.6,
    z: -5.4,
    yaw: Math.PI,
    vx: 0,
    vz: 0,
    speed: 0,
    step: 0,
    frozen: true,
    /** Tap-to-walk: head for this point, then search `objectId` on arrival. */
    walkTo: null as null | { x: number; z: number; objectId: string | null; t0: number },
    /** Scripted step (any phase): move here, then face `face`. Used to step aside in close-ups. */
    stepTo: null as null | { x: number; z: number; face: { x: number; z: number } }
  },
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
    /** Set by the camera each frame: real camera position (for wall fading). */
    pos: { x: 0, y: 6, z: 6 } as Vec3,
    target: { x: 0, y: 1, z: 0 } as Vec3
  },
  ghost: { anim: { mode: "hidden" } as GhostAnim, id: "sleepy" as GhostId },
  boo: { visible: false, talking: false, appearT0: -10, target: null as Vec3 | null },
  search: null as SearchAnim,
  gags: [] as Gag[],
  /** World position of the lantern (capture target). */
  lantern: { x: 0, y: 0.6, z: 0 } as Vec3,
  /** Lightning flash start time. */
  flashT0: -100,
  /** Object glow help (search ladder level 3) and spot glow (level 4). */
  helpObject: null as string | null,
  helpSpot: null as string | null,
  /** Sneaky's harmless distraction: an object that rattles. */
  rattle: { objectId: null as string | null, t0: -10 },
  /** Doors that are open (id -> time opened). */
  doorsOpen: new Map<string, number>(),
  timeScale: 1
};

export function resetRuntime() {
  rt.ghost.anim = { mode: "hidden" };
  rt.boo.visible = false;
  rt.boo.talking = false;
  rt.boo.target = null;
  rt.search = null;
  rt.gags = [];
  rt.helpObject = null;
  rt.helpSpot = null;
  rt.camera.mode = "follow";
  rt.camera.shot = null;
  rt.player.frozen = true;
  rt.doorsOpen.clear();
}
