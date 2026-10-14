import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { rt, type Gag } from "../game/runtime";
import { WORLD } from "../game/world/world";
import { FLOOR_Y, ROOMS, floorYOf, roomAt } from "../game/world/rooms";
import { bubbleTexture, dotTexture, noteTexture, silhouetteTexture, steamTexture } from "./textures";
import { PartBuilder } from "./partBuilder";

// ------------------------------------------------------------- particles

const MAX = 600;

interface Burst {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  max: number;
  r: number;
  g: number;
  b: number;
  swirl: number;
}

const bursts: Burst[] = [];

/** Spawn a burst of sparkles. */
export function sparkle(at: { x: number; y: number; z: number }, color: THREE.ColorRepresentation, count = 24, opts: { speed?: number; up?: number; swirl?: number; life?: number } = {}) {
  const c = new THREE.Color(color);
  for (let i = 0; i < count; i++) {
    if (bursts.length >= MAX) bursts.shift();
    const a = Math.random() * Math.PI * 2;
    const s = (opts.speed ?? 1.4) * (0.4 + Math.random() * 0.8);
    bursts.push({
      x: at.x,
      y: at.y,
      z: at.z,
      vx: Math.cos(a) * s,
      vy: (opts.up ?? 1.2) * (0.3 + Math.random()),
      vz: Math.sin(a) * s,
      life: 0,
      max: (opts.life ?? 0.9) * (0.6 + Math.random() * 0.6),
      r: c.r,
      g: c.g,
      b: c.b,
      swirl: opts.swirl ?? 0
    });
  }
}

function Sparkles() {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(MAX * 3), 3));
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(MAX * 3), 3));
    g.setDrawRange(0, 0);
    return g;
  }, []);
  const mat = useMemo(
    () =>
      new THREE.PointsMaterial({
        size: 0.13,
        map: dotTexture(),
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false
      }),
    []
  );
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const col = geo.attributes.color as THREE.BufferAttribute;
    let n = 0;
    for (let i = bursts.length - 1; i >= 0; i--) {
      const p = bursts[i];
      p.life += dt;
      if (p.life >= p.max) {
        bursts.splice(i, 1);
        continue;
      }
      if (p.swirl) {
        const vx = p.vx;
        p.vx = vx * Math.cos(p.swirl * dt) - p.vz * Math.sin(p.swirl * dt);
        p.vz = vx * Math.sin(p.swirl * dt) + p.vz * Math.cos(p.swirl * dt);
      }
      p.vy -= dt * 0.8;
      p.vx *= 1 - dt * 1.5;
      p.vz *= 1 - dt * 1.5;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
    }
    for (const p of bursts) {
      const fade = 1 - p.life / p.max;
      pos.setXYZ(n, p.x, p.y, p.z);
      col.setXYZ(n, p.r * fade, p.g * fade, p.b * fade);
      n++;
    }
    geo.setDrawRange(0, n);
    pos.needsUpdate = true;
    col.needsUpdate = true;
  });
  return <points geometry={geo} material={mat} frustumCulled={false} renderOrder={15} />;
}

// ------------------------------------------------------------------ dust

