import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { DOORS, FLOOR_HOLES, FLOOR_Y, ROOMS, WALL_H, WALL_LINES, WALL_T, type WallLine, type WallPiece } from "../game/world/rooms";
import { WORLD } from "../game/world/world";
import { rt } from "../game/runtime";
import { EXTERIOR, floorMaterial, wallMaterial, WALL_CAP } from "./materials";
import { PartBuilder } from "./partBuilder";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Beacon, Door } from "./Doors";
import { GhostBoard } from "./GhostBoard";
import { Outside } from "./Outside";
import { lineFade, nearGuestWing } from "./wallFade";
import type { Rect, RoomId } from "../game/types";
import { director } from "../game/director";
import { isCanvasTap } from "../input/tap";
import { getGame } from "../game/store";
import { getHideSeek } from "../game/hideSeek/session";

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
  const base = FLOOR_Y[piece.line.floor];
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
      uv.setXY(vi, (along ? wx : wz) / TILE, (wy - base) / WALL_H);
    }
  }
  uv.needsUpdate = true;
  return geo;
}

interface WallView {
  line: WallLine;
  geo: THREE.BufferGeometry;
  mats: THREE.MeshLambertMaterial[];
}

type FaceClass = "cap" | "pos" | "neg";

/** Copy vertices [start, start + count) of a non-indexed geometry. */
function sliceVertices(g: THREE.BufferGeometry, start: number, count: number): THREE.BufferGeometry {
  const out = new THREE.BufferGeometry();
  for (const name of ["position", "normal", "uv"]) {
    const a = g.getAttribute(name) as THREE.BufferAttribute;
    out.setAttribute(name, new THREE.BufferAttribute(a.array.slice(start * a.itemSize, (start + count) * a.itemSize), a.itemSize));
  }
  return out;
}

/**
 * One wall line as a single mesh: its pieces (between doors and windows, lintels, sills) merged,
 * with three material groups (end/top caps, the face towards +axis, the face towards -axis).
 * A line fades as a whole in the cutaway view, so this draws the same picture in 3 draw calls
 * instead of up to 6 per piece.
 */
function lineView(line: WallLine, pieces: WallPiece[], cap: THREE.MeshLambertMaterial): WallView {
  const along = line.axis === "x";
  // BoxGeometry groups: px, nx, py, ny, pz, nz
  const classes: FaceClass[] = along ? ["cap", "cap", "cap", "cap", "pos", "neg"] : ["pos", "neg", "cap", "cap", "cap", "cap"];
  const parts: Record<FaceClass, THREE.BufferGeometry[]> = { cap: [], pos: [], neg: [] };
  for (const piece of pieces) {
    const r = piece.rect;
    const box = wallGeometry(piece);
    box.translate((r.x0 + r.x1) / 2, (piece.y0 + piece.y1) / 2, (r.z0 + r.z1) / 2);
    const flat = box.toNonIndexed();
    flat.groups.forEach((group, i) => parts[classes[i]].push(sliceVertices(flat, group.start, group.count)));
    box.dispose();
    flat.dispose();
  }
  const order = (["cap", "pos", "neg"] as const).filter((c) => parts[c].length);
  const materials: Record<FaceClass, THREE.MeshLambertMaterial> = { cap, pos: wallMaterial(line.pos), neg: wallMaterial(line.neg) };
  const geo = mergeGeometries(order.map((c) => mergeGeometries(parts[c], false)), true);
  return { line, geo, mats: order.map((c) => materials[c]) };
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
  const top = FLOOR_Y[line.floor] + WALL_H + 0.45;
  for (const [px, py, pz] of points) {
    const p = { x: px, z: pz };
    const pSide = axisCoord(p) - line.at;
    if (camSide * pSide >= 0) continue; // same side: cannot block
    const t = camSide / (camSide - pSide);
    const along = alongCoord(cam) + (alongCoord(p) - alongCoord(cam)) * t;
    const y = cam.y + (py - cam.y) * t;
    if (along > line.from - 0.9 && along < line.to + 0.9 && y < top) return true;
  }
  return false;
}

/**
 * Which wall lines are drawn: only those of the floor you are on. From
 * upstairs the ground floor is under your feet; its outside is drawn by
 * <GroundShell> (one draw call instead of every wall piece).
 */
