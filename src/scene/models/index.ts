import * as THREE from "three";
import type { WorldObject } from "../../game/world/world";
import { PartBuilder } from "../partBuilder";
import type { BuilderSet, BuiltObject } from "./common";
import { bedroomModels } from "./bedroom";
import { diningModels } from "./dining";
import { storageModels } from "./storage";
import { libraryModels } from "./library";
import { lobbyModels } from "./lobby";
import { upstairsModels } from "./upstairs";
import { guestModels } from "./guest";

export type { AnimatedPart, BuiltObject, TexKey } from "./common";

const BUILDERS: BuilderSet = { ...bedroomModels, ...diningModels, ...storageModels, ...libraryModels, ...lobbyModels, ...upstairsModels, ...guestModels };

export function buildObject(obj: WorldObject): BuiltObject {
  const b = new PartBuilder();
  const g = new PartBuilder();
  const out: BuiltObject = { solid: new THREE.BufferGeometry(), glow: null, parts: [], textured: [], lamps: [] };
  const build = BUILDERS[obj.kind];
  if (build) build(obj, b, g, out);
  else {
    const s = obj.spec;
    b.box(s.w, s.h, s.d, 0, 0, 0, "#6b5a7a");
  }
  out.solid = b.build();
  out.glow = g.empty ? null : g.build();
  return out;
}
