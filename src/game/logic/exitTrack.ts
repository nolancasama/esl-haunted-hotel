/**
 * The ending's one-way walk out of the front door: a straight track along z = 0
 * from the foyer, through the middle of the open double door (z -1.1..1.1), out
 * onto the porch. While it is active, any movement input (keys, joystick) that is
 * not clearly backwards, or one tap anywhere, walks the player forward along it;
 * nothing else can move them.
 */

/** Where the ending puts the player: in the foyer, just inside the open front door, facing out. */
export const EXIT_START = { x: -6.6, z: 0 };
/** Facing west, out of the door. */
export const EXIT_YAW = -Math.PI / 2;
/** Reaching this x (out on the porch) finishes the game. */
export const EXIT_END_X = -9.0;

/**
 * Movement intent (world space, length <= 1) on the exit track, from the player's
 * input (world space) and whether they tapped. Forward is -x. Input pointing
 * backwards (into the house) does nothing; anything else walks forward at the
 * input's strength. The sideways part steers the player back onto the track.
 */
export function exitIntent(inX: number, inZ: number, tapped: boolean, z: number): { x: number; z: number } {
  const strength = tapped ? 1 : Math.min(1, Math.hypot(inX, inZ));
  // forward = (-1, 0): more than ~107 degrees off forward counts as backwards
  if (strength === 0 || (!tapped && -inX < -0.3 * strength)) return { x: 0, z: 0 };
  const steer = Math.max(-0.5, Math.min(0.5, -z * 2));
  const l = Math.hypot(1, steer);
  return { x: (-1 / l) * strength, z: (steer / l) * strength };
}
