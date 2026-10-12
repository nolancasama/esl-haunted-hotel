import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { rt } from "../game/runtime";
import { getGame, setGame } from "../game/store";
import { keyboardMove } from "../input/keyboard";
import { nearestSearchable, resolveCollisions } from "../game/world/collision";
import { rectDistance } from "../game/world/geometry";
import { INTERACT_RANGE } from "../game/world/constants";
import { WORLD } from "../game/world/world";
import { GHOSTS } from "../game/ghosts";
import { audio } from "../audio/audio";
import { director } from "../game/director";
import { PartBuilder } from "./partBuilder";
import { glowSpriteMaterial } from "./materials";
import { glowTexture } from "./textures";

const SPEED = 3.1;
const COAT = "#f2c230";
const COAT_DARK = "#d9a21b";
const SKIN = "#ffd8b5";

function bodyGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder(0.3);
  // raincoat
  b.add(new THREE.CapsuleGeometry(0.22, 0.32, 4, 12), COAT, [0, 0.66, 0], [0, 0, 0], [1, 1, 0.85]);
  b.add(new THREE.CylinderGeometry(0.2, 0.27, 0.2, 14), COAT_DARK, [0, 0.47, 0]);
  // buttons
  for (const y of [0.78, 0.66, 0.54]) b.sphere(0.022, 0, y, 0.19, "#3b6fd6");
  // head and hood
  b.sphere(0.2, 0, 1.06, 0.01, SKIN, [1, 0.95, 0.95], 16);
  b.add(new THREE.SphereGeometry(0.23, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), COAT, [0, 1.07, -0.035], [-0.35, 0, 0]);
  // hair fringe
  b.sphere(0.12, -0.07, 1.17, 0.12, "#4a2f22", [1, 0.45, 0.6]);
  b.sphere(0.1, 0.08, 1.17, 0.13, "#4a2f22", [1, 0.45, 0.6]);
  // eyes, cheeks, mouth
  b.sphere(0.028, -0.07, 1.06, 0.185, "#231a2a");
  b.sphere(0.028, 0.07, 1.06, 0.185, "#231a2a");
  b.sphere(0.03, -0.12, 1.0, 0.16, "#ff9aa2", [1, 0.6, 0.4]);
  b.sphere(0.03, 0.12, 1.0, 0.16, "#ff9aa2", [1, 0.6, 0.4]);
  b.sphere(0.02, 0, 0.99, 0.195, "#b0475a", [1.4, 0.7, 0.6]);
  return b.build();
}

function legGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder(0);
  b.add(new THREE.CapsuleGeometry(0.075, 0.18, 4, 8), "#3a4fa8", [0, -0.16, 0]);
  b.add(new THREE.CapsuleGeometry(0.085, 0.08, 4, 8), "#e8483f", [0, -0.33, 0.03], [Math.PI / 2, 0, 0], [1, 1.2, 1]);
  return b.build();
}

function armGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder(0);
  b.add(new THREE.CapsuleGeometry(0.065, 0.2, 4, 8), COAT, [0, -0.15, 0]);
  b.sphere(0.06, 0, -0.32, 0, SKIN);
  return b.build();
}

function lanternGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder(0);
  b.cyl(0.075, 0.09, 0.03, 0, -0.03, 0, "#3b2f4a");
  b.cyl(0.05, 0.085, 0.05, 0, 0.17, 0, "#3b2f4a");
  for (const a of [0, 1, 2, 3]) {
    const ang = (a / 4) * Math.PI * 2 + Math.PI / 4;
    b.box(0.014, 0.18, 0.014, Math.cos(ang) * 0.065, 0, Math.sin(ang) * 0.065, "#d4ad55");
  }
  b.torus(0.05, 0.008, [0, 0.25, 0], [0, 0, 0], "#d4ad55");
  return b.build();
}

