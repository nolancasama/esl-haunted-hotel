import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { rt } from "../game/runtime";
import { sunrise } from "./Outside";
import { FLOOR_Y, WALL_H } from "../game/world/rooms";

const lighting = /* glsl */ `
  uniform vec3 rainColor;
  uniform vec3 warmColor;
  varying vec3 vWorld;
  varying vec2 vUv;
  varying float vAlpha;

  vec3 litRain(vec3 p) {
    vec3 a = p - vec3(-10.7, 2.1, -2.1);
    vec3 b = p - vec3(-10.7, 2.1, 2.1);
    vec3 c = p - vec3(-8.2, 1.5, 0.0);
    float light = min(1.0, 1.4 / (1.0 + dot(a, a))
      + 1.4 / (1.0 + dot(b, b)) + 0.8 / (1.0 + dot(c, c)));
    return mix(rainColor, warmColor, light * 0.8) * (0.65 + light * 1.8);
  }
`;

const rainVertex = /* glsl */ `
  uniform float time;
  uniform float fade;
  attribute vec4 seed;
  varying vec3 vWorld;
  varying vec2 vUv;
  varying float vAlpha;
  void main() {
    float nearLayer = seed.w;
    float speed = mix(7.0, 10.0, seed.z);
    // The near layer falls from lower down, so its drops are where the cameras look.
    float top = mix(7.0, 4.5, nearLayer);
    // Start height independent of speed (both from seed.z, drops of one speed fall in sheets early on).
    float phase = fract(seed.x * 13.37 + seed.y * 7.31);
    float y = mod(phase * top - time * speed, top);
    // Sideways drift so far, centred on the column, so a layer stays over the ground it was placed on.
    float fall = (top * 0.5 - y) / speed;
    float wind = -2.0 + 0.45 * sin(time * 0.43) + 0.2 * sin(time * 1.7);
    // Wrap in the west volume; clip the entire ribbon at its boundaries below.
    float x = -26.0 + mod(seed.x + wind * fall, 17.7);
    float z = -14.0 + mod(seed.y + 0.35 * fall, 28.0);
    vec3 center = vec3(x, y, z);
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
    gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
  }
`;

const rainFragment = /* glsl */ `
  ${lighting}
  uniform float ceiling;
  void main() {
    // Seen from inside the hotel, the floor above is not drawn: rain above the walls would look indoors.
    if (vWorld.y > ceiling) discard;
    // Also clips ribbon tips/edges, so wind can never carry rain into rooms.
    if (vWorld.x > -8.3 || vWorld.x < -26.0 || abs(vWorld.z) > 14.0
      || vWorld.y < 0.0 || vWorld.y > 7.0) discard;
    float edge = 1.0 - smoothstep(0.15, 0.5, abs(vUv.x - 0.5));
    float tip = smoothstep(0.0, 0.18, vUv.y) * (1.0 - smoothstep(0.75, 1.0, vUv.y));
    gl_FragColor = vec4(litRain(vWorld), vAlpha * edge * tip);
    #include <colorspace_fragment>
  }
`;

const splashVertex = /* glsl */ `
  uniform float time;
  uniform float fade;
  attribute vec4 seed;
  varying vec3 vWorld;
  varying vec2 vUv;
  varying float vAlpha;
  void main() {
    float age = fract(time * mix(1.2, 2.0, seed.w) + seed.z);
    float radius = mix(0.015, 0.10, age);
    vec3 p = vec3(seed.x + position.x * radius * 2.0, 0.015,
      seed.y + position.y * radius * 2.0);
    vWorld = (modelMatrix * vec4(p, 1.0)).xyz;
    vUv = uv;
    vAlpha = 0.22 * fade * (1.0 - age) * (1.0 - age);
    gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
  }
`;

