import * as THREE from "three";
import { KINDS } from "../../game/world/kinds";
import { WALL_H } from "../../game/world/rooms";
import { C, candle, plane, type BuilderSet } from "./common";

export const lobbyModels: BuilderSet = {
  reception(_obj, b, g, out) {
    const { w, h, d } = KINDS.reception;
    b.box(w, h - 0.06, d - 0.1, 0, 0, 0.05, C.woodRed);
    b.box(w + 0.1, 0.06, d + 0.04, 0, h - 0.06, 0.02, C.woodDark);
    for (let i = 0; i < 4; i++) {
      b.box(0.5, 0.7, 0.02, -0.93 + i * 0.62, 0.18, d / 2 + 0.005, "#8e4a36");
    }
    b.box(w, 0.08, 0.04, 0, 0, d / 2, C.woodDark);
    // bell, guest book, lamp
    b.cyl(0.07, 0.08, 0.015, 0.6, h, 0.1, C.brass, 12);
    b.add(new THREE.SphereGeometry(0.06, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), C.brass, [0.6, h + 0.015, 0.1]);
    b.box(0.4, 0.04, 0.28, -0.2, h, 0.05, "#7a2a2a", 0.15);
    b.box(0.36, 0.01, 0.26, -0.2, h + 0.04, 0.05, "#f2ead6", 0.15);
    b.cyl(0.07, 0.08, 0.03, -0.95, h, -0.1, C.brass, 10);
    b.cyl(0.015, 0.015, 0.3, -0.95, h + 0.03, -0.1, C.brass, 6);
    b.cone(0.14, 0.17, -0.95, h + 0.27, -0.1, "#c8584a", 14, true);
    g.sphere(0.05, -0.95, h + 0.3, -0.1, C.bulb);
    out.lamps.push([-0.95, h + 0.3, -0.1]);
  },

  /** Frame only; the face (with the four ghost slots) is drawn live by GhostBoard. */
  ghostboard(_obj, b) {
    const W = 2.2;
    const y0 = 1.3;
    const H = 1.2;
    b.box(W + 0.16, 0.1, 0.1, 0, y0 - 0.1, 0.05, C.woodDark);
    b.box(W + 0.16, 0.1, 0.1, 0, y0 + H, 0.05, C.woodDark);
    b.box(0.1, H + 0.1, 0.1, -W / 2 - 0.03, y0 - 0.05, 0.05, C.woodDark);
    b.box(0.1, H + 0.1, 0.1, W / 2 + 0.03, y0 - 0.05, 0.05, C.woodDark);
    b.sphere(0.06, 0, y0 + H + 0.12, 0.06, C.brass);
  },

  sofa(_obj, b) {
    const plum = "#6a3a78";
    const dark = "#4a2456";
    b.box(2.1, 0.3, 0.8, 0, 0.1, 0.05, dark);
    for (const x of [-0.66, 0, 0.66]) b.box(0.64, 0.12, 0.66, x, 0.4, 0.1, plum);
    b.box(2.1, 0.55, 0.2, 0, 0.35, -0.32, plum);
    for (const x of [-0.66, 0, 0.66]) b.sphere(0.24, x, 0.72, -0.24, plum, [1.25, 0.8, 0.5], 10);
    for (const sx of [-1, 1]) {
      b.box(0.18, 0.32, 0.86, sx * 1.02, 0.28, 0.03, plum);
      b.add(new THREE.CylinderGeometry(0.1, 0.1, 0.86, 10), plum, [sx * 1.02, 0.6, 0.03], [Math.PI / 2, 0, 0]);
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cyl(0.04, 0.03, 0.1, sx * 0.95, 0, sz * 0.32, C.brass, 8);
    b.sphere(0.16, -0.75, 0.6, 0.1, "#e0b45a", [1, 0.9, 0.45], 10);
  },

  coffeetable(_obj, b, g) {
    const { w, h, d } = KINDS.coffeetable;
    b.box(w, 0.05, d, 0, h - 0.05, 0, C.woodDark);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cyl(0.03, 0.025, h - 0.05, sx * (w / 2 - 0.08), 0, sz * (d / 2 - 0.08), C.woodRed, 8);
    b.cyl(0.06, 0.05, 0.06, 0.25, h, 0.05, "#f2f2f2", 10);
    b.cyl(0.09, 0.09, 0.01, 0.25, h, 0.05, "#f2f2f2", 12);
    candle(b, g, -0.25, h, 0, 0.12);
  },

  /**
   * Front (+z) is the bottom step; the steps rise towards local -z and reach
   * the upstairs floor (WALL_H) at the back edge. Beyond the back edge, under
   * the landing's top, is a panelled closet. Seen from both floors.
   */
  stairs(_obj, b) {
    const { w, d } = KINDS.stairs;
    const H = WALL_H;
    const n = 10;
    const run = d / n;
    const rise = H / n;
    const stepW = w - 0.2;
    for (let i = 0; i < n; i++) {
      const z = d / 2 - run * (i + 0.5);
      b.box(stepW, rise * (i + 1), run, 0, 0, z, i % 2 ? "#5a3426" : "#623a2a");
      b.box(stepW + 0.02, 0.025, run + 0.01, 0, rise * (i + 1) - 0.01, z + 0.005, C.woodDark);
      // carpet runner up the middle
      b.box(1.3, 0.012, run, 0, rise * (i + 1) + 0.012, z, i % 2 ? "#8a2a3a" : "#922e3e");
      b.box(1.3, rise, 0.012, 0, rise * i, z + run / 2 + 0.006, "#7a2433");
      b.box(1.34, 0.02, 0.02, 0, rise * (i + 1), z + run / 2 - 0.01, C.brass);
    }
    // sloped stringers, balusters, handrails; newel posts at the bottom and the top
    const slope = Math.atan2(H, d);
    const len = Math.hypot(d, H);
    for (const sx of [-1, 1]) {
      const x = sx * (w / 2 - 0.06);
      b.boxAt(0.12, 0.34, len, [x, H / 2 + 0.05, 0], [slope, 0, 0], C.woodDark);
      for (let i = 0; i < n; i++) {
        const z = d / 2 - run * (i + 0.5);
        b.cyl(0.022, 0.026, 0.86, x, rise * (i + 1), z, C.woodLight, 6);
      }
      b.boxAt(0.09, 0.07, len, [x, H / 2 + 0.92, 0], [slope, 0, 0], C.woodDark);
      b.box(0.15, 1.12, 0.15, x, 0, d / 2 - 0.08, C.woodDark);
      b.sphere(0.09, x, 1.18, d / 2 - 0.08, C.brass);
      b.box(0.15, 1.08, 0.15, x, H, -d / 2 + 0.08, C.woodDark);
      b.sphere(0.09, x, H + 1.13, -d / 2 + 0.08, C.brass);
    }
    // the closet under the top of the stairs (local z -1.4 .. -2.9 = world x 6.4 .. 7.9)
    const cz0 = -d / 2;
    const cd = 1.5;
    const cw = w + 0.2;
    b.box(cw, H - 0.02, cd, 0, 0, cz0 - cd / 2, "#4c2a36");
    for (const sx of [-1, 1]) {
      b.box(0.02, 0.9, cd - 0.3, sx * (cw / 2 + 0.005), 0.25, cz0 - cd / 2, "#5e3442");
      b.box(0.02, 0.9, cd - 0.3, sx * (cw / 2 + 0.005), 1.35, cz0 - cd / 2, "#5e3442");
      b.box(0.03, 0.12, cd, sx * (cw / 2 + 0.01), 0, cz0 - cd / 2, "#2a1620");
    }
    // a little door on the south side of the closet
    b.box(0.02, 1.7, 0.7, cw / 2 + 0.02, 0.04, cz0 - cd / 2, "#6b3d2a");
    b.sphere(0.035, cw / 2 + 0.05, 0.95, cz0 - cd / 2 + 0.25, C.brass);
  },

  plant(_obj, b) {
    b.cyl(0.24, 0.18, 0.42, 0, 0, 0, "#b4654a", 12);
    // rim, and the soil sitting 6 mm proud of it (a soil top flush with the rim's top flickered)
    b.cyl(0.26, 0.26, 0.044, 0, 0.4, 0, "#9a5038", 12);
    b.cyl(0.22, 0.22, 0.02, 0, 0.43, 0, "#3a2a1a", 12);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const tilt = 0.5 + (i % 3) * 0.15;
      b.add(new THREE.ConeGeometry(0.09, 0.85, 5), i % 2 ? "#3f8a4a" : "#4f9e58", [Math.cos(a) * 0.2, 0.82, Math.sin(a) * 0.2], [Math.sin(a) * tilt, 0, -Math.cos(a) * tilt], [1, 1, 0.35]);
    }
  },

  painting(obj, b, _g, out) {
    const W = 0.8;
    const H = 1.0;
    const y0 = 1.25;
    b.box(W + 0.14, 0.08, 0.06, 0, y0 - 0.07, 0.03, "#c9a24a");
    b.box(W + 0.14, 0.08, 0.06, 0, y0 + H - 0.01, 0.03, "#c9a24a");
    b.box(0.08, H, 0.06, -W / 2 - 0.03, y0 - 0.01, 0.03, "#c9a24a");
    b.box(0.08, H, 0.06, W / 2 + 0.03, y0 - 0.01, 0.03, "#c9a24a");
    out.textured.push({ key: obj.variant === "b" ? "paintingB" : "paintingA", geometry: plane(W, H), position: [0, y0 + H / 2, 0.02] });
  },

  luggage(_obj, b) {
    b.box(0.8, 0.28, 0.52, 0, 0, 0, "#7a4a2a");
    b.box(0.82, 0.04, 0.54, 0, 0.12, 0, "#5a341c");
    b.box(0.62, 0.24, 0.42, 0.04, 0.28, 0, "#2f5a6a", 0.12);
    b.box(0.64, 0.03, 0.44, 0.04, 0.38, 0, "#1f3a46", 0.12);
    b.cyl(0.18, 0.18, 0.2, -0.05, 0.52, 0.02, "#c98a8a", 14);
    b.torus(0.06, 0.012, [0.04, 0.58, 0], [0, 0, 0], C.brass);
  },

  umbrellastand(_obj, b) {
    b.cyl(0.16, 0.14, 0.55, 0, 0, 0, "#3a4a6a", 12);
    b.torus(0.16, 0.015, [0, 0.55, 0], [Math.PI / 2, 0, 0], C.brass);
    for (const [dx, dz, c] of [
      [0.05, 0.03, "#c0263c"],
      [-0.05, -0.02, "#2a2a2a"],
      [0.0, -0.06, "#e0b030"]
    ] as const) {
      b.boxAt(0.02, 0.6, 0.02, [dx, 0.75, dz], [dz * 2, 0, -dx * 2], "#2a2a2a");
      b.torus(0.05, 0.012, [dx, 1.06, dz + 0.03], [0, Math.PI / 2, 0], c);
    }
  },

  runner(_obj, _b, _g, out) {
    const { w, d } = KINDS.runner;
    out.textured.push({ key: "runner", geometry: plane(w, d), position: [0, 0.006, 0], rotation: [-Math.PI / 2, 0, 0] });
  }
};
