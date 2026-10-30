import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { rt } from "../game/runtime";
import { sunrise } from "./Outside";
import { FLOOR_Y, WALL_H, WALL_LINES, WING, inWingFootprint } from "../game/world/rooms";

/** Outside each window (the real holes in the outer walls): where its warm room light spills out. */
const WINDOW_LIGHTS: THREE.Vector3[] = WALL_LINES.flatMap((line) =>
  (line.openings ?? [])
    .filter((o) => o.bottom !== undefined)
    .map((o) => {
      const out = line.neg === null ? -1 : 1; // which side of the line is the garden
      const along = (o.from + o.to) / 2;
      const across = line.at + out * 0.7;
      const y = FLOOR_Y[line.floor] + (o.bottom! + o.top) / 2;
      return line.axis === "x" ? new THREE.Vector3(along, y, across) : new THREE.Vector3(across, y, along);
    })
);
const LIGHTS = WINDOW_LIGHTS.length;

const lighting = /* glsl */ `
  uniform vec3 rainColor;
  uniform vec3 warmColor;
  uniform vec3 windows[${LIGHTS}];

  // The porch lamps, the open entrance and every window light the rain near them.
  vec3 litRain(vec3 p) {
    vec3 a = p - vec3(-10.7, 2.1, -2.1);
    vec3 b = p - vec3(-10.7, 2.1, 2.1);
    vec3 c = p - vec3(-8.2, 1.5, 0.0);
    float light = 1.4 / (1.0 + dot(a, a)) + 1.4 / (1.0 + dot(b, b)) + 0.8 / (1.0 + dot(c, c));
    for (int i = 0; i < ${LIGHTS}; i++) {
      vec3 w = p - windows[i];
      light += 0.9 / (1.0 + 2.0 * dot(w, w));
    }
    light = min(1.0, light);
    return mix(rainColor, warmColor, light * 0.8) * (0.65 + light * 1.8);
  }
`;

const rainVertex = /* glsl */ `
  ${lighting}
  uniform float time;
  uniform float fade;
  attribute vec4 seed; // base x, base z, speed, near layer (0/1)
  attribute float top; // the height this drop falls from
  varying vec3 vWorld;
  varying vec2 vUv;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    float nearLayer = seed.w;
    float speed = mix(7.0, 10.0, seed.z);
    // Start height independent of speed (both from seed.z, drops of one speed fall in sheets early on).
    float phase = fract(seed.x * 13.37 + seed.y * 7.31);
    float y = mod(phase * top - time * speed, top);
    // Sideways drift so far, centred on the fall, so each drop stays over the ground it was placed on.
    float fall = (top * 0.5 - y) / speed;
    float wind = -2.0 + 0.45 * sin(time * 0.43) + 0.2 * sin(time * 1.7);
    vec3 center = vec3(seed.x + wind * fall, y, seed.y + 0.35 * fall);
    vec3 direction = vec3(wind / speed, -1.0, 0.35 / speed);
    vec3 across = normalize(cross(direction, cameraPosition - center));
    float streakLength = mix(0.22, 0.42, nearLayer);
    float width = mix(0.012, 0.024, nearLayer);
    // Far away a streak is thinner than a pixel; without antialiasing (SwiftShader, some Chromebooks)
    // those flicker at full strength and pile up into a band at the horizon. Keep them about a pixel
    // wide and dim them to match, then let the far rain fade into the dark.
    float dist = distance(cameraPosition, center);
    float grow = max(1.0, dist / 5.0);
    width *= grow;
    vec3 p = center + direction * position.y * streakLength + across * position.x * width;
    vWorld = (modelMatrix * vec4(p, 1.0)).xyz;
    vUv = uv;
    vAlpha = mix(0.3, 0.62, nearLayer) * fade / grow * (1.0 - smoothstep(16.0, 26.0, dist));
    vColor = litRain(center);
    gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
  }
`;

// The hotel's footprint (walls included), and the Guest Wing behind it: no rain inside them.
const indoors = /* glsl */ `((abs(vWorld.x) < 8.3 && abs(vWorld.z) < 11.3) ||
  (vWorld.x > 7.9 && vWorld.x < ${(WING.x1 + 0.3).toFixed(2)} && abs(vWorld.z) < (vWorld.x < ${WING.x0.toFixed(2)} ? ${(WING.hall.z1 + 0.3).toFixed(2)} : ${(WING.hall.z1 + WING.depth + 0.3).toFixed(2)})))`;

