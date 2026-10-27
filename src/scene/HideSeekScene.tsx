import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { audio } from "../audio/audio";
import { heartbeatLevel } from "../audio/heartbeat";
import { abilityTargets, reachableSpots } from "../game/hideSeek";
import { getHideSeek, pickSpot, tickHideSeek, useHideSeek } from "../game/hideSeek/session";
import { getGame, useGame } from "../game/store";
import { FLOOR_Y, ROOMS } from "../game/world/rooms";
import { WORLD } from "../game/world/world";
import { Hotel } from "./Hotel";
import { Furniture } from "./Furniture";
import { Detective } from "./Detective";
import { HideSeekGhost } from "./Ghosts";
import { HideSeekCamera } from "./HideSeekCamera";
import { noteTexture } from "./textures";

/**
 * The heartbeat follows the detective's horizontal distance to the student's ghost: the same
 * public positions the student can see, never the detective's private knowledge. It is
 * silent while English is open, while paused, and once the match is over.
 */
function Heartbeat() {
  const level = useRef(0);
  useFrame((_, rawDt) => {
    const m = getHideSeek().match;
    const game = getGame();
    const active = Boolean(m && m.status === "playing" && !m.english && game.settings.heartbeat &&
      !game.settingsOpen && game.screen === "hideseek" && !document.hidden);
    const want = active ? heartbeatLevel(Math.hypot(m!.detective.x - m!.ghost.x, m!.detective.z - m!.ghost.z)) : 0;
    // Gentle on the way up, a little slower to calm down; fully stopped once faded out.
    const rate = want > level.current ? 1.6 : 0.9;
    level.current += (want - level.current) * (1 - Math.exp(-Math.min(rawDt, 0.1) * rate));
    if (!active && level.current < 0.02) level.current = 0;
    audio.setHeartbeat(level.current);
  });
  useEffect(() => () => audio.setHeartbeat(0), []);
  return null;
}

const labels = new Map<string, THREE.CanvasTexture>();
function labelTexture(text: string) {
  const cached = labels.get(text);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = 256; canvas.height = 96;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#291b3e";
  ctx.beginPath(); ctx.roundRect(4, 4, 248, 88, 32); ctx.fill();
  ctx.strokeStyle = "#f4d58b"; ctx.lineWidth = 4; ctx.stroke();
  ctx.fillStyle = "#fff2c8"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = "bold 43px sans-serif"; ctx.fillText(text, 128, 49);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  labels.set(text, tex);
  return tex;
}

function Label({ text, scale = 1 }: { text: string; scale?: number }) {
  return <sprite scale={[scale, scale * 0.375, 1]} renderOrder={22}>
    <spriteMaterial map={labelTexture(text)} transparent depthTest={false} depthWrite={false} />
  </sprite>;
}

