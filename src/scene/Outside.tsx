import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { rt } from "../game/runtime";
import { PartBuilder } from "./partBuilder";
import { glowPartMaterial, glowSpriteMaterial } from "./materials";
import { beamTexture, glowTexture } from "./textures";
import { Rain } from "./Rain";
import { director } from "../game/director";
import { isCanvasTap } from "../input/tap";

const NIGHT_GRASS = new THREE.Color("#141c1a");
const DAY_GRASS = new THREE.Color("#6aa84f");

/** 0 at night, rising to 1 over a few seconds once the sunrise starts. */
export function sunrise(): number {
  if (rt.sunriseT0 < 0) return 0;
  const t = Math.min(1, Math.max(0, (rt.time - rt.sunriseT0) / 3.5));
  return t * t * (3 - 2 * t);
}

function porchGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder(0);
  b.box(3.0, 0.1, 5.0, -9.55, -0.1, 0, "#5a5266");
  for (let z = -2.25; z <= 2.25; z += 0.5) b.box(3.0, 0.005, 0.03, -9.55, 0.0, z, "#463f52");
  // path leading home
  for (let i = 0; i < 9; i++) b.box(0.9, 0.04, 1.1, -11.6 - i * 1.15, -0.06, Math.sin(i * 0.7) * 0.25, i % 2 ? "#6a6276" : "#5e566a");
  // lamp posts
  for (const z of [-2.1, 2.1]) {
    b.cyl(0.06, 0.08, 2.0, -10.7, 0, z, "#2a2433", 8);
    b.box(0.26, 0.04, 0.26, -10.7, 2.0, z, "#2a2433");
    b.box(0.3, 0.06, 0.3, -10.7, 2.36, z, "#2a2433");
  }
  // bushes and trees
  for (const [x, z, s] of [
    [-10.3, -3.6, 0.7],
    [-10.6, 3.5, 0.8],
    [-12.5, -2.8, 0.6],
    [-12.8, 3.0, 0.7]
  ] as const) {
    b.sphere(s, x, s * 0.7, z, "#2f5a34", [1.3, 1, 1.3], 10);
  }
  // The garden round the other sides, seen through the windows: bushes between the windows
  // (never right in front of one), trees further out.
  for (const [x, z, s] of [
    [-6.2, -12.4, 0.6],
    [0.4, -12.6, 0.7],
    [5.6, -12.3, 0.55],
    [-6.0, 12.5, 0.65],
    [1.6, 12.4, 0.6],
    [9.4, -6.5, 0.7],
    [9.5, 2.5, 0.6],
    [9.3, 8.0, 0.65],
    [-9.4, -7.6, 0.55],
    [-9.5, 9.2, 0.6]
  ] as const) {
    b.sphere(s, x, s * 0.7, z, "#2f5a34", [1.3, 1, 1.3], 10);
  }
  for (const [x, z] of [
    [-14.5, -4.5],
    [-15.5, 4.2],
    [-2.0, -16.0],
    [4.8, -15.4],
    [-5.5, 15.6],
    [3.0, 16.2],
    [13.0, -3.0],
    [12.6, 7.5]
  ] as const) {
    b.cyl(0.18, 0.24, 1.6, x, 0, z, "#4a3020", 8);
    b.cone(1.2, 2.6, x, 1.4, z, "#2c5a38", 10);
    b.cone(0.95, 2.0, x, 2.6, z, "#336a40", 10);
  }
  // sign above the entrance (outside face)
  b.box(0.08, 0.5, 2.6, -8.16, 2.25, 0, "#3a2418");
  return b.build();
}

function lampGlowGeometry(): THREE.BufferGeometry {
  const b = new PartBuilder(0);
  for (const z of [-2.1, 2.1]) b.box(0.2, 0.32, 0.2, -10.7, 2.04, z, "#ffd88a");
  return b.build();
}

function signTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 100;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#3a2418";
  ctx.fillRect(0, 0, 512, 100);
  ctx.strokeStyle = "#c9a24a";
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, 496, 84);
  ctx.fillStyle = "#ffd36b";
  ctx.font = "bold 50px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("HAUNTED HOTEL", 256, 54);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Porch, path and garden outside the entrance, plus the morning sunbeams of the ending. */
export function Outside() {
  const porch = useMemo(porchGeometry, []);
  const lamps = useMemo(lampGlowGeometry, []);
  const mat = useMemo(() => new THREE.MeshLambertMaterial({ vertexColors: true }), []);
  const grassMat = useMemo(() => new THREE.MeshLambertMaterial({ color: NIGHT_GRASS }), []);
  const signMat = useMemo(() => new THREE.MeshBasicMaterial({ map: signTexture(), toneMapped: false }), []);
  const lampGlow = useMemo(() => glowSpriteMaterial("#ffcf7a", 0.7), []);
  const beamMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: beamTexture(),
        color: "#ffdf9e",
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        toneMapped: false
      }),
    []
  );
  const patchMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: glowTexture(),
        color: "#ffd88a",
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false
      }),
    []
  );
  const beams = useRef<THREE.Group>(null);

  useFrame(() => {
    const s = sunrise();
    grassMat.color.copy(NIGHT_GRASS).lerp(DAY_GRASS, s);
    beamMat.opacity = s * 0.6;
    patchMat.opacity = s * 0.85;
    if (beams.current) beams.current.visible = s > 0.01;
    lampGlow.opacity = 0.7 * (1 - s);
  });

  return (
    <group>
      <Rain />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]} material={grassMat}>
        <planeGeometry args={[90, 90]} />
      </mesh>
      <mesh geometry={porch} material={mat} onClick={(e) => {
        if (rt.view.floor !== 0 || !rt.doorsOpen.has("entrance") || !isCanvasTap(e.delta)) return;
        if (e.point.x >= -11 && e.point.x < -8 && Math.abs(e.point.z) < 2.5) {
          e.stopPropagation();
          director.tapFloor(e.point.x, e.point.z, 0);
        }
      }} />
      <mesh geometry={lamps} material={glowPartMaterial} />
      {[-2.1, 2.1].map((z) => (
        <sprite key={z} material={lampGlow} position={[-10.7, 2.2, z]} scale={[1.2, 1.2, 1]} />
      ))}
      <mesh position={[-8.21, 2.5, 0]} rotation={[0, -Math.PI / 2, 0]} material={signMat}>
        <planeGeometry args={[2.5, 0.48]} />
      </mesh>
      {/* Morning sun through the open front door: slanted shafts and a warm patch on the floor. */}
      <group ref={beams} visible={false}>
        {[-0.75, 0, 0.75].map((z, i) => (
          <group key={z} position={[-8, 2.3, z]} rotation={[0, 0, -0.52 - i * 0.05]}>
            <mesh material={beamMat} position={[2.3, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[4.6, 0.55]} />
            </mesh>
          </group>
        ))}
        <mesh material={patchMat} position={[-5.4, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[5.2, 3.2]} />
        </mesh>
      </group>
    </group>
  );
}