function Dust() {
  const COUNT = 220;
  const data = useMemo(() => {
    const seeds = new Float32Array(COUNT * 4);
    for (let i = 0; i < COUNT * 4; i++) seeds[i] = Math.random();
    return seeds;
  }, []);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3));
    return g;
  }, []);
  const mat = useMemo(
    () =>
      new THREE.PointsMaterial({
        size: 0.05,
        map: dotTexture(),
        color: "#cdbfff",
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false
      }),
    []
  );
  useFrame(() => {
    const id = roomAt(rt.player.x, rt.player.z, rt.view.floor) ?? (rt.view.floor ? "landing" : "bedroom");
    const room = ROOMS[id];
    const b = room.bounds;
    const base = FLOOR_Y[room.floor];
    // The attic is dustier: the motes are brighter there.
    mat.opacity = id === "attic" ? 0.85 : 0.55;
    mat.size = id === "attic" ? 0.065 : 0.05;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const t = rt.time;
    for (let i = 0; i < COUNT; i++) {
      const sx = data[i * 4];
      const sy = data[i * 4 + 1];
      const sz = data[i * 4 + 2];
      const sp = data[i * 4 + 3];
      const x = b.x0 + 0.3 + ((sx * (b.x1 - b.x0 - 0.6) + Math.sin(t * 0.13 * (0.5 + sp) + i) * 0.4) % (b.x1 - b.x0 - 0.6));
      const y = base + 0.2 + ((sy * 2.4 + t * 0.03 * (0.3 + sp)) % 2.4);
      const z = b.z0 + 0.3 + sz * (b.z1 - b.z0 - 0.6) + Math.cos(t * 0.11 * (0.5 + sp) + i) * 0.3;
      pos.setXYZ(i, x, y, z);
    }
    pos.needsUpdate = true;
  });
  return <points geometry={geo} material={mat} frustumCulled={false} />;
}

// ------------------------------------------------------------------ gags

function gagGeometry(item: Gag["item"]): THREE.BufferGeometry {
  const b = new PartBuilder(0);
  switch (item) {
    case "sock":
      b.add(new THREE.CapsuleGeometry(0.06, 0.16, 4, 8), "#e8e3f5", [0, 0.1, 0], [0, 0, 0.2]);
      b.add(new THREE.CapsuleGeometry(0.06, 0.1, 4, 8), "#e8e3f5", [0.07, 0.0, 0], [0, 0, Math.PI / 2]);
      b.add(new THREE.CylinderGeometry(0.065, 0.065, 0.05, 10), "#e05a7a", [-0.02, 0.2, 0], [0, 0, 0.2]);
      break;
    case "duck":
      b.sphere(0.1, 0, 0.08, 0, "#ffd84a", [1.2, 0.8, 0.9]);
      b.sphere(0.065, 0.07, 0.19, 0, "#ffd84a");
      b.add(new THREE.ConeGeometry(0.03, 0.07, 6), "#ff8a2a", [0.14, 0.18, 0], [0, 0, -Math.PI / 2]);
      b.sphere(0.012, 0.1, 0.21, 0.04, "#222222");
      b.sphere(0.012, 0.1, 0.21, -0.04, "#222222");
      break;
    case "mouse":
      b.sphere(0.08, 0, 0.06, 0, "#b6aebf", [1.4, 0.8, 0.9]);
      b.sphere(0.035, -0.07, 0.12, 0.05, "#e8a0b4");
      b.sphere(0.035, -0.07, 0.12, -0.05, "#e8a0b4");
      b.sphere(0.012, 0.1, 0.08, 0.03, "#222222");
      b.sphere(0.012, 0.1, 0.08, -0.03, "#222222");
      b.add(new THREE.CylinderGeometry(0.008, 0.008, 0.2, 5), "#e8a0b4", [-0.18, 0.04, 0], [0, 0, Math.PI / 2.4]);
      break;
    case "cookie":
      b.add(new THREE.CylinderGeometry(0.11, 0.11, 0.03, 14), "#c98a4a", [0, 0.1, 0], [Math.PI / 2, 0, 0]);
      for (const [x, y] of [
        [0.03, 0.13],
        [-0.04, 0.08],
        [0.05, 0.06]
      ])
        b.sphere(0.015, x, y, 0.017, "#4a2a1a");
      break;
    case "spider":
      b.sphere(0.06, 0, 0.1, 0, "#3a2f4a");
      b.sphere(0.012, 0.02, 0.12, 0.05, "#ffffff");
      b.sphere(0.012, -0.02, 0.12, 0.05, "#ffffff");
      for (let i = 0; i < 4; i++) {
        b.add(new THREE.CylinderGeometry(0.006, 0.006, 0.12, 4), "#3a2f4a", [0.07, 0.09 - i * 0.012, -0.03 + i * 0.02], [0, 0, 1.1]);
        b.add(new THREE.CylinderGeometry(0.006, 0.006, 0.12, 4), "#3a2f4a", [-0.07, 0.09 - i * 0.012, -0.03 + i * 0.02], [0, 0, -1.1]);
      }
      break;
    case "ball":
      b.sphere(0.09, 0, 0.09, 0, "#4ab0e8");
      b.sphere(0.0905, 0, 0.09, 0, "#ffffff", [1, 0.3, 1]);
      break;
  }
  return b.build();
}

