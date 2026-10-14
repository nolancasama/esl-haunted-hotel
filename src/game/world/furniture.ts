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
  /** Not a hiding place but something to switch on (the bathroom fan). */
  action?: "fan";
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
  // Rises east (bottom step at x 3.6, top at x 6.4); see STAIRS in rooms.ts.
  { id: "lobby.stairs", kind: "stairs", room: "lobby", x: 5.0, z: 0, rot: 270 },
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
  { id: "dining.chandelier", kind: "chandelier", room: "dining", x: 4, z: -7.6, rot: 0, variant: "small" },

  // =========================================================== upstairs
  // --------------------------------------------------------------- playroom
  { id: "playroom.box", kind: "box", room: "playroom", x: -7.45, z: -7.6, rot: 90, noun: "toy box", variant: "abc", spots: [IN, ON, by("right")] },
  { id: "playroom.table", kind: "kidtable", room: "playroom", x: -3.6, z: -7.4, rot: 0, noun: "table", spots: [ON, UNDER, by("left")] },
  { id: "playroom.horse", kind: "rockinghorse", room: "playroom", x: -1.4, z: -9.6, rot: 0, noun: "horse", spots: [ON, by("left")] },
  { id: "playroom.train", kind: "toytrain", room: "playroom", x: -1.6, z: -6.0, rot: 0, noun: "train", spots: [ON, by("left")] },
  { id: "playroom.window", kind: "window", room: "playroom", x: -4.6, z: -10.9, rot: 0, noun: "window", spots: [by("right"), UNDER] },
  { id: "playroom.chair1", kind: "kidchair", room: "playroom", x: -3.6, z: -8.15, rot: 0, variant: "red" },
  { id: "playroom.chair2", kind: "kidchair", room: "playroom", x: -2.62, z: -7.4, rot: 270, variant: "blue" },
  { id: "playroom.teddy", kind: "teddy", room: "playroom", x: -7.2, z: -5.0, rot: 90 },
  { id: "playroom.shelf", kind: "toyshelf", room: "playroom", x: -6.6, z: -10.69, rot: 0 },
  { id: "playroom.blocks", kind: "blocks", room: "playroom", x: -5.6, z: -6.0, rot: 0 },
  { id: "playroom.rug", kind: "playrug", room: "playroom", x: -4.0, z: -7.5, rot: 0 },

  // --------------------------------------------------------------- bathroom
  { id: "bathroom.tub", kind: "bathtub", room: "bathroom", x: 5.6, z: -10.3, rot: 0, noun: "bathtub", spots: [IN, UNDER, by("right")] },
  { id: "bathroom.sink", kind: "sink", room: "bathroom", x: 0.43, z: -7.8, rot: 90, noun: "sink", spots: [UNDER, by("left")] },
  { id: "bathroom.basket", kind: "basket", room: "bathroom", x: 1.6, z: -4.55, rot: 180, noun: "basket", variant: "laundry", spots: [IN, ON, by("right")] },
  { id: "bathroom.shelf", kind: "shelf", room: "bathroom", x: 7.48, z: -7.0, rot: 270, noun: "shelf", variant: "bath", spots: [ON, by("left")] },
  { id: "bathroom.window", kind: "window", room: "bathroom", x: 2.6, z: -10.9, rot: 0, noun: "window", spots: [by("right"), UNDER] },
  { id: "bathroom.mirror", kind: "mirror", room: "bathroom", x: 0.1, z: -7.8, rot: 90 },
  { id: "bathroom.fan", kind: "ventfan", room: "bathroom", x: 5.6, z: -10.9, rot: 0 },
  // On the side wall, not the door wall: that one is cut away when you walk in.
  { id: "bathroom.switch", kind: "fanswitch", room: "bathroom", x: 0.1, z: -5.6, rot: 90, action: "fan" },
  { id: "bathroom.towels", kind: "towelrack", room: "bathroom", x: 7.45, z: -5.0, rot: 270 },
  { id: "bathroom.stool", kind: "stool", room: "bathroom", x: 2.6, z: -8.6, rot: 0 },
  { id: "bathroom.cabinet", kind: "bathcabinet", room: "bathroom", x: 0.32, z: -10.4, rot: 90 },
  { id: "bathroom.mat", kind: "bathmat", room: "bathroom", x: 5.6, z: -9.35, rot: 0 },

  // ------------------------------------------------------------------ music
  { id: "music.piano", kind: "piano", room: "music", x: -6.0, z: 8.6, rot: 180, noun: "piano", variant: "white", spots: [ON, UNDER, by("left")] },
  { id: "music.drum", kind: "drum", room: "music", x: -1.5, z: 9.8, rot: 0, noun: "drum", spots: [ON, by("left")] },
  { id: "music.table", kind: "worktable", room: "music", x: -3.2, z: 6.8, rot: 0, noun: "table", variant: "music", spots: [ON, UNDER, by("left")] },
  { id: "music.box", kind: "box", room: "music", x: -0.45, z: 6.6, rot: 270, noun: "box", variant: "music", spots: [IN, ON, by("right")] },
  { id: "music.window", kind: "window", room: "music", x: -3.4, z: 10.9, rot: 180, noun: "window", spots: [by("right"), UNDER] },
  { id: "music.gramophone", kind: "gramophone", room: "music", x: -7.35, z: 5.0, rot: 90 },
  { id: "music.stand", kind: "musicstand", room: "music", x: -2.4, z: 8.2, rot: 180 },
  { id: "music.cello", kind: "cello", room: "music", x: -7.45, z: 7.0, rot: 90 },
  { id: "music.guitar", kind: "guitar", room: "music", x: -0.4, z: 9.0, rot: 270 },
  { id: "music.chair", kind: "chair", room: "music", x: -6.85, z: 6.3, rot: 90 },
  { id: "music.cabinet", kind: "cabinet", room: "music", x: -0.35, z: 4.9, rot: 270 },
  { id: "music.rug", kind: "rug", room: "music", x: -3.6, z: 7.9, rot: 0, variant: "music" },

  // ------------------------------------------------------------------ attic
  { id: "attic.sofa", kind: "coveredsofa", room: "attic", x: 2.4, z: 10.35, rot: 180, noun: "sofa", spots: [ON, by("right")] },
  { id: "attic.window", kind: "roundwindow", room: "attic", x: 5.6, z: 10.9, rot: 180, noun: "window", spots: [by("right"), UNDER] },
  { id: "attic.clock", kind: "clock", room: "attic", x: 7.54, z: 9.6, rot: 270, noun: "clock", variant: "old", spots: [IN, by("right")] },
  { id: "attic.table", kind: "desk", room: "attic", x: 4.6, z: 7.4, rot: 0, noun: "table", variant: "attic", spots: [ON, UNDER, by("left")] },
  { id: "attic.box", kind: "box", room: "attic", x: 0.46, z: 6.6, rot: 90, noun: "box", variant: "attic", spots: [IN, ON, by("right")] },
  { id: "attic.rocker", kind: "rockingchair", room: "attic", x: 6.2, z: 6.0, rot: 270 },
  { id: "attic.trunk1", kind: "trunk", room: "attic", x: 7.4, z: 5.0, rot: 270 },
  { id: "attic.trunk2", kind: "trunk", room: "attic", x: 1.4, z: 8.6, rot: 0 },
  { id: "attic.boxes", kind: "boxstack", room: "attic", x: 2.6, z: 4.6, rot: 0 },
  { id: "attic.coveredchair", kind: "coveredchair", room: "attic", x: 7.35, z: 6.9, rot: 270 },
  { id: "attic.paintings", kind: "oldpaintings", room: "attic", x: 0.4, z: 8.6, rot: 90 },
  { id: "attic.raftersW", kind: "rafters", room: "attic", x: 0.1, z: 7.5, rot: 90 },
  { id: "attic.raftersE", kind: "rafters", room: "attic", x: 7.9, z: 7.5, rot: 270 },
  { id: "attic.rug", kind: "rug", room: "attic", x: 4.4, z: 7.6, rot: 0, variant: "attic" },

  // ---------------------------------------------------------------- landing
  { id: "landing.balustrade", kind: "balustrade", room: "landing", x: 5.0, z: 0, rot: 0 },
  { id: "landing.runner", kind: "runner", room: "landing", x: -3.4, z: 0, rot: 0 },
  { id: "landing.window", kind: "window", room: "landing", x: -7.9, z: 0, rot: 90 },
  { id: "landing.bench", kind: "bench", room: "landing", x: -0.6, z: -3.6, rot: 0 },
  { id: "landing.side", kind: "sidetable", room: "landing", x: -0.6, z: 3.55, rot: 180 },
  { id: "landing.plant1", kind: "plant", room: "landing", x: -7.35, z: -3.35, rot: 0 },
  { id: "landing.plant2", kind: "plant", room: "landing", x: -7.35, z: 3.35, rot: 0 },
  { id: "landing.plant3", kind: "plant", room: "landing", x: 7.35, z: -3.35, rot: 0 },
  { id: "landing.plant4", kind: "plant", room: "landing", x: 7.35, z: 3.35, rot: 0 },
  { id: "landing.painting1", kind: "painting", room: "landing", x: -6.2, z: -3.9, rot: 0, variant: "b" },
  { id: "landing.painting2", kind: "painting", room: "landing", x: -1.9, z: 3.9, rot: 180, variant: "a" },
  { id: "landing.chandelier", kind: "chandelier", room: "landing", x: -3.4, z: 0, rot: 0, variant: "small" }
];
