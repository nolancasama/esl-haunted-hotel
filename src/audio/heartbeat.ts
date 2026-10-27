const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Proximity (0 silent .. 1 right beside you) from the detective's horizontal distance in metres. */
export function heartbeatLevel(distance: number): number {
  return clamp((6.5 - distance) / 5.7, 0, 1);
}

/** Relaxed ~65 BPM up to ~130 BPM when the detective is right there. */
export function heartbeatBpm(level: number): number {
  return 65 + 65 * clamp(level, 0, 1);
}

/** Loudness 0..1: barely there at the edge of the room, strong when very close. */
export function heartbeatGain(level: number): number {
  return level <= 0 ? 0 : Math.min(1, 0.08 + 0.92 * Math.pow(clamp(level, 0, 1), 1.1));
}