const ITEMS: Gag["item"][] = ["sock", "duck", "mouse", "cookie", "spider", "ball"];

function Gags() {
  const geos = useMemo(() => Object.fromEntries(ITEMS.map((i) => [i, gagGeometry(i)])) as Record<Gag["item"], THREE.BufferGeometry>, []);
  const mat = useMemo(() => new THREE.MeshLambertMaterial({ vertexColors: true, emissive: "#3a2a55" }), []);
  const slots = useRef<Array<THREE.Group | null>>([]);
  useFrame(() => {
    rt.gags = rt.gags.filter((g) => rt.time - g.t0 < 1.8);
    for (let i = 0; i < 3; i++) {
      const slot = slots.current[i];
      if (!slot) continue;
      const gag = rt.gags[i];
      if (!gag) {
        slot.visible = false;
        continue;
      }
      const spot = WORLD.spotById.get(gag.spotId);
      if (!spot) continue;
      slot.visible = true;
      const t = rt.time - gag.t0;
      const up = Math.min(1, t / 0.35);
      const fade = t > 1.4 ? Math.max(0, 1 - (t - 1.4) / 0.4) : 1;
      const s = (0.4 + 0.6 * (1 - Math.pow(1 - up, 3))) * fade * 1.4;
      slot.position.set(spot.pos.x, spot.pos.y + 0.15 + up * 0.25 + Math.sin(t * 6) * 0.03, spot.pos.z);
      slot.scale.setScalar(Math.max(0.001, s));
      slot.rotation.y = t * 2.2;
      slot.children.forEach((c) => (c.visible = c.name === gag.item));
    }
  });
  return (
    <group>
      {[0, 1, 2].map((i) => (
        <group key={i} ref={(g) => void (slots.current[i] = g)} visible={false}>
          {ITEMS.map((item) => (
            <mesh key={item} name={item} geometry={geos[item]} material={mat} />
          ))}
        </group>
      ))}
    </group>
  );
}

// ------------------------------------------------------------ flashlight

/** A warm beam that sweeps under furniture when searching "under". */
function Flashlight() {
  const ref = useRef<THREE.Mesh>(null);
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#ffe2a0",
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        toneMapped: false
      }),
    []
  );
  const geo = useMemo(() => new THREE.ConeGeometry(0.55, 2.2, 20, 1, true).translate(0, -1.1, 0).rotateX(-Math.PI / 2), []);
  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    const s = rt.search;
    const spot = s ? WORLD.spotById.get(s.spotId) : null;
    const t = s ? rt.time - s.t0 : 99;
    const on = spot && spot.prep === "under" && s!.open && t < 1.6;
    mat.opacity = on ? Math.min(0.32, t * 1.2) * (t > 1.2 ? Math.max(0, (1.6 - t) / 0.4) : 1) : 0;
    m.visible = Boolean(on);
    if (!on || !spot) return;
    // From between the camera and the spot, low to the floor, aimed at the spot.
    const cam = rt.camera.pos;
    const base = floorYOf(spot.room);
    const dx = cam.x - spot.pos.x;
    const dz = cam.z - spot.pos.z;
    const l = Math.hypot(dx, dz) || 1;
    m.position.set(spot.pos.x + (dx / l) * 2.1, base + 0.32, spot.pos.z + (dz / l) * 2.1);
    m.lookAt(spot.pos.x + Math.sin(t * 5) * 0.25, base + 0.12, spot.pos.z);
  });
  return <mesh ref={ref} geometry={geo} material={mat} renderOrder={14} />;
}

