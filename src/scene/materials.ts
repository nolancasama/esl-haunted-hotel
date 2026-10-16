import * as THREE from "three";
import type { RoomId } from "../game/types";
import {
  clockFaceTexture,
  floorTexture,
  glowTexture,
  nightWindowTexture,
  paintingTexture,
  quiltTexture,
  rainTexture,
  rugTexture,
  runnerTexture,
  wallTexture,
  type FloorStyle,
  type WallStyle
} from "./textures";
import type { TexKey } from "./models";

export const ROOM_STYLE: Record<RoomId, { wall: WallStyle; floor: FloorStyle }> = {
  bedroom: {
    wall: { paper: "#3d4f9c", pattern: "#4b60b4", kind: "stripes", wainscot: "#4a3352", trim: "#2b1c34" },
    floor: { base: "#7a5038", seam: "#3a2416", seed: 3 }
  },
  lobby: {
    wall: { paper: "#4e2f6e", pattern: "#62408a", kind: "damask", wainscot: "#4c2a36", trim: "#2a1620" },
    floor: { base: "#5e3b2b", seam: "#2e1b13", seed: 5 }
  },
  dining: {
    wall: { paper: "#245a57", pattern: "#c4a35a", kind: "dots", wainscot: "#40292a", trim: "#24161a" },
    floor: { base: "#6c4632", seam: "#331f18", seed: 8 }
  },
  storage: {
    wall: { paper: "#5a5363", pattern: "#3a3442", kind: "bricks", wainscot: "#4a3c33", trim: "#2a221d" },
    floor: { base: "#5c4837", seam: "#2b2018", seed: 9 }
  },
  library: {
    wall: { paper: "#6a2a3c", pattern: "#7e364a", kind: "damask", wainscot: "#3a2522", trim: "#221413" },
    floor: { base: "#573927", seam: "#2a1a12", seed: 12 }
  },
  landing: {
    wall: { paper: "#2f3a72", pattern: "#3f4d90", kind: "damask", wainscot: "#3a2a44", trim: "#1f1628" },
    floor: { base: "#5c3c2c", seam: "#2c1b14", seed: 21 }
  },
  playroom: {
    wall: { paper: "#35588a", pattern: "#e8cf6a", kind: "stars", wainscot: "#5a3f6e", trim: "#2f2140" },
    floor: { base: "#8a6242", seam: "#3e2818", seed: 14 }
  },
  bathroom: {
    wall: { paper: "#3f8290", pattern: "#2b6470", kind: "tiles", wainscot: "#d6e4e8", trim: "#2a4a52" },
    floor: { base: "#e4dfd2", seam: "#4b7480", seed: 2, tiles: true }
  },
  music: {
    wall: { paper: "#5a2b5a", pattern: "#743b74", kind: "stripes", wainscot: "#3a2232", trim: "#21121d" },
    floor: { base: "#6a4430", seam: "#331f16", seed: 17 }
  },
  attic: {
    wall: { paper: "#5e4532", pattern: "#3a2a1e", kind: "planks", wainscot: "#5e4532", trim: "#2e2118" },
    floor: { base: "#6b5138", seam: "#2f2216", seed: 23 }
  }
};

export const EXTERIOR = "#2a2238";
export const WALL_CAP = "#2b1d2a";

/** Shared vertex-coloured furniture material (non-searchable objects). */
export const furnitureMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });

/** Unlit glowing bits: bulbs, candle flames. */
export const glowPartMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });

let texMats: Partial<Record<TexKey, THREE.Material>> = {};

