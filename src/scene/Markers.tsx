import { useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { useGame, setGame } from "../game/store";
import { WORLD, type HidingSpot } from "../game/world/world";
import { rt } from "../game/runtime";
import { director } from "../game/director";
import { markerTexture } from "./textures";

/**
 * Close-up search markers. Every spot gets the same "?" orb, so the icon
 * never gives away the preposition - only its position does.
 */
function Marker({ spot }: { spot: HidingSpot }) {
  const selected = useGame((s) => s.selectedSpot === spot.id);
  const active = useGame((s) => s.phase === "search");
  const ref = useRef<THREE.Sprite>(null);
  const mat = useMemo(
    () =>
      new THREE.SpriteMaterial({
        map: markerTexture(false),
        transparent: true,
        depthTest: false,
        depthWrite: false,
        toneMapped: false
      }),
    []
  );
  const phase = useRef(Math.random() * 6);

  useFrame(() => {
    const s = ref.current;
    if (!s) return;
    const help = rt.helpSpot === spot.id;
    mat.map = markerTexture(selected || help);
    const pulse = help ? 1 + Math.sin(rt.time * 8) * 0.15 : 1;
    const base = selected ? 0.5 : 0.38;
    s.scale.setScalar(base * pulse);
    s.position.set(spot.marker.x, spot.marker.y + Math.sin(rt.time * 2.5 + phase.current) * 0.035, spot.marker.z);
    mat.opacity = active ? 1 : 0;
    s.visible = active;
  });

  const choose = (e: ThreeEvent<MouseEvent>) => {
    if (!active) return;
    e.stopPropagation();
    director.chooseSpot(spot.id);
  };

  return (
    <sprite
      ref={ref}
      material={mat}
      renderOrder={20}
      onClick={choose}
      onPointerOver={(e) => {
        if (!active) return;
        e.stopPropagation();
        setGame({ selectedSpot: spot.id });
      }}
    />
  );
}

export function Markers() {
  const searchId = useGame((s) => s.searchId);
  if (!searchId) return null;
  const spots = WORLD.spots.filter((s) => s.objectId === searchId);
  return (
    <group>
      {spots.map((s) => (
        <Marker key={s.id} spot={s} />
      ))}
    </group>
  );
}
