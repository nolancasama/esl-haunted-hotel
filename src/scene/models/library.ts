import * as THREE from "three";
import { KINDS } from "../../game/world/kinds";
import { PartBuilder } from "../partBuilder";
import { C, books, type BuilderSet } from "./common";

export const libraryModels: BuilderSet = {
  armchair(_obj, b) {
    const red = "#8c2f45";
    const dark = "#5e1d2e";
    // base and the seat cushion (top at 0.48 = KINDS.armchair.on.y)
    b.box(0.86, 0.34, 0.8, 0, 0.08, 0.02, dark);
    b.box(0.62, 0.06, 0.68, 0, 0.42, 0.08, red);
    // arms (outside the "on" area), back, buttons
    for (const sx of [-1, 1]) {
      b.box(0.15, 0.26, 0.84, sx * 0.4, 0.4, 0.02, red);
      b.add(new THREE.CylinderGeometry(0.085, 0.085, 0.84, 10), red, [sx * 0.4, 0.67, 0.02], [Math.PI / 2, 0, 0]);
    }
    b.box(0.9, 0.62, 0.18, 0, 0.42, -0.36, red);
    b.add(new THREE.CylinderGeometry(0.09, 0.09, 0.9, 12), red, [0, 1.04, -0.36], [0, 0, Math.PI / 2]);
    for (const [x, y] of [
      [-0.2, 0.75],
      [0.2, 0.75],
      [0, 0.92],
      [-0.2, 0.6],
      [0.2, 0.6]
    ] as const) {
      b.sphere(0.02, x, y, -0.265, C.brass, [1, 1, 0.5], 6);
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cyl(0.035, 0.025, 0.08, sx * 0.36, 0, sz * 0.32, C.woodDark, 8);
  },

  bookshelf(_obj, b) {
    const { w, h, d } = KINDS.bookshelf;
    const wood = "#6a3f28";
    b.box(w, h - 0.05, 0.04, 0, 0, -d / 2 + 0.02, "#4a2a1a");
    b.box(0.06, h - 0.05, d, -w / 2 + 0.03, 0, 0, wood);
    b.box(0.06, h - 0.05, d, w / 2 - 0.03, 0, 0, wood);
    const shelves = [0.05, 0.5, 0.95, 1.4, 1.82];
    for (const y of shelves) b.box(w - 0.06, 0.04, d - 0.02, 0, y, 0, wood);
    b.box(w + 0.08, 0.05, d + 0.06, 0, h - 0.05, 0, "#4a2a1a"); // top (2.2)
    shelves.slice(0, 4).forEach((y, i) => books(b, -w / 2 + 0.08, w / 2 - 0.08, y + 0.04, 0.02, d - 0.12, 7 + i * 13, 0.36));
    // a few books lying on top, away from the "on" spot (local x -0.4)
    books(b, 0.4, 0.8, h, 0, 0.26, 91, 0.22);
    b.sphere(0.07, 0.15, h + 0.07, 0.05, "#c9d6e8", [1, 1, 1], 10);
  },

  clock(_obj, b, _g, out) {
    const { w, h, d } = KINDS.clock;
    const wood = "#7a4128";
    const dark = "#4f2818";
    // base, side walls, back (the cavity is x +-0.24, z -0.2..0.21, y 0.2..1.35)
    b.box(w + 0.06, 0.2, d + 0.04, 0, 0, 0, dark);
    b.box(0.07, 1.25, d, -w / 2 + 0.035, 0.2, 0, wood);
    b.box(0.07, 1.25, d, w / 2 - 0.035, 0.2, 0, wood);
    b.box(w, 1.25, 0.04, 0, 0.2, -d / 2 + 0.02, "#3a1d10");
    b.box(w - 0.1, 0.01, d - 0.06, 0, 0.2, 0, "#1d1426");
    // pendulum against the back wall
    b.box(0.015, 0.7, 0.015, 0, 0.62, -d / 2 + 0.06, C.brass);
    b.cyl(0.08, 0.08, 0.02, 0, 0.55, -d / 2 + 0.06, C.brass, 16);
    // hood with the face
    b.box(w + 0.04, 0.65, d + 0.02, 0, 1.45, 0, wood);
    b.box(w + 0.1, 0.06, d + 0.06, 0, 1.43, 0, dark);
    b.box(w + 0.1, 0.06, d + 0.06, 0, h - 0.06, 0, dark);
    b.add(new THREE.CylinderGeometry(0.16, 0.16, w + 0.06, 14, 1, false, -Math.PI / 2, Math.PI), dark, [0, h, 0], [0, 0, Math.PI / 2], [1, 0.5, 1]);
    out.textured.push({ key: "clockface", geometry: new THREE.CircleGeometry(0.21, 24), position: [0, 1.76, d / 2 + 0.012] });
    // the door (a frame: you can see the pendulum through it); hinged on the left
    const door = new PartBuilder();
    const dw = w - 0.08;
    door.box(0.05, 1.1, 0.03, 0.025, 0, 0, C.brass);
    door.box(0.05, 1.1, 0.03, dw - 0.025, 0, 0, C.brass);
    door.box(dw, 0.05, 0.03, dw / 2, 0, 0, C.brass);
    door.box(dw, 0.05, 0.03, dw / 2, 1.05, 0, C.brass);
    door.sphere(0.02, dw - 0.06, 0.55, 0.03, C.brass);
    out.parts.push({ name: "door", pivot: [-dw / 2, 0.25, d / 2 + 0.005], geometry: door.build() });
  },

  floorlamp(_obj, b, g, out) {
    b.cyl(0.16, 0.18, 0.04, 0, 0, 0, C.brass, 14);
    b.cyl(0.02, 0.02, 1.4, 0, 0.04, 0, C.brass, 6);
    b.cone(0.24, 0.3, 0, 1.38, 0, "#e8c88a", 16, true);
    g.sphere(0.07, 0, 1.42, 0, C.bulb);
    out.lamps.push([0, 1.45, 0]);
  },

  globe(_obj, b) {
    b.cyl(0.18, 0.22, 0.05, 0, 0, 0, C.woodDark, 12);
    b.cyl(0.03, 0.04, 0.55, 0, 0.05, 0, C.woodDark, 8);
    b.sphere(0.28, 0, 0.82, 0, "#3f7fc4", [1, 1, 1], 18);
    for (const [x, y, z, s] of [
      [0.12, 0.9, 0.22, 0.12],
      [-0.15, 0.75, 0.2, 0.1],
      [0.05, 0.7, -0.24, 0.13],
      [-0.2, 0.92, -0.12, 0.09]
    ] as const) {
      b.sphere(s, x, y, z, "#6fbf6a", [1, 0.8, 0.5], 8);
    }
    b.torus(0.31, 0.012, [0, 0.82, 0], [0.4, 0, 0], C.brass);
  }
};

