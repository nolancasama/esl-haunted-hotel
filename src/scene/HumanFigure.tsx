import { useMemo, useRef } from "react";
import * as THREE from "three";
import { PartBuilder } from "./partBuilder";
import { glowSpriteMaterial } from "./materials";
import { glowTexture } from "./textures";

const COAT = "#f2c230";
const COAT_DARK = "#d9a21b";
const SKIN = "#ffd8b5";

function bodyGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder(0.3);
  // raincoat
  b.add(new THREE.CapsuleGeometry(0.22, 0.32, 4, 12), COAT, [0, 0.66, 0], [0, 0, 0], [1, 1, 0.85]);
  b.add(new THREE.CylinderGeometry(0.2, 0.27, 0.2, 14), COAT_DARK, [0, 0.47, 0]);
  // buttons
  for (const y of [0.78, 0.66, 0.54]) b.sphere(0.022, 0, y, 0.19, "#3b6fd6");
  // head and hood
  b.sphere(0.2, 0, 1.06, 0.01, SKIN, [1, 0.95, 0.95], 16);
  b.add(new THREE.SphereGeometry(0.23, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), COAT, [0, 1.07, -0.035], [-0.35, 0, 0]);
  // hair fringe
  b.sphere(0.12, -0.07, 1.17, 0.12, "#4a2f22", [1, 0.45, 0.6]);
  b.sphere(0.1, 0.08, 1.17, 0.13, "#4a2f22", [1, 0.45, 0.6]);
  // eyes, cheeks, mouth
  b.sphere(0.028, -0.07, 1.06, 0.185, "#231a2a");
  b.sphere(0.028, 0.07, 1.06, 0.185, "#231a2a");
  b.sphere(0.03, -0.12, 1.0, 0.16, "#ff9aa2", [1, 0.6, 0.4]);
  b.sphere(0.03, 0.12, 1.0, 0.16, "#ff9aa2", [1, 0.6, 0.4]);
  b.sphere(0.02, 0, 0.99, 0.195, "#b0475a", [1.4, 0.7, 0.6]);
  return b.build();
}

function legGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder(0);
  b.add(new THREE.CapsuleGeometry(0.075, 0.18, 4, 8), "#3a4fa8", [0, -0.16, 0]);
  b.add(new THREE.CapsuleGeometry(0.085, 0.08, 4, 8), "#e8483f", [0, -0.33, 0.03], [Math.PI / 2, 0, 0], [1, 1.2, 1]);
  return b.build();
}

function armGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder(0);
  b.add(new THREE.CapsuleGeometry(0.065, 0.2, 4, 8), COAT, [0, -0.15, 0]);
  b.sphere(0.06, 0, -0.32, 0, SKIN);
  return b.build();
}

function lanternGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder(0);
  b.cyl(0.075, 0.09, 0.03, 0, -0.03, 0, "#3b2f4a");
  b.cyl(0.05, 0.085, 0.05, 0, 0.17, 0, "#3b2f4a");
  for (const a of [0, 1, 2, 3]) {
    const ang = (a / 4) * Math.PI * 2 + Math.PI / 4;
    b.box(0.014, 0.18, 0.014, Math.cos(ang) * 0.065, 0, Math.sin(ang) * 0.065, "#d4ad55");
  }
  b.torus(0.05, 0.008, [0, 0.25, 0], [0, 0, 0], "#d4ad55");
  return b.build();
}

export function useHumanFigure() {
  const body = useMemo(bodyGeometry, []);
  const leg = useMemo(legGeometry, []);
  const arm = useMemo(armGeometry, []);
  const lantern = useMemo(lanternGeometry, []);
  const mat = useMemo(() => new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true }), []);
  const coreMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#ffd88a", toneMapped: false, transparent: true }), []);
  const fade = useRef(1);
  const haloMat = useMemo(() => glowSpriteMaterial("#ffcf7a", 0.75), []);
  const shadowMat = useMemo(
    () => new THREE.MeshBasicMaterial({ map: glowTexture(), color: "#000000", transparent: true, opacity: 0.55, depthWrite: false }),
    []
  );
  const root = useRef<THREE.Group>(null);
  const halo = useRef<THREE.Sprite>(null);
  const bob = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const lanternRef = useRef<THREE.Group>(null);
  const light = useRef<THREE.PointLight>(null);
  return { body, leg, arm, lantern, mat, coreMat, fade, haloMat, shadowMat, root, halo, bob, legL, legR, armL, armR, lanternRef, light };
}

export type HumanRig = ReturnType<typeof useHumanFigure>;

/** Shared visual rig: the story controller and detective animate the same figure. */
export function HumanFigure({ rig }: { rig: HumanRig }) {
  const { body, leg, arm, lantern, mat, coreMat, haloMat, shadowMat, root, halo, bob, legL, legR, armL, armR, lanternRef, light } = rig;
  return (
    <group ref={root}>
      <group ref={bob}>
        <mesh geometry={body} material={mat} />
        <group ref={legL} position={[-0.09, 0.4, 0]}>
          <mesh geometry={leg} material={mat} />
        </group>
        <group ref={legR} position={[0.09, 0.4, 0]}>
          <mesh geometry={leg} material={mat} />
        </group>
        <group ref={armL} position={[-0.25, 0.82, 0]} rotation={[0, 0, -0.15]}>
          <mesh geometry={arm} material={mat} />
        </group>
        <group ref={armR} position={[0.25, 0.82, 0]} rotation={[0.35, 0, 0.15]}>
          <mesh geometry={arm} material={mat} />
          <group ref={lanternRef} position={[0, -0.5, 0.02]} rotation={[-0.35, 0, -0.15]}>
            <mesh geometry={lantern} material={mat} />
            <mesh position={[0, 0.07, 0]} material={coreMat}>
              <sphereGeometry args={[0.05, 12, 10]} />
            </mesh>
            <sprite ref={halo} material={haloMat} position={[0, 0.07, 0]} scale={[0.55, 0.55, 1]} />
            <pointLight ref={light} position={[0, 0.1, 0]} color="#ffcf8a" intensity={2.6} distance={4.5} decay={1.6} />
          </group>
        </group>
      </group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]} material={shadowMat}>
        <planeGeometry args={[0.9, 0.9]} />
      </mesh>
    </group>
  );
}
