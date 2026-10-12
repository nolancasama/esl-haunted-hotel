import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { rt } from "../game/runtime";
import { Hotel } from "./Hotel";
import { Furniture } from "./Furniture";
import { Player } from "./Player";
import { Boo, GhostActor } from "./Ghosts";
import { Markers } from "./Markers";
import { Effects } from "./Effects";
import { Lights } from "./Lights";
import { CameraRig } from "./CameraRig";

function Clock() {
  // Runs before everything else each frame.
  useFrame((_, dt) => {
    rt.time += Math.min(dt, 0.1) * rt.timeScale;
  }, -10);
  return null;
}

export function GameScene() {
  return (
    <Canvas
      className="scene"
      dpr={[1, 1.5]}
      gl={{ antialias: true, powerPreference: "high-performance", preserveDrawingBuffer: false }}
      camera={{ fov: 50, near: 0.1, far: 70, position: [0, 6, 6] }}
      flat
      onCreated={({ gl, scene }) => {
        gl.setClearColor("#0d0719");
        scene.fog = new THREE.Fog("#120a22", 13, 30);
      }}
    >
      <Clock />
      <Lights />
      <Hotel />
      <Furniture />
      <Player />
      <Boo />
      <GhostActor />
      <Markers />
      <Effects />
      <CameraRig />
    </Canvas>
  );
}
