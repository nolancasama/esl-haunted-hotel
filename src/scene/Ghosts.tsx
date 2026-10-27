import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { rt } from "../game/runtime";
import { getGame } from "../game/store";
import { GHOSTS } from "../game/ghosts";
import { WORLD } from "../game/world/world";
import { ROOMS, floorYOf } from "../game/world/rooms";
import type { GhostId } from "../game/types";
import { accessoryGeometry, ghostArm, ghostBody, ghostFace, propellerGeometry, type Accessory } from "./ghostModel";
import { faceTexture, type Expression } from "./textures";
import { glowSpriteMaterial } from "./materials";
import { getHideSeek } from "../game/hideSeek/session";

interface GhostLook {
  color: string;
  glow: string;
  accessory: Accessory;
  mask: boolean;
  /** Shadow's glowing eyes. */
  glowEyes?: boolean;
}

function useGhostMaterials(look: GhostLook) {
  return useMemo(() => {
    const body = new THREE.MeshLambertMaterial({
      color: look.color,
      emissive: look.color,
      emissiveIntensity: look.glowEyes ? 0.38 : 0.5,
      transparent: true,
      side: THREE.DoubleSide
    });
    const face = new THREE.MeshBasicMaterial({
      map: faceTexture("happy", look.mask, look.glowEyes),
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      toneMapped: false
    });
    const acc = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true });
    const glow = glowSpriteMaterial(look.glow, 0.55);
    return { body, face, acc, glow };
  }, [look.color, look.glow, look.mask, look.glowEyes]);
}

type Mats = ReturnType<typeof useGhostMaterials>;

interface Rig {
  root: THREE.Group | null;
  squash: THREE.Group | null;
  /** Hat pivot at the top of the head: squashed flat in tight "under" spots. */
  acc: THREE.Group | null;
  armL: THREE.Mesh | null;
  armR: THREE.Mesh | null;
  /** Bouncy's propeller (spins). */
  prop: THREE.Mesh | null;
  mats: Mats | null;
}

/** Height (ghost units) where hats sit; a flattened hat stays below HAT_FLAT_TOP (see spots.test.ts). */
const HAT_BASE = 0.7;
const HAT_FLAT = 0.35;
/** Propeller hub height on Bouncy's cap (ghost units). */
const PROP_Y = 0.93;

const newRig = (): Rig => ({ root: null, squash: null, acc: null, armL: null, armR: null, prop: null, mats: null });

function GhostMesh({ look, rig }: { look: GhostLook; rig: Rig }) {
  const mats = useGhostMaterials(look);
  const body = useMemo(ghostBody, []);
  const face = useMemo(ghostFace, []);
  const arm = useMemo(ghostArm, []);
  const acc = useMemo(() => accessoryGeometry(look.accessory), [look.accessory]);
  const prop = useMemo(() => (look.accessory === "propeller" ? propellerGeometry() : null), [look.accessory]);
  rig.mats = mats;
  return (
    <group ref={(g) => void (rig.root = g)} visible={false}>
      <sprite material={mats.glow} position={[0, 0.42, 0]} scale={[1.7, 1.7, 1]} renderOrder={0} />
      <group ref={(g) => void (rig.squash = g)}>
        <mesh geometry={body} material={mats.body} renderOrder={1} />
        <mesh geometry={face} material={mats.face} renderOrder={2} />
        <group ref={(g) => void (rig.acc = g)} position={[0, HAT_BASE, 0]}>
          <mesh geometry={acc} material={mats.acc} position={[0, -HAT_BASE, 0]} renderOrder={1} />
          {prop && <mesh ref={(m) => void (rig.prop = m)} geometry={prop} material={mats.acc} position={[0, PROP_Y - HAT_BASE, 0]} renderOrder={1} />}
        </group>
        <mesh ref={(m) => void (rig.armL = m)} geometry={arm} material={mats.body} position={[-0.31, 0.36, 0.04]} renderOrder={1} />
        <mesh ref={(m) => void (rig.armR = m)} geometry={arm} material={mats.body} position={[0.31, 0.36, 0.04]} renderOrder={1} />
      </group>
    </group>
  );
}