// --------------------------------------------------------------- bubbles

const BUBBLE_MAX = 90;
const bubbleList: Array<{ x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; size: number }> = [];

/** A burst of soap bubbles (Bubbles pops out of the laundry basket). */
export function bubbles(at: { x: number; y: number; z: number }, count = 26) {
  for (let i = 0; i < count; i++) {
    if (bubbleList.length >= BUBBLE_MAX) bubbleList.shift();
    const a = Math.random() * Math.PI * 2;
    const s = 0.3 + Math.random() * 0.7;
    bubbleList.push({
      x: at.x + Math.cos(a) * 0.1,
      y: at.y,
      z: at.z + Math.sin(a) * 0.1,
      vx: Math.cos(a) * s,
      vy: 0.5 + Math.random() * 0.9,
      vz: Math.sin(a) * s,
      life: 0,
      max: 1.6 + Math.random() * 1.6,
      size: 0.6 + Math.random() * 0.8
    });
  }
}

function Bubbles() {
  const slots = useRef<Array<THREE.Sprite | null>>([]);
  const mat = useMemo(
    () => new THREE.SpriteMaterial({ map: bubbleTexture(), transparent: true, depthWrite: false, toneMapped: false, color: "#dffaff" }),
    []
  );
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    for (let i = bubbleList.length - 1; i >= 0; i--) {
      const p = bubbleList[i];
      p.life += dt;
      if (p.life >= p.max) {
        bubbleList.splice(i, 1);
        continue;
      }
      p.vx *= 1 - dt * 1.2;
      p.vz *= 1 - dt * 1.2;
      p.vy = p.vy * (1 - dt * 0.8) + dt * 0.15;
      p.x += (p.vx + Math.sin(p.life * 3 + i) * 0.15) * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
    }
    for (let i = 0; i < BUBBLE_MAX; i++) {
      const s = slots.current[i];
      if (!s) continue;
      const p = bubbleList[i];
      s.visible = Boolean(p);
      if (!p) continue;
      const k = p.life / p.max;
      s.position.set(p.x, p.y, p.z);
      s.scale.setScalar(0.12 * p.size * (k > 0.92 ? 1.3 : Math.min(1, p.life * 6)));
    }
  });
  return (
    <group>
      {Array.from({ length: BUBBLE_MAX }, (_, i) => (
        <sprite key={i} ref={(s) => void (slots.current[i] = s)} material={mat} visible={false} renderOrder={16} />
      ))}
    </group>
  );
}

// ----------------------------------------------------------------- notes

/** Music notes floating up from an instrument that plays by itself (Melody). */
function Notes() {
  const slots = useRef<Array<THREE.Sprite | null>>([]);
  const mats = useMemo(
    () =>
      Array.from(
        { length: 8 },
        () => new THREE.SpriteMaterial({ map: noteTexture(), transparent: true, depthWrite: false, toneMapped: false })
      ),
    []
  );
  useFrame(() => {
    rt.notes = rt.notes.filter((n) => rt.time - n.t0 < 1.8);
    for (let i = 0; i < 8; i++) {
      const s = slots.current[i];
      if (!s) continue;
      const n = rt.notes[i];
      s.visible = Boolean(n);
      if (!n) continue;
      const t = rt.time - n.t0;
      const k = t / 1.8;
      s.position.set(n.x + Math.sin(t * 4 + n.id) * 0.15, n.y + t * 0.55, n.z);
      s.scale.setScalar(0.28 * Math.min(1, t * 5));
      mats[i].color.set(n.color);
      mats[i].opacity = k > 0.7 ? (1 - k) / 0.3 : 1;
      mats[i].rotation = Math.sin(t * 3 + n.id) * 0.3;
    }
  });
  return (
    <group>
      {mats.map((m, i) => (
        <sprite key={i} ref={(s) => void (slots.current[i] = s)} material={m} visible={false} renderOrder={16} />
      ))}
    </group>
  );
}

