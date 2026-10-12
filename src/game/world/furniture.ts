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

export const PLACEMENTS: Placement[] = [
  // ---------------------------------------------------------------- bedroom
  { id: "bedroom.bed", kind: "bed", room: "bedroom", x: -6.0, z: -9.75, rot: 0, noun: "bed", spots: [ON, UNDER, by("right")] },
  { id: "bedroom.window", kind: "window", room: "bedroom", x: -3.0, z: -10.9, rot: 0, noun: "window", spots: [by("right"), UNDER] },
  { id: "bedroom.box", kind: "box", room: "bedroom", x: -0.45, z: -7.6, rot: 270, noun: "box", variant: "toy", spots: [IN, ON, by("right")] },
  { id: "bedroom.desk", kind: "desk", room: "bedroom", x: -7.5, z: -6.3, rot: 90, noun: "desk", spots: [ON, UNDER, by("left")] },
  { id: "bedroom.nightstand", kind: "nightstand", room: "bedroom", x: -7.4, z: -10.55, rot: 0 },
  { id: "bedroom.wardrobe", kind: "wardrobe", room: "bedroom", x: -0.42, z: -10.2, rot: 270 },
  { id: "bedroom.chair", kind: "chair", room: "bedroom", x: -7.35, z: -7.45, rot: 90 },
  { id: "bedroom.rug", kind: "rug", room: "bedroom", x: -3.6, z: -7.2, rot: 0 },
  { id: "bedroom.toys", kind: "toys", room: "bedroom", x: -2.3, z: -5.3, rot: 0 }
];