const splashFragment = /* glsl */ `
  ${lighting}
  void main() {
    if (vWorld.x > -8.3) discard;
    float radius = length(vUv - 0.5) * 2.0;
    float ring = smoothstep(0.62, 0.76, radius) * (1.0 - smoothstep(0.82, 1.0, radius));
    gl_FragColor = vec4(litRain(vWorld), vAlpha * ring);
    #include <colorspace_fragment>
  }
`;

/** Streaks in the near layer (the rest fill the distance). */
const NEAR = 1000;

/** Two fixed batches; only time/fade uniforms change during animation. */
export function Rain() {
  const group = useRef<THREE.Group>(null);
  const batches = useMemo(() => {
    // Stable seeds avoid a new arrangement on remount; no per-frame drop work.
    let state = 21610;
    const random = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
    const makeGeometry = (count: number, splash: boolean) => {
      const geometry = new THREE.InstancedBufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute([
        -0.5, -0.5, 0, 0.5, -0.5, 0, -0.5, 0.5, 0, 0.5, 0.5, 0
      ], 3));
      geometry.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 1], 2));
      geometry.setIndex([0, 1, 2, 2, 1, 3]);
      const seeds = new Float32Array(count * 4);
      for (let i = 0; i < count; i++) {
        const near = i < NEAR;
        if (splash) {
          const porch = i < count / 2;
          const x = porch ? -11.0 + random() * 2.6 : -21.1 + random() * 9.9;
          seeds[i * 4] = x;
          seeds[i * 4 + 1] = porch ? (random() - 0.5) * 4.6
            : Math.sin((-11.6 - x) / 1.15 * 0.7) * 0.25 + (random() - 0.5) * 0.8;
        } else {
          // A sparse, broader/brighter foreground over a dense distant volume.
          // The near layer is packed round the porch, the lamps and the start of the path.
          seeds[i * 4] = near ? 12.5 + random() * 5.2 : random() * 17.7;
          seeds[i * 4 + 1] = near ? 7.0 + random() * 14.0 : random() * 28.0;
        }
        seeds[i * 4 + 2] = random();
        seeds[i * 4 + 3] = splash ? random() : Number(near);
      }
      geometry.setAttribute("seed", new THREE.InstancedBufferAttribute(seeds, 4));
      geometry.instanceCount = count;
      return geometry;
    };
    const makeMaterial = (vertexShader: string, fragmentShader: string) => new THREE.ShaderMaterial({
      uniforms: {
        time: { value: rt.time },
        fade: { value: 1 - sunrise() },
        rainColor: { value: new THREE.Color("#bec8ff") },
        warmColor: { value: new THREE.Color("#ffcf7a") },
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
      rainGeometry: makeGeometry(2600, false),
      splashGeometry: makeGeometry(160, true),
      rainMaterial: makeMaterial(rainVertex, rainFragment),
      splashMaterial: makeMaterial(splashVertex, splashFragment)
    };
  }, []);

  useEffect(() => () => {
    batches.rainGeometry.dispose();
    batches.splashGeometry.dispose();
    batches.rainMaterial.dispose();
    batches.splashMaterial.dispose();
  }, [batches]);

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
    const inHotel = (x: number, z: number) => Math.abs(x) < 8.25 && Math.abs(z) < 11.25;
    const inside = inHotel(c.x, c.z) || (rt.camera.mode === "follow" && inHotel(p.x, p.z));
    batches.rainMaterial.uniforms.ceiling.value = inside ? FLOOR_Y[rt.view.floor] + WALL_H : 100;
  });

  // Shader displacement exceeds the base quad's bounds; do not CPU-frustum-cull it.
  // Drawn after the other transparent things: the walls are transparent (they fade), and sorted by
  // position the rain (at the origin) would come first and be painted over by the facade.
  return (
    <group ref={group}>
      <mesh geometry={batches.rainGeometry} material={batches.rainMaterial} frustumCulled={false} renderOrder={10} />
      <mesh geometry={batches.splashGeometry} material={batches.splashMaterial} frustumCulled={false} renderOrder={10} />
    </group>
  );
}
