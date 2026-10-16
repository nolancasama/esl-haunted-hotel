/**
 * The startled hop in the opening cutscene: the front door slams, the player
 * flinches (a quick crouch), jumps (arms up, leaning back), turns round in the
 * air to face the door, lands with a squash and settles. Pure functions of
 * elapsed time, so the reaction looks the same at 60 fps and on a slow
 * Chromebook (just with fewer frames).
 *
 * Sized to read clearly from a cutscene camera a few metres away: the player is
 * about 1.3 m tall, so the hop is roughly a quarter of their height.
 */

/** The flinch before take-off. */
export const CROUCH_TIME = 0.1;
const CROUCH_DIP = 0.06;
/** Seconds in the air. */
export const HOP_TIME = 0.5;
/** Peak height of the hop (m). */
export const HOP_HEIGHT = 0.3;
/** Take-off and touch-down times. */
export const TAKE_OFF = CROUCH_TIME;
export const LAND = CROUCH_TIME + HOP_TIME;
/** The landing squash after touching down. */
const LAND_TIME = 0.22;
const LAND_DIP = 0.07;
/** The turn starts just after take-off and is mostly done by the landing. */
export const TURN_START = 0.16;
export const TURN_TIME = 0.75;
/** When the whole reaction is over. */
export const STARTLE_TIME = Math.max(TURN_START + TURN_TIME, LAND + LAND_TIME, 1.05);

export interface StartlePose {
  /** Height added to the feet (negative = crouch / landing squash). */
  lift: number;
  /** Body lean in radians (negative = leaning back, recoiling). */
  lean: number;
  /** How far the arms are thrown up (0..1). */
  arms: number;
  /** Vertical stretch of the body (1 = normal; >1 stretched in the air, <1 squashed). */
  stretch: number;
  /** Turn progress (0..1, eased). */
  turn: number;
  done: boolean;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeInOut = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
const smooth = (u: number) => u * u * (3 - 2 * u);
/** Quick rise to 1 at `peak`, held until `hold`, then an eased fall back to 0 at `end`. */
const pulse = (t: number, peak: number, hold: number, end: number) => {
  if (t <= 0 || t >= end) return 0;
  if (t < peak) return Math.sin((t / peak) * Math.PI * 0.5);
  if (t < hold) return 1;
  return 1 - smooth((t - hold) / (end - hold));
};

export function startlePose(t: number): StartlePose {
  let lift = 0;
  let stretch = 1;
  if (t > 0 && t < TAKE_OFF) {
    // the flinch: a quick dip and squash
    const s = Math.sin((t / TAKE_OFF) * Math.PI);
    lift = -CROUCH_DIP * s;
    stretch = 1 - 0.08 * s;
  } else if (t >= TAKE_OFF && t < LAND) {
    // a ballistic arc: fast up, floaty top, fast down; stretched while rising and falling
    const u = (t - TAKE_OFF) / HOP_TIME;
    lift = 4 * HOP_HEIGHT * u * (1 - u);
    stretch = 1 + 0.07 * Math.abs(1 - 2 * u);
  } else if (t >= LAND && t < LAND + LAND_TIME) {
    const s = Math.sin(((t - LAND) / LAND_TIME) * Math.PI);
    lift = -LAND_DIP * s;
    stretch = 1 - 0.1 * s;
  }
  return {
    lift,
    lean: -0.3 * pulse(t, 0.12, 0.3, 0.8),
    arms: pulse(t, 0.16, 0.55, 1.0),
    stretch,
    turn: easeInOut(clamp01((t - TURN_START) / TURN_TIME)),
    done: t >= STARTLE_TIME
  };
}

const wrap = (a: number) => {
  let d = a % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
};

/**
 * The signed turn from `from` to `to`. The shortest way round, except for a
 * near half-turn, where `prefer` (+1 / -1) picks the side (towards the camera,
 * so the face shows during the turn).
 */
export function turnDelta(from: number, to: number, prefer: 1 | -1): number {
  const d = wrap(to - from);
  if (Math.abs(d) > Math.PI - 0.5 && Math.sign(d) !== prefer) return d - Math.sign(d) * Math.PI * 2;
  return d;
}
