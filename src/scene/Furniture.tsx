import { useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { WORLD, type WorldObject } from "../game/world/world";
import { rotRadians } from "../game/world/geometry";
import { rt } from "../game/runtime";
import { getGame } from "../game/store";
import { director } from "../game/director";
import { buildObject, type AnimatedPart } from "./furnitureModels";
import { furnitureMaterial, glowPartMaterial, glowSpriteMaterial, texturedMaterial } from "./materials";

const HIGHLIGHT = new THREE.Color("#8f7bff");
const HELP = new THREE.Color("#ffd36b");

function partOpenAmount(obj: WorldObject, part: AnimatedPart["name"]): number {
  const s = rt.search;
  if (!s) return 0;
  const spot = WORLD.spotById.get(s.spotId);
  if (!spot || spot.objectId !== obj.id) return 0;
  const t = Math.max(0, rt.time - s.t0);
  const opening = s.open ? Math.min(1, t / 0.45) : Math.max(0, 1 - t / 0.4);
  const ease = opening * opening * (3 - 2 * opening);
  // A quick pat for "on": the surface bounces once.
  const bounce = Math.sin(Math.min(1, t / 0.5) * Math.PI) * 0.12;
  switch (part) {
    case "lid":
    case "door":
      return spot.prep === "in" ? ease : spot.prep === "on" ? bounce : 0;
    case "blanket":
      return spot.prep === "on" ? bounce : 0;
    case "curtainL":
    case "curtainR":
      return ease;
  }
}

function FurnitureItem({ obj }: { obj: WorldObject }) {
  const built = useMemo(() => buildObject(obj), [obj]);
  const material = useMemo(() => (obj.searchable ? new THREE.MeshLambertMaterial({ vertexColors: true }) : furnitureMaterial), [obj]);
  const partMats = useMemo(() => new THREE.MeshLambertMaterial({ vertexColors: true }), []);
  const parts = useRef<Record<string, THREE.Group | null>>({});
  const root = useRef<THREE.Group>(null);
  const lampMat = useMemo(() => glowSpriteMaterial("#ffc46b", 0.55), []);
  const glow = useRef(0);

  useFrame((_, dt) => {
    const game = getGame();
    // Highlight the object in reach (and the help glow after many empty searches).
    if (obj.searchable) {
      const focused = (game.phase === "explore" && game.focusId === obj.id) || (game.phase === "search" && game.searchId === obj.id);
      const help = rt.helpObject === obj.id;
      const target = help ? 0.45 + Math.sin(rt.time * 5) * 0.2 : focused && game.phase === "explore" ? 0.13 + Math.sin(rt.time * 4) * 0.06 : 0;
      glow.current += (target - glow.current) * Math.min(1, dt * 8);
      const m = material as THREE.MeshLambertMaterial;
      m.emissive.copy(help ? HELP : HIGHLIGHT).multiplyScalar(glow.current);
      partMats.emissive.copy(m.emissive);
    }
    for (const p of built.parts) {
      const g = parts.current[p.name];
      if (!g) continue;
      const k = partOpenAmount(obj, p.name);
      switch (p.name) {
        case "lid":
          g.rotation.x = -k * 1.85;
          break;
        case "door":
          g.rotation.y = k * 1.9;
          break;
        case "blanket":
          g.rotation.x = -k * 0.55;
          break;
        case "curtainL":
          g.rotation.z = -k * 0.25 * Math.sin(rt.time * 9);
          break;
        case "curtainR":
          g.rotation.z = k * 0.25 * Math.sin(rt.time * 9 + 1);
          break;
      }
    }
    // Sneaky's harmless distraction: something rattles.
    if (root.current) {
      const r = rt.rattle;
      const shaking = r.objectId === obj.id && rt.time - r.t0 < 0.8;
      root.current.position.x = obj.x + (shaking ? Math.sin(rt.time * 70) * 0.025 : 0);
      root.current.rotation.z = shaking ? Math.sin(rt.time * 55) * 0.02 : 0;
    }
  });

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    // Only claim the click while exploring; in a close-up it must reach the markers.
    if (!obj.searchable || getGame().phase !== "explore") return;
    if (e.delta > 8) return; // it was a camera drag
    e.stopPropagation();
    director.tapObject(obj.id);
  };

  return (
    <group ref={root} position={[obj.x, 0, obj.z]} rotation={[0, rotRadians(obj.rot), 0]} onClick={onClick}>
      <mesh geometry={built.solid} material={material} />
      {built.glow && <mesh geometry={built.glow} material={glowPartMaterial} />}
      {built.parts.map((p) => (
        <group
          key={p.name}
          position={p.pivot}
          ref={(g) => {
            parts.current[p.name] = g;
          }}
        >
          {p.geometry && <mesh geometry={p.geometry} material={partMats} />}
          {p.textured && <mesh geometry={p.textured.geometry} material={texturedMaterial(p.textured.key)} />}
        </group>
      ))}
      {built.textured.map((t, i) => (
        <mesh key={i} geometry={t.geometry} material={texturedMaterial(t.key)} position={t.position} rotation={t.rotation ?? [0, 0, 0]} />
      ))}
      {built.lamps.map((l, i) => (
        <sprite key={i} position={l} scale={[0.75, 0.75, 1]} material={lampMat} />
      ))}
    </group>
  );
}

export function Furniture() {
  return (
    <group>
      {WORLD.objects.map((o) => (
        <FurnitureItem key={o.id} obj={o} />
      ))}
    </group>
  );
}
