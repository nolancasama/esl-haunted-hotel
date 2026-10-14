import * as THREE from "three";
import { KINDS } from "../../game/world/kinds";
import { PartBuilder } from "../partBuilder";
import { C, type BuilderSet } from "./common";

const CRATE_COLORS: Record<string, [string, string]> = {
  red: ["#cf4a3e", "#8f2a22"],
  blue: ["#3f72c9", "#24477f"],
  yellow: ["#e9b73a", "#a87a14"]
};

export const storageModels: BuilderSet = {
  crate(obj, b, _g, out) {
    const { w, d, h } = KINDS.crate;
    const [paint, edge] = CRATE_COLORS[obj.variant ?? "red"] ?? CRATE_COLORS.red;
    const t = 0.06;
    b.box(w, t, d, 0, 0, 0, edge);
    b.box(w, h - t, t, 0, t, d / 2 - t / 2, paint);
    b.box(w, h - t, t, 0, t, -d / 2 + t / 2, paint);
    b.box(t, h - t, d - 2 * t, w / 2 - t / 2, t, 0, paint);
    b.box(t, h - t, d - 2 * t, -w / 2 + t / 2, t, 0, paint);
    // planks, corner posts and a cross brace on the front
    for (const y of [0.25, 0.5]) b.box(w + 0.01, 0.018, d + 0.01, 0, y, 0, edge);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.08, h, 0.08, (sx * w) / 2, 0, (sz * d) / 2, edge);
    b.boxAt(0.06, Math.hypot(w, h) * 0.86, 0.02, [0, h / 2, d / 2 + 0.012], [0, 0, Math.atan2(w, h)], edge);
    b.box(w - 2 * t, 0.01, d - 2 * t, 0, t, 0, "#1d1426");
    const lid = new PartBuilder();
    lid.box(w + 0.05, 0.06, d + 0.05, 0, 0, (d + 0.05) / 2, paint);
    for (const z of [0.12, 0.42, 0.72]) lid.box(w + 0.06, 0.065, 0.03, 0, 0, z, edge);
    out.parts.push({ name: "lid", pivot: [0, h - 0.01, -d / 2 - 0.025], geometry: lid.build() });
  },

  shelf(obj, b) {
    const { w, h, d } = KINDS.shelf;
    if (obj.variant === "bath") {
      // white bathroom shelves: folded towels, bottles, a plant; the top's right half is the "on" spot
      const paint = "#ece6dc";
      b.box(w, h, 0.03, 0, 0, -d / 2 + 0.015, "#d8d0c2");
      for (const sx of [-1, 1]) b.box(0.05, h, d, sx * (w / 2 - 0.025), 0, 0, paint);
      for (const y of [0.05, 0.6, 1.2, h - 0.04]) b.box(w, 0.04, d, 0, y, 0, paint);
      const towels = ["#ff9fb6", "#6fc3cf", "#ffffff", "#f2d36b"];
      towels.forEach((c, i) => {
        b.box(0.34, 0.09, 0.36, -0.55 + i * 0.36, 0.09, 0, c);
        b.box(0.34, 0.09, 0.36, -0.55 + i * 0.36, 0.18, 0, towels[(i + 2) % 4]);
      });
      const bottles = ["#62c4e0", "#ff9fc4", "#9ae08a", "#e0b0ff", "#f2c94c"];
      bottles.forEach((c, i) => {
        b.cyl(0.05, 0.055, 0.18 + (i % 2) * 0.06, -0.7 + i * 0.32, 0.64, 0, c, 8);
        b.cyl(0.02, 0.02, 0.05, -0.7 + i * 0.32, 0.82 + (i % 2) * 0.06, 0, "#ffffff", 6);
      });
      b.box(0.5, 0.12, 0.3, 0.45, 1.24, 0, "#ffffff");
      b.box(0.5, 0.12, 0.3, -0.35, 1.24, 0, "#6fc3cf");
      // plant on the left of the top board
      b.cyl(0.09, 0.07, 0.14, -0.6, h, 0, "#c06a4a", 10);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        b.add(new THREE.ConeGeometry(0.04, 0.3, 4), "#5aa864", [-0.6 + Math.cos(a) * 0.05, h + 0.27, Math.sin(a) * 0.05], [Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4], [1, 1, 0.4]);
      }
      return;
    }
    const metal = "#6b6577";
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.05, h, 0.05, (sx * (w - 0.05)) / 2, 0, (sz * (d - 0.05)) / 2, metal);
    for (const y of [0.36, 0.86, 1.36, h - 0.04]) b.box(w, 0.04, d, 0, y, 0, "#8d6a4a");
    // jars, tins and small boxes (kept off the right half of the top board: the "on" spot)
    const jars = ["#7fc7d9", "#e3c06a", "#d97f7f", "#9fd48a"];
    jars.forEach((c, i) => b.cyl(0.07, 0.07, 0.16, -0.7 + i * 0.2, 0.4, 0.02, c, 10));
    b.box(0.3, 0.22, 0.3, 0.45, 0.4, 0, "#b08a5a", 0.1);
    b.box(0.26, 0.18, 0.26, 0.5, 0.62, 0.0, "#a07a4a", -0.15);
    for (let i = 0; i < 3; i++) b.cyl(0.08, 0.08, 0.14, -0.55 + i * 0.22, 0.9, 0, "#8a93a3", 12);
    b.box(0.4, 0.16, 0.3, 0.45, 0.9, 0, "#d0c3a0", 0.05);
    b.cyl(0.09, 0.1, 0.2, -0.5, 1.4, 0.0, "#5f8fd0", 12);
    b.box(0.3, 0.12, 0.25, 0.1, 1.4, 0, "#c25a46", 0.2);
    b.box(0.22, 0.14, 0.2, -0.62, h, 0, "#b08a5a", 0.3);
  },

  worktable(obj, b) {
    const { w, h, d } = KINDS.worktable;
    const music = obj.variant === "music";
    b.box(w, 0.06, d, 0, h - 0.06, 0, music ? "#5a2c22" : "#9b7550");
    // apron: bottom at 0.72 (clearance)
    b.box(w - 0.1, 0.04, 0.03, 0, h - 0.1, d / 2 - 0.04, C.woodDark);
    b.box(w - 0.1, 0.04, 0.03, 0, h - 0.1, -d / 2 + 0.04, C.woodDark);
    for (const [x, z] of [
      [-0.63, -0.31],
      [0.63, -0.31],
      [-0.63, 0.31],
      [0.63, 0.31]
    ] as const) {
      if (music) b.cyl(0.035, 0.025, h - 0.06, x, 0, z, C.woodDark, 8);
      else b.box(0.07, h - 0.06, 0.07, x, 0, z, C.woodDark);
    }
    if (music) {
      // sheet music and a metronome on the left half
      b.box(1.1, 0.004, 0.6, 0, 0.002, 0, "#140c1f");
      b.box(0.3, 0.01, 0.22, -0.38, h, -0.05, "#f4efe2", 0.2);
      b.box(0.28, 0.01, 0.21, -0.3, h + 0.01, 0.05, "#efe8d6", -0.15);
      for (let i = 0; i < 4; i++) b.box(0.22, 0.003, 0.006, -0.3, h + 0.016, -0.02 + i * 0.04, "#3a3048", -0.15);
      b.add(new THREE.ConeGeometry(0.08, 0.24, 4), "#7a3a2a", [-0.1, h + 0.12, -0.18], [0, Math.PI / 4, 0]);
      b.boxAt(0.012, 0.18, 0.012, [-0.1, h + 0.14, -0.13], [0, 0, 0.3], C.brass);
      return;
    }
    // tools on the left half
    b.box(0.34, 0.12, 0.18, -0.4, h, -0.12, "#c43c3c");
    b.box(0.34, 0.03, 0.18, -0.4, h + 0.12, -0.12, "#a02a2a");
    b.box(0.04, 0.03, 0.22, -0.15, h, 0.16, "#7a5a3a", 0.5);
    b.box(0.08, 0.05, 0.05, -0.08, h, 0.07, C.iron, 0.5);
    b.cyl(0.05, 0.05, 0.1, -0.6, h, 0.2, "#4f8a4a", 10);
  },

  barrel(_obj, b) {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 8; i++) {
      const y = (i / 8) * 0.95;
      const bulge = Math.sin((i / 8) * Math.PI) * 0.05;
      pts.push(new THREE.Vector2(0.3 + bulge, y));
    }
    b.add(new THREE.LatheGeometry(pts, 14), "#8a5f3c", [0, 0, 0]);
    b.cyl(0.3, 0.3, 0.02, 0, 0.93, 0, "#6e4a2e", 14);
    for (const y of [0.15, 0.8]) b.torus(0.315, 0.015, [0, y, 0], [Math.PI / 2, 0, 0], C.iron);
    b.torus(0.35, 0.015, [0, 0.475, 0], [Math.PI / 2, 0, 0], C.iron);
  },

  trunk(_obj, b) {
    const { w, d } = KINDS.trunk;
    b.box(w, 0.42, d, 0, 0, 0, "#3f5a7a");
    b.add(new THREE.CylinderGeometry(d / 2, d / 2, w, 14, 1, false, -Math.PI / 2, Math.PI), "#4a6a8f", [0, 0.42, 0], [0, 0, Math.PI / 2]);
    for (const x of [-0.3, 0.3]) {
      b.box(0.06, 0.43, d + 0.01, x, 0, 0, "#7a5a3a");
      b.add(new THREE.CylinderGeometry(d / 2 + 0.005, d / 2 + 0.005, 0.06, 14, 1, false, -Math.PI / 2, Math.PI), "#7a5a3a", [x, 0.42, 0], [0, 0, Math.PI / 2]);
    }
    b.box(0.1, 0.1, 0.02, 0, 0.32, d / 2 + 0.01, C.brass);
  },

  cupboard(_obj, b) {
    const { w, h, d } = KINDS.cupboard;
    b.box(w, h - 0.08, d, 0, 0.08, 0, "#6f6a52");
    b.box(w + 0.06, 0.06, d + 0.04, 0, h - 0.02, 0, "#4f4b3a");
    for (const sx of [-1, 1]) {
      b.box(w / 2 - 0.08, h - 0.4, 0.02, (sx * w) / 4, 0.25, d / 2 + 0.005, "#857f63");
      b.box(0.03, 0.12, 0.03, sx * 0.06, 0.95, d / 2 + 0.03, C.iron);
    }
    for (const sx of [-1, 1]) b.box(0.06, 0.08, 0.06, sx * (w / 2 - 0.06), 0, 0, "#4f4b3a");
  },

  broom(_obj, b) {
    b.boxAt(0.035, 1.3, 0.035, [0, 0.75, 0], [0.18, 0, 0.08], "#b8925f");
    b.boxAt(0.3, 0.25, 0.08, [0.02, 0.12, -0.05], [0.18, 0, 0.08], "#d8c070");
    b.cyl(0.13, 0.11, 0.25, 0.25, 0, 0.12, "#7a8a9a", 12);
    b.torus(0.12, 0.008, [0.25, 0.25, 0.12], [Math.PI / 2, 0, 0], C.iron);
  }
};
