import * as THREE from "three";
import { KINDS } from "../../game/world/kinds";
import { PartBuilder } from "../partBuilder";
import { C, books, plane, underShadow, type BuilderSet } from "./common";

/**
 * Upstairs furniture (Chapter 2): the landing, the playroom, the bathroom,
 * the music room and the attic. Same rules as downstairs: built from the
 * exact KINDS numbers, so the tested hiding spots match what is drawn.
 */

const SHEET = "#e8e3d6";
const SHEET_DARK = "#cfc8b8";

/** A bumpy dust sheet: a box with soft lumps and folds hanging to the floor. */
function dustSheet(b: PartBuilder, w: number, h: number, d: number, x = 0, z = 0) {
  b.box(w, h - 0.08, d, x, 0, z, SHEET);
  b.add(new THREE.CapsuleGeometry(0.08, w - 0.16, 4, 10), SHEET, [x, h - 0.08, z], [0, 0, Math.PI / 2], [1, 1, d / 0.16]);
  for (let i = 0; i < Math.max(3, Math.round(w / 0.25)); i++) {
    const fx = x - w / 2 + 0.12 + (i * (w - 0.24)) / Math.max(2, Math.round(w / 0.25) - 1);
    b.box(0.05, h * 0.7, 0.03, fx, 0, z + d / 2 + 0.005, i % 2 ? SHEET_DARK : SHEET);
  }
}