const rainFragment = /* glsl */ `
  uniform float ceiling;
  varying vec3 vWorld;
  varying vec2 vUv;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    // Seen from inside the hotel, the floor above is not drawn: rain above the walls would look indoors.
    if (vWorld.y > ceiling || vWorld.y < 0.0 || ${indoors}) discard;
    float edge = 1.0 - smoothstep(0.15, 0.5, abs(vUv.x - 0.5));
    float tip = smoothstep(0.0, 0.18, vUv.y) * (1.0 - smoothstep(0.75, 1.0, vUv.y));
    gl_FragColor = vec4(vColor, vAlpha * edge * tip);
    #include <colorspace_fragment>
  }
`;

const splashVertex = /* glsl */ `
  ${lighting}
  uniform float time;
  uniform float fade;
  attribute vec4 seed;
  varying vec3 vWorld;
  varying vec2 vUv;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    float age = fract(time * mix(1.2, 2.0, seed.w) + seed.z);
    float radius = mix(0.015, 0.10, age);
    vec3 p = vec3(seed.x + position.x * radius * 2.0, 0.015,
      seed.y + position.y * radius * 2.0);
    vWorld = (modelMatrix * vec4(p, 1.0)).xyz;
    vUv = uv;
    vAlpha = 0.22 * fade * (1.0 - age) * (1.0 - age);
    vColor = litRain(vec3(seed.x, 0.0, seed.y));
    gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
  }
`;

const splashFragment = /* glsl */ `
  varying vec3 vWorld;
  varying vec2 vUv;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    if (${indoors}) discard;
    float radius = length(vUv - 0.5) * 2.0;
    float ring = smoothstep(0.62, 0.76, radius) * (1.0 - smoothstep(0.82, 1.0, radius));
    gl_FragColor = vec4(vColor, vAlpha * ring);
    #include <colorspace_fragment>
  }
`;

/** Rain round the porch and path (where the intro looks). */
const NEAR = 900;
/** Rain just outside each window, so every window looks out at falling rain. */
const PER_WINDOW = 90;
/** A thinner ring all round the hotel. */
const RING = 1500;

interface Drop { x: number; z: number; near: boolean; top: number }

/** Where the drops fall (stable: the same arrangement on every load). */
function layout(random: () => number): Drop[] {
  const drops: Drop[] = [];
  for (let i = 0; i < NEAR; i++) drops.push({ x: -13.5 + random() * 5.2, z: -7 + random() * 14, near: true, top: 4.5 });
  WALL_LINES.forEach((line) => {
    for (const o of line.openings ?? []) {
      if (o.bottom === undefined) continue;
      const out = line.neg === null ? -1 : 1;
      const top = FLOOR_Y[line.floor] + WALL_H + 0.6;
      for (let i = 0; i < PER_WINDOW; i++) {
        const along = (o.from + o.to) / 2 + (random() - 0.5) * 3.4;
        const across = line.at + out * (0.35 + random() * 2.4);
        drops.push(line.axis === "x" ? { x: along, z: across, near: true, top } : { x: across, z: along, near: true, top });
      }
    }
  });
  while (drops.length < NEAR + LIGHTS * PER_WINDOW + RING) {
    // West to the porch, east past the Guest Wing behind the hotel.
    const x = -20 + random() * 50;
    const z = -21 + random() * 42;
    if (Math.abs(x) < 8.5 && Math.abs(z) < 11.5) continue;
    if (inWingFootprint(x, z, 0.5)) continue;
    drops.push({ x, z, near: false, top: 7 });
  }
  return drops;
}

