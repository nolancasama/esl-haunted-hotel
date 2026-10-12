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
  const { camera } = useThree();
  const pos = useRef(new THREE.Vector3(0, 6, 6));
  const look = useRef(new THREE.Vector3());
  const want = useRef(new THREE.Vector3());
  const wantLook = useRef(new THREE.Vector3());
  const ready = useRef(false);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    cameraRef.current = camera as THREE.PerspectiveCamera;
    const c = rt.camera;
    const screen = getGame().screen;
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
      const ty = 0.85;
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
    camera.lookAt(look.current);
    c.pos.x = pos.current.x;
    c.pos.y = pos.current.y;
    c.pos.z = pos.current.z;
    c.target.x = look.current.x;
    c.target.y = look.current.y;
    c.target.z = look.current.z;
  });
  return null;
}
