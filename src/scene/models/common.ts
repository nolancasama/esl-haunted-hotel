import * as THREE from "three";
import type { KindId } from "../../game/world/kinds";
import type { WorldObject } from "../../game/world/world";
import { PartBuilder } from "../partBuilder";

/**
 * Low-poly furniture built from primitives, using the exact dimensions in
 * KINDS so the hiding-spot geometry (tested) matches what the student sees.
 * Local frame: origin on the floor at the object's centre, +z = its front.
 */

export type TexKey =
  | "quilt"
  | "rugBedroom"
  | "rugDining"
  | "rugLibrary"
  | "rugPlay"
  | "rugMusic"
  | "rugAttic"
  | "bathmat"
  | "runner"
  | "night"
  | "rain"
  | "clockface"
  | "paintingA"
  | "paintingB";

export interface AnimatedPart {
  /** fan: spins while switched on; lever: the fan switch's toggle. */
  name: "lid" | "door" | "curtainL" | "curtainR" | "blanket" | "fan" | "lever";
  pivot: [number, number, number];
  geometry?: THREE.BufferGeometry;
  textured?: { key: TexKey; geometry: THREE.BufferGeometry };
}

export interface BuiltObject {
  solid: THREE.BufferGeometry;
  /** Unlit glowing bits (lamp bulbs, candle flames). */
  glow: THREE.BufferGeometry | null;
  parts: AnimatedPart[];
  textured: Array<{ key: TexKey; geometry: THREE.BufferGeometry; position: [number, number, number]; rotation?: [number, number, number] }>;
  /** Lamp positions (local) for small glow sprites. */
  lamps: Array<[number, number, number]>;
}

export type Builder = (obj: WorldObject, b: PartBuilder, glow: PartBuilder, out: BuiltObject) => void;
export type BuilderSet = Partial<Record<KindId, Builder>>;

export const C = {
  wood: "#8a5a3c",
  woodDark: "#5b3826",
  woodLight: "#b5825a",
  woodRed: "#7c3f2c",
  linen: "#efe7d8",
  brass: "#d4ad55",
  shade: "#f6d79a",
  bulb: "#fff1b8",
  flame: "#ffcf6a",
  velvet: "#7b2f5c",
  velvetDark: "#5a2044",
  teal: "#2f9c94",
  sun: "#f2c94c",
  ink: "#2a2235",
  black: "#1f1b27",
  iron: "#4a4652"
};

export function plane(w: number, h: number): THREE.BufferGeometry {
  return new THREE.PlaneGeometry(w, h);
}

// Rugs/mats are at 6 mm. A single face 6 mm above them avoids a box's
// coincident underside/top and keeps UNDER spaces readable on either floor.
export const UNDER_SHADOW_Y = 0.012;
export function underShadow(b: PartBuilder, w: number, d: number, color = "#140c1f") {
  b.add(plane(w, d), color, [0, UNDER_SHADOW_Y, 0], [-Math.PI / 2, 0, 0], [1, 1, 1], { flatAo: true });
}

/** A candle: wax column plus a glowing flame. */
export function candle(b: PartBuilder, g: PartBuilder, x: number, y: number, z: number, h = 0.14) {
  b.cyl(0.022, 0.024, h, x, y, z, "#f7efe0", 8);
  g.add(new THREE.ConeGeometry(0.018, 0.06, 6), C.flame, [x, y + h + 0.03, z]);
}

/** A row of book spines on a shelf board. */
export function books(b: PartBuilder, x0: number, x1: number, y: number, z: number, depth: number, seed: number, maxH = 0.28) {
  const colors = ["#a83e3e", "#3e6ea8", "#d8a63c", "#4f8a4a", "#7a4aa0", "#c46a2c", "#2f6f6a", "#d9d2c0"];
  let s = seed;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  let x = x0;
  while (x < x1 - 0.04) {
    const w = 0.035 + rnd() * 0.04;
    if (x + w > x1) break;
    const h = maxH * (0.65 + rnd() * 0.35);
    // Upright books keep the whole base clear of the board. The old lean
    // pivoted around the centre, cutting into both the board and neighbours.
    const setback = rnd() * 0.025;
    b.add(new THREE.BoxGeometry(w, h, depth - setback), colors[Math.floor(rnd() * colors.length)], [x + w / 2, y + 0.004 + h / 2, z - setback / 2]);
    x += w + 0.004;
    if (rnd() < 0.07) x += 0.06;
  }
}
