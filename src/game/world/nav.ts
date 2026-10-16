import type { Floor, RoomId } from "../types";
import { collidersFor, floorState, nearestSearchable } from "./collision";
import { INTERACT_RANGE, PLAYER_R } from "./constants";
import { localToWorld, rectCenter, rectDistance } from "./geometry";
import { DOORS, roomAt } from "./rooms";
import { WORLD } from "./world";

export interface NavPoint {
  x: number;
  z: number;
  floor: Floor;
}

// A small steering allowance keeps the follower away from collision boundaries.
const RADIUS = PLAYER_R + 0.04;
const CELL = 0.25;
const MIN_X = -10.5;
const NX = 75;
const NZ = 89;
const SAMPLE = 0.05;
const doorBits = new Map(DOORS.map((door, i) => [door.id as string, 1 << i]));
interface Edge { to: number; doors: number; cost: number }
interface Node extends NavPoint { doors: number; edges: Edge[] }
interface Grid { nodes: Node[]; cells: Int32Array; mask: number; components: Int32Array }
let grid: Grid | undefined;

function cellIndex(ix: number, iz: number, floor: Floor): number {
  return (floor * NZ + iz) * NX + ix;
}

/** Static walls/furniture and the same floor-dependent collider set as moveBody. */
function pointDoors(x: number, z: number, floor: Floor, radius = RADIUS): number {
  if (x <= MIN_X || x >= 8 || z <= -11 || z >= 11) return -1;
  // The short entrance path also lets the completed game be exited by a tap.
  if (x <= -8 && (floor !== 0 || Math.abs(z) > 0.75)) return -1;
  const state = floorState(x, z, floor);
  if (state.floor !== floor) return -1;
  let doors = 0;
  for (const collider of collidersFor(floor, state.stairs)) {
    const b = collider.rect;
    const dx = Math.max(b.x0 - x, 0, x - b.x1);
    const dz = Math.max(b.z0 - z, 0, z - b.z1);
    if (dx * dx + dz * dz >= radius * radius) continue;
    if (!collider.door) return -1;
    doors |= doorBits.get(collider.door)!;
  }
  return doors;
}

/** Return all doors crossed, or -1 for an obstructed segment. Floor changes are
 * simulated in travel order, so no shortcut can jump between stacked rooms. */
function segmentDoors(a: NavPoint, b: NavPoint, leaveBoundary = false): number {
  const length = Math.hypot(b.x - a.x, b.z - a.z);
  const steps = Math.max(1, Math.ceil(length / SAMPLE));
  let floor = a.floor;
  let doors = 0;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = a.x + (b.x - a.x) * t;
    const z = a.z + (b.z - a.z) * t;
    floor = floorState(x, z, floor).floor;
    // Keys can leave the body touching a collider. Let the first connector
    // regain the steering margin gradually, using the real radius initially.
    const radius = leaveBoundary ? PLAYER_R - 0.00001 + (RADIUS - PLAYER_R + 0.00001) * Math.min(1, length * t / CELL) : RADIUS;
    const mask = pointDoors(x, z, floor, radius);
    if (mask < 0) return -1;
    doors |= mask;
  }
  return floor === b.floor ? doors : -1;
}

function getGrid(): Grid {
  if (grid) return grid;
  const nodes: Node[] = [];
  const cells = new Int32Array(NX * NZ * 2).fill(-1);
  for (const floor of [0, 1] as const) {
    for (let iz = 0; iz < NZ; iz++) {
      for (let ix = 0; ix < NX; ix++) {
        const x = MIN_X + ix * CELL;
        const z = -11 + iz * CELL;
        const doors = pointDoors(x, z, floor);
        if (doors < 0) continue;
        cells[cellIndex(ix, iz, floor)] = nodes.length;
        nodes.push({ x, z, floor, doors, edges: [] });
      }
    }
  }
  for (const node of nodes) {
    const ix = Math.round((node.x - MIN_X) / CELL);
    const iz = Math.round((node.z + 11) / CELL);
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        if ((!dx && !dz) || ix + dx < 0 || ix + dx >= NX || iz + dz < 0 || iz + dz >= NZ) continue;
        const x = node.x + dx * CELL;
        const z = node.z + dz * CELL;
        const floor = floorState(x, z, node.floor).floor;
        const to = cells[cellIndex(ix + dx, iz + dz, floor)];
        if (to < 0) continue;
        const doors = segmentDoors(node, nodes[to]);
        if (doors >= 0) node.edges.push({ to, doors, cost: Math.hypot(dx, dz) * CELL });
      }
    }
  }
  grid = { nodes, cells, mask: -1, components: new Int32Array(nodes.length) };
  return grid;
}

/** Build the grid ahead of time (it is static), so the first tap does not stall. */
export function warmNav(): void {
  getGrid();
}

/** Only passability changes when progression opens a door; geometry stays cached. */
function updateDoors(data: Grid, mask: number): void {
  if (data.mask === mask) return;
  data.mask = mask;
  const components = data.components.fill(-1);
  const queue = new Int32Array(data.nodes.length);
  let component = 0;
  for (let start = 0; start < data.nodes.length; start++) {
    if (components[start] >= 0 || data.nodes[start].doors & ~mask) continue;
    let head = 0;
    let tail = 1;
    queue[0] = start;
    components[start] = component;
    while (head < tail) {
      const current = queue[head++];
      for (const edge of data.nodes[current].edges) {
        if (components[edge.to] >= 0 || edge.doors & ~mask) continue;
        components[edge.to] = component;
        queue[tail++] = edge.to;
      }
    }
    component++;
  }
}

