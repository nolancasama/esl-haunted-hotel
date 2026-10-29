import * as THREE from "three";
import { KINDS } from "../../game/world/kinds";
import { PartBuilder } from "../partBuilder";
import { C, plane, underShadow, type BuilderSet, type TexKey } from "./common";

/** Shared pieces (desk, box, window, chair, rug) and the bedroom. */
export const bedroomModels: BuilderSet = {
  bed(obj, b, _g, out) {
    const v = obj.variant ?? "";
    const k = KINDS.bed;
    const clear = k.under.clearance; // 0.38: rail bottom
    // Dark floor patch so "under the bed" reads as a space.
    underShadow(b, 1.5, 2.0);
    b.box(1.6, 0.12, 2.1, 0, clear, 0, C.wood);
    b.box(1.52, 0.16, 2.04, 0, clear + 0.12, 0, C.linen); // mattress, top 0.66
    for (const [x, z, h] of [
      [-0.82, -1.06, 1.25],
      [0.82, -1.06, 1.25],
      [-0.82, 1.06, 0.95],
      [0.82, 1.06, 0.95]
    ] as const) {
      b.box(0.1, h, 0.1, x, 0, z, C.woodDark);
      b.sphere(0.075, x, h + 0.05, z, C.brass);
    }
    // headboard, and a footboard that starts at the rail so "under" stays visible
    b.box(1.56, 0.72, 0.07, 0, 0.42, -1.06, C.wood);
    b.box(1.3, 0.12, 0.08, 0, 1.0, -1.06, C.woodLight);
    b.box(1.56, 0.34, 0.06, 0, 0.5, 1.06, C.wood);
    b.sphere(0.34, 0, 0.7, -0.72, v === "floral" ? "#f6d6e2" : "#fbf6ec", [1, 0.26, 0.55]);
    // Guest Wing variants keep the free "on" area (z -0.55..1.05) clear: details sit at the head and foot.
    if (v === "antique") {
      // tall carved posts and a dark headboard crest
      for (const x of [-0.82, 0.82]) {
        b.box(0.1, 0.75, 0.1, x, 1.25, -1.06, C.woodDark);
        b.sphere(0.07, x, 2.04, -1.06, C.brass);
      }
      b.box(1.56, 0.3, 0.06, 0, 1.3, -1.06, C.woodRed);
      b.cyl(0.2, 0.2, 0.05, 0, 1.55, -1.07, C.brass, 12);
    } else if (v === "floral") {
      for (let i = 0; i < 5; i++) b.sphere(0.045, -0.6 + i * 0.3, 1.02 + (i % 2) * 0.04, -1.06, i % 2 ? "#e86a8a" : "#f2c94c");
    } else if (v === "rumpled") {
      // the duvet pushed down into a heap at the foot, a pillow knocked askew
      b.sphere(0.36, 0.1, 0.72, 0.92, "#d8c8a8", [1.9, 0.32, 0.5], 10);
      b.sphere(0.22, 0.45, 0.72, -0.5, "#fbf6ec", [1, 0.3, 0.6]);
    } else if (v === "dusty") {
      // an old grey dust sheet over the whole bed (it hangs to just above the "under" clearance)
      b.box(1.66, 0.012, 2.16, 0, 0.687, 0, "#b8b0a4");
      for (const sx of [-1, 1]) b.box(0.012, 0.28, 2.16, sx * 0.83, 0.41, 0, "#aaa298");
      b.box(1.66, 0.28, 0.012, 0, 0.41, 1.08, "#aaa298");
      return;
    }
    if (!v) {
      // teddy bear on the pillow side, away from the "on" spot
      b.sphere(0.12, -0.5, 0.78, -0.62, "#a8784f", [1, 1.05, 0.9]);
      b.sphere(0.09, -0.5, 0.95, -0.64, "#b8885d");
      b.sphere(0.035, -0.57, 1.03, -0.64, "#8a5e3c");
      b.sphere(0.035, -0.43, 1.03, -0.64, "#8a5e3c");
      b.sphere(0.022, -0.5, 0.94, -0.56, C.ink);
    }
    out.parts.push({
      name: "blanket",
      pivot: [0, 0.66, -0.39],
      textured: { key: "quilt", geometry: new THREE.BoxGeometry(1.58, 0.05, 1.42).translate(0, 0.0, 0.71) }
    });
  },

  desk(obj, b, g, out) {
    const top = KINDS.desk.h; // 0.76
    // Guest Wing: a writing desk dresses like the reading desk, a dusty one like the attic table.
    const reading = obj.variant === "reading" || obj.variant === "writing";
    const attic = obj.variant === "attic" || obj.variant === "dusty";
    const dark = reading || attic;
    b.box(1.3, 0.05, 0.72, 0, top - 0.05, 0, attic ? "#4a3a30" : dark ? C.woodDark : C.woodLight);
    for (const [x, z] of [
      [-0.6, -0.31],
      [0.6, -0.31],
      [-0.6, 0.31],
      [0.6, 0.31]
    ] as const) {
      b.box(0.06, top - 0.05, 0.06, x, 0, z, attic ? "#3d2e24" : reading ? C.woodRed : C.wood);
    }
    // apron: bottom at 0.65 (clearance 0.64)
    const apron = attic ? "#3d2e24" : reading ? C.woodRed : C.wood;
    b.box(1.18, 0.06, 0.03, 0, 0.65, 0.33, apron);
    b.box(1.18, 0.06, 0.03, 0, 0.65, -0.33, apron);
    b.box(0.03, 0.06, 0.6, 0.6, 0.65, 0, apron);
    b.box(0.03, 0.06, 0.6, -0.6, 0.65, 0, apron);
    if (attic) {
      // an old table: dusty books, a candle and a crystal ball on the left half
      underShadow(b, 0.9, 0.5);
      b.box(0.3, 0.06, 0.22, -0.42, top, -0.1, "#5a3a4a", 0.2);
      b.box(0.28, 0.05, 0.2, -0.42, top + 0.06, -0.1, "#3a4a5a", -0.15);
      b.cyl(0.06, 0.07, 0.03, -0.12, top, 0.18, C.brass, 10);
      b.cyl(0.022, 0.024, 0.16, -0.12, top + 0.03, 0.18, "#f7efe0", 8);
      g.add(new THREE.ConeGeometry(0.02, 0.06, 6), C.flame, [-0.12, top + 0.22, 0.18]);
      out.lamps.push([-0.12, top + 0.24, 0.18]);
      b.cyl(0.06, 0.08, 0.04, -0.2, top, -0.18, C.brass, 10);
      g.sphere(0.08, -0.2, top + 0.12, -0.18, "#b8a6ff");
      return;
    }
    if (reading) {
      // open book, inkwell and a green banker's lamp on the left half
      b.box(0.34, 0.025, 0.24, -0.2, top, 0.08, "#efe4c8", 0.1);
      b.box(0.02, 0.03, 0.24, -0.2, top, 0.08, "#8a3a2a", 0.1);
      b.cyl(0.03, 0.035, 0.05, -0.05, top, -0.2, C.black, 8);
      b.boxAt(0.008, 0.16, 0.008, [-0.04, top + 0.1, -0.2], [0, 0, 0.35], "#f2efe6");
      b.cyl(0.07, 0.08, 0.03, -0.48, top, -0.12, C.brass);
      b.cyl(0.012, 0.012, 0.22, -0.48, top + 0.03, -0.12, C.brass);
      b.add(new THREE.CylinderGeometry(0.06, 0.06, 0.24, 12, 1, false, 0, Math.PI), "#2f7a4a", [-0.48, top + 0.27, -0.12], [0, 0, Math.PI / 2]);
      g.add(new THREE.BoxGeometry(0.2, 0.01, 0.05), C.bulb, [-0.48, top + 0.24, -0.1]);
      out.lamps.push([-0.48, top + 0.22, -0.1]);
    } else {
      b.box(0.26, 0.05, 0.18, -0.42, top, -0.1, "#c4504a");
      b.box(0.24, 0.05, 0.17, -0.42, top + 0.05, -0.1, "#4a78c4");
      b.box(0.22, 0.05, 0.16, -0.41, top + 0.1, -0.1, "#e2b04a");
      b.cyl(0.04, 0.035, 0.1, -0.15, top, -0.22, "#6b4fa0");
      b.box(0.01, 0.08, 0.01, -0.16, top + 0.08, -0.22, "#e0c060");
      b.box(0.01, 0.08, 0.01, -0.13, top + 0.08, -0.21, "#d05050");
      b.cyl(0.08, 0.09, 0.03, -0.45, top, 0.18, C.brass);
      b.boxAt(0.025, 0.36, 0.025, [-0.45, top + 0.2, 0.18], [0, 0, 0.25], C.brass);
      b.cone(0.13, 0.16, -0.5, top + 0.28, 0.18, "#3f7a5e", 14, true);
      g.sphere(0.05, -0.5, top + 0.31, 0.18, C.bulb);
      out.lamps.push([-0.5, top + 0.3, 0.18]);
    }
  },

  box(obj, b, _g, out) {
    const k = KINDS.box;
    const v = obj.variant ?? "books";
    const toy = v === "toy";
    const PAINT: Record<string, [string, string, string]> = {
      toy: [C.teal, C.sun, C.sun],
      abc: ["#d8403a", "#f2c94c", "#3a6ad0"],
      music: ["#5a2030", C.brass, "#4a1828"],
      attic: ["#c49a62", "#a87a44", "#c49a62"],
      books: ["#9a6b45", C.woodDark, C.woodLight],
      // Guest Wing: suitcases and trunks (same size and lid as the box, so "in" fits the same way)
      suitcase: ["#7a4a2c", "#4a2c18", "#84502e"],
      suitcasegreen: ["#3e6a4a", "#24402c", "#467a54"],
      trunk: ["#3e3a5a", C.brass, "#4a4468"],
      oldtrunk: ["#5a4a40", "#8a7a60", "#62524a"]
    };
    const [body, trim, lidColor] = PAINT[v] ?? PAINT.books;
    const { w, d } = k;
    const h = 0.6;
    b.box(w, 0.05, d, 0, 0, 0, body);
    b.box(w, h - 0.05, 0.05, 0, 0.05, d / 2 - 0.025, body);
    b.box(w, h - 0.05, 0.05, 0, 0.05, -d / 2 + 0.025, body);
    b.box(0.05, h - 0.05, d - 0.1, w / 2 - 0.025, 0.05, 0, body);
    b.box(0.05, h - 0.05, d - 0.1, -w / 2 + 0.025, 0.05, 0, body);
    // Trim follows the outside walls, leaving the chest cavity unobstructed.
    for (const [y, bandH] of [[0, 0.05], [h - 0.06, 0.04]]) {
      for (const sz of [-1, 1]) b.box(w, bandH, 0.012, 0, y, sz * (d / 2 + 0.006), trim);
      for (const sx of [-1, 1]) b.box(0.012, bandH, d, sx * (w / 2 + 0.006), y, 0, trim);
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.06, h, 0.06, (sx * w) / 2, 0, (sz * d) / 2, trim);
    b.box(w - 0.1, 0.006, d - 0.1, 0, 0.054, 0, "#1d1426");
    const front = (shape: THREE.BufferGeometry, color: string, x: number, y: number, rot = 0, scale: [number, number, number] = [1, 1, 1], relief = 0.004) =>
      b.add(shape, color, [x, y, d / 2 + relief], [0, 0, rot], scale, { flatAo: true });
    if (toy) {
      for (const [x, y, c] of [
        [-0.22, 0.32, "#ffe27a"],
        [0.05, 0.22, "#ff9fc4"],
        [0.25, 0.38, "#a8e6ff"]
      ] as const) {
        front(new THREE.CircleGeometry(0.075, 5), c, x, y, Math.PI / 2);
      }
    } else if (v === "abc") {
      // painted letter blocks across the front of the toy box
      const letters = ["#f2c94c", "#5cc46a", "#3a6ad0"];
      letters.forEach((c, i) => {
        const x = -0.26 + i * 0.26;
        front(new THREE.PlaneGeometry(0.17, 0.17), c, x, 0.3, 0.12 * (i - 1));
        front(new THREE.PlaneGeometry(0.09, 0.09), "#fff6e0", x, 0.3, 0.12 * (i - 1), [1, 1, 1], 0.008);
      });
    } else if (v === "music") {
      // gold notes on a dark red music box
      for (const [x, y] of [
        [-0.2, 0.26],
        [0.12, 0.34]
      ] as const) {
        front(new THREE.CircleGeometry(0.045, 10), C.brass, x, y, 0, [1.3, 1, 1]);
        front(new THREE.PlaneGeometry(0.018, 0.16), C.brass, x + 0.05, y + 0.08, 0, [1, 1, 1], 0.008);
      }
      front(new THREE.PlaneGeometry(0.34, 0.02), C.brass, -0.04, 0.42, 0, [1, 1, 1], 0.012);
    } else if (v === "suitcase" || v === "suitcasegreen") {
      // leather straps over the front, a travel label
      for (const x of [-0.22, 0.22]) front(new THREE.PlaneGeometry(0.06, h - 0.08), "#3a2414", x, 0.3);
      front(new THREE.PlaneGeometry(0.14, 0.09), "#f2ead2", 0, 0.24, 0.1);
    } else if (v === "trunk" || v === "oldtrunk") {
      // wooden ribs and a brass lock plate
      for (const x of [-0.3, 0, 0.3]) front(new THREE.PlaneGeometry(0.035, h - 0.08), trim, x, 0.3);
    } else if (v === "attic") {
      // a cardboard box: tape and a red label
      front(new THREE.PlaneGeometry(0.06, h - 0.1), "#e0c48a", 0, 0.3);
      front(new THREE.PlaneGeometry(0.22, 0.12), "#c0403a", 0.24, 0.22);
    } else {
      // plank lines and rope handles: a box of books
      for (const y of [0.22, 0.4]) {
        for (const sz of [-1, 1]) b.box(w - 0.04, 0.015, 0.012, 0, y, sz * (d / 2 + 0.006), C.woodDark);
        for (const sx of [-1, 1]) b.box(0.012, 0.015, d - 0.04, sx * (w / 2 + 0.006), y, 0, C.woodDark);
      }
      // books stacked beside it
      b.box(0.24, 0.05, 0.18, w / 2 + 0.2, 0, 0.1, "#3e6ea8", 0.2);
      b.box(0.22, 0.05, 0.17, w / 2 + 0.2, 0.05, 0.1, "#a83e3e", -0.1);
    }
    for (const sx of [-1, 1]) {
      for (const z of [-0.08, 0.08]) b.box(0.035, 0.02, 0.025, sx * (w / 2 + 0.018), 0.37, z, trim);
      b.box(0.035, 0.025, 0.185, sx * (w / 2 + 0.018), 0.39, 0, trim);
    }
    b.box(0.09, 0.085, 0.018, 0, h - 0.085, d / 2 + 0.012, C.brass);
    const lid = new PartBuilder();
    lid.box(w, 0.06, d, 0, 0, d / 2 + 0.02, lidColor);
    lid.box(0.09, 0.05, 0.018, 0, 0, d + 0.032, C.brass);
    out.parts.push({ name: "lid", pivot: [0, h, -d / 2 - 0.02], geometry: lid.build() });
  },

  window(_obj, b, _g, out) {
    const frame = "#e9dcc4";
    b.box(1.5, 0.1, 0.1, 0, 0.85, 0.05, frame);
    b.box(1.5, 0.1, 0.1, 0, 2.3, 0.05, frame);
    b.box(0.1, 1.55, 0.1, -0.7, 0.85, 0.05, frame);
    b.box(0.1, 1.55, 0.1, 0.7, 0.85, 0.05, frame);
    b.box(0.05, 1.35, 0.06, 0, 0.95, 0.04, frame);
    b.box(1.3, 0.05, 0.06, 0, 1.6, 0.04, frame);
    b.box(1.7, 0.06, 0.22, 0, 0.8, 0.11, "#d8c8a8");
    b.cylAt(0.025, 2.0, [0, 2.55, 0.12], [0, 0, Math.PI / 2], C.brass);
    b.sphere(0.05, -1.0, 2.55, 0.12, C.brass);
    b.sphere(0.05, 1.0, 2.55, 0.12, C.brass);
    // Real glass in a real hole (rooms.ts WINDOW_GLASS), at the middle of the wall: the model's
    // origin is the inner wall face, the wall is 0.2 thick. The garden and rain are behind it.
    out.textured.push({ key: "glass", geometry: plane(1.3, 1.35), position: [0, 1.625, -0.1] });
    // A plain frame on the outside face, so the hole looks finished from the garden.
    b.box(1.5, 0.1, 0.04, 0, 0.85, -0.22, frame);
    b.box(1.5, 0.1, 0.04, 0, 2.3, -0.22, frame);
    b.box(0.1, 1.55, 0.04, -0.7, 0.85, -0.22, frame);
    b.box(0.1, 1.55, 0.04, 0.7, 0.85, -0.22, frame);
    // tied-back curtains: outer edge at +-0.93 (KINDS.window.by.edge)
    for (const side of [-1, 1] as const) {
      const c = new PartBuilder();
      c.box(0.2, 1.75, 0.07, 0, -1.75, 0, C.velvet);
      c.box(0.21, 0.08, 0.09, 0, -1.05, 0, C.brass);
      c.box(0.04, 1.75, 0.075, side * 0.05, -1.75, 0, C.velvetDark);
      out.parts.push({ name: side < 0 ? "curtainL" : "curtainR", pivot: [side * 0.83, 2.55, 0.12], geometry: c.build() });
    }
  },

  nightstand(_obj, b, g, out) {
    b.box(0.5, 0.5, 0.45, 0, 0.05, 0, C.wood);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.05, 0.05, 0.05, sx * 0.2, 0, sz * 0.17, C.woodDark);
    b.box(0.42, 0.16, 0.02, 0, 0.32, 0.23, C.woodLight);
    b.sphere(0.025, 0, 0.4, 0.25, C.brass);
    b.cyl(0.08, 0.1, 0.04, 0, 0.55, 0, C.brass);
    b.cyl(0.02, 0.02, 0.28, 0, 0.59, 0, C.brass);
    b.cone(0.16, 0.2, 0, 0.82, 0, C.shade, 16, true);
    g.sphere(0.06, 0, 0.88, 0, C.bulb);
    out.lamps.push([0, 0.9, 0]);
  },

  wardrobe(obj, b) {
    const { w, h, d } = KINDS.wardrobe;
    const body = obj.variant === "light" ? "#b08458" : obj.variant === "dusty" ? "#6a5a52" : C.woodRed;
    b.box(w, h - 0.1, d, 0, 0.1, 0, body);
    // a dust sheet thrown over the top of the forgotten room's wardrobe
    if (obj.variant === "dusty") b.box(w + 0.04, 0.5, d + 0.04, 0, h - 0.48, 0, "#b8b0a4");
    b.box(w + 0.08, 0.1, d + 0.06, 0, h - 0.02, 0, C.woodDark);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.08, 0.1, 0.08, sx * (w / 2 - 0.08), 0, sz * (d / 2 - 0.08), C.woodDark);
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
    b.box(0.4, 0.03, 0.4, 0, 0.47, 0.01, "#a0405a");
  },

  toys(_obj, b) {
    b.sphere(0.13, -0.15, 0.13, 0.05, "#e85a5a");
    b.sphere(0.131, -0.15, 0.13, 0.05, "#ffffff", [1, 0.25, 1]);
    b.box(0.14, 0.14, 0.14, 0.16, 0, -0.08, "#4aa3e8");
    b.box(0.14, 0.14, 0.14, 0.2, 0, 0.1, "#f2c94c", 0.4);
    b.box(0.12, 0.12, 0.12, 0.18, 0.14, 0.0, "#6fcf73", 0.2);
  },

  rug(obj, _b, _g, out) {
    const { w, d } = KINDS.rug;
    const keys: Record<string, TexKey> = {
      library: "rugLibrary", music: "rugMusic", attic: "rugAttic",
      guest: "rugDining", travel: "rugLibrary", garden: "rugPlay", antique: "rugMusic"
    };
    out.textured.push({
      key: keys[obj.variant ?? ""] ?? "rugBedroom",
      geometry: plane(w, d),
      position: [0, 0.006, 0],
      rotation: [-Math.PI / 2, 0, 0]
    });
  },

  bookpile(_obj, b) {
    b.box(0.32, 0.06, 0.24, 0, 0, 0, "#7a4aa0", 0.2);
    b.box(0.3, 0.06, 0.22, 0.02, 0.06, 0, "#c46a2c", -0.15);
    b.box(0.28, 0.06, 0.2, -0.01, 0.12, 0, "#2f6f6a", 0.3);
    b.box(0.26, 0.05, 0.2, 0.0, 0.18, 0.02, "#d9d2c0", -0.1);
  }
};