// ----------------------------------------------------------------- steam

/**
 * Bathroom steam: a few soft clouds drifting over the bathtub half of the
 * room. Light enough that every object stays recognisable; it clears for
 * close-ups and while the fan runs. Now and then a ghostly shape drifts
 * through it - never at a hiding place, so it is never the clue.
 */
function Steam() {
  const COUNT = 12;
  const tub = WORLD.objectById.get("bathroom.tub");
  const seeds = useMemo(() => Array.from({ length: COUNT }, (_, i) => ({ a: Math.random() * 6, r: 0.5 + (i % 4) * 0.55, s: 2.2 + Math.random() * 1.4, h: 0.4 + Math.random() * 1.2 })), []);
  const slots = useRef<Array<THREE.Sprite | null>>([]);
  const ghost = useRef<THREE.Sprite>(null);
  const mats = useMemo(
    () => seeds.map(() => new THREE.SpriteMaterial({ map: steamTexture(), transparent: true, depthWrite: false, opacity: 0, color: "#eef8fb", toneMapped: false })),
    [seeds]
  );
  const ghostMat = useMemo(() => new THREE.SpriteMaterial({ map: silhouetteTexture(), transparent: true, depthWrite: false, opacity: 0, toneMapped: false }), []);
  useFrame((_, dt) => {
    const st = rt.steam;
    const clear = rt.time < st.fanUntil || rt.camera.mode !== "follow";
    const target = clear ? 0 : st.target;
    st.level += (target - st.level) * Math.min(1, dt * (target > st.level ? 0.5 : 1.6));
    const show = rt.view.floor === 1 && st.level > 0.01 && tub;
    for (let i = 0; i < COUNT; i++) {
      const s = slots.current[i];
      if (!s) continue;
      s.visible = Boolean(show);
      if (!show || !tub) continue;
      const p = seeds[i];
      const t = rt.time * 0.12 + p.a;
      // A drifting bank of steam over the back half of the room, from the bathtub out.
      s.position.set(tub.x - 1.6 + Math.cos(t) * p.r * 1.9, tub.y + p.h + Math.sin(rt.time * 0.4 + p.a) * 0.12, tub.z + 2.4 + Math.sin(t * 0.8) * p.r * 1.1);
      s.scale.set(p.s, p.s * 0.75, 1);
      mats[i].opacity = 0.62 * st.level;
    }
    // the silhouette: 3 seconds across the cloud, faint
    const g = ghost.current;
    if (g && tub) {
      const t = rt.time - st.silhouetteT0;
      const on = show && t >= 0 && t < 3;
      g.visible = Boolean(on);
      if (on) {
        const k = t / 3;
        g.position.set(tub.x - 2.8 + k * 2.4, tub.y + 1.1 + Math.sin(t * 3) * 0.1, tub.z + 2.3 - k * 0.6);
        g.scale.set(0.85, 0.85, 1);
        ghostMat.opacity = Math.sin(k * Math.PI) * 0.6 * st.level;
      }
    }
  });
  return (
    <group>
      {mats.map((m, i) => (
        <sprite key={i} ref={(s) => void (slots.current[i] = s)} material={m} visible={false} renderOrder={12} />
      ))}
      <sprite ref={ghost} material={ghostMat} visible={false} renderOrder={11} />
    </group>
  );
}

export function Effects() {
  return (
    <group>
      <Dust />
      <Sparkles />
      <Gags />
      <Flashlight />
      <Bubbles />
      <Notes />
      <Steam />
    </group>
  );
}
