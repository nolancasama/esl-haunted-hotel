import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { rt } from "../game/runtime";
import { ROOMS, roomAt } from "../game/world/rooms";
import { getGame } from "../game/store";
import { audio } from "../audio/audio";
import { tts } from "../audio/tts";
import { animateSharedMaterials } from "./materials";

/** Lightning brightness envelope: two quick flashes and a fade. */
export function flashLevel(t: number): number {
  if (t < 0 || t > 0.9) return 0;
  if (t < 0.07) return 1;
  if (t < 0.15) return 0.15;
  if (t < 0.24) return 0.85;
  return Math.max(0, 1 - (t - 0.24) / 0.6) * 0.35;
}

/**
 * Small fixed light set (Chromebook budget): hemisphere + moon + one warm
 * "room light" that moves to the lamp of the room the player is in, plus the
 * lantern light on the player. Changing light counts recompiles shaders, so
 * lights are never added or removed - only moved and dimmed.
 */
export function Lights() {
  const hemi = useRef<THREE.HemisphereLight>(null);
  const flash = useRef<THREE.DirectionalLight>(null);
  const room = useRef<THREE.PointLight>(null);
  const nextFlash = useRef(8);

  useFrame((_, dt) => {
    const game = getGame();
    // Lightning, but never while Boo talks or the microphone listens.
    const calm = game.screen !== "game" || (game.phase !== "answer" && !tts.isSpeaking() && !audio.isListening);
    if (rt.time > nextFlash.current && calm && game.phase !== "outro") {
      rt.flashT0 = rt.time;
      nextFlash.current = rt.time + 18 + Math.random() * 20;
      window.setTimeout(() => audio.thunder(0.55 + Math.random() * 0.3), 500 + Math.random() * 900);
    }
    const f = flashLevel(rt.time - rt.flashT0);
    if (flash.current) flash.current.intensity = f * 2.6;
    if (hemi.current) hemi.current.intensity = 1.1 + f * 0.8;
    animateSharedMaterials(rt.time, f);

    // Warm room light follows the player's room.
    const id = roomAt(rt.player.x, rt.player.z);
    const r = (id && ROOMS[id]) || null;
    const l = room.current;
    if (l && r) {
      const k = Math.min(1, dt * 3);
      l.position.x += (r.lamp.x - l.position.x) * k;
      l.position.y += (r.lamp.y - l.position.y) * k;
      l.position.z += (r.lamp.z - l.position.z) * k;
      l.color.lerp(new THREE.Color(r.lamp.color), k);
      l.intensity += (r.lamp.intensity - l.intensity) * k;
    }
  });

  return (
    <group>
      <hemisphereLight ref={hemi} args={["#9a8cff", "#2b1745", 1.1]} />
      <ambientLight color="#4b3b7d" intensity={0.45} />
      <directionalLight color="#a9b9ff" intensity={0.75} position={[-6, 12, -10]} />
      <directionalLight ref={flash} color="#e4ebff" intensity={0} position={[-4, 14, -6]} />
      <pointLight ref={room} color="#ffc98a" intensity={8} distance={11} decay={1.5} position={[-4, 2.4, -7.5]} />
    </group>
  );
}
