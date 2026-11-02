import type { Floor } from "../game/types";
import { roomAt } from "../game/world/rooms";

/** Story/Practice exploration camera presets. Hide & Seek has its own camera
 * and all story close-ups/cutscenes keep their authored shots.
 *
 * The view follows the player but its angle is NOT player-controlled.
 * Changing rooms changes the shot smoothly instead of requiring drag-to-turn.
 */
export interface AutomaticView {
  zone: string;
  yaw: number;
  pitch: number;
  distance: number;
}

const views: Record<string, Omit<AutomaticView, "zone">> = {
  lobby: { yaw: 0.35, pitch: 0.9, distance: 7.4 },
  landing: { yaw: 0.9, pitch: 0.96, distance: 7.6 },
  wingpassage: { yaw: -Math.PI / 2, pitch: 0.92, distance: 7.0 },
  guesthall: { yaw: -Math.PI / 2, pitch: 1.0, distance: 8.1 },
  bedroom: { yaw: 0, pitch: 0.92, distance: 6.9 },
  dining: { yaw: 0, pitch: 0.92, distance: 6.9 },
  storage: { yaw: Math.PI, pitch: 0.9, distance: 6.9 },
  library: { yaw: Math.PI, pitch: 0.9, distance: 6.9 },
  playroom: { yaw: 0, pitch: 0.94, distance: 6.6 },
  bathroom: { yaw: 0, pitch: 0.94, distance: 6.6 },
  music: { yaw: Math.PI, pitch: 0.94, distance: 6.6 },
  attic: { yaw: Math.PI, pitch: 0.94, distance: 6.6 },
  g201: { yaw: 0, pitch: 1.04, distance: 5.9 },
  g203: { yaw: 0, pitch: 1.04, distance: 5.9 },
  g205: { yaw: 0, pitch: 1.04, distance: 5.9 },
  g202: { yaw: Math.PI, pitch: 1.04, distance: 5.9 },
  g204: { yaw: Math.PI, pitch: 1.04, distance: 5.9 },
  g206: { yaw: Math.PI, pitch: 1.04, distance: 5.9 },
  stairs: { yaw: -Math.PI / 2, pitch: 0.85, distance: 8.0 }
};

export function automaticView(x: number, z: number, floor: Floor, stairs: boolean): AutomaticView {
  const zone = stairs ? "stairs" : (roomAt(x, z, floor) ?? (floor ? "landing" : "lobby"));
  return { zone, ...(views[zone] ?? views.lobby) };
}