/** Two fixed batches; only time/fade uniforms change during animation. */
export function Rain() {
  const group = useRef<THREE.Group>(null);
  const batches = useMemo(() => {
    let state = 21610;
    const random = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
    const quad = (geometry: THREE.InstancedBufferGeometry) => {
      geometry.setAttribute("position", new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, -0.5, 0.5, 0, 0.5, 0.5, 0], 3));
      geometry.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 1], 2));
      geometry.setIndex([0, 1, 2, 2, 1, 3]);
      return geometry;
    };

    const drops = layout(random);
    const rainGeometry = quad(new THREE.InstancedBufferGeometry());
    const seeds = new Float32Array(drops.length * 4);
    const tops = new Float32Array(drops.length);
    drops.forEach((d, i) => {
      seeds.set([d.x, d.z, random(), d.near ? 1 : 0], i * 4);
      tops[i] = d.top;
    });
    rainGeometry.setAttribute("seed", new THREE.InstancedBufferAttribute(seeds, 4));
    rainGeometry.setAttribute("top", new THREE.InstancedBufferAttribute(tops, 1));
    rainGeometry.instanceCount = drops.length;

    // Splashes: the porch, the path, and the ground under the ground-floor windows.
    const splashes: number[] = [];
    for (let i = 0; i < 80; i++) splashes.push(-11.0 + random() * 2.6, (random() - 0.5) * 4.6);
    for (let i = 0; i < 80; i++) {
      const x = -21.1 + random() * 9.9;
      splashes.push(x, Math.sin(((-11.6 - x) / 1.15) * 0.7) * 0.25 + (random() - 0.5) * 0.8);
    }
    for (const line of WALL_LINES) {
      if (line.floor !== 0 || line.neg !== null) continue;
      for (const o of line.openings ?? []) {
        if (o.bottom === undefined) continue;
        for (let i = 0; i < 20; i++) {
          const along = (o.from + o.to) / 2 + (random() - 0.5) * 2.6;
          const across = line.at - (0.35 + random() * 1.4);
          splashes.push(...(line.axis === "x" ? [along, across] : [across, along]));
        }
      }
    }
    const splashGeometry = quad(new THREE.InstancedBufferGeometry());
    const splashSeeds = new Float32Array((splashes.length / 2) * 4);
    for (let i = 0; i < splashes.length / 2; i++) splashSeeds.set([splashes[i * 2], splashes[i * 2 + 1], random(), random()], i * 4);
    splashGeometry.setAttribute("seed", new THREE.InstancedBufferAttribute(splashSeeds, 4));
    splashGeometry.instanceCount = splashes.length / 2;

    const makeMaterial = (vertexShader: string, fragmentShader: string) =>
      new THREE.ShaderMaterial({
        uniforms: {
          time: { value: rt.time },
          fade: { value: 1 - sunrise() },
          rainColor: { value: new THREE.Color("#bec8ff") },
          warmColor: { value: new THREE.Color("#ffcf7a") },
          windows: { value: WINDOW_LIGHTS },
          ceiling: { value: 100 }
        },
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide
      });
    return {
      rainGeometry,
      splashGeometry,
      rainMaterial: makeMaterial(rainVertex, rainFragment),
      splashMaterial: makeMaterial(splashVertex, splashFragment)
    };
  }, []);

  useEffect(
    () => () => {
      batches.rainGeometry.dispose();
      batches.splashGeometry.dispose();
      batches.rainMaterial.dispose();
      batches.splashMaterial.dispose();
    },
    [batches]
  );

  useFrame(() => {
    const fade = 1 - sunrise();
    if (group.current) group.current.visible = fade > 0;
    if (fade === 0) return;
    batches.rainMaterial.uniforms.time.value = rt.time;
    batches.splashMaterial.uniforms.time.value = rt.time;
    batches.rainMaterial.uniforms.fade.value = fade;
    batches.splashMaterial.uniforms.fade.value = fade;
    // Indoors means the camera is in the hotel, or (following) the player is: the follow camera swings
    // out over the walls, and streaks between it and the room would look like rain in the room.
    const c = rt.camera.pos;
    const p = rt.player;
    const inHotel = (x: number, z: number) => (Math.abs(x) < 8.25 && Math.abs(z) < 11.25) || inWingFootprint(x, z, 0.25);
    const inside = inHotel(c.x, c.z) || (rt.camera.mode === "follow" && inHotel(p.x, p.z));
    batches.rainMaterial.uniforms.ceiling.value = inside ? FLOOR_Y[rt.view.floor] + WALL_H : 100;
  });

  // Shader displacement exceeds the base quad's bounds; do not CPU-frustum-cull it.
  // Drawn after the other transparent things (the fading walls), and before the window glass.
  return (
    <group ref={group}>
      <mesh geometry={batches.rainGeometry} material={batches.rainMaterial} frustumCulled={false} renderOrder={10} />
      <mesh geometry={batches.splashGeometry} material={batches.splashMaterial} frustumCulled={false} renderOrder={10} />
    </group>
  );
}
