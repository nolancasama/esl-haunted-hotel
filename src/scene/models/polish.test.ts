import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { WORLD, type WorldObject } from "../../game/world/world";
import { PartBuilder } from "../partBuilder";
import { bedroomModels } from "./bedroom";
import { diningModels } from "./dining";
import { libraryModels } from "./library";
import { storageModels } from "./storage";
import { upstairsModels } from "./upstairs";
import { buildObject } from "./index";
import type { BuiltObject } from "./common";

const MM = 0.001;
const EPS = 1e-6;
interface Part { geometry: THREE.BufferGeometry; bounds: THREE.Box3; color: THREE.ColorRepresentation }

/** Capture actual primitive geometry before the production builder merges it. */
class InspectBuilder extends PartBuilder {
  readonly inspected: Part[] = [];

  override add(...args: Parameters<PartBuilder["add"]>): this {
    const [geometry, color, pos, rot = [0, 0, 0], scale = [1, 1, 1]] = args;
    const copy = geometry.clone().applyMatrix4(new THREE.Matrix4().compose(
      new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(...scale)
    ));
    copy.computeBoundingBox();
    this.inspected.push({ geometry: copy, bounds: copy.boundingBox!.clone(), color });
    return super.add(...args);
  }
}

function inspect(obj: WorldObject): Part[] {
  const b = new InspectBuilder();
  const glow = new PartBuilder();
  const out: BuiltObject = { solid: new THREE.BufferGeometry(), glow: null, parts: [], textured: [], lamps: [] };
  const builders = { ...bedroomModels, ...diningModels, ...storageModels, ...libraryModels, ...upstairsModels };
  builders[obj.kind]!(obj, b, glow, out);
  b.build().dispose();
  if (!glow.empty) glow.build().dispose();
  out.solid.dispose();
  out.parts.forEach((part) => { part.geometry?.dispose(); part.textured?.geometry.dispose(); });
  out.textured.forEach((part) => part.geometry.dispose());
  return b.inspected;
}

function overlap(a: THREE.Box3, b: THREE.Box3): boolean {
  return Math.min(a.max.x, b.max.x) - Math.max(a.min.x, b.min.x) > EPS &&
    Math.min(a.max.z, b.max.z) - Math.max(a.min.z, b.min.z) > EPS;
}

/** Upward horizontal faces only: concealed, mating undersides are intentional joints. */
function tops(part: Part): THREE.Box3[] {
  const geometry = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry;
  const positions = geometry.getAttribute("position");
  const faces = new Map<number, THREE.Box3>();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < positions.count; i += 3) {
    a.fromBufferAttribute(positions, i); b.fromBufferAttribute(positions, i + 1); c.fromBufferAttribute(positions, i + 2);
    if (Math.abs(a.y - b.y) > EPS || Math.abs(a.y - c.y) > EPS) continue;
    if (new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).y <= EPS) continue;
    const y = Math.round(a.y / EPS) * EPS;
    const bounds = faces.get(y) ?? new THREE.Box3();
    bounds.expandByPoint(a).expandByPoint(b).expandByPoint(c);
    faces.set(y, bounds);
  }
  if (geometry !== part.geometry) geometry.dispose();
  return [...faces.values()];
}

describe("polished furniture has separated visible surfaces", () => {
  for (const obj of WORLD.objects.filter((obj) => obj.kind === "clock")) {
    it(`${obj.id}: hood and crown have no overlapping horizontal tops within 1 mm`, () => {
      const parts = inspect(obj);
      const faces = parts.flatMap((part, index) => tops(part).filter((face) => face.min.y > 1.9).map((bounds) => ({ index, bounds })));
      expect(faces.length).toBeGreaterThan(1);
      for (const a of faces) for (const b of faces) {
        if (a.index >= b.index || !overlap(a.bounds, b.bounds)) continue;
        expect(Math.abs(a.bounds.min.y - b.bounds.min.y), `${obj.id}: overlapping crown tops`).toBeGreaterThan(MM);
      }
      parts.forEach((part) => part.geometry.dispose());
    });
  }

  it("bookshelf books clear shelf boards and neighbouring books", () => {
    const obj = WORLD.objects.find((obj) => obj.kind === "bookshelf")!;
    const parts = inspect(obj);
    const books = parts.filter(({ bounds }) => bounds.max.x - bounds.min.x < 0.1 &&
      bounds.max.y - bounds.min.y > 0.12 && bounds.max.y - bounds.min.y < 0.4);
    const boards = parts.filter(({ bounds }) => bounds.max.x - bounds.min.x > 1 && bounds.max.y - bounds.min.y < 0.06);
    expect(books.length).toBeGreaterThan(50); // preserve a full shelf
    expect(new Set(books.map(({ bounds }) => Math.round(bounds.max.z / MM))).size).toBeGreaterThan(3);
    expect(boards.length).toBeGreaterThanOrEqual(5);
    for (const book of books) {
      const board = boards.filter(({ bounds }) => overlap(book.bounds, bounds) && bounds.max.y <= book.bounds.min.y + 0.04)
        .sort((a, b) => b.bounds.max.y - a.bounds.max.y)[0];
      expect(board).toBeDefined();
      expect(book.bounds.min.y - board.bounds.max.y, "book bottom must clear its board").toBeGreaterThan(MM);
      for (const other of books) {
        if (book === other || !overlap(book.bounds, other.bounds)) continue;
        const verticalOverlap = Math.min(book.bounds.max.y, other.bounds.max.y) - Math.max(book.bounds.min.y, other.bounds.min.y);
        expect(verticalOverlap, "neighbouring books must not intersect").toBeLessThanOrEqual(EPS);
      }
    }
    parts.forEach((part) => part.geometry.dispose());
  });

  for (const obj of WORLD.objects.filter((obj) => obj.kind === "bed" || obj.kind === "kidtable" || obj.kind === "bathtub" || obj.kind === "sink" || obj.kind === "piano" ||
    (obj.kind === "desk" && obj.variant === "attic") || (obj.kind === "worktable" && obj.variant === "music"))) {
    it(`${obj.id}: under-furniture patch clears every rug surface`, () => {
      const rugTops = WORLD.objects.flatMap((rug) => {
        if (!rug.spec.flat) return [];
        const built = buildObject(rug);
        const heights = built.textured.filter((part) => /rug|mat|runner/i.test(part.key)).map((part) => part.position[1]);
        built.solid.dispose(); built.glow?.dispose();
        built.textured.forEach((part) => part.geometry.dispose());
        return heights;
      });
      expect(rugTops.length).toBeGreaterThan(0);
      const parts = inspect(obj);
      const patches = parts.filter(({ bounds }) => bounds.max.y < 0.03 && bounds.max.x - bounds.min.x > 0.4 && bounds.max.z - bounds.min.z > 0.3);
      expect(patches.length).toBeGreaterThan(0);
      // Rugs can lie beneath any part of a patch: even its underside must clear
      // the highest rug, so no horizontal face can become coplanar with it.
      for (const patch of patches) expect(patch.bounds.min.y - Math.max(...rugTops)).toBeGreaterThan(MM);
      parts.forEach((part) => part.geometry.dispose());
    });
  }
});
