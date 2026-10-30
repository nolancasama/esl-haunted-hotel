import { rt } from "../game/runtime";

/** Current opacity of each wall line (doors fade with the wall they sit in). */
export const lineFade = new Map<string, number>();

/** The Guest Wing is drawn only when the player (or the camera) is in the east half of the upstairs or in the wing. */
export function nearGuestWing(): boolean {
  return rt.view.floor === 1 && (rt.player.x > 0 || rt.camera.pos.x > 2);
}
