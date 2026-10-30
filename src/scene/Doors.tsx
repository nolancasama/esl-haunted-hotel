import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { FLOOR_Y, GUEST_INFO, ROOMS, WALL_LINES, WALL_T, doorFit, isGuestRoom, type DoorDef } from "../game/world/rooms";
import { doorAccess } from "../game/guestWing";
import { BEACON_RADIUS, beaconSpot, hallSide } from "../game/beacon";
import { rt } from "../game/runtime";
import { PartBuilder } from "./partBuilder";
import { iconTexture, plaqueTexture, signboardTexture } from "./textures";
import { lineFade } from "./wallFade";
import { director } from "../game/director";
import { isCanvasTap } from "../input/tap";
import { getGame } from "../game/store";

type Style = "plain" | "entrance" | "attic" | "gate" | "guest" | "wing";

function panelGeometry(width: number, height: number, mirror: boolean, style: Style): THREE.BufferGeometry {
  const b = new PartBuilder(0.2);
  const x0 = mirror ? -width : 0;
  const cx = x0 + width / 2;
  const knobX = mirror ? -width + 0.12 : width - 0.12;
  if (style === "gate") {
    // wrought iron: frame, bars with spear tips, a curl in the middle
    const iron = "#2a2433";
    b.box(width, 0.05, 0.05, cx, 0.08, 0, iron);
    b.box(width, 0.05, 0.05, cx, height - 0.12, 0, iron);
    b.box(0.05, height, 0.05, x0 + 0.025, 0, 0, iron);
    b.box(0.05, height, 0.05, x0 + width - 0.025, 0, 0, iron);
    const n = Math.round(width / 0.14);
    for (let i = 1; i < n; i++) {
      const x = x0 + (i * width) / n;
      b.box(0.025, height - 0.05, 0.025, x, 0.03, 0, iron);
      b.add(new THREE.ConeGeometry(0.03, 0.09, 4), "#c9a24a", [x, height + 0.02, 0]);
    }
    b.torus(0.12, 0.018, [cx, height * 0.5, 0], [0, 0, 0], "#c9a24a");
    return b.build();
  }
  const wood = style === "entrance" ? "#4f2a1c" : style === "attic" ? "#5a4636" : style === "guest" ? "#5a3222" : style === "wing" ? "#43241a" : "#6b3d2a";
  const panel = style === "entrance" ? "#64372a" : style === "attic" ? "#6e5844" : style === "guest" ? "#6e4030" : style === "wing" ? "#5a3224" : "#7e4a33";
  b.box(width, height, 0.07, cx, 0, 0, wood);
  if (style === "wing") {
    // Tall glazed doors with brass rails: frosted panes above, a wooden panel below.
    for (const z of [0.04, -0.04]) {
      b.box(width - 0.22, height * 0.46, 0.012, cx, height * 0.44, z, "#a9b6d6");
      b.box(width - 0.22, 0.03, 0.02, cx, height * 0.66, z, "#d4ad55");
      b.box(0.03, height * 0.46, 0.02, cx, height * 0.44, z, "#d4ad55");
      b.box(width - 0.26, height * 0.26, 0.02, cx, 0.14, z, panel);
    }
    b.box(0.03, 0.5, 0.03, mirror ? -width + 0.1 : width - 0.1, 0.8, 0.07, "#d4ad55");
    b.box(0.03, 0.5, 0.03, mirror ? -width + 0.1 : width - 0.1, 0.8, -0.07, "#d4ad55");
    return b.build();
  }
  if (style === "attic") {
    // weathered vertical planks, iron straps, a little round window
    for (let i = 1; i < 4; i++) b.box(0.015, height, 0.075, x0 + (i * width) / 4, 0, 0, "#3e3024");
    for (const y of [0.3, height - 0.4]) b.box(width * 0.85, 0.06, 0.08, mirror ? x0 + width * 0.575 : x0 + width * 0.425, y, 0, "#2a2433");
    b.cyl(0.13, 0.13, 0.08, cx, height * 0.74, 0, "#2a2433", 14);
    b.cyl(0.1, 0.1, 0.085, cx, height * 0.74, 0, "#8a7ad8", 14);
  } else {
    for (const y of [0.25, height * 0.55]) {
      b.box(width - 0.3, height * 0.36, 0.02, cx, y, 0.04, panel);
      b.box(width - 0.3, height * 0.36, 0.02, cx, y, -0.04, panel);
    }
    if (style === "guest") {
      // brass kick plates and a little peephole
      b.box(width - 0.1, 0.16, 0.012, cx, 0.02, 0.042, "#b8923f");
      b.box(width - 0.1, 0.16, 0.012, cx, 0.02, -0.042, "#b8923f");
      b.cyl(0.018, 0.018, 0.09, cx, 1.55, 0, "#d4ad55", 8);
    }
  }
  b.sphere(0.05, knobX, 1.0, 0.07, style === "attic" ? "#8a8494" : "#d4ad55");
  b.sphere(0.05, knobX, 1.0, -0.07, style === "attic" ? "#8a8494" : "#d4ad55");
  if (style === "entrance") {
    // a little round window in each leaf
    b.cyl(0.16, 0.16, 0.08, cx, height * 0.72, 0, "#c9a24a", 14);
  }
  return b.build();
}

