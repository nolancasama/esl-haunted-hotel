import type { MatchState } from "./types";

/**
 * What the detective has noticed, for the stealth eye. Presentation only: derived from the
 * detective's own suspicion and the perception boundary's sight result, never fed back.
 * Proximity is the heartbeat's job and plays no part here.
 */
export type Awareness = "hidden" | "suspicious" | "spotted";

/** Below this the detective has nothing meaningful (a single clue is worth 14-30). */
export const SUSPICIOUS_AT = 12;
/** Sight is sampled each 50 ms tick; a short hold keeps the eye from flickering at the cone's edge. */
export const SPOTTED_HOLD = 0.35;

export interface AwarenessReading {
  state: Awareness;
  /** How far the eye is open, 0 (closed) to 1 (wide). */
  open: number;
  /** Suspicion as 0..1, for the arc. */
  level: number;
}

export function awarenessOf(m: Pick<MatchState, "time" | "seenAt" | "status"> & { detective: { suspicion: number } }): AwarenessReading {
  const level = Math.max(0, Math.min(1, m.detective.suspicion / 100));
  if (m.status !== "playing") return { state: "hidden", open: 0, level };
  if (m.time - m.seenAt <= SPOTTED_HOLD) return { state: "spotted", open: 1, level };
  if (m.detective.suspicion >= SUSPICIOUS_AT) {
    const t = (m.detective.suspicion - SUSPICIOUS_AT) / (100 - SUSPICIOUS_AT);
    return { state: "suspicious", open: 0.45 + 0.4 * t, level };
  }
  return { state: "hidden", open: 0, level };
}
