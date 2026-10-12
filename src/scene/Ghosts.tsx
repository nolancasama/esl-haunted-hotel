import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { rt } from "../game/runtime";
import { getGame } from "../game/store";
import { GHOSTS } from "../game/ghosts";
import { WORLD } from "../game/world/world";
import { ROOMS } from "../game/world/rooms";
import type { GhostId } from "../game/types";
import { accessoryGeometry, ghostArm, ghostBody, ghostFace, type Accessory } from "./ghostModel";
import { faceTexture, type Expression } from "./textures";
import { glowSpriteMaterial } from "./materials";

interface GhostLook {
  color: string;
  glow: string;
  accessory: Accessory;
  mask: boolean;
}

function useGhostMaterials(look: GhostLook) {
  return useMemo(() => {
    const body = new THREE.MeshLambertMaterial({
      color: look.color,
      emissive: look.color,
      emissiveIntensity: 0.5,
      transparent: true,
      side: THREE.DoubleSide
    });
    const face = new THREE.MeshBasicMaterial({
      map: faceTexture("happy", look.mask),
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      toneMapped: false
    });
    const acc = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true });
    const glow = glowSpriteMaterial(look.glow, 0.55);
    return { body, face, acc, glow };
  }, [look.color, look.glow, look.mask]);
}

type Mats = ReturnType<typeof useGhostMaterials>;

interface Rig {
  root: THREE.Group | null;
  squash: THREE.Group | null;
  armL: THREE.Mesh | null;
  armR: THREE.Mesh | null;
  mats: Mats | null;
}

const newRig = (): Rig => ({ root: null, squash: null, armL: null, armR: null, mats: null });

function GhostMesh({ look, rig }: { look: GhostLook; rig: Rig }) {
  const mats = useGhostMaterials(look);
  const body = useMemo(ghostBody, []);
  const face = useMemo(ghostFace, []);
  const arm = useMemo(ghostArm, []);
  const acc = useMemo(() => accessoryGeometry(look.accessory), [look.accessory]);
  rig.mats = mats;
  return (
    <group ref={(g) => void (rig.root = g)} visible={false}>
      <sprite material={mats.glow} position={[0, 0.42, 0]} scale={[1.7, 1.7, 1]} renderOrder={0} />
      <group ref={(g) => void (rig.squash = g)}>
        <mesh geometry={body} material={mats.body} renderOrder={1} />
        <mesh geometry={face} material={mats.face} renderOrder={2} />
        <mesh geometry={acc} material={mats.acc} renderOrder={1} />
        <mesh ref={(m) => void (rig.armL = m)} geometry={arm} material={mats.body} position={[-0.31, 0.36, 0.04]} renderOrder={1} />
        <mesh ref={(m) => void (rig.armR = m)} geometry={arm} material={mats.body} position={[0.31, 0.36, 0.04]} renderOrder={1} />
      </group>
    </group>
  );
}

function setExpression(mats: Mats, expr: Expression, mask: boolean) {
  const tex = faceTexture(expr, mask);
  if (mats.face.map !== tex) {
    mats.face.map = tex;
    mats.face.needsUpdate = true;
  }
}

function setOpacity(mats: Mats, o: number) {
  mats.body.opacity = o;
  mats.face.opacity = o;
  mats.acc.opacity = o;
  mats.glow.opacity = 0.55 * o;
  mats.body.depthWrite = o > 0.98;
}