function frameGeometry(width: number, height: number, style: Style): THREE.BufferGeometry {
  const b = new PartBuilder(0);
  if (style === "gate") {
    // stone-capped gate posts
    for (const x of [-0.08, width + 0.08]) {
      b.box(0.16, height + 0.12, 0.16, x, 0, 0, "#3a3242");
      b.sphere(0.09, x, height + 0.2, 0, "#c9a24a");
    }
    return b.build();
  }
  const t = WALL_T + 0.08;
  const col = style === "attic" ? "#7a6450" : style === "guest" || style === "wing" ? "#3e2418" : "#c9b28c";
  b.box(0.12, height + 0.1, t, -0.04, 0, 0, col);
  b.box(0.12, height + 0.1, t, width + 0.04, 0, 0, col);
  b.box(width + 0.2, 0.12, t, width / 2, height, 0, col);
  return b.build();
}

const styleOf = (door: DoorDef): Style => (door.id === "entrance" ? "entrance" : door.style ?? "plain");

export function Door({ door }: { door: DoorDef }) {
  const width = door.to - door.from;
  const { head, leaf: height } = doorFit(door);
  const style = styleOf(door);
  const leaves = useMemo(
    () =>
      door.double
        ? [panelGeometry(width / 2, height, false, style), panelGeometry(width / 2, height, true, style)]
        : [panelGeometry(width, height, false, style)],
    [door.double, width, height, style]
  );
  const frame = useMemo(() => frameGeometry(width, head, style), [width, head, style]);
  const hinges = useRef<Array<THREE.Group | null>>([]);
  const root = useRef<THREE.Group>(null);
  const lock = useRef<THREE.Sprite>(null);
  const mat = useMemo(() => new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true }), []);
  const lockMat = useMemo(
    () => new THREE.SpriteMaterial({ map: iconTexture("lock"), transparent: true, depthWrite: false, toneMapped: false }),
    []
  );
  const lineId = useMemo(() => WALL_LINES.find((l) => l.openings?.some((o) => o.door === door.id))?.id ?? "", [door.id]);
  // Guest rooms: a brass number on the corridor side, above the door. The wing: GUEST ROOMS on the landing side.
  const label = useMemo(() => {
    if (style === "guest" && isGuestRoom(door.id)) {
      return new THREE.MeshBasicMaterial({ map: plaqueTexture(String(GUEST_INFO[door.id].number)), transparent: true, toneMapped: false });
    }
    if (style === "wing") return new THREE.MeshBasicMaterial({ map: signboardTexture("GUEST ROOMS"), transparent: true, toneMapped: false });
    return null;
  }, [style, door.id]);
  const rotY = door.axis === "x" ? 0 : -Math.PI / 2;
  const base = FLOOR_Y[door.floor];
  const origin: [number, number, number] = door.axis === "x" ? [door.from, base, door.at] : [door.at, base, door.from];
  const room = ROOMS[door.room];
  const roomSide =
    door.axis === "x"
      ? Math.sign((room.bounds.z0 + room.bounds.z1) / 2 - door.at)
      : Math.sign((room.bounds.x0 + room.bounds.x1) / 2 - door.at);
  // Local z of the frame equals world +z (axis x) or world -x (axis z). The gate swings back into the lobby.
  const swing = style === "gate" ? 1 : door.axis === "x" ? roomSide : -roomSide;
  const lockLocalZ = (door.axis === "x" ? hallSide(door) : -hallSide(door)) * 0.38;
  const angle = useRef(0);

  useFrame((_, dt) => {
    const open = rt.doorsOpen.has(door.id);
    const target = open ? 1 : 0;
    const speed = open ? (style === "gate" ? 1 / 0.6 : 1 / 1.1) : rt.doorSlam.has(door.id) ? 1 / 0.12 : 1 / 0.9;
    const step = Math.min(1, dt * speed);
    angle.current += Math.sign(target - angle.current) * Math.min(Math.abs(target - angle.current), step);
    const a = open ? 1 - Math.pow(1 - angle.current, 2.2) : angle.current;
    if (hinges.current[0]) hinges.current[0].rotation.y = -swing * a * 1.75;
    if (hinges.current[1]) hinges.current[1].rotation.y = swing * a * 1.75;
    const onFloor = door.floor === rt.view.floor;
    const o = onFloor ? (lineId ? lineFade.get(lineId) ?? 1 : 1) : 0;
    mat.opacity = o;
    mat.depthWrite = o > 0.98;
    if (label) label.opacity = o;
    if (root.current) root.current.visible = o > 0.02;
    if (lock.current) {
      // Sprites face the camera: keep the whole billboard proud of the visible
      // door face, including when the entrance is viewed from outside.
      const cameraSide = door.axis === "x" ? rt.camera.pos.z - door.at : door.at - rt.camera.pos.x;
      lock.current.position.z = (Math.sign(cameraSide) || Math.sign(lockLocalZ)) * 0.38;
      // Doors the student opens by hand only show the padlock while they are really locked.
      const locked = !open && angle.current < 0.02 && doorAccess(door.id) !== "open";
      lock.current.visible = locked;
      lockMat.opacity = o * (0.75 + Math.sin(rt.time * 3) * 0.2);
    }
  });

  return (
    <group ref={root} position={origin} rotation={[0, rotY, 0]} onClick={(e) => {
      if (getGame().phase !== "explore" || door.floor !== rt.view.floor || !root.current?.visible || !isCanvasTap(e.delta)) return;
      e.stopPropagation();
      director.tapDoor(door.id);
    }}>
      <mesh geometry={frame} material={mat} />
      <group ref={(g) => void (hinges.current[0] = g)}>
        <mesh geometry={leaves[0]} material={mat} />
      </group>
      {leaves[1] && (
        <group ref={(g) => void (hinges.current[1] = g)} position={[width, 0, 0]}>
          <mesh geometry={leaves[1]} material={mat} />
        </group>
      )}
      {label && style === "guest" && (
        // Local +z is world +z (axis-x doors): the corridor is on the far side from the room.
        <mesh material={label} position={[width / 2, head + 0.24, -roomSide * (WALL_T / 2 + 0.05)]} rotation={[0, roomSide > 0 ? Math.PI : 0, 0]}>
          <planeGeometry args={[0.42, 0.21]} />
        </mesh>
      )}
      {label && style === "wing" && (
        // Axis-z door: local +z is world -x, the hallway side (facing the stairs).
        <mesh material={label} position={[width / 2, head + 0.33, WALL_T / 2 + 0.05]}>
          <planeGeometry args={[1.9, 0.42]} />
        </mesh>
      )}
      <sprite
        ref={lock}
        material={lockMat}
        position={[width / 2, style === "gate" ? height + 0.45 : 1.35, lockLocalZ]}
        scale={[0.5, 0.5, 1]}
      />
    </group>
  );
}