/** Exposed for pure tests and destination checks; no raycasting or runtime state. */
export function canWalkSegment(a: NavPoint, b: NavPoint, isDoorOpen: (id: string) => boolean): boolean {
  const doors = segmentDoors(a, b);
  if (doors < 0) return false;
  for (const [id, bit] of doorBits) if ((doors & bit) && !isDoorOpen(id)) return false;
  return true;
}

function sameRoom(point: NavPoint, room: RoomId | null): boolean {
  return roomAt(point.x, point.z, point.floor) === room;
}

/** A* runs only for a new destination or a stuck follower. The returned list
 * excludes the start and is string-pulled using the actual collision geometry.
 * Invalid targets snap inside their room, never through a locked room's wall.
 */
export function findPath(
  start: NavPoint,
  destination: NavPoint,
  isDoorOpen: (id: string) => boolean,
  objectId?: string | null
): NavPoint[] | null {
  const data = getGrid();
  let mask = 0;
  for (const [id, bit] of doorBits) if (isDoorOpen(id)) mask |= bit;
  updateDoors(data, mask);
  const { nodes, components } = data;
  let first = -1;
  let nearest = Infinity;
  // Connecting the exact current position matters when a keyboard movement
  // ended between cells, close to an object or in the middle of a doorway.
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.floor !== start.floor || components[i] < 0) continue;
    const distance = Math.hypot(node.x - start.x, node.z - start.z);
    if (distance >= nearest || distance > 0.8) continue;
    const doors = segmentDoors(start, node, true);
    if (doors < 0 || (doors & ~mask)) continue;
    first = i;
    nearest = distance;
  }
  if (first < 0) return null;
  const object = objectId ? WORLD.objectById.get(objectId) : undefined;
  if (objectId && !object?.interactive) return null;
  const targetRoom = object?.room ?? roomAt(destination.x, destination.z, destination.floor);
  const targetFloor = object?.floor ?? destination.floor;
  const wallTarget = !targetRoom && destination.x >= -8 && destination.x <= 8 && destination.z >= -11 && destination.z <= 11;
  const centre = object ? rectCenter(object.rect) : destination;
  const ideal = object
    ? localToWorld(object, object.rot, { x: 0, y: 0, z: object.spec.d / 2 + 0.65 })
    : destination;
  let goal = -1;
  let best = Infinity;
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (components[i] !== components[first] || node.floor !== targetFloor) continue;
    if (!wallTarget && !sameRoom(node, targetRoom)) continue;
    if (object) {
      if (rectDistance(object.rect, node.x, node.z) > INTERACT_RANGE - 0.3) continue;
      const facing = Math.atan2(centre.x - node.x, centre.z - node.z);
      if (nearestSearchable(node.x, node.z, facing, node.floor) !== object.id) continue;
    }
    const distance = Math.hypot(node.x - ideal.x, node.z - ideal.z);
    // A point exactly on a room boundary has no roomAt result. Snap locally
    // to its reachable side; never reinterpret it as an outdoor destination.
    if (wallTarget && distance > 1) continue;
    if (distance < best) { best = distance; goal = i; }
  }
  if (goal < 0) return null;

  // Binary heap with lazy duplicate entries; all allocations occur on the tap.
  const score = new Float64Array(nodes.length).fill(Infinity);
  const previous = new Int32Array(nodes.length).fill(-1);
  const closed = new Uint8Array(nodes.length);
  const heap: { id: number; f: number }[] = [];
  const push = (id: number, f: number) => {
    let i = heap.length;
    heap.push({ id, f });
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (heap[parent].f <= f) break;
      heap[i] = heap[parent]; i = parent;
    }
    heap[i] = { id, f };
  };
  const pop = (): number => {
    const first = heap[0].id;
    const last = heap.pop()!;
    if (heap.length) {
      let i = 0;
      while (i * 2 + 1 < heap.length) {
        let child = i * 2 + 1;
        if (child + 1 < heap.length && heap[child + 1].f < heap[child].f) child++;
        if (heap[child].f >= last.f) break;
        heap[i] = heap[child]; i = child;
      }
      heap[i] = last;
    }
    return first;
  };
  const heuristic = (id: number) => Math.hypot(nodes[id].x - nodes[goal].x, nodes[id].z - nodes[goal].z);
  score[first] = 0;
  push(first, heuristic(first));
  while (heap.length) {
    const current = pop();
    if (closed[current]) continue;
    if (current === goal) break;
    closed[current] = 1;
    for (const edge of nodes[current].edges) {
      if ((edge.doors & ~mask) || closed[edge.to]) continue;
      const next = score[current] + edge.cost;
      if (next >= score[edge.to]) continue;
      score[edge.to] = next;
      previous[edge.to] = current;
      push(edge.to, next + heuristic(edge.to));
    }
  }
  if (!Number.isFinite(score[goal])) return null;
  const route: NavPoint[] = [];
  for (let i = goal; i >= 0; i = previous[i]) {
    const { x, z, floor } = nodes[i];
    route.push({ x, z, floor });
  }
  route.reverse();
  // Preserve precise floor taps where there is clearance. Obstructed taps keep
  // their nearest reachable grid point instead.
  if (!object && sameRoom(destination, targetRoom)) {
    const doors = segmentDoors(route[route.length - 1], destination);
    if (doors >= 0 && !(doors & ~mask)) route.push({ ...destination });
  }
  const path: NavPoint[] = [];
  let anchor = start;
  let from = 0;
  while (from < route.length) {
    let next = from;
    for (let i = route.length - 1; i > from; i--) {
      const doors = segmentDoors(anchor, route[i], anchor === start);
      if (doors >= 0 && !(doors & ~mask)) { next = i; break; }
    }
    path.push(route[next]);
    anchor = route[next];
    from = next + 1;
  }
  return path;
}
