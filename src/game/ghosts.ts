import type { GhostId, RoomId } from "./types";

export interface GhostDef {
  id: GhostId;
  name: string;
  /** Body colour and glow. */
  color: string;
  glow: string;
  room: RoomId;
  accessory: "nightcap" | "bib" | "mask" | "tophat" | "propeller" | "showercap" | "headphones" | "wings";
  /** Giggle pitch multiplier. */
  voice: number;
  /** Idle bobbing speed. */
  bob: number;
  /** Glowing eyes (Shadow). */
  glowEyes?: boolean;
  /** Short description for the results card (Japanese). */
  blurbJa: string;
}

export const GHOSTS: Record<GhostId, GhostDef> = {
  sleepy: {
    id: "sleepy",
    name: "Sleepy",
    color: "#7cc0ff",
    glow: "#9fd2ff",
    room: "bedroom",
    accessory: "nightcap",
    voice: 0.8,
    bob: 0.6,
    blurbJa: "ねむたがりの おばけ"
  },
  hungry: {
    id: "hungry",
    name: "Hungry",
    color: "#ffa552",
    glow: "#ffc285",
    room: "dining",
    accessory: "bib",
    voice: 1.0,
    bob: 1.0,
    blurbJa: "くいしんぼうの おばけ"
  },
  sneaky: {
    id: "sneaky",
    name: "Sneaky",
    color: "#72e39a",
    glow: "#a5f5c0",
    room: "storage",
    accessory: "mask",
    voice: 1.15,
    bob: 1.2,
    blurbJa: "こっそりやの おばけ"
  },
  mischief: {
    id: "mischief",
    name: "Mischief",
    color: "#bb86ff",
    glow: "#d6b4ff",
    room: "library",
    accessory: "tophat",
    voice: 1.3,
    bob: 1.5,
    blurbJa: "いたずらずきの おばけ"
  },
  bouncy: {
    id: "bouncy",
    name: "Bouncy",
    color: "#ffd84a",
    glow: "#ffe98a",
    room: "playroom",
    accessory: "propeller",
    voice: 1.4,
    bob: 1.8,
    blurbJa: "おもちゃが だいすきな おばけ"
  },
  bubbles: {
    id: "bubbles",
    name: "Bubbles",
    color: "#62e2ee",
    glow: "#a8f4fa",
    room: "bathroom",
    accessory: "showercap",
    voice: 1.1,
    bob: 0.9,
    blurbJa: "おふろが すきな おばけ"
  },
  melody: {
    id: "melody",
    name: "Melody",
    color: "#ff8fcf",
    glow: "#ffbfe4",
    room: "music",
    accessory: "headphones",
    voice: 1.2,
    bob: 1.1,
    blurbJa: "おんがくが すきな おばけ"
  },
  shadow: {
    id: "shadow",
    name: "Shadow",
    color: "#6a4bb4",
    glow: "#9b7cff",
    room: "attic",
    accessory: "wings",
    voice: 0.7,
    bob: 1.3,
    glowEyes: true,
    blurbJa: "やねうらの かくれんぼ めいじん"
  }
};

export const GHOST_ORDER: GhostId[] = ["sleepy", "hungry", "sneaky", "mischief", "bouncy", "bubbles", "melody", "shadow"];
export const CHAPTER_GHOSTS: Record<1 | 2, GhostId[]> = {
  1: ["sleepy", "hungry", "sneaky", "mischief"],
  2: ["bouncy", "bubbles", "melody", "shadow"]
};
