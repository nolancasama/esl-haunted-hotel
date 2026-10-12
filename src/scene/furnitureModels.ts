import * as THREE from "three";
import { KINDS, type KindId } from "../game/world/kinds";
import type { WorldObject } from "../game/world/world";
import { PartBuilder } from "./partBuilder";

/**
 * Low-poly furniture built from primitives, using the exact dimensions in
 * KINDS so the hiding-spot geometry (tested) matches what the student sees.
 */

export type TexKey = "quilt" | "rugBedroom" | "night" | "rain" | "clockface";

export interface AnimatedPart {
  name: "lid" | "door" | "curtainL" | "curtainR" | "blanket";
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

const C = {
  wood: "#8a5a3c",
  woodDark: "#5b3826",
  woodLight: "#b5825a",
  woodRed: "#7c3f2c",
  linen: "#efe7d8",
  brass: "#d4ad55",
  shade: "#f6d79a",
  bulb: "#fff1b8",
  velvet: "#7b2f5c",
  velvetDark: "#5a2044",
  teal: "#2f9c94",
  sun: "#f2c94c",
  ink: "#2a2235"
};

function plane(w: number, h: number): THREE.BufferGeometry {
  return new THREE.PlaneGeometry(w, h);
}

type Builder = (obj: WorldObject, b: PartBuilder, glow: PartBuilder, out: BuiltObject) => void;

const builders: Partial<Record<KindId, Builder>> = {
  bed(_obj, b, _g, out) {
    const k = KINDS.bed;
    const clear = k.under.clearance; // 0.38: rail bottom
    // Dark floor patch so "under the bed" reads as a space.
    b.box(1.5, 0.004, 2.0, 0, 0.002, 0, "#140c1f");
    // rails and slats
    b.box(1.6, 0.12, 2.1, 0, clear, 0, C.wood);
    b.box(1.52, 0.16, 2.04, 0, clear + 0.12, 0, C.linen); // mattress, top 0.66
    // posts with finials
    for (const [x, z, h] of [
      [-0.82, -1.06, 1.25],
      [0.82, -1.06, 1.25],
      [-0.82, 1.06, 0.95],
      [0.82, 1.06, 0.95]
    ] as const) {
      b.box(0.1, h, 0.1, x, 0, z, C.woodDark);
      b.sphere(0.075, x, h + 0.05, z, C.brass);
    }
    // headboard panel and footboard (footboard starts at the rail so "under" stays visible)
    b.box(1.56, 0.72, 0.07, 0, 0.42, -1.06, C.wood);
    b.box(1.3, 0.12, 0.08, 0, 1.0, -1.06, C.woodLight);
    b.box(1.56, 0.34, 0.06, 0, 0.5, 1.06, C.wood);
    // pillow
    b.sphere(0.34, 0, 0.7, -0.72, "#fbf6ec", [1, 0.26, 0.55]);
    // teddy bear on the pillow side, away from the "on" spot
    b.sphere(0.12, -0.5, 0.78, -0.62, "#a8784f", [1, 1.05, 0.9]);
    b.sphere(0.09, -0.5, 0.95, -0.64, "#b8885d");
    b.sphere(0.035, -0.57, 1.03, -0.64, "#8a5e3c");
    b.sphere(0.035, -0.43, 1.03, -0.64, "#8a5e3c");
    b.sphere(0.022, -0.5, 0.94, -0.56, C.ink);
    // quilt (lifts when searched)
    out.parts.push({
      name: "blanket",
      pivot: [0, 0.66, -0.39],
      textured: { key: "quilt", geometry: new THREE.BoxGeometry(1.58, 0.05, 1.42).translate(0, 0.0, 0.71) }
    });
  },

  desk(_obj, b, g, out) {
    const top = KINDS.desk.h; // 0.76
    b.box(1.3, 0.05, 0.72, 0, top - 0.05, 0, C.woodLight);
    for (const [x, z] of [
      [-0.6, -0.31],
      [0.6, -0.31],
      [-0.6, 0.31],
      [0.6, 0.31]
    ] as const) {
      b.box(0.06, top - 0.05, 0.06, x, 0, z, C.wood);
    }
    // apron: bottom at 0.65 (clearance 0.64)
    b.box(1.18, 0.06, 0.03, 0, 0.65, 0.33, C.wood);
    b.box(1.18, 0.06, 0.03, 0, 0.65, -0.33, C.wood);
    b.box(0.03, 0.06, 0.6, 0.6, 0.65, 0, C.wood);
    b.box(0.03, 0.06, 0.6, -0.6, 0.65, 0, C.wood);
    // books and a pencil cup on the left half (the right half is the "on" spot)
    b.box(0.26, 0.05, 0.18, -0.42, top, -0.1, "#c4504a");
    b.box(0.24, 0.05, 0.17, -0.42, top + 0.05, -0.1, "#4a78c4");
    b.box(0.22, 0.05, 0.16, -0.41, top + 0.1, -0.1, "#e2b04a");
    b.cyl(0.04, 0.035, 0.1, -0.15, top, -0.22, "#6b4fa0");
    b.box(0.01, 0.08, 0.01, -0.16, top + 0.08, -0.22, "#e0c060");
    b.box(0.01, 0.08, 0.01, -0.13, top + 0.08, -0.21, "#d05050");
    // desk lamp
    b.cyl(0.08, 0.09, 0.03, -0.45, top, 0.18, C.brass);
    b.boxAt(0.025, 0.36, 0.025, [-0.45, top + 0.2, 0.18], [0, 0, 0.25], C.brass);
    b.cone(0.13, 0.16, -0.5, top + 0.28, 0.18, "#3f7a5e", 14, true);
    g.sphere(0.05, -0.5, top + 0.31, 0.18, C.bulb);
    out.lamps.push([-0.5, top + 0.3, 0.18]);
  },

  box(obj, b, _g, out) {
    const k = KINDS.box;
    const toy = obj.variant === "toy";
    const body = toy ? C.teal : C.wood;
    const trim = toy ? C.sun : C.woodDark;
    const { w, d } = k;
    const h = 0.6;
    b.box(w, 0.05, d, 0, 0, 0, body);
    b.box(w, h - 0.05, 0.05, 0, 0.05, d / 2 - 0.025, body);
    b.box(w, h - 0.05, 0.05, 0, 0.05, -d / 2 + 0.025, body);
    b.box(0.05, h - 0.05, d - 0.1, w / 2 - 0.025, 0.05, 0, body);
    b.box(0.05, h - 0.05, d - 0.1, -w / 2 + 0.025, 0.05, 0, body);
    // trim bands and corner posts
    b.box(w + 0.02, 0.05, d + 0.02, 0, 0.0, 0, trim);
    b.box(w + 0.02, 0.04, d + 0.02, 0, h - 0.06, 0, trim);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.06, h, 0.06, (sx * w) / 2, 0, (sz * d) / 2, trim);
    // dark inside
    b.box(w - 0.1, 0.01, d - 0.1, 0, 0.05, 0, "#1d1426");
    if (toy) {
      // stars on the front
      for (const [x, y, c] of [
        [-0.22, 0.32, "#ffe27a"],
        [0.05, 0.22, "#ff9fc4"],
        [0.25, 0.38, "#a8e6ff"]
      ] as const) {
        b.add(new THREE.CircleGeometry(0.075, 5), c, [x, y, d / 2 + 0.002], [0, 0, Math.PI / 2], [1, 1, 1], { flatAo: true });
      }
    }
    const lid = new PartBuilder();
    lid.box(w + 0.04, 0.06, d + 0.04, 0, 0, (d + 0.04) / 2, toy ? C.sun : C.woodLight);
    lid.box(0.16, 0.03, 0.05, 0, -0.01, d + 0.04, C.brass);
    out.parts.push({ name: "lid", pivot: [0, h, -d / 2 - 0.02], geometry: lid.build() });
  },

