import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { rt } from "../game/runtime";
import { onStairs, stairsT } from "../game/world/collision";
import { FLOOR_Y } from "../game/world/rooms";

/** One quiet cyan ring, distinct from the gold beacon and floating search markers. */
export function Destination() {
  const mesh = useRef<THREE.Mesh>(null);
  const material = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(() => {
    const d = rt.destination;
    if (!mesh.current || !material.current) return;
    const age = rt.time - d.t0;
    const fade = d.arrived < 0 ? 1 : Math.max(0, 1 - (rt.time - d.arrived) / 0.45);
    mesh.current.visible = d.visible && d.floor === rt.view.floor && fade > 0;
    if (!mesh.current.visible) return;
    const y = onStairs(d.x, d.z) ? stairsT(d.x) * FLOOR_Y[1] : FLOOR_Y[d.floor];
    mesh.current.position.set(d.x, y + 0.025, d.z);
    mesh.current.scale.setScalar(1 + Math.exp(-age * 6) * 0.5);
    material.current.opacity = Math.min(1, age * 10) * fade * 0.55;
  });
  return (
    <mesh ref={mesh} rotation={[-Math.PI / 2, 0, 0]} visible={false} raycast={() => {}}>
      <ringGeometry args={[0.19, 0.24, 32]} />
      <meshBasicMaterial ref={material} color="#91e8e0" transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </mesh>
  );
}