function setExpression(mats: Mats, expr: Expression, look: { mask: boolean; glowEyes?: boolean }) {
  const tex = faceTexture(expr, look.mask, look.glowEyes);
  if (mats.face.map !== tex) {
    mats.face.map = tex;
    mats.face.needsUpdate = true;
  }
}

const BOO_FACE = { mask: false };

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

/** The student's ghost and the false silhouette share the story model/accessories. */
export function HideSeekGhost({ id, decoy = false }: { id: GhostId; decoy?: boolean }) {
  const def = GHOSTS[id];
  const look = useMemo<GhostLook>(() => ({ color: def.color, glow: def.glow, accessory: def.accessory, mask: def.accessory === "mask", glowEyes: def.glowEyes }), [def]);
  const rig = useRef(newRig());
  const outline = useRef<THREE.Mesh>(null);
  const celebrationTime = useRef(0);
  useFrame((_, dt) => {
    const m = getHideSeek().match;
    const r = rig.current;
    if (!m || !r.root || !r.squash || !r.mats) return;
    // Starting English previews the chosen place for the student; the canonical
    // ghost pose is committed only by answerEnglish in the simulation.
    const startingPreview = !decoy && m.status === "setup" && m.english?.starting ? m.english.spotId : null;
    const spotId = decoy ? m.effects.decoy?.spotId : startingPreview ?? m.ghost.spotId ?? m.ghost.destination;
    const spot = spotId ? WORLD.spotById.get(spotId) : null;
    r.root.visible = Boolean(spot);
    if (!spot) { if (outline.current) outline.current.visible = false; return; }
    // Found, or celebrating: out of the box (lid open) where the closing shot can see it.
    const popped = !decoy && !m.ghost.transit && (m.status === "lost" || m.status === "won");
    const p = decoy || startingPreview ? spot.hidePos : popped ? spot.pos : m.ghost;
    const transit = !decoy && m.ghost.transit;
    // Found: a friendly "oh!" with arms up (the same face as when the detective comes close).
    const frightened = !decoy && (m.status === "lost" || (m.status === "playing" && Math.hypot(m.detective.x - p.x, m.detective.z - p.z) < 2.1));
    const won = !decoy && m.status === "won";
    celebrationTime.current = won ? celebrationTime.current + Math.min(dt, 0.1) : 0;
    const visualTime = m.time + celebrationTime.current;
    const bounce = transit && m.ghost.loudness > 1 ? Math.abs(Math.sin(m.time * 7)) * 0.65 : 0;
    const float = spot.prep === "under" || spot.prep === "in" ? 0 : Math.sin(m.time * 2.2) * 0.025;
    const shimmer = decoy ? Math.sin(m.time * 7.5) : 0;
    r.root.position.set(p.x + (frightened ? Math.sin(m.time * 27) * 0.015 : 0), p.y + float + bounce + (won ? Math.abs(Math.sin(visualTime * 6)) * 0.25 : 0) + (decoy ? shimmer * 0.025 : 0), p.z);
    faceCamera(r.root, Math.min(1, dt * 8));
    const decoyScale = decoy ? 1 + shimmer * 0.035 : 1;
    r.squash.scale.set((transit ? 0.75 : spot.scale[0]) * decoyScale, (transit ? 0.75 : spot.scale[1]) * decoyScale, (transit ? 0.75 : spot.scale[2]) * decoyScale);
    r.squash.rotation.z = won ? Math.sin(visualTime * 7) * 0.17 : 0;
    if (r.acc) r.acc.scale.y = !transit && spot.prep === "under" ? HAT_FLAT : 1;
    if (r.armL) r.armL.rotation.z = frightened ? -0.9 : won ? -1.4 : 0;
    if (r.armR) r.armR.rotation.z = frightened ? 0.9 : won ? 1.4 : 0;
    if (r.prop && !m.english) r.prop.rotation.y += Math.min(dt, 0.1) * 12;
    setExpression(r.mats, frightened ? "surprised" : id === "sleepy" ? "sleepy" : won ? "giggle" : "happy", look);
    const opacity = decoy ? 0.3 + shimmer * 0.06 : m.ghost.invisible ? 0.06 : m.effects.sleepySearch !== null ? 0.48 : 0.88;
    setOpacity(r.mats, opacity);
    if (decoy) {
      r.mats.body.depthTest = false;
      r.mats.face.depthTest = false;
      r.mats.acc.depthTest = false;
    }
    // Seen from its own eyes (first person), the ghost is not drawn at all.
    const cam = rt.camera.pos;
    const own = !decoy && Math.hypot(cam.x - r.root.position.x, cam.y - r.root.position.y - 0.35, cam.z - r.root.position.z) < 0.9;
    r.root.visible = !own;
    // This player-only silhouette has no relation to the perception module.
    if (outline.current) {
      outline.current.visible = !own && !decoy && (m.ghost.hidden || Boolean(startingPreview));
      outline.current.position.copy(r.root.position);
      outline.current.rotation.copy(r.root.rotation);
      outline.current.scale.set(spot.scale[0] * 1.09, spot.scale[1] * 1.06, spot.scale[2] * 1.09);
    }
  });
  return <>
    <GhostMesh look={look} rig={rig.current} />
    {!decoy && <mesh ref={outline} geometry={ghostBody()} renderOrder={18} visible={false}>
      <meshBasicMaterial color={def.glow} transparent opacity={0.32} depthTest={false} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>}
  </>;
}

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
    for (const g of Object.values(GHOSTS))
      out[g.id] = { color: g.color, glow: g.glow, accessory: g.accessory, mask: g.accessory === "mask", glowEyes: g.glowEyes };
    return out;
  }, []);
  const rigs = useRef(Object.fromEntries(Object.keys(GHOSTS).map((id) => [id, newRig()])) as Record<GhostId, Rig>);

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
  if (r.prop) r.prop.rotation.y += dt * (anim.mode === "escape" || anim.mode === "capture" ? 30 : 9);
  const squashed = spot.prep === "under";
  // Under low furniture the hat is pressed flat too, so it never pokes through.
  let hatFlat = squashed ? 1 : 0;

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
      setExpression(mats, expr, look);
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
        setExpression(mats, t < 0.3 ? "surprised" : "dizzy", look);
        setOpacity(mats, 1);
      } else {
        // The last ghost of the game takes a grander, slower, spiralling flight.
        const big = Boolean(anim.big);
        const k = Math.min(1, (t - 0.55) / (big ? 1.5 : 0.85));
        const e = k * k * (3 - 2 * k);
        const lx = rt.lantern.x;
        const ly = rt.lantern.y;
        const lz = rt.lantern.z;
        // arc above the straight line, spiralling in
        const mid = { x: (start.x + lx) / 2, y: Math.max(start.y, ly) + (big ? 2.0 : 1.2), z: (start.z + lz) / 2 };
        const a = 1 - e;
        const x = a * a * start.x + 2 * a * e * mid.x + e * e * lx;
        const y = a * a * start.y + 2 * a * e * mid.y + e * e * ly;
        const z = a * a * start.z + 2 * a * e * mid.z + e * e * lz;
        const spin = (1 - e) * (big ? 0.8 : 0.35);
        root.position.set(x + Math.cos(t * (big ? 9 : 14)) * spin, y, z + Math.sin(t * (big ? 9 : 14)) * spin);
        root.rotation.y += dt * 12;
        const s = Math.max(0.001, 1 - e * 0.97);
        const un = Math.min(1, k * 3);
        if (squashed) hatFlat = 1 - un;
        squash.scale.set(THREE.MathUtils.lerp(sx, 1, un) * s, THREE.MathUtils.lerp(sy, 1, un) * s, THREE.MathUtils.lerp(sz, 1, un) * s);
        setExpression(mats, "dizzy", look);
        setOpacity(mats, k > 0.92 ? Math.max(0, (1 - k) / 0.08) : 1);
        if (k >= 1) rt.ghost.anim = { mode: "hidden" };
      }
      break;
    }
    case "escape": {
      const room = ROOMS[spot.room].bounds;
      const cx = (room.x0 + room.x1) / 2;
      const cz = (room.z0 + room.z1) / 2;
      const loopY = floorYOf(spot.room) + 1.9;
      if (t < 0.45) {
        const e = easeOutBack(Math.min(1, t / 0.45));
        root.position.set(spot.pos.x, spot.pos.y + e * 0.25, spot.pos.z);
        squash.scale.set(Math.max(0.01, e), Math.max(0.01, e), Math.max(0.01, e));
        faceCamera(root, 1);
        setExpression(mats, "giggle", look);
        setOpacity(mats, 1);
      } else if (t < 2.2) {
        const k = (t - 0.45) / 1.75;
        // from the spot, swoop up into a loop around the room centre
        const ang = k * Math.PI * 2.4 + Math.atan2(spot.pos.z - cz, spot.pos.x - cx);
        const rad = THREE.MathUtils.lerp(0.2, 2.3, Math.min(1, k * 3));
        const bx = THREE.MathUtils.lerp(spot.pos.x, cx, Math.min(1, k * 3));
        const bz = THREE.MathUtils.lerp(spot.pos.z, cz, Math.min(1, k * 3));
        root.position.set(bx + Math.cos(ang) * rad, THREE.MathUtils.lerp(spot.pos.y + 0.25, loopY, Math.min(1, k * 2.5)) + Math.sin(k * 20) * 0.1, bz + Math.sin(ang) * rad);
        root.rotation.y = -ang;
        squash.scale.setScalar(1);
        squash.rotation.z = Math.sin(t * 12) * 0.25;
        setExpression(mats, Math.floor(t * 4) % 2 ? "giggle" : "happy", look);
        setOpacity(mats, 1);
      } else {
        const k = Math.min(1, (t - 2.2) / 0.3);
        squash.scale.setScalar(Math.max(0.001, 1 - k));
        setOpacity(mats, 1 - k);
        if (k >= 1) rt.ghost.anim = { mode: "hidden" };
      }
      hatFlat = 0;
      break;
    }
  }
  if (r.acc) r.acc.scale.y = 1 - (1 - HAT_FLAT) * hatFlat;
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
      : new THREE.Vector3(rt.player.x + Math.cos(yaw) * 0.85 + Math.sin(yaw) * 0.25, rt.player.y + 1.35, rt.player.z - Math.sin(yaw) * 0.85 + Math.cos(yaw) * 0.25);
    const appear = Math.min(1, (rt.time - b.appearT0) / 0.6);
    if (appear < 0.05) pos.current.copy(want);
    pos.current.lerp(want, Math.min(1, dt * 3));
    r.root.position.set(pos.current.x, pos.current.y + Math.sin(rt.time * 2.4) * 0.06, pos.current.z);
    faceCamera(r.root, Math.min(1, dt * 5));
    const s = 0.72 * easeOutBack(appear) * presence.current;
    const talkBounce = b.talking ? Math.abs(Math.sin(rt.time * 9)) * 0.04 : 0;
    // Surprised (the bang upstairs): a jump and wide eyes.
    const st = rt.time - b.surprisedT0;
    const jump = st >= 0 && st < 0.5 ? Math.sin((st / 0.5) * Math.PI) * 0.2 : 0;
    r.root.position.y += jump;
    r.squash.scale.set(s * (1 + talkBounce), s * (1 - talkBounce), s);
    r.squash.rotation.z = Math.sin(rt.time * 1.3) * 0.06;
    let expr: Expression = b.talking ? (Math.floor(rt.time * 7) % 2 ? "talk" : "smile") : "smile";
    if (st >= 0 && st < 1.8) expr = "surprised";
    setExpression(mats, expr, BOO_FACE);
    const wave = Math.sin(rt.time * 5);
    if (r.armL) r.armL.position.y = 0.36 + wave * 0.04;
    if (r.armR) r.armR.position.y = 0.36 - wave * 0.04;
  });

  return <GhostMesh look={look} rig={rig.current} />;
}
