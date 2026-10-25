import { mulberry32 } from "../logic/rng";

/** Store mulberry's cursor, rather than a closure, so JSON resumes exactly. */
export function random(cursor: { rng: number }): number {
  const value = mulberry32(cursor.rng)();
  cursor.rng = (cursor.rng + 0x6d2b79f5) >>> 0;
  return value;
}
