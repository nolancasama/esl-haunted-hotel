import * as THREE from "three";
import type { RoomId } from "../game/types";
import { floorTexture, glowTexture, quiltTexture, rugTexture, nightWindowTexture, rainTexture, clockFaceTexture, wallTexture, type FloorStyle, type WallStyle } from "./textures";
import type { TexKey } from "./furnitureModels";

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
    case "night":
      m = new THREE.MeshBasicMaterial({ map: nightWindowTexture(), toneMapped: false });
      break;
    case "rain": {
      const t = rainTexture().clone();
      t.needsUpdate = true;
      m = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, opacity: 0.8, toneMapped: false });
      break;
    }
    case "clockface":
      m = new THREE.MeshLambertMaterial({ map: clockFaceTexture() });
      break;
  }
  texMats[key] = m;
  return m;
}

/** Rain streak textures scroll; window glass flashes with lightning. */
export function animateSharedMaterials(time: number, flash: number) {
  const rain = texMats.rain as THREE.MeshBasicMaterial | undefined;
  if (rain?.map) rain.map.offset.set(time * 0.15, time * 1.4);
  const night = texMats.night as THREE.MeshBasicMaterial | undefined;
  if (night) night.color.setScalar(1 + flash * 2.2);
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

export function resetMaterialCache() {
  texMats = {};
}
