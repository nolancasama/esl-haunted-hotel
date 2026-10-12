import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { DOORS, DOOR_H, ROOMS, WALL_LINES, WALL_T, type DoorDef } from "../game/world/rooms";
import { rt } from "../game/runtime";
import { PartBuilder } from "./partBuilder";
import { iconTexture } from "./textures";
import { lineFade } from "./wallFade";

function panelGeometry(width: number, height: number, mirror: boolean, entrance: boolean): THREE.BufferGeometry {
  const b = new PartBuilder(0.2);
  const x0 = mirror ? -width : 0;
  const cx = x0 + width / 2;
  const wood = entrance ? "#4f2a1c" : "#6b3d2a";
  const panel = entrance ? "#64372a" : "#7e4a33";
  b.box(width, height, 0.07, cx, 0, 0, wood);
  for (const y of [0.25, height * 0.55]) {
    b.box(width - 0.3, height * 0.36, 0.02, cx, y, 0.04, panel);
    b.box(width - 0.3, height * 0.36, 0.02, cx, y, -0.04, panel);
  }
  const knobX = mirror ? -width + 0.12 : width - 0.12;
  b.sphere(0.05, knobX, 1.0, 0.07, "#d4ad55");
  b.sphere(0.05, knobX, 1.0, -0.07, "#d4ad55");
  if (entrance) {
    // a little round window in each leaf
    b.cyl(0.16, 0.16, 0.08, cx, height * 0.72, 0, "#c9a24a", 14);
  }
  return b.build();
}

function frameGeometry(width: number, height: number): THREE.BufferGeometry {
  const b = new PartBuilder(0);
  const t = WALL_T + 0.08;
  b.box(0.12, height + 0.1, t, -0.04, 0, 0, "#c9b28c");
  b.box(0.12, height + 0.1, t, width + 0.04, 0, 0, "#c9b28c");
  b.box(width + 0.2, 0.12, t, width / 2, height, 0, "#c9b28c");
  return b.build();
}

/** Which side of the wall (along its normal axis) faces the lobby. */
function lobbySide(door: DoorDef): number {
  const room = ROOMS[door.room];
  const roomSide =
    door.axis === "x"
      ? Math.sign((room.bounds.z0 + room.bounds.z1) / 2 - door.at)
      : Math.sign((room.bounds.x0 + room.bounds.x1) / 2 - door.at);
  return door.room === "lobby" ? roomSide : -roomSide;
}

export function Door({ door }: { door: DoorDef }) {
  const width = door.to - door.from;
  const height = (door.height ?? DOOR_H) - 0.04;
  const entrance = door.id === "entrance";
  const leaves = useMemo(
    () =>
      door.double
        ? [panelGeometry(width / 2, height, false, entrance), panelGeometry(width / 2, height, true, entrance)]
        : [panelGeometry(width, height, false, entrance)],
    [door.double, width, height, entrance]
  );
  const frame = useMemo(() => frameGeometry(width, height + 0.04), [width, height]);
  const hinges = useRef<Array<THREE.Group | null>>([]);
  const root = useRef<THREE.Group>(null);
  const lock = useRef<THREE.Sprite>(null);
  const mat = useMemo(() => new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true }), []);
  const lockMat = useMemo(
    () => new THREE.SpriteMaterial({ map: iconTexture("lock"), transparent: true, depthWrite: false, toneMapped: false }),
    []
  );
  const lineId = useMemo(() => WALL_LINES.find((l) => l.openings?.some((o) => o.door === door.id))?.id ?? "", [door.id]);
  const rotY = door.axis === "x" ? 0 : -Math.PI / 2;
  const origin: [number, number, number] = door.axis === "x" ? [door.from, 0, door.at] : [door.at, 0, door.from];
  const room = ROOMS[door.room];
  const roomSide =
    door.axis === "x"
      ? Math.sign((room.bounds.z0 + room.bounds.z1) / 2 - door.at)
      : Math.sign((room.bounds.x0 + room.bounds.x1) / 2 - door.at);
  // Local z of the frame equals world +z (axis x) or world -x (axis z).
  const swing = door.axis === "x" ? roomSide : -roomSide;
  const lockLocalZ = (door.axis === "x" ? lobbySide(door) : -lobbySide(door)) * 0.2;
  const angle = useRef(0);

  useFrame((_, dt) => {
    const open = rt.doorsOpen.has(door.id);
    const target = open ? 1 : 0;
    const speed = open ? 1 / 1.1 : rt.doorSlam.has(door.id) ? 1 / 0.12 : 1 / 0.9;
    const step = Math.min(1, dt * speed);
    angle.current += Math.sign(target - angle.current) * Math.min(Math.abs(target - angle.current), step);
    const a = open ? 1 - Math.pow(1 - angle.current, 2.2) : angle.current;
    if (hinges.current[0]) hinges.current[0].rotation.y = -swing * a * 1.75;
    if (hinges.current[1]) hinges.current[1].rotation.y = swing * a * 1.75;
    const o = lineFade.get(lineId) ?? 1;
    mat.opacity = o;
    mat.depthWrite = o > 0.98;
    if (root.current) root.current.visible = o > 0.02;
    if (lock.current) {
      const locked = !open && angle.current < 0.02;
      lock.current.visible = locked;
      lockMat.opacity = o * (0.75 + Math.sin(rt.time * 3) * 0.2);
    }
  });

  return (
    <group ref={root} position={origin} rotation={[0, rotY, 0]}>
      <mesh geometry={frame} material={mat} />
      <group ref={(g) => void (hinges.current[0] = g)}>
        <mesh geometry={leaves[0]} material={mat} />
      </group>
      {leaves[1] && (
        <group ref={(g) => void (hinges.current[1] = g)} position={[width, 0, 0]}>
          <mesh geometry={leaves[1]} material={mat} />
        </group>
      )}
      <sprite ref={lock} material={lockMat} position={[width / 2, 1.35, lockLocalZ]} scale={[0.5, 0.5, 1]} />
    </group>
  );
}

/** A bobbing golden arrow (and a floor glow) over the door the student should go to. */
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
    const door = DOORS.find((d) => d.id === rt.beaconDoor);
    const show = Boolean(door);
    if (arrow.current) arrow.current.visible = show;
    if (ring.current) ring.current.visible = show;
    if (!door) return;
    const mid = (door.from + door.to) / 2;
    const side = lobbySide(door) * 0.7;
    const x = door.axis === "x" ? mid : door.at + side;
    const z = door.axis === "x" ? door.at + side : mid;
    arrow.current?.position.set(x, 2.75 + Math.sin(rt.time * 4) * 0.12, z);
    ring.current?.position.set(x, 0.02, z);
    if (ring.current) ring.current.scale.setScalar(1 + Math.sin(rt.time * 3) * 0.12);
  });
  return (
    <group>
      <sprite ref={arrow} material={mat} scale={[0.7, 0.7, 1]} renderOrder={30} visible={false} />
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} material={ringMat} visible={false}>
        <ringGeometry args={[0.45, 0.62, 32]} />
      </mesh>
    </group>
  );
}