const easeOutBack = (t: number) => {
  const c1 = 1.9;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

const tmpV = new THREE.Vector3();

/** Turn to face the camera (yaw only). */
function faceCamera(root: THREE.Group, k = 1) {
  const cam = rt.camera.pos;
  const target = Math.atan2(cam.x - root.position.x, cam.z - root.position.z);
  let d = target - root.rotation.y;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  root.rotation.y += d * k;
}

/** The ghost currently being hunted. One mesh per ghost kind; only the active one is shown. */
export function GhostActor() {
  const looks = useMemo(() => {
    const out = {} as Record<GhostId, GhostLook>;
    for (const g of Object.values(GHOSTS)) out[g.id] = { color: g.color, glow: g.glow, accessory: g.accessory, mask: g.accessory === "mask" };
    return out;
  }, []);
  const rigs = useRef<Record<GhostId, Rig>>({ sleepy: newRig(), hungry: newRig(), sneaky: newRig(), mischief: newRig() });

  useFrame((_, dt) => {
    for (const id of Object.keys(rigs.current) as GhostId[]) {
      const r = rigs.current[id];
      if (!r.root || !r.squash || !r.mats) continue;
      if (id !== rt.ghost.id) {
        r.root.visible = false;
        continue;
      }
      animateGhost(r, looks[id], dt);
    }
  });

  return (
    <group>
      {(Object.keys(looks) as GhostId[]).map((id) => (
        <GhostMesh key={id} look={looks[id]} rig={rigs.current[id]} />
      ))}
    </group>
  );
}

function animateGhost(r: Rig, look: GhostLook, dt: number) {
  const root = r.root!;
  const squash = r.squash!;
  const mats = r.mats!;
  const anim = rt.ghost.anim;
  if (anim.mode === "hidden") {
    root.visible = false;
    return;
  }
  const spot = WORLD.spotById.get(anim.spotId);
  if (!spot) {
    root.visible = false;
    return;
  }
  root.visible = true;
  const t = rt.time - anim.t0;
  const def = GHOSTS[rt.ghost.id];
  const [sx, sy, sz] = spot.scale;
  const wave = Math.sin(rt.time * 6 * def.bob);
  if (r.armL) r.armL.position.y = 0.36 + wave * 0.03;
  if (r.armR) r.armR.position.y = 0.36 - wave * 0.03;
  const squashed = spot.prep === "under";

  switch (anim.mode) {
    case "found":
    case "giggle": {
      const pop = Math.min(1, t / 0.5);
      const e = easeOutBack(pop);
      tmpV.set(
        THREE.MathUtils.lerp(spot.hidePos.x, spot.pos.x, e),
        THREE.MathUtils.lerp(spot.hidePos.y, spot.pos.y, Math.min(1, e)),
        THREE.MathUtils.lerp(spot.hidePos.z, spot.pos.z, e)
      );
      const bobY = squashed ? 0 : Math.sin(rt.time * 2.2 * def.bob) * 0.03;
      root.position.set(tmpV.x, tmpV.y + bobY, tmpV.z);
      faceCamera(root, Math.min(1, dt * 6));
      const giggle = anim.mode === "giggle" && t < 1.2;
      const wob = giggle ? Math.sin(rt.time * 30) * 0.06 : 0;
      squash.scale.set(sx * Math.max(0.01, e) * (1 + wob), sy * Math.max(0.01, e) * (1 - wob), sz * Math.max(0.01, e));
      squash.rotation.z = giggle ? Math.sin(rt.time * 18) * 0.12 : Math.sin(rt.time * 1.7) * 0.05;
      let expr: Expression = "happy";
      if (anim.mode === "found") expr = t < 1.1 ? "surprised" : Math.floor(rt.time * 0.6) % 3 === 0 ? "giggle" : "happy";
      else expr = t < 1.2 ? "giggle" : "happy";
      if (rt.ghost.id === "sleepy" && anim.mode === "found" && t > 1.1 && Math.floor(rt.time * 0.4) % 2 === 0) expr = "sleepy";
      setExpression(mats, expr, look.mask);
      setOpacity(mats, 1);
      break;
    }
    case "capture": {
      const start = spot.pos;
      if (t < 0.55) {
        // funny surprised face, shaking
        const shake = Math.sin(rt.time * 50) * 0.04;
        root.position.set(start.x + shake, start.y + (squashed ? 0 : 0.05), start.z);
        squash.scale.set(sx * (1 + Math.sin(t * 25) * 0.08), sy * (1.08 - Math.sin(t * 25) * 0.08), sz);
        setExpression(mats, t < 0.3 ? "surprised" : "dizzy", look.mask);
        setOpacity(mats, 1);
      } else {
        const k = Math.min(1, (t - 0.55) / 0.85);
        const e = k * k * (3 - 2 * k);
        const lx = rt.lantern.x;
        const ly = rt.lantern.y;
        const lz = rt.lantern.z;
        // arc above the straight line, spiralling in
        const mid = { x: (start.x + lx) / 2, y: Math.max(start.y, ly) + 1.2, z: (start.z + lz) / 2 };
        const a = 1 - e;
        const x = a * a * start.x + 2 * a * e * mid.x + e * e * lx;
        const y = a * a * start.y + 2 * a * e * mid.y + e * e * ly;
        const z = a * a * start.z + 2 * a * e * mid.z + e * e * lz;
        const spin = (1 - e) * 0.35;
        root.position.set(x + Math.cos(t * 14) * spin, y, z + Math.sin(t * 14) * spin);
        root.rotation.y += dt * 12;
        const s = Math.max(0.001, 1 - e * 0.97);
        const un = Math.min(1, k * 3);
        squash.scale.set(THREE.MathUtils.lerp(sx, 1, un) * s, THREE.MathUtils.lerp(sy, 1, un) * s, THREE.MathUtils.lerp(sz, 1, un) * s);
        setExpression(mats, "dizzy", look.mask);
        setOpacity(mats, k > 0.92 ? Math.max(0, (1 - k) / 0.08) : 1);
        if (k >= 1) rt.ghost.anim = { mode: "hidden" };
      }
      break;
    }
    case "escape": {
      const room = ROOMS[spot.room]!.bounds;
      const cx = (room.x0 + room.x1) / 2;
      const cz = (room.z0 + room.z1) / 2;
      if (t < 0.45) {
        const e = easeOutBack(Math.min(1, t / 0.45));
        root.position.set(spot.pos.x, spot.pos.y + e * 0.25, spot.pos.z);
        squash.scale.set(Math.max(0.01, e), Math.max(0.01, e), Math.max(0.01, e));
        faceCamera(root, 1);
        setExpression(mats, "giggle", look.mask);
        setOpacity(mats, 1);
      } else if (t < 2.2) {
        const k = (t - 0.45) / 1.75;
        // from the spot, swoop up into a loop around the room centre
        const ang = k * Math.PI * 2.4 + Math.atan2(spot.pos.z - cz, spot.pos.x - cx);
        const rad = THREE.MathUtils.lerp(0.2, 2.3, Math.min(1, k * 3));
        const bx = THREE.MathUtils.lerp(spot.pos.x, cx, Math.min(1, k * 3));
        const bz = THREE.MathUtils.lerp(spot.pos.z, cz, Math.min(1, k * 3));
        root.position.set(bx + Math.cos(ang) * rad, THREE.MathUtils.lerp(spot.pos.y + 0.25, 1.9, Math.min(1, k * 2.5)) + Math.sin(k * 20) * 0.1, bz + Math.sin(ang) * rad);
        root.rotation.y = -ang;
        squash.scale.setScalar(1);
        squash.rotation.z = Math.sin(t * 12) * 0.25;
        setExpression(mats, Math.floor(t * 4) % 2 ? "giggle" : "happy", look.mask);
        setOpacity(mats, 1);
      } else {
        const k = Math.min(1, (t - 2.2) / 0.3);
        squash.scale.setScalar(Math.max(0.001, 1 - k));
        setOpacity(mats, 1 - k);
        if (k >= 1) rt.ghost.anim = { mode: "hidden" };
      }
      break;
    }
  }
}

/** Boo, the friendly guide who floats beside the player. */
export function Boo() {
  const look = useMemo<GhostLook>(() => ({ color: "#f3f0ff", glow: "#bfe9ff", accessory: "bowtie", mask: false }), []);
  const rig = useRef<Rig>(newRig());
  const pos = useRef(new THREE.Vector3(0, 1.5, 0));
  const presence = useRef(0);

  useFrame((_, dt) => {
    const r = rig.current;
    if (!r.root || !r.squash || !r.mats) return;
    const mats = r.mats;
    const b = rt.boo;
    // Boo steps out of close-ups so the found ghost and its furniture stay clear.
    const wanted = b.visible && (rt.camera.mode === "follow" || b.target !== null) && getGame().screen === "game";
    presence.current += ((wanted ? 1 : 0) - presence.current) * Math.min(1, dt * 7);
    r.root.visible = presence.current > 0.02;
    if (!r.root.visible) return;
    // Float at the player's shoulder (camera-relative right side), or a scripted spot.
    const yaw = rt.camera.yaw;
    const want = b.target
      ? new THREE.Vector3(b.target.x, b.target.y, b.target.z)
      : new THREE.Vector3(rt.player.x + Math.cos(yaw) * 0.85 + Math.sin(yaw) * 0.25, 1.35, rt.player.z - Math.sin(yaw) * 0.85 + Math.cos(yaw) * 0.25);
    const appear = Math.min(1, (rt.time - b.appearT0) / 0.6);
    if (appear < 0.05) pos.current.copy(want);
    pos.current.lerp(want, Math.min(1, dt * 3));
    r.root.position.set(pos.current.x, pos.current.y + Math.sin(rt.time * 2.4) * 0.06, pos.current.z);
    faceCamera(r.root, Math.min(1, dt * 5));
    const s = 0.72 * easeOutBack(appear) * presence.current;
    const talkBounce = b.talking ? Math.abs(Math.sin(rt.time * 9)) * 0.04 : 0;
    r.squash.scale.set(s * (1 + talkBounce), s * (1 - talkBounce), s);
    r.squash.rotation.z = Math.sin(rt.time * 1.3) * 0.06;
    const expr: Expression = b.talking ? (Math.floor(rt.time * 7) % 2 ? "talk" : "smile") : "smile";
    setExpression(mats, expr, false);
    const wave = Math.sin(rt.time * 5);
    if (r.armL) r.armL.position.y = 0.36 + wave * 0.04;
    if (r.armR) r.armR.position.y = 0.36 - wave * 0.04;
  });

  return <GhostMesh look={look} rig={rig.current} />;
}
