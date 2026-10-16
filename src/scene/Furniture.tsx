import { useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { WORLD, type WorldObject } from "../game/world/world";
import { rotRadians } from "../game/world/geometry";
import type { KindId } from "../game/world/kinds";
import { rt } from "../game/runtime";
import { getGame } from "../game/store";
import { director } from "../game/director";
import { buildObject, type AnimatedPart } from "./models";
import { furnitureMaterial, glowPartMaterial, glowSpriteMaterial, texturedMaterial } from "./materials";
import { lineFade } from "./wallFade";
import { isCanvasTap } from "../input/tap";

const HIGHLIGHT = new THREE.Color("#8f7bff");
const HELP = new THREE.Color("#ffd36b");

/** How each kind of thing moves when it "rattles" (Sneaky's distractions, Bouncy's toys, Melody's instruments). */
type Wobble = "shake" | "rockZ" | "rockX" | "slide" | "hop" | "swing" | "play";
const WOBBLE: Partial<Record<KindId, Wobble>> = {
  rockinghorse: "rockZ",
  rockingchair: "rockX",
  toytrain: "slide",
  teddy: "hop",
  blocks: "hop",
  kidchair: "hop",
  chandelier: "swing",
  piano: "play",
  drum: "play",
  gramophone: "play",
  guitar: "play",
  cello: "play",
  musicstand: "play"
};
/** Things that hang swing from the ceiling, not from the floor. */
const PIVOT_Y: Partial<Record<KindId, number>> = { chandelier: 2.8 };

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
    default:
      return 0;
  }
}

function FurnitureItem({ obj }: { obj: WorldObject }) {
  const built = useMemo(() => buildObject(obj), [obj]);
  const material = useMemo(() => (obj.interactive ? new THREE.MeshLambertMaterial({ vertexColors: true }) : furnitureMaterial), [obj]);
  const partMats = useMemo(() => new THREE.MeshLambertMaterial({ vertexColors: true }), []);
  const parts = useRef<Record<string, THREE.Group | null>>({});
  const root = useRef<THREE.Group>(null);
  const wob = useRef<THREE.Group>(null);
  const lampMat = useMemo(() => glowSpriteMaterial(obj.kind === "roundwindow" ? "#a894ff" : "#ffc46b", 0.55), [obj.kind]);
  const glow = useRef(0);
  const fanSpin = useRef(0);
  const wobble = WOBBLE[obj.kind] ?? "shake";
  const pivotY = PIVOT_Y[obj.kind] ?? 0;

  useFrame((_, dt) => {
    const r = root.current;
    if (!r) return;
    // Only the floor you are on is drawn (the staircase belongs to both).
    let visible = obj.floor === rt.view.floor || Boolean(obj.spec.bothFloors);
    // Things hanging on a wall disappear with it in the cutaway view.
    if (visible && obj.wallLines.length) visible = Math.min(...obj.wallLines.map((id) => lineFade.get(id) ?? 1)) > 0.4;
    r.visible = visible;
    if (!visible) return;
    const game = getGame();
    // Highlight the object in reach (and the help glow after many empty searches).
    if (obj.interactive) {
      const focused = (game.phase === "explore" && game.focusId === obj.id) || (game.phase === "search" && game.searchId === obj.id);
      const help = rt.helpObject === obj.id || rt.attention === obj.id;
      const target = help ? 0.45 + Math.sin(rt.time * 5) * 0.2 : focused && game.phase === "explore" ? 0.13 + Math.sin(rt.time * 4) * 0.06 : 0;
      glow.current += (target - glow.current) * Math.min(1, dt * 8);
      const m = material as THREE.MeshLambertMaterial;
      m.emissive.copy(help ? HELP : HIGHLIGHT).multiplyScalar(glow.current);
      partMats.emissive.copy(m.emissive);
    }
    const fanOn = rt.time < rt.steam.fanUntil;
    for (const p of built.parts) {
      const g = parts.current[p.name];
      if (!g) continue;
      const k = partOpenAmount(obj, p.name);
      switch (p.name) {
        case "lid":
          g.rotation.x = -k * 1.85;
          break;
        case "door":
          g.rotation.y = -k * 1.9;
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
        case "fan":
          fanSpin.current += ((fanOn ? 16 : 0) - fanSpin.current) * Math.min(1, dt * (fanOn ? 1.5 : 0.6));
          g.rotation.z -= fanSpin.current * dt;
          break;
        case "lever":
          g.rotation.x += ((fanOn ? -1.1 : 0) - g.rotation.x) * Math.min(1, dt * 12);
          break;
      }
    }
    // A harmless wobble: shake, rock, slide, hop, swing or play.
    const w = wob.current;
    if (!w) return;
    let rattle: { t0: number; dur: number; amp: number } | null = null;
    for (const x of rt.rattles) if (x.objectId === obj.id && rt.time - x.t0 < x.dur) rattle = x;
    w.position.set(0, pivotY, 0);
    w.rotation.set(0, 0, 0);
    w.scale.setScalar(1);
    if (!rattle) return;
    const t = rt.time - rattle.t0;
    const fade = 1 - t / rattle.dur;
    const a = rattle.amp;
    switch (wobble) {
      case "shake":
        w.position.x = Math.sin(rt.time * 70) * 0.025 * a;
        w.rotation.z = Math.sin(rt.time * 55) * 0.02 * a;
        break;
      case "rockZ":
        w.rotation.z = Math.sin(t * 7) * 0.22 * fade * a;
        break;
      case "rockX":
        w.rotation.x = Math.sin(t * 5) * 0.18 * fade * a;
        break;
      case "slide":
        // back and forth along its own length (local x)
        w.position.x = Math.sin(t * 6) * 0.14 * fade * a;
        w.rotation.z = Math.sin(t * 24) * 0.01 * a;
        break;
      case "hop":
        w.position.y = Math.abs(Math.sin(t * 9)) * 0.1 * fade * a;
        w.rotation.z = Math.sin(t * 9) * 0.08 * fade * a;
        break;
      case "swing":
        w.rotation.x = Math.sin(t * 5.5) * 0.13 * fade * a;
        w.rotation.z = Math.cos(t * 4.3) * 0.1 * fade * a;
        break;
      case "play":
        w.scale.set(1 + Math.abs(Math.sin(t * 12)) * 0.035 * a, 1 - Math.abs(Math.sin(t * 12)) * 0.03 * a, 1 + Math.abs(Math.sin(t * 12)) * 0.035 * a);
        w.position.y = Math.abs(Math.sin(t * 12)) * 0.02 * a;
        break;
    }
  });

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    // Only claim the click while exploring; in a close-up it must reach the markers.
    if ((!obj.interactive && obj.id !== "lobby.stairs") || getGame().phase !== "explore" || !root.current?.visible) return;
    if (!isCanvasTap(e.delta)) return;
    e.stopPropagation();
    if (obj.id === "lobby.stairs") director.tapStairs();
    else director.tapObject(obj.id);
  };

  return (
    <group ref={root} position={[obj.x, obj.y, obj.z]} rotation={[0, rotRadians(obj.rot), 0]} onClick={onClick}>
      <group ref={wob} position={[0, pivotY, 0]}>
        <group position={[0, -pivotY, 0]}>
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
            <mesh key={i} geometry={t.geometry} material={texturedMaterial(t.key)} position={t.position} rotation={t.rotation ?? [0, 0, 0]} renderOrder={t.key === "glass" ? 11 : 0} />
          ))}
          {built.lamps.map((l, i) => (
            <sprite key={i} position={l} scale={[0.75, 0.75, 1]} material={lampMat} />
          ))}
        </group>
      </group>
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