export const upstairsModels: BuilderSet = {
  // =============================================================== landing
  /** Railing round the stairwell (north, south and west sides; the east side is the top step). */
  balustrade(_obj, b) {
    const hx = 1.4; // opening half length (x 3.6..6.4)
    const hz = 1.2; // opening half width
    const rail = (x0: number, z0: number, x1: number, z1: number) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      b.box(alongX ? len : 0.09, 0.06, alongX ? 0.09 : len, cx, 0.92, cz, C.woodDark);
      b.box(alongX ? len : 0.06, 0.05, alongX ? 0.06 : len, cx, 0.04, cz, C.woodDark);
      const n = Math.round(len / 0.2);
      for (let i = 1; i < n; i++) {
        const t = i / n;
        b.cyl(0.022, 0.026, 0.84, x0 + (x1 - x0) * t, 0.08, z0 + (z1 - z0) * t, C.woodLight, 6);
      }
    };
    rail(-hx - 0.09, -hz - 0.09, hx, -hz - 0.09);
    rail(-hx - 0.09, hz + 0.09, hx, hz + 0.09);
    rail(-hx - 0.09, -hz - 0.09, -hx - 0.09, hz + 0.09);
    for (const [x, z] of [
      [-hx - 0.09, -hz - 0.09],
      [-hx - 0.09, hz + 0.09]
    ] as const) {
      b.box(0.14, 1.05, 0.14, x, 0, z, C.woodDark);
      b.sphere(0.08, x, 1.12, z, C.brass);
    }
    // The floor's edge round the hole, so it reads as a thick floor, not a sheet of paper.
    b.box(2 * hx + 0.02, 0.26, 0.06, 0, -0.26, -hz - 0.03, "#3a2418");
    b.box(2 * hx + 0.02, 0.26, 0.06, 0, -0.26, hz + 0.03, "#3a2418");
    b.box(0.06, 0.26, 2 * hz + 0.1, -hx - 0.03, -0.26, 0, "#3a2418");
  },

  bench(_obj, b) {
    const { w } = KINDS.bench;
    b.box(w, 0.06, 0.45, 0, 0.38, 0, C.woodRed);
    b.box(w - 0.06, 0.08, 0.4, 0, 0.44, 0.02, "#6a3a78");
    b.box(w, 0.4, 0.06, 0, 0.5, -0.2, C.woodRed);
    for (const sx of [-1, 1]) {
      b.box(0.06, 0.38, 0.4, sx * (w / 2 - 0.05), 0, 0, C.woodDark);
      b.box(0.06, 0.35, 0.06, sx * (w / 2 - 0.05), 0.44, -0.2, C.woodDark);
    }
  },

  // ============================================================== playroom
  kidtable(_obj, b) {
    const k = KINDS.kidtable;
    const top = k.h;
    b.box(k.w, 0.05, k.d, 0, top - 0.05, 0, "#f2d36b");
    b.box(k.w + 0.02, 0.02, k.d + 0.02, 0, top - 0.06, 0, "#e86a5a");
    // apron: bottom at the clearance (0.52)
    b.box(k.w - 0.1, 0.03, 0.03, 0, k.under.clearance, k.d / 2 - 0.06, "#e86a5a");
    b.box(k.w - 0.1, 0.03, 0.03, 0, k.under.clearance, -k.d / 2 + 0.06, "#e86a5a");
    const legColors = ["#4a8fe0", "#5cc46a", "#f08a3c", "#b06ad8"];
    [
      [-0.54, -0.34],
      [0.54, -0.34],
      [-0.54, 0.34],
      [0.54, 0.34]
    ].forEach(([x, z], i) => b.cyl(0.04, 0.045, top - 0.05, x, 0, z, legColors[i], 8));
    // dark patch so "under the table" reads as a space
    underShadow(b, 1.0, 0.62, "#1a1028");
    // tea party on the left half (the right half is the "on" spot)
    b.cyl(0.07, 0.08, 0.11, -0.36, top, -0.12, "#f4f0ff", 12);
    b.sphere(0.035, -0.36, top + 0.13, -0.12, "#e86a8a");
    b.boxAt(0.1, 0.02, 0.02, [-0.27, top + 0.07, -0.12], [0, 0, 0.6], "#f4f0ff");
    for (const [x, z] of [
      [-0.45, 0.18],
      [-0.2, 0.2]
    ] as const) {
      b.cyl(0.07, 0.07, 0.01, x, top, z, "#9fd0ff", 12);
      b.cyl(0.035, 0.03, 0.05, x, top + 0.01, z, "#ffffff", 8);
    }
  },

  kidchair(obj, b) {
    const col = obj.variant === "blue" ? "#4a8fe0" : "#e8584a";
    b.box(0.38, 0.04, 0.38, 0, 0.3, 0, col);
    for (const [x, z] of [
      [-0.16, -0.16],
      [0.16, -0.16],
      [-0.16, 0.16],
      [0.16, 0.16]
    ] as const) {
      b.box(0.035, 0.3, 0.035, x, 0, z, "#f2d36b");
    }
    b.box(0.38, 0.22, 0.035, 0, 0.42, -0.17, col);
    b.box(0.035, 0.12, 0.035, -0.16, 0.34, -0.17, "#f2d36b");
    b.box(0.035, 0.12, 0.035, 0.16, 0.34, -0.17, "#f2d36b");
  },

  /** Body along local x; the saddle top is KINDS.rockinghorse.on.y (0.66). */
  rockinghorse(_obj, b) {
    const coat = "#f2e6d0";
    const dapple = "#c9bfb0";
    const red = "#d0403a";
    const wood = "#9a6a3e";
    // curved rockers (an arc of short planks)
    for (const z of [-0.18, 0.18]) {
      for (let i = 0; i < 8; i++) {
        const a = -0.42 + (i / 7) * 0.84;
        const R = 1.6;
        b.boxAt(0.2, 0.05, 0.05, [R * Math.sin(a), 1.63 - R * Math.cos(a), z], [0, 0, a], wood);
      }
    }
    b.box(0.06, 0.04, 0.4, -0.35, 0.05, 0, wood);
    b.box(0.06, 0.04, 0.4, 0.35, 0.05, 0, wood);
    // legs splaying down to the rockers
    for (const [x, z] of [
      [-0.28, -0.12],
      [-0.28, 0.12],
      [0.24, -0.12],
      [0.24, 0.12]
    ] as const) {
      b.boxAt(0.06, 0.38, 0.06, [x * 1.1, 0.26, z * 1.25], [z * 0.6, 0, -x * 0.25], coat);
    }
    // body, saddle (the "on" spot: top 0.66), neck, head
    b.add(new THREE.CapsuleGeometry(0.17, 0.5, 4, 12), coat, [-0.04, 0.47, 0], [0, 0, Math.PI / 2], [1, 1, 0.92]);
    for (const [x, y, z] of [
      [-0.2, 0.52, 0.15],
      [0.05, 0.45, 0.15],
      [-0.12, 0.38, -0.15],
      [0.12, 0.55, -0.14]
    ] as const) {
      b.sphere(0.045, x, y, z, dapple, [1, 1, 0.4], 8);
    }
    b.box(0.34, 0.03, 0.38, -0.05, 0.63, 0, red);
    b.box(0.3, 0.12, 0.02, -0.05, 0.5, 0.19, red);
    b.box(0.3, 0.12, 0.02, -0.05, 0.5, -0.19, red);
    b.boxAt(0.15, 0.42, 0.15, [0.36, 0.76, 0], [0, 0, -0.45], coat);
    b.boxAt(0.34, 0.15, 0.14, [0.52, 0.96, 0], [0, 0, -0.42], coat);
    b.boxAt(0.12, 0.1, 0.12, [0.66, 0.88, 0], [0, 0, -0.42], "#d8cbb4");
    for (const z of [-0.05, 0.05]) b.add(new THREE.ConeGeometry(0.03, 0.09, 5), coat, [0.42, 1.07, z], [0, 0, 0.3]);
    for (const z of [-0.075, 0.075]) b.sphere(0.022, 0.52, 0.99, z, C.ink);
    // mane and tail
    for (let i = 0; i < 5; i++) b.sphere(0.045, 0.27 + i * 0.05, 0.66 + i * 0.07, 0, "#3a2a2a", [1, 1, 0.6], 8);
    b.add(new THREE.ConeGeometry(0.06, 0.32, 6), "#3a2a2a", [-0.38, 0.45, 0], [0, 0, 2.4]);
    // handles through the head
    b.cylAt(0.015, 0.3, [0.5, 0.98, 0], [Math.PI / 2, 0, 0], C.brass, 6);
  },

  toytrain(_obj, b, g) {
    const red = "#d8403a";
    const blue = "#3a6ad0";
    const yellow = "#f2c94c";
    b.box(1.36, 0.12, 0.5, 0, 0.12, 0, red);
    for (const x of [-0.45, -0.05, 0.38]) {
      for (const z of [-0.27, 0.27]) {
        b.cylAt(0.11, 0.06, [x, 0.12, z], [Math.PI / 2, 0, 0], "#2a2433", 14);
        b.cylAt(0.05, 0.065, [x, 0.12, z], [Math.PI / 2, 0, 0], yellow, 10);
      }
    }
    b.box(0.95, 0.03, 0.04, -0.05, 0.11, 0.305, yellow);
    b.box(0.95, 0.03, 0.04, -0.05, 0.11, -0.305, yellow);
    // boiler and chimney (front, +x)
    b.add(new THREE.CylinderGeometry(0.21, 0.21, 0.66, 14), blue, [0.27, 0.45, 0], [0, 0, Math.PI / 2]);
    for (const x of [0.05, 0.3, 0.52]) b.add(new THREE.TorusGeometry(0.212, 0.012, 6, 16), yellow, [x, 0.45, 0], [0, Math.PI / 2, 0]);
    b.cyl(0.06, 0.08, 0.16, 0.48, 0.62, 0, "#2a2433", 10);
    b.cyl(0.1, 0.06, 0.04, 0.48, 0.76, 0, "#2a2433", 10);
    b.sphere(0.07, 0.18, 0.66, 0, yellow, [1, 0.8, 1], 10);
    g.sphere(0.06, 0.62, 0.47, 0, "#fff1b8");
    b.add(new THREE.ConeGeometry(0.2, 0.16, 4), yellow, [0.66, 0.2, 0], [0, 0, -Math.PI / 2], [1, 1, 1.4]);
    // cab (back, -x) with a flat roof: the "on" spot
    b.box(0.6, 0.54, 0.54, -0.39, 0.24, 0, red);
    for (const z of [-0.272, 0.272]) b.box(0.26, 0.2, 0.01, -0.39, 0.48, z, "#2a2433");
    b.box(0.01, 0.2, 0.3, -0.085, 0.5, 0, "#2a2433");
    b.box(0.66, 0.04, 0.6, -0.39, 0.78, 0, yellow);
    // a smiley face on the front
    b.cylAt(0.17, 0.02, [0.6, 0.45, 0], [0, 0, Math.PI / 2], "#f4e6c8", 14);
    b.sphere(0.02, 0.61, 0.5, -0.06, C.ink);
    b.sphere(0.02, 0.61, 0.5, 0.06, C.ink);
    b.torus(0.06, 0.012, [0.61, 0.43, 0], [0, Math.PI / 2, 0], C.ink);
  },

  teddy(_obj, b) {
    const fur = "#b07a4a";
    const light = "#e0b88a";
    b.sphere(0.3, 0, 0.32, -0.02, fur, [1, 1.05, 0.9], 14);
    b.sphere(0.2, 0, 0.3, 0.17, light, [1, 1.05, 0.5], 12);
    b.sphere(0.22, 0, 0.78, 0, fur, [1, 0.95, 0.95], 14);
    b.sphere(0.1, 0, 0.74, 0.18, light, [1, 0.8, 0.8], 10);
    b.sphere(0.035, 0, 0.77, 0.27, C.ink);
    for (const sx of [-1, 1]) {
      b.sphere(0.03, sx * 0.08, 0.84, 0.19, C.ink);
      b.sphere(0.08, sx * 0.17, 0.97, -0.02, fur, [1, 1, 0.6], 10);
      b.sphere(0.045, sx * 0.17, 0.97, 0.01, light, [1, 1, 0.5], 8);
      // Upper ends tuck into the shoulders; the paws fall forward and outward.
      // The same capsules retain the original width and the feet set the depth.
      b.add(new THREE.CapsuleGeometry(0.08, 0.18, 4, 8), fur, [sx * 0.28, 0.49, 0.08], [-0.35, 0, sx * 0.3]);
      b.add(new THREE.CapsuleGeometry(0.1, 0.18, 4, 8), fur, [sx * 0.16, 0.1, 0.24], [Math.PI / 2, 0, 0]);
      b.sphere(0.07, sx * 0.16, 0.1, 0.38, light, [1, 1, 0.4], 10);
    }
    b.add(new THREE.ConeGeometry(0.06, 0.1, 4), "#d0403a", [-0.06, 0.6, 0.2], [0, 0, Math.PI / 2], [1, 1, 0.5]);
    b.add(new THREE.ConeGeometry(0.06, 0.1, 4), "#d0403a", [0.06, 0.6, 0.2], [0, 0, -Math.PI / 2], [1, 1, 0.5]);
  },

  blocks(_obj, b) {
    const cols = ["#e8584a", "#4a8fe0", "#f2c94c", "#5cc46a", "#b06ad8"];
    const cube = (x: number, y: number, z: number, i: number, r = 0) => {
      b.box(0.15, 0.15, 0.15, x, y, z, cols[i % cols.length], r);
      b.box(0.08, 0.08, 0.005, x, y + 0.035, z + 0.078, "#fff6e0", r);
    };
    cube(-0.2, 0, 0.05, 0, 0.2);
    cube(-0.04, 0, 0.08, 1, -0.1);
    cube(-0.12, 0.15, 0.06, 2, 0.4);
    cube(0.16, 0, -0.1, 3, 0.7);
    b.sphere(0.12, 0.2, 0.12, 0.12, "#e8584a");
    b.sphere(0.1205, 0.2, 0.12, 0.12, "#ffffff", [1, 0.25, 1]);
  },

  toyshelf(_obj, b) {
    const { w, h, d } = KINDS.toyshelf;
    const wood = "#e9d9b6";
    b.box(w, h, 0.03, 0, 0, -d / 2 + 0.015, "#c9b48c");
    for (const sx of [-1, 1]) b.box(0.05, h, d, sx * (w / 2 - 0.025), 0, 0, wood);
    for (const y of [0, 0.45, 0.9, h - 0.04]) b.box(w, 0.04, d, 0, y, 0, wood);
    // toys
    books(b, -0.75, -0.2, 0.04, 0.02, d - 0.12, 41, 0.3);
    b.sphere(0.1, 0.1, 0.14, 0, "#ff9fc4");
    b.sphere(0.07, 0.1, 0.3, 0, "#ffe0c8");
    b.box(0.3, 0.1, 0.16, 0.45, 0.04, 0, "#3a6ad0", 0.2);
    for (const x of [0.36, 0.54]) b.cylAt(0.04, 0.17, [x, 0.06, 0], [Math.PI / 2, 0, 0], "#2a2433", 8);
    // a toy boat and a spinning top
    b.box(0.36, 0.08, 0.14, -0.4, 0.49, 0, "#e8584a");
    b.cyl(0.015, 0.015, 0.24, -0.4, 0.57, 0, C.woodDark, 6);
    b.add(new THREE.ConeGeometry(0.1, 0.18, 3), "#fff6e0", [-0.34, 0.7, 0], [0, Math.PI / 2, 0], [1, 1, 0.2]);
    b.cone(0.09, 0.12, 0.1, 0.49, 0, "#f2c94c", 10);
    books(b, 0.25, 0.75, 0.49, 0.02, d - 0.12, 59, 0.28);
    // a doll and a drum-shaped tin on top
    b.sphere(0.12, -0.45, 0.98, 0, "#5cc46a", [1, 1.2, 1]);
    b.sphere(0.08, -0.45, 1.18, 0, "#ffe0c8");
    b.cyl(0.11, 0.11, 0.15, 0.35, 0.94, 0, "#f08a3c", 12);
    b.box(0.4, 0.2, 0.25, 0.0, h, 0, "#4a8fe0", 0.1);
  },

  playrug(_obj, _b, _g, out) {
    const { w, d } = KINDS.playrug;
    out.textured.push({ key: "rugPlay", geometry: plane(w, d), position: [0, 0.006, 0], rotation: [-Math.PI / 2, 0, 0] });
  },

  // ============================================================== bathroom
  bathtub(_obj, b) {
    const k = KINDS.bathtub;
    const enamel = "#f4f2ee";
    const clear = k.under.clearance; // 0.38: underside of the tub
    const top = k.h; // 0.8 rim
    underShadow(b, 1.4, 0.66, "#13202a");
    // claw feet
    for (const [x, z] of [
      [-0.6, -0.26],
      [0.6, -0.26],
      [-0.6, 0.26],
      [0.6, 0.26]
    ] as const) {
      b.cyl(0.03, 0.05, clear - 0.06, x, 0.06, z, C.brass, 8);
      b.sphere(0.07, x, 0.05, z, C.brass, [1, 0.7, 1], 8);
    }
    // basin: bottom, walls and rounded ends
    b.box(1.56, 0.06, 0.68, 0, clear, 0, enamel);
    b.box(1.5, top - clear, 0.08, 0, clear, 0.34, enamel);
    b.box(1.5, top - clear, 0.08, 0, clear, -0.34, enamel);
    for (const sx of [-1, 1]) {
      b.box(0.08, top - clear, 0.76, sx * 0.74, clear, 0, enamel);
      b.add(new THREE.CylinderGeometry(0.38, 0.38, top - clear, 14, 1, false, 0, Math.PI), enamel, [sx * 0.78, (top + clear) / 2, 0], [0, sx > 0 ? 0 : Math.PI, 0], [0.32, 1, 1]);
    }
    // rolled rim
    for (const z of [-0.38, 0.38]) b.cylAt(0.04, 1.56, [0, top, z], [0, 0, Math.PI / 2], "#ffffff", 8);
    for (const sx of [-1, 1]) b.cylAt(0.04, 0.8, [sx * 0.8, top, 0], [Math.PI / 2, 0, 0], "#ffffff", 8);
    // water (a ghost "in the bathtub" sits in it) and foam at the ends
    b.box(1.42, 0.01, 0.6, 0, 0.62, 0, "#8fd8e8");
    for (const [x, z, r] of [
      [-0.55, 0.12, 0.09],
      [-0.6, -0.1, 0.08],
      [-0.48, -0.02, 0.07],
      [0.58, 0.08, 0.08],
      [0.52, -0.14, 0.07]
    ] as const) {
      b.sphere(r, x, 0.64, z, "#ffffff", [1, 0.6, 1], 8);
    }
    // taps at the far end
    b.cyl(0.02, 0.02, 0.3, -0.72, top, -0.28, C.brass, 6);
    b.cylAt(0.018, 0.16, [-0.66, top + 0.28, -0.28], [0, 0, Math.PI / 2], C.brass, 6);
    for (const dz of [-0.08, 0.08]) b.sphere(0.035, -0.72, top + 0.12, -0.28 + dz, C.brass);
    // a rubber duck on the rim
    b.sphere(0.05, 0.62, top + 0.04, 0.36, "#ffd84a", [1.2, 0.8, 1]);
    b.sphere(0.035, 0.66, top + 0.09, 0.36, "#ffd84a");
    b.add(new THREE.ConeGeometry(0.015, 0.04, 6), "#ff8a2a", [0.7, top + 0.09, 0.36], [0, 0, -Math.PI / 2]);
  },

  sink(_obj, b) {
    const k = KINDS.sink;
    const paint = "#e9e2d6";
    const slab = 0.74;
    for (const [x, z] of [
      [-0.41, -0.27],
      [0.41, -0.27],
      [-0.41, 0.27],
      [0.41, 0.27]
    ] as const) {
      b.cyl(0.03, 0.025, slab, x, 0, z, paint, 8);
    }
    // apron: bottom at the clearance (0.62)
    b.box(0.86, slab - k.under.clearance, 0.03, 0, k.under.clearance, 0.28, paint);
    // the side aprons stop at the front one (overlapping, their undersides shared a plane)
    b.box(0.03, slab - k.under.clearance, 0.545, 0.42, k.under.clearance, -0.0075, paint);
    b.box(0.03, slab - k.under.clearance, 0.545, -0.42, k.under.clearance, -0.0075, paint);
    b.box(k.w, 0.06, k.d, 0, slab, 0, "#cfd8dc");
    underShadow(b, 0.82, 0.5, "#13202a");
    // basin, water and tap
    b.cyl(0.25, 0.18, 0.1, 0, slab + 0.06, 0.02, "#ffffff", 16);
    // water: sunk into the basin's top, 4 mm proud (flush with it, the two tops flickered)
    b.cyl(0.21, 0.21, 0.008, 0, slab + 0.156, 0.02, "#8fd8e8", 16);
    b.cyl(0.02, 0.02, 0.22, 0, slab + 0.06, -0.24, C.brass, 6);
    b.cylAt(0.016, 0.14, [0, slab + 0.27, -0.18], [Math.PI / 2, 0, 0], C.brass, 6);
    // soap and a toothbrush cup
    b.box(0.09, 0.03, 0.06, 0.34, slab + 0.06, 0.15, "#ff9fc4");
    b.cyl(0.035, 0.03, 0.09, -0.34, slab + 0.06, -0.18, "#62c4e0", 8);
    b.boxAt(0.012, 0.14, 0.012, [-0.33, slab + 0.18, -0.18], [0, 0, 0.2], "#f2f2f2");
  },

  mirror(_obj, b) {
    b.add(new THREE.TorusGeometry(0.3, 0.035, 6, 24), C.brass, [0, 1.5, 0.04], [0, 0, 0], [1, 1.25, 1]);
    b.add(new THREE.CircleGeometry(0.3, 24), "#b9d3dd", [0, 1.5, 0.035], [0, 0, 0], [1, 1.25, 1], { flatAo: true });
    b.boxAt(0.05, 0.4, 0.004, [-0.08, 1.56, 0.04], [0, 0, 0.6], "#e8f6fb");
    b.boxAt(0.025, 0.25, 0.004, [0.06, 1.48, 0.04], [0, 0, 0.6], "#e8f6fb");
  },

  towelrack(_obj, b) {
    for (const sx of [-1, 1]) {
      b.cyl(0.02, 0.02, 1.0, sx * 0.3, 0.05, 0, C.brass, 6);
      b.box(0.08, 0.05, 0.3, sx * 0.3, 0, 0, C.brass);
    }
    for (const y of [0.62, 0.95]) b.cylAt(0.015, 0.62, [0, y, 0], [0, 0, Math.PI / 2], C.brass, 6);
    // towels hanging over the bars
    b.box(0.5, 0.42, 0.06, 0, 0.53, 0.04, "#ff9fb6");
    b.box(0.5, 0.06, 0.07, 0, 0.62, 0.04, "#ff9fb6");
    b.box(0.5, 0.05, 0.065, 0, 0.75, 0.04, "#ffffff");
    b.box(0.46, 0.32, 0.06, 0, 0.66, -0.04, "#6fc3cf");
    b.box(0.46, 0.04, 0.065, 0, 0.88, -0.04, "#ffffff");
  },

  stool(_obj, b) {
    b.cyl(0.19, 0.19, 0.05, 0, 0.4, 0, "#62c4e0", 14);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      b.boxAt(0.03, 0.42, 0.03, [Math.cos(a) * 0.12, 0.2, Math.sin(a) * 0.12], [Math.sin(a) * 0.15, 0, -Math.cos(a) * 0.15], "#e9e2d6");
    }
    // a folded towel on top
    b.box(0.26, 0.06, 0.2, 0, 0.45, 0, "#ffffff", 0.3);
    b.box(0.26, 0.012, 0.2, 0, 0.475, 0, "#ff9fb6", 0.3);
  },

  bathcabinet(_obj, b) {
    const { w, h, d } = KINDS.bathcabinet;
    b.box(w, h - 0.06, d, 0, 0.06, 0, "#e9e2d6");
    b.box(w + 0.04, 0.05, d + 0.03, 0, h - 0.05, 0, "#cfd8dc");
    for (const y of [0.15, 0.95]) {
      b.box(w - 0.12, 0.7, 0.02, 0, y, d / 2 + 0.005, "#f4efe6");
      b.sphere(0.025, 0.22, y + 0.35, d / 2 + 0.03, C.brass);
    }
    // bottles on top
    const cols = ["#62c4e0", "#ff9fc4", "#9ae08a"];
    cols.forEach((c, i) => b.cyl(0.045, 0.05, 0.14 + i * 0.03, -0.2 + i * 0.18, h, 0, c, 8));
  },

  bathmat(_obj, _b, _g, out) {
    const { w, d } = KINDS.bathmat;
    out.textured.push({ key: "bathmat", geometry: plane(w, d), position: [0, 0.006, 0], rotation: [-Math.PI / 2, 0, 0] });
  },

  ventfan(_obj, b, _g, out) {
    const y = 2.15;
    b.add(new THREE.TorusGeometry(0.24, 0.04, 6, 20), "#cfd8dc", [0, y, 0.04]);
    b.add(new THREE.CircleGeometry(0.24, 20), "#2a3438", [0, y, 0.01], [0, 0, 0], [1, 1, 1], { flatAo: true });
    const fan = new PartBuilder(0);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      fan.boxAt(0.08, 0.2, 0.01, [Math.cos(a) * 0.1, Math.sin(a) * 0.1, 0], [0.3, 0, a - Math.PI / 2], "#b8c8cf");
    }
    fan.sphere(0.04, 0, 0, 0.01, "#8a9aa2");
    out.parts.push({ name: "fan", pivot: [0, y, 0.03], geometry: fan.build() });
    // grille bars in front of the blades
    for (const dy of [-0.12, 0, 0.12]) b.box(0.44, 0.015, 0.015, 0, y + dy - 0.0075, 0.07, "#cfd8dc");
  },

  /** A big brass switch plate with a fan symbol (easy to spot); the toggle flips up when the fan runs. */
  fanswitch(_obj, b, g, out) {
    const y = 1.15;
    b.box(0.34, 0.5, 0.025, 0, y - 0.25, 0.012, C.brass);
    b.box(0.28, 0.44, 0.015, 0, y - 0.22, 0.024, "#f4efe6");
    // fan symbol above the toggle
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.3;
      b.add(new THREE.CircleGeometry(0.045, 8), "#3a6ad0", [Math.cos(a) * 0.05, y + 0.1 + Math.sin(a) * 0.05, 0.034], [0, 0, a], [1.6, 0.8, 1], { flatAo: true });
    }
    g.sphere(0.018, 0, y + 0.1, 0.036, "#ffffff");
    const lever = new PartBuilder(0);
    lever.boxAt(0.05, 0.13, 0.05, [0, 0.04, 0.04], [0.5, 0, 0], "#d0403a");
    lever.sphere(0.045, 0, 0.11, 0.075, "#d0403a");
    out.parts.push({ name: "lever", pivot: [0, y - 0.1, 0.03], geometry: lever.build() });
  },

  // ================================================================= music
  drum(_obj, b) {
    const k = KINDS.drum;
    const r = k.w / 2 - 0.02;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      b.cyl(0.02, 0.025, 0.14, Math.cos(a) * r * 0.8, 0, Math.sin(a) * r * 0.8, C.brass, 6);
    }
    b.cyl(r, r, 0.52, 0, 0.12, 0, "#c0303a", 20);
    for (const y of [0.14, 0.63]) b.add(new THREE.TorusGeometry(r + 0.01, 0.025, 6, 24), C.brass, [0, y, 0], [Math.PI / 2, 0, 0]);
    // tension cords in a zigzag
    for (let i = 0; i < 10; i++) {
      const a0 = (i / 10) * Math.PI * 2;
      const a1 = ((i + 0.5) / 10) * Math.PI * 2;
      const p0 = new THREE.Vector3(Math.cos(a0) * (r + 0.012), 0.16, Math.sin(a0) * (r + 0.012));
      const p1 = new THREE.Vector3(Math.cos(a1) * (r + 0.012), 0.61, Math.sin(a1) * (r + 0.012));
      const mid = p0.clone().add(p1).multiplyScalar(0.5);
      const dir = p1.clone().sub(p0);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
      const e = new THREE.Euler().setFromQuaternion(q);
      b.add(new THREE.CylinderGeometry(0.008, 0.008, dir.length(), 4), "#f4efe6", [mid.x, mid.y, mid.z], [e.x, e.y, e.z]);
    }
    b.cyl(r, r, 0.02, 0, 0.64, 0, "#f4ead2", 20);
    // drumsticks on the floor in front
    b.boxAt(0.4, 0.025, 0.025, [0.05, 0.015, r + 0.12], [0, 0.3, 0], C.woodLight);
    b.boxAt(0.4, 0.025, 0.025, [-0.05, 0.015, r + 0.18], [0, -0.2, 0], C.woodLight);
  },

  gramophone(_obj, b) {
    b.box(0.5, 0.62, 0.5, 0, 0, 0, C.woodRed);
    b.box(0.54, 0.04, 0.54, 0, 0.62, 0, C.woodDark);
    // The platter rests on the cabinet; the record and label stand 4 mm proud.
    b.cyl(0.172, 0.172, 0.08, 0, 0.66, 0, C.woodDark, 18);
    b.cyl(0.162, 0.162, 0.008, 0, 0.744, 0, "#1d1a24", 18);
    b.cyl(0.04, 0.04, 0.004, 0, 0.756, 0, "#d0403a", 10);
    const tube = (from: THREE.Vector3, to: THREE.Vector3, radius: number) => {
      const direction = to.clone().sub(from);
      const mid = from.clone().add(to).multiplyScalar(0.5);
      const turn = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize()));
      b.cylAt(radius, direction.length(), [mid.x, mid.y, mid.z], [turn.x, turn.y, turn.z], C.brass, 6);
    };
    // The back-right pivot carries the arm above the disc, ending in a stylus.
    b.cyl(0.025, 0.03, 0.18, 0.2, 0.66, -0.2, C.brass, 6);
    tube(new THREE.Vector3(0.2, 0.84, -0.2), new THREE.Vector3(0.1, 0.8, 0.07), 0.014);
    b.cyl(0.024, 0.024, 0.036, 0.1, 0.756, 0.07, C.brass, 8);
    b.cyl(0.006, 0.006, 0.004, 0.1, 0.752, 0.07, C.iron, 4);
    // A separate rear neck supports one hollow shell, opening forward/upward.
    // Its joined outer wall, lip and inner wall replace the intersecting cones.
    b.cyl(0.03, 0.035, 0.25, -0.17, 0.66, -0.22, C.brass, 8);
    const throat = new THREE.Vector3(-0.16, 0.94, -0.22);
    tube(new THREE.Vector3(-0.17, 0.91, -0.22), throat, 0.03);
    const axis = new THREE.Vector3(-0.05, 1.015, 0.13).sub(throat);
    const turn = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.clone().normalize()));
    const horn = new THREE.LatheGeometry([
      new THREE.Vector2(0.03, 0),
      new THREE.Vector2(0.27, axis.length()),
      new THREE.Vector2(0.258, axis.length()),
      new THREE.Vector2(0.024, 0)
    ], 18);
    b.add(horn, C.brass, [throat.x, throat.y, throat.z], [turn.x, turn.y, turn.z]);
    b.cylAt(0.015, 0.14, [0.27, 0.45, 0.2], [0, 0, Math.PI / 2], C.brass, 6);
  },

  musicstand(_obj, b) {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      b.boxAt(0.02, 0.32, 0.02, [Math.cos(a) * 0.12, 0.14, Math.sin(a) * 0.12], [Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7], C.iron);
    }
    b.cyl(0.012, 0.012, 1.0, 0, 0.25, 0, C.iron, 6);
    b.boxAt(0.48, 0.32, 0.02, [0, 1.15, 0.02], [-0.35, 0, 0], C.iron);
    b.boxAt(0.4, 0.26, 0.01, [0, 1.16, 0.035], [-0.35, 0, 0], "#f4efe2");
    for (let i = 0; i < 4; i++) b.boxAt(0.34, 0.006, 0.005, [0, 1.07 + i * 0.05, 0.045 - i * 0.017], [-0.35, 0, 0], "#3a3048");
  },

  cello(_obj, b) {
    const wood = "#a0522d";
    b.box(0.5, 0.05, 0.35, 0, 0, 0, C.woodDark);
    b.sphere(0.24, 0, 0.42, 0, wood, [1, 1.05, 0.38], 14);
    b.sphere(0.2, 0, 0.8, 0, wood, [1, 1.0, 0.38], 14);
    b.box(0.2, 0.12, 0.17, 0, 0.56, 0, wood);
    b.box(0.06, 0.55, 0.05, 0, 0.92, 0.03, C.black);
    b.sphere(0.04, 0, 1.48, 0.0, C.woodDark, [1, 1.3, 0.8], 8);
    for (const sx of [-1, 1]) b.box(0.015, 0.16, 0.005, sx * 0.08, 0.52, 0.09, C.black);
    for (const dx of [-0.03, -0.01, 0.01, 0.03]) b.box(0.003, 0.95, 0.003, dx, 0.4, 0.095, "#e8e0c8");
    b.box(0.1, 0.03, 0.05, 0, 0.3, 0.09, C.black);
    b.cyl(0.008, 0.008, 0.12, 0, 0.05, 0, C.iron, 4);
  },

  guitar(_obj, b) {
    const wood = "#d89a52";
    b.box(0.3, 0.04, 0.25, 0, 0, 0, C.iron);
    b.boxAt(0.03, 0.4, 0.03, [0, 0.2, -0.08], [0.25, 0, 0], C.iron);
    b.sphere(0.16, 0, 0.26, 0, wood, [1, 1, 0.35], 14);
    b.sphere(0.12, 0, 0.48, 0, wood, [1, 1, 0.35], 14);
    b.cylAt(0.05, 0.01, [0, 0.34, 0.055], [Math.PI / 2, 0, 0], C.black, 12);
    b.box(0.05, 0.42, 0.03, 0, 0.58, 0.02, C.woodDark);
    b.box(0.08, 0.12, 0.03, 0, 1.0, 0.02, C.woodDark);
  },

  // ================================================================= attic
  coveredsofa(_obj, b) {
    const k = KINDS.coveredsofa;
    // under the sheet: seat (top at 0.5 = KINDS.coveredsofa.on.y), back and arms
    b.box(k.w, 0.5, k.d - 0.04, 0, 0, 0.02, SHEET);
    b.box(k.w, 0.45, 0.24, 0, 0.5, -0.33, SHEET);
    b.add(new THREE.CapsuleGeometry(0.12, k.w - 0.24, 4, 10), SHEET, [0, 0.93, -0.33], [0, 0, Math.PI / 2], [1, 0.6, 1]);
    for (const sx of [-1, 1]) {
      b.box(0.18, 0.2, k.d - 0.04, sx * (k.w / 2 - 0.09), 0.5, 0.02, SHEET);
      b.add(new THREE.CapsuleGeometry(0.09, k.d - 0.22, 4, 8), SHEET, [sx * (k.w / 2 - 0.09), 0.7, 0.02], [Math.PI / 2, 0, 0]);
    }
    // folds hanging to the floor, and a hint of purple velvet at the hem
    for (let i = 0; i < 8; i++) b.box(0.05, 0.42, 0.03, -0.84 + i * 0.24, 0.02, k.d / 2 + 0.005, i % 2 ? SHEET_DARK : SHEET);
    b.box(k.w - 0.1, 0.05, 0.03, 0, 0, k.d / 2 + 0.01, "#6a3a78");
    for (const sx of [-1, 1]) b.cyl(0.035, 0.03, 0.06, sx * 0.85, 0, 0.36, C.brass, 8);
  },

  roundwindow(_obj, b, g, out) {
    const cy = 1.62;
    const r = 0.6;
    b.add(new THREE.TorusGeometry(r, 0.07, 8, 28), C.woodDark, [0, cy, 0.05]);
    b.box(0.05, 2 * r, 0.05, 0, cy - r, 0.05, C.woodDark);
    b.box(2 * r, 0.05, 0.05, 0, cy - 0.025, 0.05, C.woodDark);
    // sill: its underside is the "under" clearance (0.86)
    b.box(1.2, 0.06, 0.22, 0, 0.88, 0.11, C.woodDark);
    out.textured.push({ key: "night", geometry: new THREE.CircleGeometry(r, 28), position: [0, cy, 0.02] });
    // the mysterious glow round the glass
    g.add(new THREE.RingGeometry(r - 0.06, r - 0.01, 28), "#b8a6ff", [0, cy, 0.03]);
    out.lamps.push([0, cy, 0.25]);
  },

  rockingchair(_obj, b) {
    const wood = "#5a3826";
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 7; i++) {
        const a = -0.4 + (i / 6) * 0.8;
        const R = 1.5;
        b.boxAt(0.05, 0.05, 0.18, [sx * 0.28, 1.53 - R * Math.cos(a), R * Math.sin(a)], [-a, 0, 0], wood);
      }
      b.box(0.05, 0.42, 0.05, sx * 0.28, 0.06, 0.25, wood);
      b.box(0.05, 0.42, 0.05, sx * 0.28, 0.06, -0.25, wood);
      b.boxAt(0.05, 0.78, 0.05, [sx * 0.28, 0.82, -0.36], [-0.22, 0, 0], wood);
      b.box(0.05, 0.05, 0.5, sx * 0.3, 0.68, 0.02, wood);
    }
    b.box(0.6, 0.05, 0.56, 0, 0.45, 0, wood);
    b.box(0.52, 0.04, 0.48, 0, 0.5, 0.01, "#7b2f5c");
    for (let i = 0; i < 5; i++) b.boxAt(0.03, 0.62, 0.03, [-0.2 + i * 0.1, 0.85, -0.36], [-0.22, 0, 0], wood);
    b.boxAt(0.6, 0.08, 0.06, [0, 1.17, -0.44], [-0.22, 0, 0], wood);
    // a knitted blanket over the arm
    b.box(0.08, 0.3, 0.4, 0.33, 0.42, 0.02, "#a8c8a0");
  },

  coveredchair(_obj, b) {
    dustSheet(b, 0.7, 0.55, 0.62, 0, 0.03);
    b.box(0.7, 0.8, 0.16, 0, 0.55, -0.24, SHEET);
    b.sphere(0.36, 0, 1.3, -0.24, SHEET, [1, 0.35, 0.3], 10);
  },

  boxstack(_obj, b) {
    const card = "#c49a62";
    const tape = "#e0c48a";
    const box = (w: number, h: number, d: number, x: number, y: number, z: number, rot: number, color: string, top = false) => {
      const part = (pw: number, ph: number, pd: number, px: number, py: number, pz: number, col: string) => {
        b.box(pw, ph, pd, x + px * Math.cos(rot) + pz * Math.sin(rot), y + py, z - px * Math.sin(rot) + pz * Math.cos(rot), col, rot);
      };
      // Flush lids retain each box's footprint and the original stack heights.
      part(w, h - 0.035, d, 0, 0, 0, color);
      part(w, 0.035, d, 0, h - 0.035, 0, color);
      for (const sx of [-1, 1]) {
        // Tape runs outside the end faces; it no longer cuts through the box.
        const handleY = h * 0.48;
        const endX = sx * (w / 2 + 0.006);
        part(0.004, handleY - 0.034, 0.08, endX, 0.03, 0, tape);
        part(0.004, h - handleY - 0.079, 0.08, endX, handleY + 0.049, 0, tape);
        part(0.004, 0.045, 0.14, endX, handleY, 0, C.woodDark);
      }
      part(0.05, 0.075, 0.012, 0, h - 0.065, d / 2 + 0.01, tape);
      // Only the uncovered box gets top tape, keeping the next box seated flush.
      if (top) part(w - 0.012, 0.004, 0.08, 0, h + 0.004, 0, tape);
    };
    box(0.85, 0.42, 0.65, 0, 0, 0, 0.05, card);
    box(0.6, 0.34, 0.5, 0.06, 0.42, 0.02, -0.2, "#b48a52");
    box(0.36, 0.22, 0.3, -0.05, 0.76, 0, 0.4, card, true);
  },

  oldpaintings(_obj, b, _g, out) {
    const frame = "#8a6a2a";
    const lean = -0.25;
    b.boxAt(0.8, 0.95, 0.05, [-0.05, 0.47, 0.02], [lean, 0, 0], frame);
    out.textured.push({ key: "paintingA", geometry: plane(0.64, 0.78), position: [-0.05, 0.48, 0.06], rotation: [lean, 0, 0] });
    b.boxAt(0.55, 0.7, 0.05, [0.25, 0.35, 0.14], [lean - 0.05, 0, 0.04], "#5a4a3a");
    out.textured.push({ key: "paintingB", geometry: plane(0.42, 0.55), position: [0.25, 0.36, 0.175], rotation: [lean - 0.05, 0, 0.04] });
  },

  /** Rafters and posts along an attic wall: it is right under the roof. */
  rafters(_obj, b) {
    const { w } = KINDS.rafters;
    const wood = "#4a3424";
    for (let i = 0; i <= 4; i++) {
      const x = -w / 2 + (i * w) / 4;
      b.box(0.16, 2.8, 0.16, x, 0, 0.08, wood);
    }
    b.box(w + 0.16, 0.18, 0.2, 0, 2.55, 0.1, wood);
    for (let i = 0; i < 4; i++) {
      const x0 = -w / 2 + (i * w) / 4;
      const x1 = x0 + w / 4;
      const len = Math.hypot(x1 - x0, 1.2);
      b.boxAt(len, 0.1, 0.1, [(x0 + x1) / 2, 1.95, 0.12], [0, 0, (i % 2 ? 1 : -1) * Math.atan2(1.2, x1 - x0)], "#3d2a1c");
    }
  }
};
