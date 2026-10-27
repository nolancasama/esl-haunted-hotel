import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getHideSeek } from "../game/hideSeek/session";
import { hasLineOfSight } from "../game/hideSeek/perception";
import { ROOMS, FLOOR_Y } from "../game/world/rooms";
import { WORLD } from "../game/world/world";
import { audio } from "../audio/audio";
import { rt } from "../game/runtime";
import { HumanFigure, useHumanFigure } from "./HumanFigure";

/** The detective's footsteps: quiet across the room, clear up close. */
function footstep(x: number, z: number, ghost: { x: number; z: number }) {
  const distance = Math.hypot(x - ghost.x, z - ghost.z);
  const gain = Math.max(0.15, Math.min(1.25, 1.7 / (1 + distance * 0.6)));
  // Pan from where the view is facing: left of the picture sounds from the left.
  const c = rt.camera;
  const fx = c.target.x - c.pos.x, fz = c.target.z - c.pos.z;
  const fl = Math.hypot(fx, fz) || 1;
  const dx = x - c.pos.x, dz = z - c.pos.z;
  const dl = Math.hypot(dx, dz) || 1;
  const pan = ((dx / dl) * (-fz / fl) + (dz / dl) * (fx / fl)) * 0.7;
  audio.play("step", { gain, pan });
}

const CONE_RAYS = 25;
const CONE_RANGE = 5;
const CONE_HALF_ANGLE = 35 * Math.PI / 180;

/**
 * Samples the same public collision geometry used by detective perception.
 * A binary search keeps each fan ray at the first wall or tall furniture it meets.
 */
function clippedConeGeometry(room: Parameters<typeof hasLineOfSight>[0], x: number, z: number, yaw: number, base: number) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  const eye = { x, y: base + 1.4, z };
  for (let i = 0; i <= CONE_RAYS; i++) {
    const angle = -CONE_HALF_ANGLE + (i / CONE_RAYS) * CONE_HALF_ANGLE * 2;
    const heading = yaw + angle;
    let near = 0;
    let far = CONE_RANGE;
    // Test a floor-level endpoint so tall furniture makes a visible notch in the fan.
    const clear = (distance: number) => hasLineOfSight(room, eye, {
      x: x + Math.sin(heading) * distance,
      y: base + 0.05,
      z: z + Math.cos(heading) * distance
    });
    if (!clear(far)) {
      for (let sample = 0; sample < 9; sample++) {
        const middle = (near + far) / 2;
        if (clear(middle)) near = middle;
        else far = middle;
      }
    } else near = far;
    // Geometry is in detective-local space; its rotation is handled by the group.
    shape.lineTo(Math.sin(angle) * near, Math.cos(angle) * near);
  }
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
}

/** Visual controller only: every decision and position comes from the accepted core. */
export function Detective() {
  const rig = useHumanFigure();
  const cone = useRef<THREE.Group>(null);
  const coneMesh = useRef<THREE.Mesh>(null);
  const step = useRef(0);
  const gait = useRef({ x: 0, z: 0, movedAt: -1e9, crouch: 0 });
  const coneGeo = useMemo(() => new THREE.ShapeGeometry(), []);
  const coneRefresh = useRef(0);
  useFrame((_, dt) => {
    const m = getHideSeek().match;
    if (!m) return;
    const d = m.detective;
    const y = FLOOR_Y[ROOMS[m.config.room].floor];
    // Walking means actually covering ground: a paused match (decision, English, settings) stands still.
    const now = performance.now();
    const g = gait.current;
    if (Math.hypot(d.x - g.x, d.z - g.z) > 1e-4) { g.movedAt = now; g.x = d.x; g.z = d.z; }
    const moving = d.anim === "walk" && m.status === "playing" && now - g.movedAt < 160;
    const before = step.current;
    if (!m.english) step.current += Math.min(dt, 0.1) * (moving ? 8 : 1.8);
    const t = step.current;
    // A footstep each time a foot comes down (twice per stride), louder and more central when close.
    if (moving && Math.floor(before / Math.PI) !== Math.floor(t / Math.PI)) footstep(d.x, d.z, m.ghost);
    const swing = moving ? Math.sin(t) * 0.48 : 0;
    // Looking under something: crouch down low with the lantern forward.
    const target = d.target ? WORLD.spotById.get(d.target) : null;
    const wantCrouch = d.anim === "inspect" && target?.prep === "under" ? 1 : 0;
    g.crouch += (wantCrouch - g.crouch) * Math.min(1, Math.min(dt, 0.1) * 6);
    rig.root.current?.position.set(d.x, y, d.z);
    if (rig.root.current) rig.root.current.rotation.y = d.yaw;
    if (rig.legL.current) rig.legL.current.rotation.x = swing - g.crouch * 1.55;
    if (rig.legR.current) rig.legR.current.rotation.x = -swing - g.crouch * 1.55;
    if (rig.bob.current) {
      rig.bob.current.position.y = (moving ? Math.abs(Math.cos(t)) * 0.035 : d.anim === "celebrate" ? Math.abs(Math.sin(t * 3)) * 0.16 : 0) - g.crouch * 0.12;
      rig.bob.current.rotation.x = d.anim === "inspect" ? 0.4 + g.crouch * 0.15 : g.crouch * 0.55;
      rig.bob.current.rotation.y = d.anim === "think" ? Math.sin(t) * 0.22 : 0;
    }
    if (rig.armL.current) {
      rig.armL.current.rotation.x = -swing * 0.8;
      rig.armL.current.rotation.z = d.anim === "react" ? -0.9 : d.anim === "celebrate" ? -2.1 : -0.15;
    }
    if (rig.armR.current) {
      rig.armR.current.rotation.x = d.anim === "inspect" ? -0.65 : 0.35 + swing * 0.25;
      rig.armR.current.rotation.z = d.anim === "react" ? 0.9 : d.anim === "celebrate" ? 2.1 : 0.15;
      rig.lanternRef.current?.quaternion.copy(rig.armR.current.quaternion).invert();
    }
    if (cone.current) {
      cone.current.position.set(d.x, y + 0.025, d.z);
      cone.current.rotation.y = d.yaw;
      cone.current.visible = m.status === "playing";
    }
    // Public geometry only, capped below 10 Hz to keep this one visual draw inexpensive.
    coneRefresh.current += Math.min(dt, 0.1);
    if (coneMesh.current && coneRefresh.current >= 0.1) {
      coneRefresh.current = 0;
      const geometry = clippedConeGeometry(m.config.room, d.x, d.z, d.yaw, y);
      const previous = coneMesh.current.geometry;
      coneMesh.current.geometry = geometry;
      previous.dispose();
    }
  });
  return <>
    <HumanFigure rig={rig} />
    <group ref={cone}>
      <mesh ref={coneMesh} geometry={coneGeo} rotation={[Math.PI / 2, 0, 0]}>
        <meshBasicMaterial color="#ffdb83" transparent opacity={0.075} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  </>;
}
