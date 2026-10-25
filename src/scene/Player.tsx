import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { rt } from "../game/runtime";
import { getGame, setGame } from "../game/store";
import { keyboardMove } from "../input/keyboard";
import { floorState, moveBody, nearestSearchable } from "../game/world/collision";
import { findPath } from "../game/world/nav";
import { WORLD } from "../game/world/world";
import { GHOSTS } from "../game/ghosts";
import { audio } from "../audio/audio";
import { director } from "../game/director";
import { startlePose } from "../game/logic/startle";
import { cancelsAutoEntry } from "../game/beacon";
import { exitIntent } from "../game/logic/exitTrack";
import { HumanFigure, useHumanFigure } from "./HumanFigure";

const SPEED = 3.1;
export function Player() {
  const rig = useHumanFigure();
  const { mat, coreMat, fade, haloMat, shadowMat, root, halo, bob, legL, legR, armL, armR, lanternRef, light } = rig;
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const tmpColor = useMemo(() => new THREE.Color(), []);
  const lastStep = useRef(0);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1); // real time down to 10 fps (slow Chromebooks)
    const p = rt.player;
    const game = getGame();
    const canMove = game.screen === "game" && game.phase === "explore" && !game.settingsOpen && !p.frozen;
    director.checkBeacon();

    let mx = 0;
    let my = 0;
    if (canMove) {
      const k = keyboardMove();
      mx = k.x + rt.joy.x;
      my = k.y + rt.joy.y;
    } else {
      p.walkTo = null;
      rt.destination.visible = false;
    }

    if (mx === 0 && my === 0) rt.camera.inputLock = null;
    const yaw = rt.camera.inputLock ?? rt.camera.yaw;
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    const rx = Math.cos(yaw);
    const rz = -Math.sin(yaw);
    let dx = rx * mx + fx * my;
    let dz = rz * mx + fz * my;
    if ((mx !== 0 || my !== 0) && (!p.walkTo?.auto || cancelsAutoEntry(dx, dz, p.walkTo.auto))) {
      p.walkTo = null;
      rt.destination.visible = false;
    }

    // Paths only supply intent: acceleration, turning and moveBody stay shared with keys/joystick.
    if (canMove && p.walkTo) {
      const w = p.walkTo;
      let point = w.path[w.index];
      while (point && p.floor === point.floor && Math.hypot(point.x - p.x, point.z - p.z) < 0.045) {
        point = w.path[++w.index];
      }
      if (!point) {
        p.walkTo = null;
        rt.destination.arrived = rt.time;
        const obj = w.objectId ? WORLD.objectById.get(w.objectId) : null;
        if (obj) {
          p.yaw = Math.atan2((obj.rect.x0 + obj.rect.x1) / 2 - p.x, (obj.rect.z0 + obj.rect.z1) / 2 - p.z);
          director.tapObject(obj.id);
        }
      } else {
        const ax = point.x - p.x;
        const az = point.z - p.z;
        const l = Math.hypot(ax, az) || 1;
        // The ramp rises 1 m per horizontal metre: keep automatic entry's
        // actual 3D speed at walking speed, even at the 0.1 s frame cap.
        const throttle = Math.min(w.auto?.ramp ? Math.SQRT1_2 : 1, l * 4, l / (SPEED * dt));
        dx = ax / l * throttle;
        dz = az / l * throttle;
        // Retry once from the actual body position, then retain the old stuck give-up behavior.
        if (rt.time - w.checkT > 0.8) {
          const moved = Math.hypot(p.x - w.checkX, p.z - w.checkZ);
          if (moved < 0.12) {
            const path = w.replans === 0 ? findPath(p, w, (id) => rt.doorsOpen.has(id), w.objectId) : null;
            if (path?.length) {
              w.path = path;
              w.index = 0;
              w.replans++;
            } else {
              p.walkTo = null;
              rt.destination.visible = false;
              dx = dz = 0;
            }
          }
          w.checkT = rt.time;
          w.checkX = p.x;
          w.checkZ = p.z;
        }
      }
    }

    // The ending: only forward along the exit track, whatever the input (keys, joystick, a tap).
    if (rt.exit.active) {
      p.walkTo = null;
      rt.destination.visible = false;
      const go = canMove ? exitIntent(dx, dz, rt.exit.tapped, p.z) : { x: 0, z: 0 };
      dx = go.x;
      dz = go.z;
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
        const r = moveBody(p.x + (p.vx * dt) / steps, p.z + (p.vz * dt) / steps, p.floor, (id) => rt.doorsOpen.has(id));
        p.x = r.x;
        p.z = r.z;
        p.floor = r.floor;
      }
    }
    // Height follows the stairs; the floor you are on is the floor that is drawn.
    const fs = floorState(p.x, p.z, p.floor);
    p.floor = fs.floor;
    p.stairs = fs.stairs;
    p.y += (fs.y - p.y) * (Math.abs(fs.y - p.y) > 1.5 ? 1 : Math.min(1, dt * 18));
    rt.view.floor = p.floor;
    if (speed > 0.2) {
      const target = Math.atan2(p.vx, p.vz);
      let d = target - p.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      p.yaw += d * Math.min(1, dt * 12);
    }

    // The intro's startled hop: up, arms out, leaning back, then a smooth turn (driven by rt.time).
    let lift = 0;
    let lean = 0;
    let arms = 0;
    let stretch = 1;
    if (p.startle) {
      const pose = startlePose(rt.time - p.startle.t0);
      p.yaw = p.startle.from + p.startle.delta * pose.turn;
      lift = pose.lift;
      lean = pose.lean;
      arms = pose.arms;
      stretch = pose.stretch;
      if (pose.done) p.startle = null;
    }

    // Walk cycle.
    const moving = Math.min(1, speed / SPEED);
    p.step += dt * speed * 3.1;
    const swing = Math.sin(p.step) * 0.6 * moving;
    if (legL.current) legL.current.rotation.x = swing;
    if (legR.current) legR.current.rotation.x = -swing;
    if (armL.current) {
      armL.current.rotation.x = -swing * 0.8 - arms * 0.35;
      armL.current.rotation.z = -0.15 - arms * 1.85;
    }
    if (armR.current) {
      armR.current.rotation.x = 0.35 + swing * 0.25 - arms * 0.6;
      armR.current.rotation.z = 0.15 + arms * 1.85;
      // the lantern keeps hanging upright from the hand, however the arm moves
      if (lanternRef.current) lanternRef.current.quaternion.copy(armR.current.quaternion).invert();
    }
    if (bob.current) {
      bob.current.position.y = Math.abs(Math.cos(p.step)) * 0.045 * moving + Math.sin(rt.time * 2) * 0.004 + lift;
      bob.current.rotation.x = lean;
      bob.current.scale.set(1 / Math.sqrt(stretch), stretch, 1 / Math.sqrt(stretch));
    }
    const stepIndex = Math.floor(p.step / Math.PI);
    if (stepIndex !== lastStep.current) {
      lastStep.current = stepIndex;
      if (moving > 0.4) audio.play("step");
    }

    if (root.current) {
      root.current.position.set(p.x, p.y, p.z);
      root.current.rotation.y = p.yaw;
    }

    // Fade out when standing between the camera and what it is looking at.
    const cam = rt.camera.pos;
    const tgt = rt.camera.target;
    const sx = tgt.x - cam.x;
    const sy = tgt.y - cam.y;
    const sz = tgt.z - cam.z;
    const sl = sx * sx + sy * sy + sz * sz || 1;
    const chest = p.y + 0.75;
    const t = ((p.x - cam.x) * sx + (chest - cam.y) * sy + (p.z - cam.z) * sz) / sl;
    const cx = cam.x + sx * Math.min(1, Math.max(0, t)) - p.x;
    const cy = cam.y + sy * Math.min(1, Math.max(0, t)) - chest;
    const cz = cam.z + sz * Math.min(1, Math.max(0, t)) - p.z;
    const blocking = rt.camera.mode !== "follow" && !rt.camera.shot?.keepPlayer && t > 0.02 && t < 0.98 && Math.hypot(cx, cy, cz) < 0.8;
    const tooClose = Math.hypot(cam.x - p.x, cam.z - p.z) < 1.0 && cam.y < p.y + 2.2;
    const wantOpacity = blocking || tooClose ? 0 : 1;
    fade.current += (wantOpacity - fade.current) * Math.min(1, dt * 9);
    const o = fade.current;
    p.opacity = o;
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
    // The ending: the lantern blazes with every ghost inside, cycling their colours quickly.
    const burst = rt.time - rt.lanternBurstT0;
    const blaze = burst >= 0 && burst < 4.5 ? Math.sin(Math.min(1, burst / 0.6) * Math.PI * 0.5) * Math.min(1, (4.5 - burst) / 1.2) : 0;
    if (blaze > 0 && caught.length) {
      const c = GHOSTS[caught[Math.floor(rt.time * 6) % caught.length]].glow;
      coreMat.color.lerp(tmpColor.set(c), 0.3);
      haloMat.color.copy(coreMat.color);
    }
    if (halo.current) halo.current.scale.setScalar(0.55 * (1 + blaze * 3.5));
    if (light.current) light.current.intensity = 2.6 + Math.sin(rt.time * 7) * 0.15 + caught.length * 0.25 + blaze * 9;

    // Which object can be searched from here.
    if (game.screen === "game" && game.phase === "explore") {
      const focus = p.stairs ? null : nearestSearchable(p.x, p.z, p.yaw, p.floor);
      if (focus !== game.focusId) setGame({ focusId: focus });
    }
  });

  return <HumanFigure rig={rig} />;
}