function lineShown(line: WallLine, floor: 0 | 1, roomId?: RoomId): "fade" | "hidden" {
  if (line.floor !== floor) return "hidden";
  // The Guest Wing's own walls ("w-...") are skipped from the far side of the hotel (Chromebook budget).
  if (!roomId && line.id.startsWith("w-") && !nearGuestWing()) return "hidden";
  return "fade";
}

/** The ground floor's outer walls seen from upstairs, so the hotel does not float. */
function GroundShell() {
  const geo = useMemo(() => {
    const b = new PartBuilder(0.4);
    const x0 = -8 - WALL_T / 2;
    const x1 = 8 + WALL_T / 2;
    const z0 = -11 - WALL_T / 2;
    const z1 = 11 + WALL_T / 2;
    const h = WALL_H - 0.01;
    b.box(x1 - x0, h, WALL_T, 0, 0, z0 + WALL_T / 2, EXTERIOR);
    b.box(x1 - x0, h, WALL_T, 0, 0, z1 - WALL_T / 2, EXTERIOR);
    b.box(WALL_T, h, z1 - z0 - 2 * WALL_T, x0 + WALL_T / 2, 0, 0, EXTERIOR);
    b.box(WALL_T, h, z1 - z0 - 2 * WALL_T, x1 - WALL_T / 2, 0, 0, EXTERIOR);
    // the front door, shut, on the west side
    b.box(0.04, 2.4, 2.2, x0 - 0.02, 0, 0, "#4f2a1c");
    return b.build();
  }, []);
  const mat = useMemo(() => new THREE.MeshLambertMaterial({ vertexColors: true }), []);
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (ref.current) ref.current.visible = rt.view.floor === 1;
  });
  return <mesh ref={ref} geometry={geo} material={mat} visible={false} />;
}

function Walls({ roomId }: { roomId?: RoomId }) {
  const views = useMemo<WallView[]>(() => {
    const room = roomId ? ROOMS[roomId] : null;
    const byLine = new Map<WallLine, WallPiece[]>();
    for (const original of WORLD.walls) {
      if (room) {
        const r = original.rect;
        const b = room.bounds;
        if (original.line.floor !== room.floor || r.x1 < b.x0 || r.x0 > b.x1 || r.z1 < b.z0 || r.z0 > b.z1) continue;
      }
      // Hide & Seek draws one room: its walls are clipped to it.
      const piece = room ? { ...original, rect: {
        x0: Math.max(original.rect.x0, room.bounds.x0 - WALL_T / 2),
        x1: Math.min(original.rect.x1, room.bounds.x1 + WALL_T / 2),
        z0: Math.max(original.rect.z0, room.bounds.z0 - WALL_T / 2),
        z1: Math.min(original.rect.z1, room.bounds.z1 + WALL_T / 2)
      } } : original;
      const list = byLine.get(original.line) ?? [];
      list.push(piece);
      byLine.set(original.line, list);
    }
    return [...byLine].map(([line, pieces]) => lineView(line, pieces, new THREE.MeshLambertMaterial({ color: WALL_CAP, transparent: true })));
  }, [roomId]);
  const meshes = useRef<Array<THREE.Mesh | null>>([]);

  useFrame((_, dt) => {
    const cam = rt.camera.pos;
    const t = rt.camera.target;
    const py = rt.player.y;
    const floorY = FLOOR_Y[rt.view.floor];
    const points: THREE.Vector3Tuple[] =
      rt.camera.mode === "follow"
        ? [
            [rt.player.x, py + 1.2, rt.player.z],
            [rt.player.x, py + 0.2, rt.player.z]
          ]
        : [
            [t.x, t.y, t.z],
            [t.x, floorY + 0.1, t.z]
          ];
    if (roomId) {
      const match = getHideSeek().match;
      if (match) points.push([match.ghost.x, match.ghost.y + 0.2, match.ghost.z], [match.detective.x, floorY + 0.6, match.detective.z]);
    }
    const k = Math.min(1, dt * 7);
    const b = roomId ? ROOMS[roomId].bounds : null;
    const centre = b ? { x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2 } : null;
    for (const line of WALL_LINES) {
      if (lineShown(line, rt.view.floor, roomId) === "hidden") {
        lineFade.set(line.id, 0);
        continue;
      }
      // Hide & Seek shows one room: any of its walls between the camera and the room's middle is cut away,
      // even when a high overview camera looks over it (in a small room it would still hide the floor by it).
      const across = centre !== null && (line.axis === "x" ? (cam.z - line.at) * (centre.z - line.at) : (cam.x - line.at) * (centre.x - line.at)) < 0;
      const target = across || lineOccludes(line, cam, points) ? 0 : 1;
      let o = lineFade.get(line.id) ?? 1;
      o += (target - o) * k;
      if (Math.abs(o - target) < 0.01) o = target;
      lineFade.set(line.id, o);
    }
    views.forEach((v, i) => {
      const o = lineFade.get(v.line.id) ?? 1;
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
          key={v.line.id}
          ref={(m) => {
            meshes.current[i] = m;
          }}
          geometry={v.geo}
          material={v.mats}
        />
      ))}
    </group>
  );
}