/** A bobbing golden arrow (and a floor glow) over the door - or the stairs - the student should go to. */
export function Beacon() {
  const arrow = useRef<THREE.Sprite>(null);
  const ring = useRef<THREE.Mesh>(null);
  const mat = useMemo(
    () => new THREE.SpriteMaterial({ map: iconTexture("arrow"), transparent: true, depthWrite: false, depthTest: false, toneMapped: false }),
    []
  );
  const ringMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#ffd36b",
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false
      }),
    []
  );
  useFrame(() => {
    const spot = rt.beaconDoor ? beaconSpot(rt.beaconDoor) : null;
    const show = Boolean(spot && spot.floor === rt.view.floor);
    if (arrow.current) arrow.current.visible = show;
    if (ring.current) ring.current.visible = show;
    if (!spot || !show) return;
    arrow.current?.position.set(spot.x, spot.y + 2.75 + Math.sin(rt.time * 4) * 0.12, spot.z);
    ring.current?.position.set(spot.x, spot.y + 0.02, spot.z);
    if (ring.current) ring.current.scale.setScalar(1 + Math.sin(rt.time * 3) * 0.12);
  });
  return (
    <group>
      <sprite ref={arrow} material={mat} scale={[0.7, 0.7, 1]} renderOrder={30} visible={false} />
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} material={ringMat} visible={false}>
        <ringGeometry args={[0.45, BEACON_RADIUS, 32]} />
      </mesh>
    </group>
  );
}
