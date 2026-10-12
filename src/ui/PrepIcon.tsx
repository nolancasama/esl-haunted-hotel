import type { Prep } from "../game/types";

const GHOST = (x: number, y: number, s = 1) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <path d="M-9 10 V-1 a9 9 0 0 1 18 0 V10 l-3 -2.5 -3 2.5 -3 -2.5 -3 2.5 -3 -2.5 z" fill="#f4f1ff" />
    <circle cx="-3" cy="-1" r="1.5" fill="#231a33" />
    <circle cx="3" cy="-1" r="1.5" fill="#231a33" />
  </g>
);

/**
 * Picture hint for a preposition (a box and a ghost). Shown after several
 * empty searches - a visual scaffold, not a translation.
 */
export function PrepIcon({ prep, size = 56 }: { prep: Prep; size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-label={prep} role="img">
      <rect x="0" y="0" width="64" height="64" rx="12" fill="rgba(255,255,255,0.08)" />
      {prep === "in" && (
        <>
          {GHOST(32, 30, 1.05)}
          <path d="M14 34 h36 v20 h-36 z" fill="#b5825a" stroke="#5b3826" strokeWidth="2" />
          <path d="M14 34 l-6 -10 h12 z" fill="#d49a6a" stroke="#5b3826" strokeWidth="2" />
        </>
      )}
      {prep === "on" && (
        <>
          <path d="M14 36 h36 v18 h-36 z" fill="#b5825a" stroke="#5b3826" strokeWidth="2" />
          {GHOST(32, 24, 1.05)}
        </>
      )}
      {prep === "under" && (
        <>
          <path d="M8 22 h48 v5 h-48 z M11 27 h4 v28 h-4 z M49 27 h4 v28 h-4 z" fill="#b5825a" stroke="#5b3826" strokeWidth="1.5" />
          {GHOST(32, 44, 1)}
        </>
      )}
      {prep === "by" && (
        <>
          <path d="M8 30 h28 v24 h-28 z" fill="#b5825a" stroke="#5b3826" strokeWidth="2" />
          {GHOST(48, 42, 1.05)}
        </>
      )}
    </svg>
  );
}
