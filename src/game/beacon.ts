import { DOORS, FLOOR_Y, ROOMS, STAIRS, type DoorDef } from "./world/rooms";

export const BEACON_RADIUS = 0.62;

/** Which side of a threshold faces the lobby/landing. */
export function hallSide(door: DoorDef): number {
  const b = ROOMS[door.room].bounds;
  const side = Math.sign((door.axis === "x" ? (b.z0 + b.z1) / 2 : (b.x0 + b.x1) / 2) - door.at);
  if (door.style === "gate") return -1;
  return door.room === "lobby" ? side : -side;
}

// Fixed geometry is cached once: the frame check does no searches or allocation.
const spots = new Map(DOORS.map((d) => {
  const side = hallSide(d);
  const mid = (d.from + d.to) / 2;
  return [d.id as string, {
    x: d.axis === "x" ? mid : d.at + side * 0.7,
    z: d.axis === "x" ? d.at + side * 0.7 : mid,
    y: FLOOR_Y[d.floor], floor: d.floor,
    dirX: d.axis === "x" ? 0 : -side,
    dirZ: d.axis === "x" ? -side : 0
  }];
}));
spots.set("stairs", { ...STAIRS.beacon, y: 0, floor: 0, dirX: 1, dirZ: 0 });

export function beaconSpot(id: string) {
  return spots.get(id) ?? null;
}

export function withinBeacon(x: number, z: number, floor: number, spot: { x: number; z: number; floor: number }) {
  const dx = x - spot.x;
  const dz = z - spot.z;
  return floor === spot.floor && dx * dx + dz * dz <= BEACON_RADIUS * BEACON_RADIUS;
}

/**
 * Held input cancels the automatic entry only when it clearly points back out of the
 * doorway (more than ~107 degrees off "into the room"). Sideways input does not: a
 * student who walked along the wall onto the ring is still holding that key.
 */
export function cancelsAutoEntry(dx: number, dz: number, auto: { dirX: number; dirZ: number }) {
  const l = Math.hypot(dx, dz);
  return l > 0 && dx * auto.dirX + dz * auto.dirZ < -0.3 * l;
}