function SpotMarkers() {
  useHideSeek((s) => s.revision);
  const { match, pickMode } = getHideSeek();
  if (!match) return null;
  const spots = pickMode === "ability" ? abilityTargets(match) : pickMode ? reachableSpots(match) : [];
  const highlight = match.config.level === "beginner" ? match.english?.spotId ?? match.detective.target : null;
  const shown = spots.length ? spots : highlight ? WORLD.spots.filter((s) => s.id === highlight) : [];
  return <group>{shown.map((spot) => <group key={spot.id} position={[spot.marker.x, spot.marker.y + 0.12, spot.marker.z]}
    onClick={(e) => { e.stopPropagation(); if (pickMode) pickSpot(spot.id); }}>
    <Label text={spot.prep} scale={0.72} />
    <mesh visible={false}><sphereGeometry args={[0.28, 8, 6]} /><meshBasicMaterial /></mesh>
    <mesh position={[0, -0.23, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={20}>
      <ringGeometry args={[0.14, 0.19, 20]} />
      <meshBasicMaterial color={spot.id === highlight ? "#ffe08d" : "#78eadb"} depthTest={false} side={THREE.DoubleSide} transparent opacity={0.85} />
    </mesh>
  </group>)}</group>;
}

function AbilityEffects() {
  const bubbles = useRef<THREE.Group>(null);
  const signs = useRef<THREE.Group>(null);
  const clue = useRef<THREE.Group>(null);
  const trail = useRef<THREE.Group>(null);
  const pop = useRef<THREE.Mesh>(null);
  const popLabel = useRef<THREE.Group>(null);
  const notes = useRef<Array<THREE.Sprite | null>>([]);
  const seenDecoyPop = useRef(-1);
  const popT = useRef(-10);
  const noteMats = useMemo(() => Array.from({ length: 6 }, (_, i) => new THREE.SpriteMaterial({
    map: noteTexture(), color: i % 2 ? "#ffd36b" : "#f5b5ff", transparent: true, depthWrite: false, toneMapped: false
  })), []);
  useHideSeek((s) => s.revision);
  const m = getHideSeek().match;
  const id = m?.config.ghost ?? "sleepy";
  const sign = id === "sleepy" ? "z z z" : id === "hungry" ? "munch!" : id === "melody" ? "♪  ♫" : id === "bouncy" ? "BOING" : id === "shadow" ? "vanish" : id === "sneaky" ? "shhh..." : "DECOY!";
  useFrame(() => {
    const session = getHideSeek(); const s = session.match;
    if (!s) return;
    const g = s.ghost;
    const base = FLOOR_Y[ROOMS[s.config.room].floor];
    if (bubbles.current) {
      const b = s.effects.bubbles[0]; bubbles.current.visible = Boolean(b);
      if (b) {
        bubbles.current.position.set(b.x, base + 0.65, b.z);
        bubbles.current.scale.setScalar(b.radius);
        bubbles.current.rotation.y = s.time * 0.3;
      }
    }
    if (signs.current) {
      const active = Boolean((session.fx && session.fx.until > s.time) || s.effects.nextMove || s.effects.sleepySearch !== null || s.effects.music || g.invisible);
      signs.current.visible = active;
      const target = session.fx?.targetSpotId ? WORLD.spotById.get(session.fx.targetSpotId) : null;
      const music = s.effects.music;
      signs.current.position.set(target?.marker.x ?? music?.x ?? g.x, Math.max(base + 1.4, (target?.marker.y ?? g.y) + 1.1) + Math.sin(s.time * 3) * 0.12, target?.marker.z ?? music?.z ?? g.z);
    }
    const music = s.effects.music;
    for (let i = 0; i < noteMats.length; i++) {
      const sprite = notes.current[i];
      if (!sprite) continue;
      sprite.visible = Boolean(music);
      if (!music) continue;
      const phase = (s.time * 0.72 + i / noteMats.length) % 1;
      const angle = i * 2.4;
      sprite.position.set(music.x + Math.cos(angle) * (0.18 + phase * 0.35), base + 0.45 + phase * 1.25, music.z + Math.sin(angle) * (0.18 + phase * 0.35));
      sprite.scale.setScalar(0.22 + phase * 0.11);
      noteMats[i].opacity = Math.sin(phase * Math.PI) * 0.9;
      noteMats[i].rotation = Math.sin(s.time * 2.4 + i) * 0.22;
    }
    if (clue.current) {
      clue.current.visible = Boolean(session.clue && session.clue.until > s.time && s.status === "playing");
      clue.current.position.set(s.detective.x, base + 1.7, s.detective.z);
    }
    if (trail.current) {
      trail.current.visible = g.transit && (g.silent || g.invisible || g.loudness > 1);
      trail.current.position.set(g.x, g.y + 0.15, g.z);
      trail.current.rotation.y = Math.atan2(g.path[0]?.x - g.x || 0, g.path[0]?.z - g.z || 0);
    }
    const decoyPop = session.decoyPop;
    if (decoyPop && decoyPop.at !== seenDecoyPop.current) {
      const spot = WORLD.spotById.get(decoyPop.spotId);
      if (spot) {
        if (pop.current) pop.current.position.set(spot.hidePos.x, spot.hidePos.y + 0.4, spot.hidePos.z);
        if (popLabel.current) popLabel.current.position.set(spot.hidePos.x, spot.hidePos.y + 0.9, spot.hidePos.z);
        popT.current = decoyPop.at;
      }
      seenDecoyPop.current = decoyPop.at;
    }
    if (pop.current) {
      const t = s.time - popT.current;
      pop.current.visible = t >= 0 && t < 0.8;
      pop.current.scale.setScalar(0.2 + t * 2);
      (pop.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - t / 0.8);
      if (popLabel.current) {
        popLabel.current.visible = t >= 0 && t < 0.8;
        popLabel.current.scale.setScalar(0.65 + t * 0.5);
      }
    }
  });
  return <>
    <group ref={bubbles} visible={false}>{Array.from({ length: 10 }, (_, i) => {
      const a = i * 2.4, r = i % 3 === 0 ? 0.8 : 0.5;
      return <mesh key={i} position={[Math.cos(a) * r, Math.sin(i * 1.7) * 0.4, Math.sin(a) * r]}>
        <sphereGeometry args={[0.35 + (i % 3) * 0.1, 10, 7]} />
        <meshBasicMaterial color={i % 2 ? "#a6e8ff" : "#e3bdff"} transparent opacity={0.24} depthWrite={false} />
      </mesh>;
    })}</group>
    <group ref={signs} visible={false}>
      <Label text={sign} scale={1.1} />
      {id === "hungry" && <group position={[0, -0.46, 0]} rotation={[0.4, 0, 0.2]}>
        <mesh><cylinderGeometry args={[0.23, 0.23, 0.07, 12]} /><meshBasicMaterial color="#e8ae66" /></mesh>
        {[[-0.09, 0.05], [0.1, 0.08], [0.04, -0.11]].map(([x, z], i) => <mesh key={i} position={[x, 0.04, z]}>
          <sphereGeometry args={[0.032, 6, 4]} /><meshBasicMaterial color="#67452f" />
        </mesh>)}
      </group>}
    </group>
    <group ref={clue} visible={false}><Label text={getHideSeek().clue?.kind === "glimpse" ? "!" : "?"} scale={0.8} /></group>
    <group ref={trail} visible={false}>{Array.from({ length: 5 }, (_, i) => <mesh key={i} position={[Math.sin(i * 2) * 0.1, i * 0.03, -i * 0.16]}>
      <sphereGeometry args={[0.1 - i * 0.012, 7, 5]} /><meshBasicMaterial color={id === "bouncy" ? "#ffd47b" : "#b5f5ed"} transparent opacity={0.28 - i * 0.04} depthWrite={false} />
    </mesh>)}{id === "bouncy" && <mesh position={[0, 0.25, -0.2]} rotation={[0, Math.PI / 2, 0]}>
      <torusGeometry args={[0.5, 0.025, 5, 16, Math.PI]} /><meshBasicMaterial color="#ffd47b" transparent opacity={0.55} depthWrite={false} />
    </mesh>}</group>
    <group ref={popLabel} visible={false}><Label text="POP!" scale={0.75} /></group>
    <mesh ref={pop} visible={false}><torusGeometry args={[0.35, 0.035, 5, 18]} /><meshBasicMaterial color="#f2a3ec" transparent depthWrite={false} /></mesh>
    <group>{noteMats.map((material, i) => <sprite key={i} ref={(sprite) => void (notes.current[i] = sprite)} material={material} visible={false} renderOrder={16} />)}</group>
  </>;
}

export function HideSeekScene() {
  useHideSeek((s) => s.revision);
  const match = getHideSeek().match;
  const settingsOpen = useGame((s) => s.settingsOpen);
  useFrame((_, dt) => { if (!settingsOpen) tickHideSeek(dt); }, -10);
  if (!match) return null;
  const room = ROOMS[match.config.room];
  return <>
    <hemisphereLight args={["#c8b7ff", "#49324e", 1.5]} />
    <ambientLight color="#ac9ac8" intensity={0.65} />
    <directionalLight color="#c5d4ff" intensity={1.2} position={[-6, 12, -10]} />
    <pointLight color={room.lamp.color} intensity={room.lamp.intensity} distance={12} decay={1.5} position={[room.lamp.x, room.lamp.y, room.lamp.z]} />
    <Hotel roomId={room.id} />
    <Furniture roomId={room.id} />
    <Detective />
    <HideSeekGhost key={match.config.ghost} id={match.config.ghost} />
    <HideSeekGhost key={`${match.config.ghost}-decoy`} id={match.config.ghost} decoy />
    <SpotMarkers />
    <AbilityEffects />
    <HideSeekCamera />
    <Heartbeat />
  </>;
}