export function Player() {
  const body = useMemo(bodyGeometry, []);
  const leg = useMemo(legGeometry, []);
  const arm = useMemo(armGeometry, []);
  const lantern = useMemo(lanternGeometry, []);
  const mat = useMemo(() => new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true }), []);
  const coreMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#ffd88a", toneMapped: false, transparent: true }), []);
  const fade = useRef(1);
  const haloMat = useMemo(() => glowSpriteMaterial("#ffcf7a", 0.75), []);
  const shadowMat = useMemo(
    () => new THREE.MeshBasicMaterial({ map: glowTexture(), color: "#000000", transparent: true, opacity: 0.55, depthWrite: false }),
    []
  );
  const root = useRef<THREE.Group>(null);
  const bob = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const lanternRef = useRef<THREE.Group>(null);
  const light = useRef<THREE.PointLight>(null);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const tmpColor = useMemo(() => new THREE.Color(), []);
  const lastStep = useRef(0);
  const stuck = useRef({ t: 0, x: 0, z: 0 });

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    const p = rt.player;
    const game = getGame();
    const canMove = game.screen === "game" && game.phase === "explore" && !game.settingsOpen && !p.frozen;

    let mx = 0;
    let my = 0;
    if (canMove) {
      const k = keyboardMove();
      mx = k.x + rt.joy.x;
      my = k.y + rt.joy.y;
      if (mx !== 0 || my !== 0) p.walkTo = null;
    } else if (game.phase !== "explore") {
      p.walkTo = null;
    }

    const yaw = rt.camera.yaw;
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    const rx = Math.cos(yaw);
    const rz = -Math.sin(yaw);
    let dx = rx * mx + fx * my;
    let dz = rz * mx + fz * my;

    // Tap-to-walk towards an object.
    if (canMove && p.walkTo) {
      const w = p.walkTo;
      const obj = w.objectId ? WORLD.objectById.get(w.objectId) : null;
      const reached = obj ? rectDistance(obj.rect, p.x, p.z) < INTERACT_RANGE - 0.25 : Math.hypot(w.x - p.x, w.z - p.z) < 0.2;
      if (reached) {
        p.walkTo = null;
        if (obj) {
          p.yaw = Math.atan2(w.x - p.x, w.z - p.z);
          director.tapObject(obj.id);
        }
      } else {
        const ax = w.x - p.x;
        const az = w.z - p.z;
        const l = Math.hypot(ax, az) || 1;
        dx = ax / l;
        dz = az / l;
        // Give up if we are not getting anywhere (blocked).
        if (rt.time - stuck.current.t > 0.6) {
          const moved = Math.hypot(p.x - stuck.current.x, p.z - stuck.current.z);
          if (rt.time - w.t0 > 0.6 && moved < 0.12) p.walkTo = null;
          stuck.current = { t: rt.time, x: p.x, z: p.z };
        }
      }
    }

    // Scripted step aside (close-ups), in any phase.
    let stepping = false;
    if (p.stepTo) {
      const ax = p.stepTo.x - p.x;
      const az = p.stepTo.z - p.z;
      const l = Math.hypot(ax, az);
      if (l < 0.06) {
        p.yaw = Math.atan2(p.stepTo.face.x - p.x, p.stepTo.face.z - p.z);
        p.stepTo = null;
      } else {
        stepping = true;
        dx = (ax / l) * Math.min(1, l * 3) * 0.7;
        dz = (az / l) * Math.min(1, l * 3) * 0.7;
      }
    }

    const len = Math.hypot(dx, dz);
    if (len > 1) {
      dx /= len;
      dz /= len;
    }
    const accel = Math.min(1, dt * 12);
    p.vx += (dx * SPEED - p.vx) * accel;
    p.vz += (dz * SPEED - p.vz) * accel;
    if (!canMove && !stepping) {
      p.vx *= 0.5;
      p.vz *= 0.5;
    }
    const speed = Math.hypot(p.vx, p.vz);
    p.speed = speed;
    if (speed > 0.01) {
      const steps = Math.max(1, Math.ceil((speed * dt) / 0.08));
      for (let i = 0; i < steps; i++) {
        const r = resolveCollisions(p.x + (p.vx * dt) / steps, p.z + (p.vz * dt) / steps, (id) => rt.doorsOpen.has(id));
        p.x = r.x;
        p.z = r.z;
      }
    }
    if (speed > 0.2) {
      const target = Math.atan2(p.vx, p.vz);
      let d = target - p.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      p.yaw += d * Math.min(1, dt * 12);
    }

    // Walk cycle.
    const moving = Math.min(1, speed / SPEED);
    p.step += dt * speed * 3.1;
    const swing = Math.sin(p.step) * 0.6 * moving;
    if (legL.current) legL.current.rotation.x = swing;
    if (legR.current) legR.current.rotation.x = -swing;
    if (armL.current) armL.current.rotation.x = -swing * 0.8;
    if (armR.current) armR.current.rotation.x = 0.35 + swing * 0.25;
    if (bob.current) bob.current.position.y = Math.abs(Math.cos(p.step)) * 0.045 * moving + Math.sin(rt.time * 2) * 0.004;
    const stepIndex = Math.floor(p.step / Math.PI);
    if (stepIndex !== lastStep.current) {
      lastStep.current = stepIndex;
      if (moving > 0.4) audio.play("step");
    }

    if (root.current) {
      root.current.position.set(p.x, 0, p.z);
      root.current.rotation.y = p.yaw;
    }

    // Fade out when standing between the camera and what it is looking at.
    const cam = rt.camera.pos;
    const tgt = rt.camera.target;
    const sx = tgt.x - cam.x;
    const sy = tgt.y - cam.y;
    const sz = tgt.z - cam.z;
    const sl = sx * sx + sy * sy + sz * sz || 1;
    const t = ((p.x - cam.x) * sx + (0.75 - cam.y) * sy + (p.z - cam.z) * sz) / sl;
    const cx = cam.x + sx * Math.min(1, Math.max(0, t)) - p.x;
    const cy = cam.y + sy * Math.min(1, Math.max(0, t)) - 0.75;
    const cz = cam.z + sz * Math.min(1, Math.max(0, t)) - p.z;
    const blocking = rt.camera.mode !== "follow" && t > 0.02 && t < 0.98 && Math.hypot(cx, cy, cz) < 0.8;
    const tooClose = Math.hypot(cam.x - p.x, cam.z - p.z) < 1.0 && cam.y < 2.2;
    const wantOpacity = blocking || tooClose ? 0 : 1;
    fade.current += (wantOpacity - fade.current) * Math.min(1, dt * 9);
    const o = fade.current;
    mat.opacity = o;
    mat.depthWrite = o > 0.98;
    coreMat.opacity = o;
    shadowMat.opacity = 0.55 * o;
    haloMat.opacity = 0.75 * o;
    if (root.current) root.current.visible = o > 0.02;

    // Lantern: colour cycles through captured ghosts.
    const caught = game.lantern;
    if (caught.length) {
      const c = GHOSTS[caught[Math.floor(rt.time * 0.8) % caught.length]].glow;
      coreMat.color.lerp(tmpColor.set(c), 0.05);
      haloMat.color.copy(coreMat.color);
    }
    if (lanternRef.current) {
      lanternRef.current.getWorldPosition(tmp);
      rt.lantern.x = tmp.x;
      rt.lantern.y = tmp.y;
      rt.lantern.z = tmp.z;
    }
    if (light.current) light.current.intensity = 2.6 + Math.sin(rt.time * 7) * 0.15 + caught.length * 0.25;

    // Which object can be searched from here.
    if (game.screen === "game" && game.phase === "explore") {
      const focus = nearestSearchable(p.x, p.z, p.yaw);
      if (focus !== game.focusId) setGame({ focusId: focus });
    }
  });

  return (
    <group ref={root}>
      <group ref={bob}>
        <mesh geometry={body} material={mat} />
        <group ref={legL} position={[-0.09, 0.4, 0]}>
          <mesh geometry={leg} material={mat} />
        </group>
        <group ref={legR} position={[0.09, 0.4, 0]}>
          <mesh geometry={leg} material={mat} />
        </group>
        <group ref={armL} position={[-0.25, 0.82, 0]} rotation={[0, 0, -0.15]}>
          <mesh geometry={arm} material={mat} />
        </group>
        <group ref={armR} position={[0.25, 0.82, 0]} rotation={[0.35, 0, 0.15]}>
          <mesh geometry={arm} material={mat} />
          <group ref={lanternRef} position={[0, -0.5, 0.02]} rotation={[-0.35, 0, -0.15]}>
            <mesh geometry={lantern} material={mat} />
            <mesh position={[0, 0.07, 0]} material={coreMat}>
              <sphereGeometry args={[0.05, 12, 10]} />
            </mesh>
            <sprite material={haloMat} position={[0, 0.07, 0]} scale={[0.55, 0.55, 1]} />
            <pointLight ref={light} position={[0, 0.1, 0]} color="#ffcf8a" intensity={2.6} distance={4.5} decay={1.6} />
          </group>
        </group>
      </group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]} material={shadowMat}>
        <planeGeometry args={[0.9, 0.9]} />
      </mesh>
    </group>
  );
}
