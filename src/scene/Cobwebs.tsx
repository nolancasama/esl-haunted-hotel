import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { WALL_H, WALL_LINES, WALL_T } from "../game/world/rooms";
import { lineFade } from "./wallFade";

/** Upper room corners that get a web: [x, z, direction along x, direction along z]. */
const CORNERS: Array<[number, number, number, number]> = [
  [-8, -11, 1, 1], // bedroom NW
  [0, -11, -1, 1], // bedroom NE
  [8, -11, -1, 1], // dining NE
  [0, -4, 1, -1], // dining SW
  [-8, 11, 1, -1], // library SW
  [0, 4, -1, 1], // library NE
  [8, 11, -1, -1], // storage SE
  [0, 11, 1, -1], // storage SW
  [-8, -4, 1, 1], // lobby NW
  [8, 4, -1, -1] // lobby SE
];

/** One web hanging in a corner: radial threads plus a few sagging rings. */
function webGeometry(size: number, seed: number): THREE.BufferGeometry {
  let s = seed;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  const pts: number[] = [];
  const threads = 7;
  // Anchors run from one wall (+x), down past the corner, to the other wall (+z);
  // the middle ones bow out into the room so the web spans the corner.
  const anchor = (k: number, r: number): THREE.Vector3 => {
    const a = (k / (threads - 1)) * Math.PI; // 0..pi
    const bow = 0.25 * Math.sin(a) * r;
    const x = Math.max(Math.cos(a), 0) * r + bow;
    const z = Math.max(-Math.cos(a), 0) * r + bow;
    const y = -Math.sin(a) * r * 0.85;
    return new THREE.Vector3(x, y, z);
  };
  for (let k = 0; k < threads; k++) {
    const p = anchor(k, size * (0.85 + rnd() * 0.25));
    pts.push(0, 0, 0, p.x, p.y, p.z);
  }
  for (const f of [0.3, 0.52, 0.74, 0.95]) {
    for (let k = 0; k < threads - 1; k++) {
      const a = anchor(k, size * f);
      const b = anchor(k + 1, size * f);
      const sag = 0.03 * f;
      pts.push(a.x, a.y - sag, a.z, b.x, b.y - sag, b.z);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  return g;
}

/** Walls a corner touches (the web vanishes if either fades). */
function linesAt(x: number, z: number): string[] {
  return WALL_LINES.filter((l) => {
    if (l.axis === "x") return Math.abs(l.at - z) < 0.01 && x >= l.from - 0.01 && x <= l.to + 0.01;
    return Math.abs(l.at - x) < 0.01 && z >= l.from - 0.01 && z <= l.to + 0.01;
  }).map((l) => l.id);
}

export function Cobwebs() {
  const mat = useMemo(
    () => new THREE.LineBasicMaterial({ color: "#ddd6f2", transparent: true, opacity: 0.38, depthWrite: false }),
    []
  );
  const webs = useMemo(
    () =>
      CORNERS.map(([x, z, dx, dz], i) => ({
        geo: webGeometry(0.75 + (i % 3) * 0.12, i * 97 + 13),
        pos: [x + dx * (WALL_T / 2 + 0.01), WALL_H - 0.02, z + dz * (WALL_T / 2 + 0.01)] as [number, number, number],
        scale: [dx, 1, dz] as [number, number, number],
        lines: linesAt(x, z)
      })),
    []
  );
  const refs = useRef<Array<THREE.LineSegments | null>>([]);
  useFrame(() => {
    webs.forEach((w, i) => {
      const r = refs.current[i];
      if (r) r.visible = Math.min(...w.lines.map((id) => lineFade.get(id) ?? 1)) > 0.5;
    });
  });
  return (
    <group>
      {webs.map((w, i) => (
        <lineSegments key={i} ref={(r) => void (refs.current[i] = r)} geometry={w.geo} material={mat} position={w.pos} scale={w.scale} />
      ))}
    </group>
  );
}
