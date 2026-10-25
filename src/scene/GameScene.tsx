import { useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { rt } from "../game/runtime";
import { Hotel } from "./Hotel";
import { Furniture } from "./Furniture";
import { Player } from "./Player";
import { Boo, GhostActor } from "./Ghosts";
import { Markers } from "./Markers";
import { Effects } from "./Effects";
import { Cobwebs } from "./Cobwebs";
import { Lights } from "./Lights";
import { CameraRig } from "./CameraRig";
import { Destination } from "./Destination";
import { director } from "../game/director";
import { isCanvasTap } from "../input/tap";
import { getGame, useGame } from "../game/store";
import { HideSeekScene } from "./HideSeekScene";

/** The WebGL renderer (for the e2e hook's performance numbers). */
export const rendererRef: { current: THREE.WebGLRenderer | null } = { current: null };

/**
 * Weak GPUs on high-DPI Chromebooks: if frames stay slow for a few seconds,
 * drop to 1x pixels (once; never flips back and forth).
 */
function AdaptivePixelRatio() {
  const setDpr = useThree((s) => s.setDpr);
  const dpr = useThree((s) => s.viewport.dpr);
  const acc = useRef({ time: 0, frames: 0, done: false });
  useFrame((_, dt) => {
    const a = acc.current;
    if (a.done || dpr <= 1) return;
    a.time += dt;
    a.frames++;
    if (a.time > 4) {
      if (a.frames / a.time < 28) {
        setDpr(1);
        a.done = true;
      }
      a.time = 0;
      a.frames = 0;
    }
  });
  return null;
}

function Clock() {
  // Runs before everything else each frame.
  useFrame((_, dt) => {
    rt.time += Math.min(dt, 0.1) * rt.timeScale;
  }, -10);
  return null;
}

export function GameScene() {
  const hideSeek = useGame((s) => s.screen === "hideseek");
  return (
    <Canvas
      className="scene"
      dpr={[1, 1.5]}
      gl={{ antialias: true, powerPreference: "high-performance", preserveDrawingBuffer: false }}
      camera={{ fov: 50, near: 0.1, far: 70, position: [0, 6, 6] }}
      flat
      // A tap on nothing in particular (the sky, the grass) still walks the player out at the end.
      onPointerMissed={() => {
        if (getGame().screen !== "hideseek" && isCanvasTap(0)) director.tapExit();
      }}
      onCreated={({ gl, scene }) => {
        rendererRef.current = gl;
        gl.setClearColor("#0d0719");
        scene.fog = new THREE.Fog("#120a22", 13, 30);
      }}
    >
      <AdaptivePixelRatio />
      {hideSeek ? <HideSeekScene /> : <>
      <Clock />
      <Lights />
      <Hotel />
      <Furniture />
      <Player />
      <Destination />
      <Boo />
      <GhostActor />
      <Markers />
      <Effects />
      <Cobwebs />
      <CameraRig />
      </>}
    </Canvas>
  );
}
