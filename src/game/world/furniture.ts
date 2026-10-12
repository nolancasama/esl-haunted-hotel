import type { Prep, RoomId, Rot } from "../types";
import type { KindId } from "./kinds";

export type Side = "left" | "right" | "front";

export interface SpotRule {
  prep: Prep;
  /** Which side a "by" ghost floats on (object-local). */
  side?: Side;
}

export interface Placement {
  id: string;
  kind: KindId;
  room: RoomId;
  x: number;
  z: number;
  rot: Rot;
  /** Clue noun. Only objects with a noun are searchable. Must be unique in the room. */
  noun?: string;
  spots?: SpotRule[];
  /** Builder variant (colour/style). */
  variant?: string;
}

const ON: SpotRule = { prep: "on" };
const UNDER: SpotRule = { prep: "under" };
const IN: SpotRule = { prep: "in" };
const by = (side: Side): SpotRule => ({ prep: "by", side });

/**
 * Every searchable object offers two or three prepositions, so the clue's
 * preposition (not just its noun) decides where to look. Positions are
 * checked by spots.test.ts (geometry, nearest object, reachability).
 */
export const PLACEMENTS: Placement[] = [
  // ---------------------------------------------------------------- bedroom
  { id: "bedroom.bed", kind: "bed", room: "bedroom", x: -6.0, z: -9.75, rot: 0, noun: "bed", spots: [ON, UNDER, by("right")] },
  { id: "bedroom.window", kind: "window", room: "bedroom", x: -3.0, z: -10.9, rot: 0, noun: "window", spots: [by("right"), UNDER] },
  { id: "bedroom.box", kind: "box", room: "bedroom", x: -0.45, z: -7.6, rot: 270, noun: "box", variant: "toy", spots: [IN, ON, by("right")] },
  { id: "bedroom.desk", kind: "desk", room: "bedroom", x: -7.5, z: -6.3, rot: 90, noun: "desk", spots: [ON, UNDER, by("left")] },
  { id: "bedroom.nightstand", kind: "nightstand", room: "bedroom", x: -7.4, z: -10.55, rot: 0 },
  { id: "bedroom.wardrobe", kind: "wardrobe", room: "bedroom", x: -0.42, z: -10.2, rot: 270 },
  { id: "bedroom.chair", kind: "chair", room: "bedroom", x: -7.35, z: -7.45, rot: 90 },
  { id: "bedroom.rug", kind: "rug", room: "bedroom", x: -3.6, z: -7.2, rot: 0, variant: "bedroom" },
  { id: "bedroom.toys", kind: "toys", room: "bedroom", x: -2.3, z: -5.3, rot: 0 },

  // ----------------------------------------------------------------- dining
  { id: "dining.table", kind: "table", room: "dining", x: 4.0, z: -7.6, rot: 0, noun: "table", spots: [ON, UNDER, by("left")] },
  { id: "dining.piano", kind: "piano", room: "dining", x: 6.4, z: -9.8, rot: 0, noun: "piano", spots: [ON, UNDER, by("left")] },
  { id: "dining.window", kind: "window", room: "dining", x: 2.2, z: -10.9, rot: 0, noun: "window", spots: [by("right"), UNDER] },
  { id: "dining.basket", kind: "basket", room: "dining", x: 0.46, z: -6.0, rot: 90, noun: "basket", spots: [IN, ON, by("right")] },
  { id: "dining.chair1", kind: "chair", room: "dining", x: 3.1, z: -8.65, rot: 0 },
  { id: "dining.chair2", kind: "chair", room: "dining", x: 4.0, z: -8.65, rot: 0 },
  { id: "dining.chair3", kind: "chair", room: "dining", x: 4.9, z: -8.65, rot: 0 },
  { id: "dining.chair4", kind: "chair", room: "dining", x: 3.1, z: -6.55, rot: 180 },
  { id: "dining.chair5", kind: "chair", room: "dining", x: 4.0, z: -6.55, rot: 180 },
  { id: "dining.chair6", kind: "chair", room: "dining", x: 4.9, z: -6.55, rot: 180 },
  { id: "dining.cabinet", kind: "cabinet", room: "dining", x: 0.38, z: -9.6, rot: 90 },
  { id: "dining.side1", kind: "sidetable", room: "dining", x: 7.6, z: -5.2, rot: 270 },
  { id: "dining.side2", kind: "sidetable", room: "dining", x: 7.6, z: -7.2, rot: 270 },
  { id: "dining.rug", kind: "bigrug", room: "dining", x: 4.0, z: -7.6, rot: 0 },

  // ---------------------------------------------------------------- storage
  { id: "storage.red", kind: "crate", room: "storage", x: 1.6, z: 10.2, rot: 180, noun: "red box", variant: "red", spots: [IN, ON, by("right")] },
  { id: "storage.blue", kind: "crate", room: "storage", x: 4.6, z: 10.2, rot: 180, noun: "blue box", variant: "blue", spots: [IN, ON, by("left")] },
  { id: "storage.yellow", kind: "crate", room: "storage", x: 7.2, z: 7.4, rot: 270, noun: "yellow box", variant: "yellow", spots: [IN, ON, by("right")] },
  { id: "storage.shelf", kind: "shelf", room: "storage", x: 0.47, z: 6.4, rot: 90, noun: "shelf", spots: [ON, by("left")] },
  { id: "storage.table", kind: "worktable", room: "storage", x: 3.6, z: 7.6, rot: 0, noun: "table", spots: [ON, UNDER] },
  { id: "storage.barrel1", kind: "barrel", room: "storage", x: 7.35, z: 10.35, rot: 0 },
  { id: "storage.barrel2", kind: "barrel", room: "storage", x: 6.6, z: 10.5, rot: 0 },
  { id: "storage.trunk", kind: "trunk", room: "storage", x: 7.38, z: 5.0, rot: 270 },
  { id: "storage.cupboard", kind: "cupboard", room: "storage", x: 6.2, z: 4.38, rot: 0 },
  { id: "storage.broom", kind: "broom", room: "storage", x: 0.45, z: 4.6, rot: 0 },

  // ---------------------------------------------------------------- library
  { id: "library.desk", kind: "desk", room: "library", x: -3.8, z: 7.4, rot: 0, noun: "desk", variant: "reading", spots: [ON, UNDER, by("left")] },
  { id: "library.chair", kind: "armchair", room: "library", x: -6.5, z: 9.1, rot: 90, noun: "chair", spots: [ON, by("right")] },
  { id: "library.bookshelf", kind: "bookshelf", room: "library", x: -3.4, z: 10.54, rot: 180, noun: "bookshelf", spots: [ON, by("right")] },
  { id: "library.window", kind: "window", room: "library", x: -7.9, z: 6.2, rot: 90, noun: "window", spots: [by("right"), UNDER] },
  { id: "library.clock", kind: "clock", room: "library", x: -0.46, z: 5.6, rot: 270, noun: "clock", spots: [IN, by("right")] },
  { id: "library.box", kind: "box", room: "library", x: -1.3, z: 8.9, rot: 270, noun: "box", variant: "books", spots: [IN, ON, by("right")] },
  { id: "library.lamp", kind: "floorlamp", room: "library", x: -7.45, z: 10.45, rot: 0 },
  { id: "library.globe", kind: "globe", room: "library", x: -1.6, z: 6.9, rot: 0 },
  { id: "library.books", kind: "bookpile", room: "library", x: -6.0, z: 4.75, rot: 0 },
  { id: "library.rug", kind: "rug", room: "library", x: -3.9, z: 7.6, rot: 0, variant: "library" },

  // ------------------------------------------------------------------ lobby
  { id: "lobby.reception", kind: "reception", room: "lobby", x: 0, z: -3.35, rot: 0 },
  { id: "lobby.board", kind: "ghostboard", room: "lobby", x: 0, z: -3.9, rot: 0 },
  { id: "lobby.sofa", kind: "sofa", room: "lobby", x: 0, z: 3.3, rot: 180 },
  { id: "lobby.coffee", kind: "coffeetable", room: "lobby", x: 0, z: 2.15, rot: 0 },
  { id: "lobby.stairs", kind: "stairs", room: "lobby", x: 6.5, z: 0, rot: 270 },
  { id: "lobby.plant1", kind: "plant", room: "lobby", x: -7.35, z: -3.35, rot: 0 },
  { id: "lobby.plant2", kind: "plant", room: "lobby", x: -7.35, z: 3.35, rot: 0 },
  { id: "lobby.plant3", kind: "plant", room: "lobby", x: 7.35, z: -3.35, rot: 0 },
  { id: "lobby.plant4", kind: "plant", room: "lobby", x: 7.35, z: 3.35, rot: 0 },
  { id: "lobby.painting1", kind: "painting", room: "lobby", x: -2.25, z: -3.9, rot: 0, variant: "a" },
  { id: "lobby.painting2", kind: "painting", room: "lobby", x: 2.25, z: -3.9, rot: 0, variant: "b" },
  { id: "lobby.luggage", kind: "luggage", room: "lobby", x: -6.7, z: -2.9, rot: 90 },
  { id: "lobby.umbrellas", kind: "umbrellastand", room: "lobby", x: -7.5, z: 1.75, rot: 0 },
  { id: "lobby.rug", kind: "runner", room: "lobby", x: -3.6, z: 0, rot: 0 },
  { id: "lobby.chandelier", kind: "chandelier", room: "lobby", x: 0, z: 0, rot: 0 },
  { id: "dining.chandelier", kind: "chandelier", room: "dining", x: 4, z: -7.6, rot: 0, variant: "small" }
];
