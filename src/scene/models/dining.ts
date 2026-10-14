import * as THREE from "three";
import { KINDS } from "../../game/world/kinds";
import { PartBuilder } from "../partBuilder";
import { C, candle, plane, type BuilderSet } from "./common";

export const diningModels: BuilderSet = {
  table(_obj, b, g) {
    const { h } = KINDS.table; // 0.8
    // tablecloth hangs to 0.62 (clearance 0.6)
    b.box(2.8, 0.06, 1.2, 0, h - 0.08, 0, C.woodDark);
    b.box(2.92, 0.025, 1.32, 0, h - 0.025, 0, "#f3eee4");
    b.box(2.92, 0.16, 0.012, 0, h - 0.18, 0.66, "#ece5d6");
    b.box(2.92, 0.16, 0.012, 0, h - 0.18, -0.66, "#ece5d6");
    b.box(0.012, 0.16, 1.32, 1.46, h - 0.18, 0, "#ece5d6");
    b.box(0.012, 0.16, 1.32, -1.46, h - 0.18, 0, "#ece5d6");
    // lace edge
    for (let x = -1.4; x <= 1.4; x += 0.2) {
      b.sphere(0.03, x, h - 0.19, 0.665, "#ffffff", [1, 0.6, 0.3], 6);
      b.sphere(0.03, x, h - 0.19, -0.665, "#ffffff", [1, 0.6, 0.3], 6);
    }
    for (const [x, z] of [
      [-1.25, -0.48],
      [1.25, -0.48],
      [-1.25, 0.48],
      [1.25, 0.48]
    ] as const) {
      b.cyl(0.045, 0.06, h - 0.08, x, 0, z, C.woodDark, 8);
      b.sphere(0.06, x, 0.3, z, C.woodDark, [1, 0.6, 1], 8);
    }
    // dinner on the left half; the right half (x > 0.1) is the "on" spot
    const top = h;
    for (const [x, z] of [
      [-1.15, 0.36],
      [-1.15, -0.36],
      [-0.55, 0.38],
      [-0.55, -0.38],
      [1.08, 0.38]
    ] as const) {
      b.cyl(0.13, 0.11, 0.015, x, top, z, "#ffffff", 16);
      b.cyl(0.08, 0.08, 0.017, x, top, z, "#d7e4f2", 16);
    }
    // cake next to where Hungry likes to sit
    b.cyl(0.17, 0.17, 0.02, -0.12, top, 0.12, "#f2f2f2", 16);
    b.cyl(0.13, 0.13, 0.12, -0.12, top + 0.02, 0.12, "#f4a6c0", 16);
    b.cyl(0.135, 0.135, 0.025, -0.12, top + 0.13, 0.12, "#fff3f6", 16);
    b.sphere(0.03, -0.12, top + 0.17, 0.12, "#e0263c");
    // candelabra
    b.cyl(0.07, 0.09, 0.03, -0.75, top, -0.05, C.brass, 10);
    b.cyl(0.015, 0.015, 0.3, -0.75, top + 0.03, -0.05, C.brass, 6);
    b.cylAt(0.012, 0.36, [-0.75, top + 0.28, -0.05], [0, 0, Math.PI / 2], C.brass, 6);
    for (const dx of [-0.18, 0, 0.18]) candle(b, g, -0.75 + dx, top + 0.29 + (dx === 0 ? 0.04 : 0), -0.05, 0.12);
    // fruit bowl
    b.add(new THREE.SphereGeometry(0.15, 12, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), "#c9d6e8", [-1.0, top + 0.13, 0], [0, 0, 0]);
    b.sphere(0.06, -1.04, top + 0.12, 0.02, "#e84a3c");
    b.sphere(0.06, -0.96, top + 0.12, -0.03, "#f2c94c");
    b.sphere(0.055, -1.0, top + 0.17, 0.0, "#6fbf4a");
    // a cup by the plate on the right
    b.cyl(0.04, 0.035, 0.08, 1.22, top, 0.2, "#ffffff", 10);
  },

  piano(obj, b, g) {
    const legH = KINDS.piano.under.clearance; // 0.62
    const white = obj.variant === "white";
    const black = white ? "#f2eee6" : "#1d1a24";
    const shine = white ? "#ffffff" : "#3c3548";
    // case: square front part + half-disc tail
    b.box(1.45, 0.34, 0.95, 0, legH, 0.22, black);
    b.add(new THREE.CylinderGeometry(0.725, 0.725, 0.34, 22, 1, false, Math.PI / 2, Math.PI), black, [0, legH + 0.17, -0.25]);
    b.box(1.47, 0.04, 0.97, 0, legH + 0.34, 0.22, shine);
    b.add(new THREE.CylinderGeometry(0.735, 0.735, 0.04, 22, 1, false, Math.PI / 2, Math.PI), shine, [0, legH + 0.36, -0.25]);
    // keyboard
    b.box(1.3, 0.1, 0.24, 0, legH + 0.04, 0.78, black);
    b.box(1.2, 0.03, 0.2, 0, legH + 0.14, 0.8, "#f6f2e8");
    for (let i = 0; i < 14; i++) {
      if (i % 7 === 2 || i % 7 === 6) continue;
      b.box(0.035, 0.03, 0.11, -0.56 + i * 0.083 + 0.04, legH + 0.165, 0.75, "#15121c");
    }
    // music stand with a sheet
    b.boxAt(0.6, 0.26, 0.02, [0, legH + 0.52, 0.6], [-0.25, 0, 0], black);
    b.boxAt(0.3, 0.2, 0.01, [0.0, legH + 0.53, 0.615], [-0.25, 0, 0], "#f4efe2");
    // three legs with brass feet
    for (const [x, z] of [
      [-0.6, 0.6],
      [0.6, 0.6],
      [0, -0.8]
    ] as const) {
      b.cyl(0.05, 0.07, legH, x, 0, z, black, 10);
      b.sphere(0.06, x, 0.03, z, C.brass, [1, 0.5, 1], 8);
    }
    // dark floor patch under the piano
    b.add(new THREE.CircleGeometry(0.8, 20), "#140c1f", [0, 0.003, -0.05], [-Math.PI / 2, 0, 0], [1, 1.1, 1], { flatAo: true });
    // a small candle on the corner (not on the "on" spot)
    candle(b, g, 0.58, legH + 0.38, 0.55, 0.1);
  },

  basket(obj, b, _g, out) {
    const { w, d, h } = KINDS.basket;
    const laundry = obj.variant === "laundry";
    const wicker = laundry ? "#e6dcc8" : "#c99a5b";
    const dark = laundry ? "#b8aa90" : "#9c6f3c";
    b.box(w, 0.05, d, 0, 0, 0, dark);
    b.box(w, h - 0.05, 0.05, 0, 0.05, d / 2 - 0.025, wicker);
    b.box(w, h - 0.05, 0.05, 0, 0.05, -d / 2 + 0.025, wicker);
    b.box(0.05, h - 0.05, d - 0.1, w / 2 - 0.025, 0.05, 0, wicker);
    b.box(0.05, h - 0.05, d - 0.1, -w / 2 + 0.025, 0.05, 0, wicker);
    for (const y of [0.12, 0.24, 0.36]) b.box(w + 0.01, 0.025, d + 0.01, 0, y, 0, dark);
    for (let x = -0.36; x <= 0.36; x += 0.12) b.box(0.02, h - 0.06, d + 0.012, x, 0.05, 0, dark);
    b.box(w - 0.1, 0.01, d - 0.1, 0, 0.05, 0, "#2a1b14");
    if (laundry) {
      // a striped towel and a sock hanging over the front
      b.boxAt(0.26, 0.2, 0.012, [-0.18, h - 0.06, d / 2 + 0.01], [0.15, 0, -0.08], "#6fc3cf");
      b.boxAt(0.26, 0.03, 0.014, [-0.18, h - 0.02, d / 2 + 0.012], [0.15, 0, -0.08], "#ffffff");
      b.boxAt(0.06, 0.16, 0.012, [0.24, h - 0.06, d / 2 + 0.01], [0.1, 0, 0.25], "#ff9fb6");
    } else {
      // gingham napkin peeking out
      b.boxAt(0.3, 0.12, 0.01, [0.2, h - 0.02, d / 2 - 0.02], [0.3, 0, 0.1], "#e05050");
    }
    // side handles
    for (const sx of [-1, 1]) b.torus(0.1, 0.018, [(sx * w) / 2, h - 0.02, 0], [0, Math.PI / 2, 0], dark);
    const lid = new PartBuilder();
    lid.box(w + 0.04, 0.06, d + 0.04, 0, 0, (d + 0.04) / 2, wicker);
    for (let x = -0.36; x <= 0.36; x += 0.12) lid.box(0.02, 0.065, d + 0.045, x, 0, (d + 0.04) / 2, dark);
    out.parts.push({ name: "lid", pivot: [0, h, -d / 2 - 0.02], geometry: lid.build() });
  },

  cabinet(_obj, b) {
    const { w, h, d } = KINDS.cabinet;
    b.box(w, 0.88, d, 0, 0.05, 0, C.woodRed);
    for (const sx of [-1, 1]) {
      b.box(w / 2 - 0.08, 0.7, 0.02, (sx * w) / 4, 0.14, d / 2 + 0.005, "#8e4a36");
      b.sphere(0.025, sx * 0.08, 0.55, d / 2 + 0.03, C.brass);
    }
    // glass hutch with plates
    b.box(w, 0.04, d - 0.1, 0, 0.93, -0.05, C.woodDark);
    b.box(0.06, h - 0.97, d - 0.1, -w / 2 + 0.03, 0.97, -0.05, C.woodRed);
    b.box(0.06, h - 0.97, d - 0.1, w / 2 - 0.03, 0.97, -0.05, C.woodRed);
    b.box(w, h - 0.97, 0.03, 0, 0.97, -d / 2 + 0.03, "#5a2c22");
    b.box(w - 0.1, 0.03, d - 0.12, 0, 1.38, -0.05, C.woodDark);
    b.box(w + 0.1, 0.08, d, 0, h - 0.06, 0, C.woodDark);
    for (const [y, n] of [
      [0.98, 4],
      [1.42, 3]
    ] as const) {
      for (let i = 0; i < n; i++) {
        const x = -0.42 + i * (0.84 / (n - 1));
        b.add(new THREE.CylinderGeometry(0.15, 0.15, 0.015, 16), "#f6f2ea", [x, y + 0.17, -0.12], [Math.PI / 2 - 0.2, 0, 0]);
        b.add(new THREE.CylinderGeometry(0.1, 0.1, 0.017, 16), "#6f9ad6", [x, y + 0.17, -0.11], [Math.PI / 2 - 0.2, 0, 0]);
      }
    }
    for (const sx of [-1, 1]) b.cyl(0.04, 0.03, 0.05, sx * 0.55, 0, 0.15, C.woodDark, 8);
  },

  sidetable(_obj, b, g) {
    const { h } = KINDS.sidetable;
    b.cyl(0.3, 0.3, 0.04, 0, h - 0.04, 0, C.woodRed, 18);
    b.cyl(0.04, 0.05, h - 0.04, 0, 0, 0, C.woodDark, 8);
    b.cyl(0.2, 0.22, 0.04, 0, 0, 0, C.woodDark, 14);
    b.cyl(0.05, 0.06, 0.03, 0, h, 0, C.brass, 8);
    candle(b, g, 0, h + 0.03, 0, 0.2);
  },

  bigrug(_obj, _b, _g, out) {
    const { w, d } = KINDS.bigrug;
    out.textured.push({ key: "rugDining", geometry: plane(w, d), position: [0, 0.006, 0], rotation: [-Math.PI / 2, 0, 0] });
  },

  chandelier(obj, b, g, out) {
    const small = obj.variant === "small";
    const y = small ? 2.25 : 2.3;
    const r = small ? 0.38 : 0.6;
    const n = small ? 5 : 8;
    b.cylAt(0.012, 2.8 - y, [0, (2.8 + y) / 2 + 0.1, 0], [0, 0, 0], C.brass, 6);
    b.torus(r, 0.025, [0, y, 0], [Math.PI / 2, 0, 0], C.brass);
    b.sphere(0.08, 0, y - 0.05, 0, C.brass);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      b.cylAt(0.008, r, [x / 2, y, z / 2], [0, -a, Math.PI / 2], C.brass, 4);
      b.cyl(0.035, 0.03, 0.03, x, y, z, C.brass, 8);
      candle(b, g, x, y + 0.03, z, 0.1);
    }
    out.lamps.push([0, y + 0.12, 0]);
  }
};
