import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { DOORS, ROOMS, WALL_H, WALL_LINES, type WallLine, type WallPiece } from "../game/world/rooms";
import { WORLD } from "../game/world/world";
import { rt } from "../game/runtime";
import { floorMaterial, wallMaterial, WALL_CAP } from "./materials";
import { Beacon, Door } from "./Doors";
import { GhostBoard } from "./GhostBoard";
import { Outside } from "./Outside";
import { lineFade } from "./wallFade";
import type { RoomId } from "../game/types";

const TILE = 1.6;

/** Box geometry for a wall piece with world-anchored wallpaper UVs on both big faces. */
function wallGeometry(piece: WallPiece): THREE.BoxGeometry {
  const r = piece.rect;
  const w = r.x1 - r.x0;
  const d = r.z1 - r.z0;
  const h = piece.y1 - piece.y0;
  const geo = new THREE.BoxGeometry(w, h, d);
  const cx = (r.x0 + r.x1) / 2;
  const cz = (r.z0 + r.z1) / 2;
  const cy = (piece.y0 + piece.y1) / 2;
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const along = piece.line.axis === "x";
  // groups: 0 px, 1 nx, 2 py, 3 ny, 4 pz, 5 nz
  const sides = along ? [4, 5] : [0, 1];
  for (const group of geo.groups) {
    const index = geo.groups.indexOf(group);
    if (!sides.includes(index)) continue;
    for (let i = group.start; i < group.start + group.count; i++) {
      const vi = geo.index ? geo.index.getX(i) : i;
      const wx = cx + pos.getX(vi);
      const wz = cz + pos.getZ(vi);
      const wy = cy + pos.getY(vi);
      uv.setXY(vi, (along ? wx : wz) / TILE, wy / WALL_H);
    }
  }
  uv.needsUpdate = true;
  return geo;
}

interface WallView {
  piece: WallPiece;
  geo: THREE.BoxGeometry;
  mats: THREE.MeshLambertMaterial[];
  pos: [number, number, number];
}

/**
 * Cutaway walls: a whole wall line fades when the camera is on the other
 * side of it from what we must see (the player, or the close-up target) and
 * the sight line crosses it below the wall top.
 */
function lineOccludes(line: WallLine, cam: THREE.Vector3Like, points: THREE.Vector3Tuple[]): boolean {
  const axisCoord = (p: { x: number; z: number }) => (line.axis === "x" ? p.z : p.x);
  const alongCoord = (p: { x: number; z: number }) => (line.axis === "x" ? p.x : p.z);
  const camSide = axisCoord(cam) - line.at;
  for (const [px, py, pz] of points) {
    const p = { x: px, z: pz };
    const pSide = axisCoord(p) - line.at;
    if (camSide * pSide >= 0) continue; // same side: cannot block
    const t = camSide / (camSide - pSide);
    const along = alongCoord(cam) + (alongCoord(p) - alongCoord(cam)) * t;
    const y = cam.y + (py - cam.y) * t;
    if (along > line.from - 0.9 && along < line.to + 0.9 && y < WALL_H + 0.45) return true;
  }
  return false;
}

function Walls() {
  const views = useMemo<WallView[]>(() => {
    const cap = () => new THREE.MeshLambertMaterial({ color: WALL_CAP, transparent: true });
    return WORLD.walls.map((piece) => {
      const along = piece.line.axis === "x";
      const neg = wallMaterial(piece.line.neg);
      const posM = wallMaterial(piece.line.pos);
      const end = cap();
      const top = cap();
      // BoxGeometry material order: px, nx, py, ny, pz, nz
      const mats = along ? [end, end, top, top, posM, neg] : [posM, neg, top, top, end, end];
      const r = piece.rect;
      return {
        piece,
        geo: wallGeometry(piece),
        mats,
        pos: [(r.x0 + r.x1) / 2, (piece.y0 + piece.y1) / 2, (r.z0 + r.z1) / 2]
      };
    });
  }, []);
  const meshes = useRef<Array<THREE.Mesh | null>>([]);

  useFrame((_, dt) => {
    const cam = rt.camera.pos;
    const t = rt.camera.target;
    const points: THREE.Vector3Tuple[] =
      rt.camera.mode === "follow"
        ? [
            [rt.player.x, 1.2, rt.player.z],
            [rt.player.x, 0.2, rt.player.z]
          ]
        : [
            [t.x, t.y, t.z],
            [t.x, 0.1, t.z]
          ];
    const k = Math.min(1, dt * 7);
    for (const line of WALL_LINES) {
      const target = lineOccludes(line, cam, points) ? 0 : 1;
      let o = lineFade.get(line.id) ?? 1;
      o += (target - o) * k;
      if (Math.abs(o - target) < 0.01) o = target;
      lineFade.set(line.id, o);
    }
    views.forEach((v, i) => {
      const o = lineFade.get(v.piece.line.id) ?? 1;
      const mesh = meshes.current[i];
      if (!mesh) return;
      mesh.visible = o > 0.02;
      for (const m of v.mats) {
        m.opacity = o;
        m.depthWrite = o > 0.98;
      }
    });
  });

  return (
    <group>
      {views.map((v, i) => (
        <mesh
          key={v.piece.id}
          ref={(m) => {
            meshes.current[i] = m;
          }}
          geometry={v.geo}
          material={v.mats}
          position={v.pos}
        />
      ))}
    </group>
  );
}

function Floors() {
  const rooms = Object.values(ROOMS).filter(Boolean) as NonNullable<(typeof ROOMS)[RoomId]>[];
  return (
    <group>
      {rooms.map((room) => {
        const b = room.bounds;
        const w = b.x1 - b.x0;
        const d = b.z1 - b.z0;
        return (
          <mesh
            key={room.id}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[(b.x0 + b.x1) / 2, 0, (b.z0 + b.z1) / 2]}
            material={floorMaterial(room.id, w, d)}
          >
            <planeGeometry args={[w, d]} />
          </mesh>
        );
      })}
    </group>
  );
}

export function Hotel() {
  return (
    <group>
      <Floors />
      <Walls />
      {DOORS.map((d) => (
        <Door key={d.id} door={d} />
      ))}
      <Beacon />
      <GhostBoard />
      <Outside />
    </group>
  );
}
