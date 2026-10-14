import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { rt } from "../game/runtime";
import { ROOMS, roomAt } from "../game/world/rooms";
import { getGame } from "../game/store";
import { audio } from "../audio/audio";
import { tts } from "../audio/tts";
import { animateSharedMaterials } from "./materials";
import { sunrise } from "./Outside";

/** Lightning brightness envelope: two quick flashes and a fade. */
export function flashLevel(t: number): number {
  if (t < 0 || t > 0.9) return 0;
  if (t < 0.07) return 1;
  if (t < 0.15) return 0.15;
  if (t < 0.24) return 0.85;
  return Math.max(0, 1 - (t - 0.24) / 0.6) * 0.35;
}

/** Lights stutter for a moment (the door slams in the intro, the bang upstairs). */
function flickerLevel(t: number): number {
  if (t < 0 || t > 1.6) return 1;
  const k = Math.floor(t * 14);
  const pattern = [1, 0.15, 0.8, 0.05, 0.05, 0.9, 0.3, 1, 0.1, 0.7, 1, 0.4, 1, 1, 0.6, 1, 1, 1, 1, 1, 1, 1, 1];
  return pattern[k] ?? 1;
}

/** Shadow switches the lights off: dark for a moment, then they come back with a stutter. */
function blackoutLevel(t: number): number {
  if (t < 0 || t > 2.2) return 1;
  if (t < 0.12) return 1 - t / 0.12 * 0.88;
  if (t < 1.4) return 0.12;
  const k = (t - 1.4) / 0.8;
  return 0.12 + 0.88 * k * (Math.floor(t * 12) % 3 === 0 ? 0.5 : 1);
}

/** Warm indoor light once the sun is up (the ending). */
const DAWN_ROOM = new THREE.Color("#ffd9a0");

const NIGHT = {
  sky: new THREE.Color("#9a8cff"),
  ground: new THREE.Color("#2b1745"),
  clear: new THREE.Color("#0d0719"),
  fog: new THREE.Color("#120a22")
};
const DAWN = {
  sky: new THREE.Color("#ffe6c4"),
  ground: new THREE.Color("#8a7458"),
  clear: new THREE.Color("#f0b98c"),
  fog: new THREE.Color("#e7c09c")
};
const NIGHT_AMBIENT = new THREE.Color("#4b3b7d");
const DAWN_AMBIENT = new THREE.Color("#ffd6a8");

/**
 * Small fixed light set (Chromebook budget): hemisphere + moon + one warm
 * "room light" that moves to the lamp of the room the player is in, plus the
 * lantern light on the player. Changing light counts recompiles shaders, so
 * lights are never added or removed - only moved and dimmed.
 */
export function Lights() {
  const hemi = useRef<THREE.HemisphereLight>(null);
  const flash = useRef<THREE.DirectionalLight>(null);
  const moon = useRef<THREE.DirectionalLight>(null);
  const ambient = useRef<THREE.AmbientLight>(null);
  const room = useRef<THREE.PointLight>(null);
  const nextFlash = useRef(8);
  const tmp = useMemo(() => new THREE.Color(), []);
  const flashColor = useMemo(() => new THREE.Color("#e4ebff"), []);
  const sunColor = useMemo(() => new THREE.Color("#ffd7a0"), []);

  useFrame((state, dt) => {
    const game = getGame();
    const sun = sunrise();
    // Lightning, but never while Boo talks or the microphone listens, and not after dawn.
    const calm = game.screen !== "game" || (game.phase !== "answer" && !tts.isSpeaking() && !audio.isListening);
    if (rt.time > nextFlash.current && calm && sun === 0 && game.phase !== "outro") {
      rt.flashT0 = rt.time;
      nextFlash.current = rt.time + 18 + Math.random() * 20;
      window.setTimeout(() => audio.thunder(0.55 + Math.random() * 0.3), 500 + Math.random() * 900);
    }
    const f = flashLevel(rt.time - rt.flashT0) * (1 - sun);
    const flicker = flickerLevel(rt.time - rt.flickerT0) * blackoutLevel(rt.time - rt.blackoutT0);

    if (flash.current) {
      // The lightning light doubles as the morning sun, low in the west.
      flash.current.color.copy(flashColor).lerp(sunColor, sun);
      flash.current.intensity = f * 2.6 + sun * 2.3;
      flash.current.position.set(-4 - sun * 14, 14 - sun * 8, -6 + sun * 6);
    }
    if (hemi.current) {
      hemi.current.color.copy(NIGHT.sky).lerp(DAWN.sky, sun);
      hemi.current.groundColor.copy(NIGHT.ground).lerp(DAWN.ground, sun);
      hemi.current.intensity = (1.1 + f * 0.8 + sun * 0.5) * (0.55 + 0.45 * flicker);
    }
    const dark = blackoutLevel(rt.time - rt.blackoutT0);
    if (moon.current) moon.current.intensity = 0.75 * (1 - sun) * dark;
    if (ambient.current) {
      ambient.current.color.copy(NIGHT_AMBIENT).lerp(DAWN_AMBIENT, sun);
      ambient.current.intensity = (0.45 + sun * 0.5) * (0.4 + 0.6 * dark);
    }
    state.gl.setClearColor(tmp.copy(NIGHT.clear).lerp(DAWN.clear, sun));
    if (state.scene.fog) (state.scene.fog as THREE.Fog).color.copy(NIGHT.fog).lerp(DAWN.fog, sun);
    animateSharedMaterials(rt.time, f, sun);

    // Warm room light follows the player's room (on the floor being drawn).
    const id = roomAt(rt.player.x, rt.player.z, rt.view.floor);
    const r = id ? ROOMS[id] : null;
    const l = room.current;
    if (l && r) {
      const k = Math.min(1, dt * 3);
      // Changing floors moves the light at once (it would sweep through the ceiling).
      const jump = Math.abs(r.lamp.y - l.position.y) > 1.5 ? 1 : k;
      l.position.x += (r.lamp.x - l.position.x) * jump;
      l.position.y += (r.lamp.y - l.position.y) * jump;
      l.position.z += (r.lamp.z - l.position.z) * jump;
      l.color.lerp(tmp.set(r.lamp.color), k);
      if (sun > 0) l.color.lerp(DAWN_ROOM, sun * 0.6);
      const want = r.lamp.intensity * flicker;
      l.intensity += (want - l.intensity) * (flicker < 1 ? 1 : k);
    }
  });

  return (
    <group>
      <hemisphereLight ref={hemi} args={["#9a8cff", "#2b1745", 1.1]} />
      <ambientLight ref={ambient} color="#4b3b7d" intensity={0.45} />
      <directionalLight ref={moon} color="#a9b9ff" intensity={0.75} position={[-6, 12, -10]} />
      <directionalLight ref={flash} color="#e4ebff" intensity={0} position={[-4, 14, -6]} />
      <pointLight ref={room} color="#ffc98a" intensity={8} distance={11} decay={1.5} position={[-4, 2.4, -7.5]} />
    </group>
  );
}
