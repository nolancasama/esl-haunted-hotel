import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { rt } from "../game/runtime";
import { FLOOR_Y } from "../game/world/rooms";
import { PartBuilder } from "./partBuilder";

/** A once-busy bellhop's luggage trolley: common hotel furniture made eerie
 * by its single unclaimed suitcase. One merged mesh, no dynamic lights.
 * Tucked beside the wall so the Guest Wing entrance remains broad and clear.
 */
export function GuestWingEntrance() {
  const geometry = useMemo(() => {
    const b = new PartBuilder(0.35);
    const brass = "#a78a49";
    const dull = "#766340";
    const rubber = "#282630";
    const wood = "#553b30";
    b.box(1.18, 0.08, 0.76, 0, 0.22, 0, wood);
    b.box(1.12, 0.025, 0.70, 0, 0.30, 0, brass);
    for (const x of [-0.50, 0.50]) {
      for (const z of [-0.29, 0.29]) {
        b.cylAt(0.095, 0.062, [x, 0.12, z], [Math.PI / 2, 0, 0], rubber, 10);
        b.cylAt(0.034, 0.067, [x, 0.12, z], [Math.PI / 2, 0, 0], brass, 8);
      }
      b.box(0.048, 1.56, 0.048, x, 0.30, 0, brass);
      b.sphere(0.045, x, 1.82, 0, brass);
    }
    // Half-circle at the top of the classic hotel trolley.
    b.add(new THREE.TorusGeometry(0.5, 0.029, 6, 22, Math.PI), brass, [0, 1.86, 0]);
    b.box(1.03, 0.044, 0.05, 0, 1.05, 0, dull);
    // The single abandoned suitcase, with tarnished buckles and a dangling room tag.
    b.box(0.77, 0.57, 0.43, -0.06, 0.34, -0.03, "#654737");
    b.box(0.79, 0.046, 0.45, -0.06, 0.57, -0.03, "#342b2b");
    for (const x of [-0.30, 0.18]) {
      b.box(0.045, 0.60, 0.47, x, 0.34, -0.03, "#a18a64");
      b.box(0.10, 0.05, 0.07, x, 0.73, 0.19, brass);
    }
    b.box(0.24, 0.035, 0.11, -0.06, 0.92, 0, dull);
    b.box(0.12, 0.19, 0.018, 0.35, 0.69, 0.2, "#d5c59f");
    return b.build();
  }, []);
  const mat = useMemo(() => new THREE.MeshLambertMaterial({ vertexColors: true }), []);
  const mesh = useRef<THREE.Mesh>(null);
  useFrame(() => { if (mesh.current) mesh.current.visible = rt.view.floor === 1; });
  return <mesh ref={mesh} geometry={geometry} material={mat}
    position={[9.8, FLOOR_Y[1], 3.05]} visible={false} />;
}