  window(_obj, b, _g, out) {
    const frame = "#e9dcc4";
    // frame (wall face is z = 0)
    b.box(1.5, 0.1, 0.1, 0, 0.85, 0.05, frame);
    b.box(1.5, 0.1, 0.1, 0, 2.3, 0.05, frame);
    b.box(0.1, 1.55, 0.1, -0.7, 0.85, 0.05, frame);
    b.box(0.1, 1.55, 0.1, 0.7, 0.85, 0.05, frame);
    b.box(0.05, 1.35, 0.06, 0, 0.95, 0.04, frame);
    b.box(1.3, 0.05, 0.06, 0, 1.6, 0.04, frame);
    // sill
    b.box(1.7, 0.06, 0.22, 0, 0.8, 0.11, "#d8c8a8");
    // curtain rod
    b.cylAt(0.025, 2.0, [0, 2.55, 0.12], [0, 0, Math.PI / 2], C.brass);
    b.sphere(0.05, -1.0, 2.55, 0.12, C.brass);
    b.sphere(0.05, 1.0, 2.55, 0.12, C.brass);
    out.textured.push({ key: "night", geometry: plane(1.3, 1.35), position: [0, 1.625, 0.015] });
    out.textured.push({ key: "rain", geometry: plane(1.3, 1.35), position: [0, 1.625, 0.025] });
    // tied-back curtains: outer edge at +-0.93 (KINDS.window.by.edge)
    for (const side of [-1, 1] as const) {
      const c = new PartBuilder();
      c.box(0.2, 1.75, 0.07, 0, -1.75, 0, C.velvet);
      c.box(0.21, 0.08, 0.09, 0, -1.05, 0, C.brass); // tie
      c.box(0.04, 1.75, 0.075, side * 0.05, -1.75, 0, C.velvetDark);
      out.parts.push({ name: side < 0 ? "curtainL" : "curtainR", pivot: [side * 0.83, 2.55, 0.12], geometry: c.build() });
    }
  },