/** A room's floor minus its holes (the stairwell), as up to four rectangles round each hole. */
function floorRects(bounds: Rect, holes: Rect[]): Rect[] {
  let rects = [bounds];
  for (const h of holes) {
    rects = rects.flatMap((r) => {
      if (h.x1 <= r.x0 || h.x0 >= r.x1 || h.z1 <= r.z0 || h.z0 >= r.z1) return [r];
      const out: Rect[] = [];
      if (h.z0 > r.z0) out.push({ x0: r.x0, x1: r.x1, z0: r.z0, z1: h.z0 });
      if (h.z1 < r.z1) out.push({ x0: r.x0, x1: r.x1, z0: h.z1, z1: r.z1 });
      const z0 = Math.max(r.z0, h.z0);
      const z1 = Math.min(r.z1, h.z1);
      if (h.x0 > r.x0) out.push({ x0: r.x0, x1: h.x0, z0, z1 });
      if (h.x1 < r.x1) out.push({ x0: h.x1, x1: r.x1, z0, z1 });
      return out;
    });
  }
  return rects;
}

function Floors({ roomId }: { roomId?: RoomId }) {
  const pieces = useMemo(
    () =>
      Object.values(ROOMS).filter((room) => !roomId || room.id === roomId).flatMap((room) => {
        const b = room.bounds;
        const mat = floorMaterial(room.id, b.x1 - b.x0, b.z1 - b.z0);
        return floorRects(b, FLOOR_HOLES[room.id] ?? []).map((r, i) => {
          const w = r.x1 - r.x0;
          const d = r.z1 - r.z0;
          // Plane UVs span the piece; offset/scale them so the planks line up across pieces.
          const geo = new THREE.PlaneGeometry(w, d);
          const uv = geo.attributes.uv;
          for (let k = 0; k < uv.count; k++) {
            uv.setXY(k, (r.x0 - b.x0 + uv.getX(k) * w) / (b.x1 - b.x0), (b.z1 - r.z1 + uv.getY(k) * d) / (b.z1 - b.z0));
          }
          return {
            key: `${room.id}-${i}`,
            floor: room.floor,
            // From upstairs you can look down the stairwell into the lobby.
            alsoUpstairs: room.id === "lobby",
            geo,
            mat,
            pos: [(r.x0 + r.x1) / 2, FLOOR_Y[room.floor] + (room.floor ? 0.002 : 0), (r.z0 + r.z1) / 2] as [number, number, number]
          };
        });
      }),
    [roomId]
  );
  const refs = useRef<Array<THREE.Mesh | null>>([]);
  useFrame(() => {
    pieces.forEach((p, i) => {
      const m = refs.current[i];
      if (m) m.visible = p.floor === rt.view.floor || (p.alsoUpstairs && rt.view.floor === 1);
    });
  });
  return (
    <group>
      {pieces.map((p, i) => (
        <mesh key={p.key} ref={(m) => void (refs.current[i] = m)} rotation={[-Math.PI / 2, 0, 0]} position={p.pos} geometry={p.geo} material={p.mat}
          onClick={(e) => {
            if (roomId || getGame().phase !== "explore" || p.floor !== rt.view.floor || !isCanvasTap(e.delta)) return;
            e.stopPropagation();
            director.tapFloor(e.point.x, e.point.z, p.floor);
          }} />
      ))}
    </group>
  );
}

export function Hotel({ roomId }: { roomId?: RoomId }) {
  return (
    <group>
      <Floors roomId={roomId} />
      <Walls roomId={roomId} />
      {!roomId && <>
      <GroundShell />
      {DOORS.map((d) => (
        <Door key={d.id} door={d} />
      ))}
      <Beacon />
      <GhostBoard />
      <Outside />
      </>}
    </group>
  );
}
