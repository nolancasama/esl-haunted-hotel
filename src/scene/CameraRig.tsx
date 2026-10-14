import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { rt } from "../game/runtime";
import { getGame } from "../game/store";

/** The live camera, for projecting markers to the screen (keyboard navigation). */
export const cameraRef: { current: THREE.PerspectiveCamera | null } = { current: null };

/**
 * Third-person camera: elevated, restrained, no bobbing. Follows the player
 * with smoothing; eases to scripted shots for close-ups and cutscenes.
 */
export function CameraRig() {
  const { camera, size } = useThree();
  const shift = useRef(0);
  const pos = useRef(new THREE.Vector3(0, 6, 6));
  const look = useRef(new THREE.Vector3());
  const want = useRef(new THREE.Vector3());
  const wantLook = useRef(new THREE.Vector3());
  const ready = useRef(false);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    cameraRef.current = camera as THREE.PerspectiveCamera;
    const c = rt.camera;
    const screen = getGame().screen;
    if (c.yawTarget !== null) {
      let d = c.yawTarget - c.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      c.yaw += d * (1 - Math.exp(-dt * 2.2));
      if (Math.abs(d) < 0.01) c.yawTarget = null;
    }
    if (screen === "title" || screen === "results") {
      // Slow orbit around the bedroom behind the title card.
      const t = rt.time * 0.07;
      const cx = -4;
      const cz = -7.5;
      want.current.set(cx + Math.sin(t) * 6.4, 4.4, cz + Math.cos(t) * 6.4);
      wantLook.current.set(cx, 0.7, cz);
    } else if (c.mode === "follow" || !c.shot) {
      const tx = rt.player.x;
      const tz = rt.player.z;
      const ty = rt.player.y + 0.85;
      const horiz = c.dist * Math.cos(c.pitch);
      want.current.set(tx + Math.sin(c.yaw) * horiz, ty + c.dist * Math.sin(c.pitch), tz + Math.cos(c.yaw) * horiz);
      wantLook.current.set(tx, ty, tz);
    } else {
      want.current.set(c.shot.pos.x, c.shot.pos.y, c.shot.pos.z);
      wantLook.current.set(c.shot.target.x, c.shot.target.y, c.shot.target.z);
    }
    if (!ready.current || c.snap) {
      pos.current.copy(want.current);
      look.current.copy(wantLook.current);
      ready.current = true;
      c.snap = false;
    }
    const k = 1 - Math.exp(-dt * (c.mode === "follow" ? 5.5 : 3.4));
    pos.current.lerp(want.current, k);
    look.current.lerp(wantLook.current, k);
    camera.position.copy(pos.current);
    // A short shake (the bang upstairs, the last capture).
    const st = rt.time - c.shake.t0;
    if (st >= 0 && st < 0.9) {
      const s = c.shake.amp * (1 - st / 0.9);
      camera.position.x += Math.sin(rt.time * 61) * s;
      camera.position.y += Math.sin(rt.time * 47 + 1) * s * 0.6;
    }
    camera.lookAt(look.current);

    // Lens shift: while the answer panel covers the bottom of the screen, move the
    // picture up so the found ghost stays in the visible part (matters on short screens).
    const game = getGame();
    let wantShift = 0;
    if (game.screen === "game" && (game.phase === "answer" || game.answer.status === "correct")) {
      const panel = document.querySelector('[data-testid="answer-panel"]');
      if (panel) wantShift = Math.min(0.3, (panel.getBoundingClientRect().height + 24) / 2 / size.height);
    }
    shift.current += (wantShift - shift.current) * Math.min(1, dt * 5);
    const cam = camera as THREE.PerspectiveCamera;
    if (shift.current > 0.002) cam.setViewOffset(size.width, size.height, 0, shift.current * size.height, size.width, size.height);
    else if (cam.view?.enabled) cam.clearViewOffset();
    c.pos.x = pos.current.x;
    c.pos.y = pos.current.y;
    c.pos.z = pos.current.z;
    c.target.x = look.current.x;
    c.target.y = look.current.y;
    c.target.z = look.current.z;
  });
  return null;
}