  nightstand(_obj, b, g, out) {
    b.box(0.5, 0.5, 0.45, 0, 0.05, 0, C.wood);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.05, 0.05, 0.05, sx * 0.2, 0, sz * 0.17, C.woodDark);
    b.box(0.42, 0.16, 0.02, 0, 0.32, 0.23, C.woodLight);
    b.sphere(0.025, 0, 0.4, 0.25, C.brass);
    // lamp
    b.cyl(0.08, 0.1, 0.04, 0, 0.55, 0, C.brass);
    b.cyl(0.02, 0.02, 0.28, 0, 0.59, 0, C.brass);
    b.cone(0.16, 0.2, 0, 0.82, 0, C.shade, 16, true);
    g.sphere(0.06, 0, 0.88, 0, C.bulb);
    out.lamps.push([0, 0.9, 0]);
  },

  wardrobe(_obj, b) {
    const { w, h, d } = KINDS.wardrobe;
    b.box(w, h - 0.1, d, 0, 0.1, 0, C.woodRed);
    b.box(w + 0.08, 0.1, d + 0.06, 0, h - 0.02, 0, C.woodDark);
    for (const sx of [-1, 1]) b.box(0.08, 0.1, 0.08, sx * (w / 2 - 0.08), 0, d / 2 - 0.08, C.woodDark);
    for (const sx of [-1, 1]) b.box(0.08, 0.1, 0.08, sx * (w / 2 - 0.08), 0, -d / 2 + 0.08, C.woodDark);
    b.box(0.02, h - 0.3, 0.02, 0, 0.2, d / 2 + 0.005, C.woodDark);
    for (const sx of [-1, 1]) {
      b.box(w / 2 - 0.16, h - 0.5, 0.02, sx * (w / 4), 0.3, d / 2 + 0.005, "#8e4a36");
      b.sphere(0.03, sx * 0.07, 1.05, d / 2 + 0.03, C.brass);
    }
  },

  chair(_obj, b) {
    b.box(0.46, 0.05, 0.46, 0, 0.42, 0, C.woodLight);
    for (const [x, z] of [
      [-0.2, -0.2],
      [0.2, -0.2],
      [-0.2, 0.2],
      [0.2, 0.2]
    ] as const) {
      b.box(0.045, 0.42, 0.045, x, 0, z, C.wood);
    }
    b.box(0.045, 0.55, 0.045, -0.2, 0.47, -0.2, C.wood);
    b.box(0.045, 0.55, 0.045, 0.2, 0.47, -0.2, C.wood);
    b.box(0.44, 0.08, 0.04, 0, 0.92, -0.2, C.wood);
    b.box(0.3, 0.04, 0.03, 0, 0.72, -0.2, C.woodLight);
  },

  toys(_obj, b) {
    b.sphere(0.13, -0.15, 0.13, 0.05, "#e85a5a");
    b.sphere(0.131, -0.15, 0.13, 0.05, "#ffffff", [1, 0.25, 1]);
    b.box(0.14, 0.14, 0.14, 0.16, 0, -0.08, "#4aa3e8");
    b.box(0.14, 0.14, 0.14, 0.2, 0, 0.1, "#f2c94c", 0.4);
    b.box(0.12, 0.12, 0.12, 0.18, 0.14, 0.0, "#6fcf73", 0.2);
  },

  rug(_obj, _b, _g, out) {
    const { w, d } = KINDS.rug;
    out.textured.push({ key: "rugBedroom", geometry: plane(w, d), position: [0, 0.006, 0], rotation: [-Math.PI / 2, 0, 0] });
  }
};

export function buildObject(obj: WorldObject): BuiltObject {
  const b = new PartBuilder();
  const g = new PartBuilder();
  const out: BuiltObject = { solid: new THREE.BufferGeometry(), glow: null, parts: [], textured: [], lamps: [] };
  const build = builders[obj.kind];
  if (build) build(obj, b, g, out);
  else {
    const s = obj.spec;
    b.box(s.w, s.h, s.d, 0, 0, 0, "#6b5a7a");
  }
  out.solid = b.build();
  out.glow = g.empty ? null : g.build();
  return out;
}
