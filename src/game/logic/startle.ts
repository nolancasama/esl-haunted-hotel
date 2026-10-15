/**
 * The startled hop in the opening cutscene: the front door slams, the player
 * jumps a little (arms out, leaning back), lands softly and turns round to
 * look at the door. Pure functions of elapsed time, so the reaction looks the
 * same at 60 fps and on a slow Chromebook (just with fewer frames).
 */

/** Seconds in the air. */
export const HOP_TIME = 0.34;
/** Peak height of the hop (m). */
export const HOP_HEIGHT = 0.15;
/** The landing squash after touching down. */
const LAND_TIME = 0.16;
const LAND_DIP = 0.03;
/** The turn starts mid-hop and takes a little over half a second. */
export const TURN_START = 0.12;
export const TURN_TIME = 0.55;
/** When the whole reaction is over. */
export const STARTLE_TIME = Math.max(TURN_START + TURN_TIME, HOP_TIME + LAND_TIME);

export interface StartlePose {
  /** Height added to the feet (negative = landing squash). */
  lift: number;
  /** Body lean in radians (negative = leaning back, recoiling). */
  lean: number;
  /** How far the arms are flung out (0..1). */
  arms: number;
  /** Turn progress (0..1, eased). */
  turn: number;
  done: boolean;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeInOut = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
/** Quick rise to 1 at `peak`, then an eased fall back to 0 at `end`. */
const pulse = (t: number, peak: number, end: number) => {
  if (t <= 0 || t >= end) return 0;
  if (t < peak) return Math.sin((t / peak) * Math.PI * 0.5);
  const u = (t - peak) / (end - peak);
  return 1 - u * u * (3 - 2 * u);
};

export function startlePose(t: number): StartlePose {
  let lift = 0;
  if (t > 0 && t < HOP_TIME) {
    // a ballistic arc: fast up, floaty top, fast down
    const u = t / HOP_TIME;
    lift = 4 * HOP_HEIGHT * u * (1 - u);
  } else if (t >= HOP_TIME && t < HOP_TIME + LAND_TIME) {
    lift = -LAND_DIP * Math.sin(((t - HOP_TIME) / LAND_TIME) * Math.PI);
  }
  return {
    lift,
    lean: -0.13 * pulse(t, 0.09, 0.5),
    arms: pulse(t, 0.1, 0.62),
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