export function texturedMaterial(key: TexKey): THREE.Material {
  const hit = texMats[key];
  if (hit) return hit;
  let m: THREE.Material;
  switch (key) {
    case "quilt": {
      const t = quiltTexture();
      m = new THREE.MeshLambertMaterial({ map: t });
      break;
    }
    case "rugBedroom":
      m = new THREE.MeshLambertMaterial({ map: rugTexture("#6c3f8f", "#e0b45a") });
      break;
    case "rugDining":
      m = new THREE.MeshLambertMaterial({ map: rugTexture("#8a2f3a", "#d9b25a") });
      break;
    case "rugLibrary":
      m = new THREE.MeshLambertMaterial({ map: rugTexture("#24406e", "#c9a24a") });
      break;
    case "rugPlay":
      m = new THREE.MeshLambertMaterial({ map: rugTexture("#3f8f7a", "#f2c14e") });
      break;
    case "rugMusic":
      m = new THREE.MeshLambertMaterial({ map: rugTexture("#8a2f62", "#e0b45a") });
      break;
    case "rugAttic":
      m = new THREE.MeshLambertMaterial({ map: rugTexture("#5a4a6a", "#9a8a6a") });
      break;
    case "bathmat":
      m = new THREE.MeshLambertMaterial({ map: rugTexture("#f2f2ee", "#6fc3cf") });
      break;
    case "runner":
      m = new THREE.MeshLambertMaterial({ map: runnerTexture() });
      break;
    case "paintingA":
      m = new THREE.MeshLambertMaterial({ map: paintingTexture("family") });
      break;
    case "paintingB":
      m = new THREE.MeshLambertMaterial({ map: paintingTexture("hotel") });
      break;
    case "night":
      m = new THREE.MeshBasicMaterial({ map: nightWindowTexture(), toneMapped: false });
      break;
    case "rain": {
      const t = rainTexture().clone();
      t.needsUpdate = true;
      m = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, opacity: 0.8, toneMapped: false });
      break;
    }
    case "glass":
      // Faint cool glass over the real garden and rain; drawn after the rain (Furniture.tsx).
      m = new THREE.MeshBasicMaterial({ color: GLASS, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
      break;
    case "clockface":
      m = new THREE.MeshLambertMaterial({ map: clockFaceTexture() });
      break;
  }
  texMats[key] = m;
  return m;
}

const DAWN_GLASS = new THREE.Color(2.2, 1.7, 1.2);
const GLASS = new THREE.Color("#a9bfe8");
const FLASH = new THREE.Color("#f4f0ff");
const DAWN_TINT = new THREE.Color("#ffe2b8");

/** Rain streak textures scroll; window glass flashes with lightning and warms at sunrise. */
export function animateSharedMaterials(time: number, flash: number, sun = 0) {
  const rain = texMats.rain as THREE.MeshBasicMaterial | undefined;
  if (rain?.map) rain.map.offset.set(time * 0.15, time * 1.4);
  if (rain) rain.opacity = 0.8 * (1 - sun);
  const night = texMats.night as THREE.MeshBasicMaterial | undefined;
  if (night) night.color.setScalar(1 + flash * 2.2).lerp(DAWN_GLASS, sun);
  // Real windows: lightning lights up the glass; at dawn it warms and nearly vanishes.
  const glass = texMats.glass as THREE.MeshBasicMaterial | undefined;
  if (glass) {
    glass.color.copy(GLASS).lerp(FLASH, Math.min(1, flash)).lerp(DAWN_TINT, sun);
    glass.opacity = 0.1 + flash * 0.45 - sun * 0.04;
  }
}

export function floorMaterial(room: RoomId, w: number, d: number): THREE.MeshLambertMaterial {
  const tex = floorTexture(ROOM_STYLE[room].floor).clone();
  tex.needsUpdate = true;
  tex.repeat.set(w / 2.2, d / 2.2);
  return new THREE.MeshLambertMaterial({ map: tex });
}

export function wallMaterial(room: RoomId | null): THREE.MeshLambertMaterial {
  if (!room) return new THREE.MeshLambertMaterial({ color: EXTERIOR, transparent: true });
  return new THREE.MeshLambertMaterial({ map: wallTexture(ROOM_STYLE[room].wall), transparent: true });
}

export function glowSpriteMaterial(color: THREE.ColorRepresentation, opacity = 0.6): THREE.SpriteMaterial {
  return new THREE.SpriteMaterial({
    map: glowTexture(),
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  });
}
