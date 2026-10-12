/**
 * Furniture kinds: size plus the geometry that makes each preposition true.
 *
 * Local frame: origin at the floor centre of the object, +x to its right,
 * +y up, +z towards its front (the side a player normally stands on).
 * The 3D builders and the hiding-spot generator both read these numbers,
 * so a ghost "under the bed" is placed from the same clearance the bed is
 * modelled with.
 */

/** Ghost body: origin at the bottom of the hem. */
export const GHOST_H = 0.8;
export const GHOST_R = 0.32;

export interface Area {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

export interface OnSpec {
  /** Height of the surface the ghost sits on. */
  y: number;
  /** Where the ghost sits (local x/z). */
  at: { x: number; z: number };
  /** Free part of the surface (no props) - the ghost must fit inside it. */
  area: Area;
  scale: number;
}

export interface UnderSpec {
  /** Free height below the object. */
  clearance: number;
  /** Free floor area below the object (local). */
  area: Area;
  /** Ghost squash so it fits: [x, y, z]. */
  scale: [number, number, number];
  /** Floor offset of the ghost (default 0.02). */
  y?: number;
}

export interface InSpec {
  /** Interior cavity (local). */
  box: { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number };
  scale: number;
  /** "rise": the ghost pops up until its head peeks over the rim. "stay": seen through an open door. */
  reveal: "rise" | "stay";
  /** Where the search marker sits (the lid or the door). */
  marker: { x: number; y: number; z: number };
}

export interface BySpec {
  y: number;
  /** Gap between the object's side and the ghost's body. */
  gap: number;
  /** Half width to the side edge (defaults to w/2). */
  edge?: number;
  /** Local z of the ghost (defaults to 0; wall-mounted objects push the ghost into the room). */
  z?: number;
  scale?: number;
}

export interface KindSpec {
  w: number;
  h: number;
  d: number;
  /** Blocks the player. */
  solid: boolean;
  /** Hangs on a wall; x/z place it on the wall face with +z pointing into the room. */
  wallMounted?: boolean;
  /** Lies on the floor (rugs); ignored when deciding which object is "nearest". */
  flat?: boolean;
  on?: OnSpec;
  under?: UnderSpec;
  in?: InSpec;
  by?: BySpec;
}

const BY_FLOOR: BySpec = { y: 0.1, gap: 0.12 };

export const KINDS = {
  // ---- searchable kinds -------------------------------------------------
  bed: {
    w: 1.6,
    h: 1.15,
    d: 2.2,
    solid: true,
    on: { y: 0.68, at: { x: 0, z: 0.3 }, area: { x0: -0.76, x1: 0.76, z0: -0.55, z1: 1.05 }, scale: 1 },
    under: { clearance: 0.38, area: { x0: -0.7, x1: 0.7, z0: -0.95, z1: 0.95 }, scale: [0.8, 0.43, 0.8] },
    by: BY_FLOOR
  },
  desk: {
    w: 1.3,
    h: 0.76,
    d: 0.72,
    solid: true,
    on: { y: 0.76, at: { x: 0.3, z: 0 }, area: { x0: 0, x1: 0.65, z0: -0.36, z1: 0.36 }, scale: 0.85 },
    under: { clearance: 0.64, area: { x0: -0.58, x1: 0.58, z0: -0.3, z1: 0.3 }, scale: [0.9, 0.72, 0.9] },
    by: BY_FLOOR
  },
  table: {
    w: 2.8,
    h: 0.8,
    d: 1.2,
    solid: true,
    on: { y: 0.8, at: { x: 0.5, z: 0 }, area: { x0: 0.1, x1: 1.3, z0: -0.5, z1: 0.5 }, scale: 1 },
    under: { clearance: 0.6, area: { x0: -1.2, x1: 1.2, z0: -0.45, z1: 0.45 }, scale: [1, 0.68, 1] },
    by: BY_FLOOR
  },
  worktable: {
    w: 1.4,
    h: 0.82,
    d: 0.75,
    solid: true,
    on: { y: 0.82, at: { x: 0.28, z: 0 }, area: { x0: -0.05, x1: 0.7, z0: -0.37, z1: 0.37 }, scale: 0.85 },
    under: { clearance: 0.72, area: { x0: -0.6, x1: 0.6, z0: -0.32, z1: 0.32 }, scale: [0.95, 0.75, 0.95] },
    by: BY_FLOOR
  },
  armchair: {
    w: 0.95,
    h: 1.05,
    d: 0.9,
    solid: true,
    on: { y: 0.48, at: { x: 0, z: 0.12 }, area: { x0: -0.32, x1: 0.32, z0: -0.22, z1: 0.42 }, scale: 0.85 },
    by: BY_FLOOR
  },
  box: {
    w: 0.9,
    h: 0.6,
    d: 0.62,
    solid: true,
    in: {
      box: { x0: -0.4, x1: 0.4, y0: 0.05, y1: 0.6, z0: -0.26, z1: 0.26 },
      scale: 0.78,
      reveal: "rise",
      marker: { x: 0, y: 0.34, z: 0.34 }
    },
    on: { y: 0.66, at: { x: 0, z: 0 }, area: { x0: -0.45, x1: 0.45, z0: -0.31, z1: 0.31 }, scale: 0.8 },
    by: BY_FLOOR
  },
  crate: {
    w: 1.0,
    h: 0.75,
    d: 0.8,
    solid: true,
    in: {
      box: { x0: -0.45, x1: 0.45, y0: 0.06, y1: 0.75, z0: -0.35, z1: 0.35 },
      scale: 0.95,
      reveal: "rise",
      marker: { x: 0, y: 0.42, z: 0.43 }
    },
    on: { y: 0.8, at: { x: 0, z: 0 }, area: { x0: -0.5, x1: 0.5, z0: -0.4, z1: 0.4 }, scale: 0.9 },
    by: BY_FLOOR
  },
  basket: {
    w: 0.9,
    h: 0.52,
    d: 0.62,
    solid: true,
    in: {
      box: { x0: -0.4, x1: 0.4, y0: 0.06, y1: 0.52, z0: -0.26, z1: 0.26 },
      scale: 0.78,
      reveal: "rise",
      marker: { x: 0, y: 0.3, z: 0.34 }
    },
    on: { y: 0.58, at: { x: 0, z: 0 }, area: { x0: -0.45, x1: 0.45, z0: -0.31, z1: 0.31 }, scale: 0.8 },
    by: BY_FLOOR
  },
  window: {
    w: 2.1,
    h: 2.6,
    d: 0.25,
    solid: false,
    wallMounted: true,
    under: { clearance: 0.82, area: { x0: -0.6, x1: 0.6, z0: 0.12, z1: 0.74 }, scale: [0.9, 0.9, 0.9], y: 0.04 },
    by: { y: 1.0, gap: 0.1, edge: 0.93, z: 0.42, scale: 0.9 }
  },
  piano: {
    w: 1.5,
    h: 1.0,
    d: 1.8,
    solid: true,
    on: { y: 1.0, at: { x: 0, z: -0.2 }, area: { x0: -0.6, x1: 0.6, z0: -0.8, z1: 0.4 }, scale: 0.95 },
    under: { clearance: 0.62, area: { x0: -0.6, x1: 0.6, z0: -0.75, z1: 0.45 }, scale: [1, 0.7, 1] },
    by: BY_FLOOR
  },
  shelf: {
    w: 1.8,
    h: 1.9,
    d: 0.55,
    solid: true,
    on: { y: 1.92, at: { x: 0.3, z: 0 }, area: { x0: -0.85, x1: 0.85, z0: -0.27, z1: 0.27 }, scale: 0.8 },
    by: BY_FLOOR
  },
  bookshelf: {
    w: 2.0,
    h: 2.2,
    d: 0.5,
    solid: true,
    on: { y: 2.22, at: { x: -0.4, z: 0 }, area: { x0: -0.95, x1: 0.95, z0: -0.25, z1: 0.25 }, scale: 0.75 },
    by: BY_FLOOR
  },
  clock: {
    w: 0.62,
    h: 2.1,
    d: 0.5,
    solid: true,
    in: {
      box: { x0: -0.24, x1: 0.24, y0: 0.2, y1: 1.35, z0: -0.2, z1: 0.21 },
      scale: 0.6,
      reveal: "stay",
      marker: { x: 0, y: 0.75, z: 0.29 }
    },
    by: BY_FLOOR
  },

  // ---- decor -------------------------------------------------------------
  nightstand: { w: 0.5, h: 0.55, d: 0.45, solid: true },
  wardrobe: { w: 1.2, h: 2.1, d: 0.6, solid: true },
  chair: { w: 0.5, h: 1.0, d: 0.5, solid: true },
  rug: { w: 3, h: 0.02, d: 2, solid: false, flat: true },
  floorlamp: { w: 0.4, h: 1.7, d: 0.4, solid: true },
  toys: { w: 0.6, h: 0.3, d: 0.5, solid: false },
  sofa: { w: 2.2, h: 0.9, d: 0.9, solid: true },
  coffeetable: { w: 1.1, h: 0.45, d: 0.6, solid: true },
  plant: { w: 0.6, h: 1.4, d: 0.6, solid: true },
  reception: { w: 2.6, h: 1.1, d: 0.8, solid: true },
  stairs: { w: 2.4, h: 2.8, d: 3.4, solid: true },
  cabinet: { w: 1.3, h: 1.9, d: 0.5, solid: true },
  sidetable: { w: 0.6, h: 0.7, d: 0.5, solid: true },
  barrel: { w: 0.7, h: 0.95, d: 0.7, solid: true },
  trunk: { w: 1.0, h: 0.6, d: 0.6, solid: true },
  cupboard: { w: 1.1, h: 1.8, d: 0.5, solid: true },
  globe: { w: 0.6, h: 1.1, d: 0.6, solid: true },
  bookpile: { w: 0.5, h: 0.5, d: 0.4, solid: false },
  broom: { w: 0.3, h: 1.4, d: 0.3, solid: false },
  ghostboard: { w: 2.4, h: 2.6, d: 0.12, solid: false, wallMounted: true },
  painting: { w: 0.9, h: 2.2, d: 0.08, solid: false, wallMounted: true }
} satisfies Record<string, KindSpec>;

export type KindId = keyof typeof KINDS;

export function kindSpec(kind: KindId): KindSpec {
  return KINDS[kind];
}
