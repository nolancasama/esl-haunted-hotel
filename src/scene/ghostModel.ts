import * as THREE from "three";
import { PartBuilder } from "./partBuilder";

/** Shared ghost geometry. Origin at the bottom of the hem; height ~0.78 (GHOST_H). */

let bodyGeo: THREE.BufferGeometry | null = null;
let faceGeo: THREE.BufferGeometry | null = null;
let armGeo: THREE.BufferGeometry | null = null;

export const DOME_Y = 0.48;
export const DOME_R = 0.3;

export function ghostBody(): THREE.BufferGeometry {
  if (bodyGeo) return bodyGeo;
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(0.32, 0.0),
    new THREE.Vector2(0.316, 0.05),
    new THREE.Vector2(0.304, 0.14),
    new THREE.Vector2(0.297, 0.28),
    new THREE.Vector2(0.3, DOME_Y - 0.02)
  ];
  for (let i = 0; i <= 12; i++) {
    const a = (i / 12) * (Math.PI / 2);
    pts.push(new THREE.Vector2(Math.max(0.0001, DOME_R * Math.cos(a)), DOME_Y + DOME_R * Math.sin(a)));
  }
  const geo = new THREE.LatheGeometry(pts, 36);
  // Scalloped hem: lift the edge between six "toes".
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    if (y < 0.18) {
      const phi = Math.atan2(p.getX(i), p.getZ(i));
      const k = 1 - y / 0.18;
      p.setY(i, y + 0.075 * (1 - Math.abs(Math.cos(3 * phi))) * k * k);
    }
  }
  geo.computeVertexNormals();
  bodyGeo = geo;
  return geo;
}

/** Sphere segment just outside the dome, facing +z, carrying the face texture. */
export function ghostFace(): THREE.BufferGeometry {
  if (faceGeo) return faceGeo;
  const L = 1.9;
  faceGeo = new THREE.SphereGeometry(DOME_R + 0.004, 24, 12, Math.PI / 2 - L / 2, L, 0.55, 1.02).translate(0, DOME_Y, 0);
  return faceGeo;
}

export function ghostArm(): THREE.BufferGeometry {
  if (armGeo) return armGeo;
  armGeo = new THREE.SphereGeometry(0.085, 10, 8).scale(1, 0.75, 0.75);
  return armGeo;
}

export type Accessory = "nightcap" | "bib" | "mask" | "tophat" | "bowtie";

const accCache = new Map<Accessory, THREE.BufferGeometry>();

/** Vertex-coloured accessory geometry in ghost-local space. */
export function accessoryGeometry(kind: Accessory): THREE.BufferGeometry {
  const hit = accCache.get(kind);
  if (hit) return hit;
  const b = new PartBuilder(0);
  switch (kind) {
    case "nightcap": {
      // A floppy cap tilted to the ghost's right; everything is placed along the tilted axis.
      const axis = new THREE.Vector3(Math.sin(0.5), Math.cos(0.5), 0);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis);
      const base = new THREE.Vector3(0, 0.66, 0);
      const H = 0.48;
      const at = (k: number) => base.clone().addScaledVector(axis, H * k).toArray() as [number, number, number];
      const flat = { flatAo: true };
      b.add(new THREE.ConeGeometry(0.225, H, 16).applyQuaternion(q), "#3d63c9", at(0.5), [0, 0, 0], [1, 1, 1], flat);
      b.add(new THREE.TorusGeometry(0.21, 0.045, 8, 20).rotateX(Math.PI / 2).applyQuaternion(q), "#f4f1ff", at(0), [0, 0, 0], [1, 1, 1], flat);
      for (const k of [0.36, 0.64]) {
        const r = 0.225 * (1 - k) + 0.012;
        b.add(new THREE.TorusGeometry(r, 0.018, 6, 16).rotateX(Math.PI / 2).applyQuaternion(q), "#8fb0ff", at(k), [0, 0, 0], [1, 1, 1], flat);
      }
      b.add(new THREE.SphereGeometry(0.075, 10, 8), "#f4f1ff", at(1.02), [0, 0, 0], [1, 1, 1], flat);
      break;
    }
    case "bib": {
      b.add(new THREE.CircleGeometry(0.19, 18, Math.PI, Math.PI), "#fffaf0", [0, 0.43, 0.292], [-0.12, 0, 0], [1, 1, 1], { flatAo: true });
      b.add(new THREE.CircleGeometry(0.035, 10), "#ff7a6b", [0, 0.36, 0.305], [-0.12, 0, 0], [1, 1, 1], { flatAo: true });
      // fork in the right hand
      b.add(new THREE.BoxGeometry(0.025, 0.22, 0.025), "#d8dde8", [0.4, 0.42, 0.08], [0, 0, -0.35], [1, 1, 1], { flatAo: true });
      for (const dx of [-0.03, 0, 0.03]) {
        b.add(new THREE.BoxGeometry(0.012, 0.07, 0.012), "#d8dde8", [0.44 + dx, 0.55, 0.08], [0, 0, -0.35], [1, 1, 1], { flatAo: true });
      }
      break;
    }
    case "tophat": {
      const rot: [number, number, number] = [0, 0, 0.28];
      b.add(new THREE.CylinderGeometry(0.15, 0.15, 0.26, 16), "#2e1f4f", [-0.06, 0.88, 0], rot, [1, 1, 1], { flatAo: true });
      b.add(new THREE.CylinderGeometry(0.155, 0.155, 0.06, 16), "#ff6fb5", [-0.035, 0.8, 0], rot, [1, 1, 1], { flatAo: true });
      b.add(new THREE.CylinderGeometry(0.25, 0.25, 0.025, 20), "#2e1f4f", [-0.02, 0.75, 0], rot, [1, 1, 1], { flatAo: true });
      break;
    }
    case "bowtie": {
      b.add(new THREE.ConeGeometry(0.075, 0.13, 4), "#ff5c8a", [-0.08, 0.4, 0.29], [0, 0, Math.PI / 2], [1, 1, 0.5], { flatAo: true });
      b.add(new THREE.ConeGeometry(0.075, 0.13, 4), "#ff5c8a", [0.08, 0.4, 0.29], [0, 0, -Math.PI / 2], [1, 1, 0.5], { flatAo: true });
      b.add(new THREE.SphereGeometry(0.035, 8, 6), "#ff86a8", [0, 0.4, 0.3], [0, 0, 0], [1, 1, 1], { flatAo: true });
      break;
    }
    case "mask":
      // drawn into the face texture
      b.add(new THREE.SphereGeometry(0.001, 3, 2), "#000000", [0, 0, 0]);
      break;
  }
  const geo = b.build();
  accCache.set(kind, geo);
  return geo;
}
