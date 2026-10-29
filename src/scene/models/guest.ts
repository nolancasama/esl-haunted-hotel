import * as THREE from "three";
import { KINDS } from "../../game/world/kinds";
import { PartBuilder } from "../partBuilder";
import type { GuestArt } from "../textures";
import { C, plane, underShadow, type BuilderSet } from "./common";

/**
 * The Forgotten Guest Wing's own pieces. Big shared furniture (beds, desks, wardrobes, suitcases
 * as box variants) is built by the shared builders; these are the wing's extras, kept low-poly.
 */

const QUILTS: Record<string, [string, string]> = {
  red: ["#c4504a", "#f2c94c"],
  blue: ["#3a6ad0", "#e6eef8"]
};

/** Picture sizes on the wall (model origin = the wall face, +z into the room). */
const ART_SIZE: Partial<Record<GuestArt, [number, number, number]>> = {
  note: [0.3, 0.38, 1.45],
  keys: [0.34, 0.42, 1.4],
  mirror: [0.5, 0.8, 1.35],
  faded: [0.48, 0.6, 1.55],
  photo206: [0.36, 0.45, 1.5],
  family: [0.36, 0.45, 1.5]
};

export const guestModels: BuilderSet = {
  /** A child's bed: rail at the "under" clearance, mattress top at the "on" height. */
  smallbed(obj, b, _g, out) {
    const k = KINDS.smallbed;
    const [quilt, trim] = QUILTS[obj.variant ?? "red"] ?? QUILTS.red;
    const clear = k.under.clearance;
    underShadow(b, k.w - 0.1, k.d - 0.1);
    b.box(k.w, 0.1, k.d - 0.1, 0, clear, 0, C.wood);
    b.box(k.w - 0.06, 0.12, k.d - 0.14, 0, clear + 0.1, 0, C.linen); // top at 0.6
    for (const [x, z, h] of [
      [-0.47, -0.92, 1.0],
      [0.47, -0.92, 1.0],
      [-0.47, 0.92, 0.75],
      [0.47, 0.92, 0.75]
    ] as const) {
      b.box(0.08, h, 0.08, x, 0, z, C.woodLight);
      b.sphere(0.055, x, h + 0.04, z, trim);
    }
    b.box(k.w - 0.04, 0.5, 0.06, 0, 0.42, -0.92, C.woodLight);
    b.box(k.w - 0.04, 0.26, 0.05, 0, 0.44, 0.92, C.woodLight);
    b.sphere(0.24, 0, 0.64, -0.62, "#fbf6ec", [1, 0.28, 0.55]);
    const q = new PartBuilder();
    q.box(k.w - 0.02, 0.05, 1.18, 0, 0, 0.59, quilt);
    q.box(k.w - 0.02, 0.052, 0.12, 0, 0, 0.12, trim);
    out.parts.push({ name: "blanket", pivot: [0, 0.6, -0.32], geometry: q.build() });
  },

  /** A brass wall lamp with a warm shade. */
  walllamp(_obj, b, _g, out) {
    // The warm glow is the shared lamp sprite alone (no separate bulb mesh: one draw call fewer per lamp).
    b.box(0.12, 0.2, 0.03, 0, 1.78, 0.015, C.brass);
    b.boxAt(0.025, 0.025, 0.16, [0, 1.86, 0.09], [0, 0, 0], C.brass);
    b.cone(0.1, 0.14, 0, 1.9, 0.17, C.shade, 12, true);
    out.lamps.push([0, 1.95, 0.17]);
  },

  /** A framed picture, photo, note, mirror or key board (the variant names the art). */
  frame(obj, b, _g, out) {
    const art = (obj.variant ?? "landscape") as GuestArt;
    const [w, h, y] = ART_SIZE[art] ?? [0.46, 0.58, 1.5];
    if (art !== "note") {
      const wood = art === "faded" ? "#6a5e54" : art === "keys" ? "#4a3020" : C.brass;
      b.box(w + 0.08, 0.05, 0.04, 0, y - h / 2 - 0.04, 0.02, wood);
      b.box(w + 0.08, 0.05, 0.04, 0, y + h / 2 - 0.01, 0.02, wood);
      b.box(0.05, h + 0.02, 0.04, -w / 2 - 0.015, y - h / 2 - 0.01, 0.02, wood);
      b.box(0.05, h + 0.02, 0.04, w / 2 + 0.015, y - h / 2 - 0.01, 0.02, wood);
    }
    out.textured.push({ key: `art:${art}`, geometry: plane(w, h), position: [0, y, 0.025] });
  },

  /** The guest register: an open book on a lectern, with a candle. */
  register(_obj, b, g, out) {
    const wood = "#4a2c1c";
    b.box(0.5, 0.06, 0.4, 0, 0, 0, wood);
    b.box(0.14, 0.82, 0.14, 0, 0.06, 0, wood);
    b.boxAt(0.7, 0.05, 0.48, [0, 0.98, 0], [0.32, 0, 0], wood);
    b.boxAt(0.66, 0.012, 0.44, [0, 1.006, 0.006], [0.32, 0, 0], "#3a1e14");
    for (const x of [-0.16, 0.16]) b.boxAt(0.3, 0.02, 0.38, [x, 1.02, 0.01], [0.32, 0, x > 0 ? -0.04 : 0.04], "#f2ead2");
    b.boxAt(0.012, 0.025, 0.38, [0, 1.03, 0.01], [0.32, 0, 0], "#8a3a2a");
    for (let i = 0; i < 5; i++) {
      for (const x of [-0.16, 0.16]) b.boxAt(0.22, 0.004, 0.012, [x, 1.034 - i * 0.022, -0.1 + i * 0.065], [0.32, 0, 0], "#6a5a4a");
    }
    b.cyl(0.04, 0.045, 0.02, 0.28, 1.08, -0.12, C.brass, 8);
    b.cyl(0.016, 0.018, 0.1, 0.28, 1.1, -0.12, "#f7efe0", 8);
    g.add(new THREE.ConeGeometry(0.014, 0.045, 6), C.flame, [0.28, 1.225, -0.12]);
    out.lamps.push([0.28, 1.23, -0.12]);
  },

  /** A coat stand with a long coat and a hat: the traveller left them behind. */
  coatrack(_obj, b) {
    const wood = "#4a2c1c";
    b.cyl(0.2, 0.22, 0.04, 0, 0, 0, wood, 10);
    b.cyl(0.03, 0.035, 1.72, 0, 0.04, 0, wood, 8);
    b.sphere(0.05, 0, 1.78, 0, C.brass);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      b.boxAt(0.02, 0.02, 0.16, [Math.sin(a) * 0.08, 1.62, Math.cos(a) * 0.08], [0.6, a, 0], C.brass);
    }
    // the coat, hanging on the front hook
    b.box(0.34, 0.9, 0.12, 0, 0.62, 0.11, "#3f5a4a");
    b.box(0.36, 0.08, 0.13, 0, 1.46, 0.1, "#2f4a3a");
    for (const x of [-0.19, 0.19]) b.box(0.08, 0.7, 0.1, x, 0.75, 0.1, "#3a5244");
    // the hat, on the top
    b.cyl(0.17, 0.17, 0.02, 0, 1.68, 0, "#2a2433", 14);
    b.cyl(0.1, 0.11, 0.14, 0, 1.69, 0, "#2a2433", 12);
    b.cyl(0.111, 0.111, 0.03, 0, 1.71, 0, "#8a3a2a", 12);
  },

  /** An open suitcase, clothes spilling out: left in a hurry (a clue in Room 202). */
  opencase(_obj, b) {
    const leather = "#7a4a2c";
    const w = 0.84;
    const d = 0.5;
    b.box(w, 0.04, d, 0, 0, -0.1, leather);
    b.box(w, 0.2, 0.03, 0, 0.04, -0.1 + d / 2, leather);
    b.box(w, 0.2, 0.03, 0, 0.04, -0.1 - d / 2, leather);
    for (const sx of [-1, 1]) b.box(0.03, 0.2, d, sx * (w / 2), 0.04, -0.1, leather);
    // the lid, swung back against the wall side
    b.boxAt(w, d, 0.04, [0, 0.47, -0.1 - d / 2 - 0.08], [-0.2, 0, 0], "#6a3c22");
    b.boxAt(w - 0.1, d - 0.1, 0.01, [0, 0.47, -0.1 - d / 2 - 0.05], [-0.2, 0, 0], "#c8a878");
    // clothes: a striped shirt, a red scarf trailing out, socks
    b.box(0.5, 0.06, 0.36, -0.1, 0.12, -0.1, "#e8e2d4");
    for (let i = 0; i < 4; i++) b.box(0.5, 0.062, 0.03, -0.1, 0.12, -0.24 + i * 0.09, "#4a78c4");
    b.boxAt(0.12, 0.03, 0.5, [0.22, 0.16, 0.06], [0, 0.4, 0], "#c4403a");
    b.boxAt(0.12, 0.02, 0.22, [0.33, 0.01, 0.24], [0, 0.9, 0], "#c4403a");
    b.box(0.14, 0.05, 0.08, -0.32, 0.0, 0.26, "#d8b04a");
  },

  /** A small potted plant: a fern, or flowers. */
  pot(obj, b) {
    b.cyl(0.16, 0.12, 0.3, 0, 0, 0, "#b4654a", 10);
    b.cyl(0.18, 0.18, 0.04, 0, 0.28, 0, "#9a5038", 10);
    b.cyl(0.15, 0.15, 0.02, 0, 0.3, 0, "#3a2a1a", 10);
    if (obj.variant === "flowers") {
      b.sphere(0.17, 0, 0.5, 0, "#3f8a4a", [1, 0.8, 1], 8);
      for (let i = 0; i < 7; i++) {
        const a = i * 2.2;
        b.sphere(0.05, Math.cos(a) * 0.12, 0.58 + (i % 3) * 0.04, Math.sin(a) * 0.12, i % 2 ? "#e86a8a" : "#f2c94c");
      }
    } else {
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        b.add(new THREE.ConeGeometry(0.06, 0.55, 5), i % 2 ? "#3f8a4a" : "#4f9e58", [Math.cos(a) * 0.12, 0.55, Math.sin(a) * 0.12], [Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6], [1, 1, 0.35]);
      }
    }
  }
};
