import type { Medal } from "../game/logic/hard";

/** "No ghost here": a little ghost behind a red ring and slash (an original mark, not any logo). */
export function NoGhost({ size = 28 }: { size?: number }) {
  return (
    <span className="no-ghost" role="img" aria-label="no ghost" data-testid="no-ghost">
      <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
        <path d="M9 26V14a7 7 0 0 1 14 0v12l-3-2-4 2-4-2z" fill="#f4efff" />
        <circle cx="13.5" cy="14" r="1.4" fill="#2a1840" />
        <circle cx="18.5" cy="14" r="1.4" fill="#2a1840" />
        <circle cx="16" cy="16" r="13" fill="none" stroke="#e5484d" strokeWidth="3" />
        <path d="M7 7l18 18" stroke="#e5484d" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </span>
  );
}

const MEDAL_COLORS: Record<Medal, [string, string]> = {
  gold: ["#ffd36b", "#c9962a"],
  silver: ["#eef0f6", "#a3a9b8"],
  bronze: ["#e7a56b", "#a8662f"]
};

/** A round medal on a ribbon, in gold, silver or bronze. */
export function MedalIcon({ medal, size = 32 }: { medal: Medal; size?: number }) {
  const [face, rim] = MEDAL_COLORS[medal];
  return (
    <svg className={`medal-svg ${medal}`} viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
      <path d="M9 2h6l3 10h-6zM23 2h-6l-3 10h6z" fill="#7a5cc4" />
      <circle cx="16" cy="20" r="10" fill={face} stroke={rim} strokeWidth="2.5" />
      <path d="M16 14.5l1.7 3.5 3.8.5-2.8 2.6.7 3.8-3.4-1.8-3.4 1.8.7-3.8-2.8-2.6 3.8-.5z" fill={rim} />
    </svg>
  );
}

/** A small four-point sparkle for the newly unlocked card. */
export function Sparkle({ size = 14 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M12 1l2.6 8.4L23 12l-8.4 2.6L12 23l-2.6-8.4L1 12l8.4-2.6z" fill="currentColor" />
    </svg>
  );
}
