import type { GhostId } from "../game/types";
import { GHOSTS } from "../game/ghosts";

type Face = "happy" | "surprised" | "giggle" | "sleepy" | "smile";

const BODY = "M14 86 V44 a36 36 0 0 1 72 0 V86 l-9 -7 -9 7 -9 -7 -9 7 -9 -7 -9 7 -9 -7 z";

/** Flat SVG ghost used in the HUD and on the results screen. */
export function GhostPortrait({
  ghost,
  size = 64,
  face = "happy",
  dim = false,
  boo = false
}: {
  ghost?: GhostId;
  size?: number;
  face?: Face;
  dim?: boolean;
  boo?: boolean;
}) {
  const def = ghost ? GHOSTS[ghost] : null;
  const color = boo ? "#f4f1ff" : def?.color ?? "#cccccc";
  // Shadow's eyes glow; everyone else has ink eyes.
  const glowEyes = Boolean(def?.glowEyes) && !dim;
  const ink = glowEyes ? "#fff27a" : "#231a33";
  const mouthInk = "#231a33";
  const mask = def?.accessory === "mask";
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" style={{ opacity: dim ? 0.35 : 1, overflow: "visible" }}>
      <defs>
        <radialGradient id={`g-${ghost ?? "boo"}`} cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path d={BODY} fill={dim ? "#6d6385" : color} stroke={dim ? "#8a80a6" : "rgba(255,255,255,0.7)"} strokeWidth="2" />
      {!dim && <path d={BODY} fill={`url(#g-${ghost ?? "boo"})`} />}
      {mask && !dim && <rect x="22" y="36" width="56" height="18" rx="9" fill="#1d3428" />}
      {/* eyes */}
      {face === "giggle" || face === "smile" ? (
        <>
          <path d="M32 47 q6 -7 12 0" stroke={mask ? "#f2fff6" : ink} strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M56 47 q6 -7 12 0" stroke={mask ? "#f2fff6" : ink} strokeWidth="4" fill="none" strokeLinecap="round" />
        </>
      ) : face === "sleepy" ? (
        <>
          <path d="M32 45 q6 6 12 0" stroke={ink} strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M56 45 q6 6 12 0" stroke={ink} strokeWidth="4" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <ellipse cx="38" cy="45" rx={face === "surprised" ? 6 : 4.5} ry={face === "surprised" ? 7.5 : 6.5} fill={mask ? "#f2fff6" : ink} />
          <ellipse cx="62" cy="45" rx={face === "surprised" ? 6 : 4.5} ry={face === "surprised" ? 7.5 : 6.5} fill={mask ? "#f2fff6" : ink} />
        </>
      )}
      <ellipse cx="28" cy="57" rx="5" ry="3" fill="#ff7896" opacity="0.45" />
      <ellipse cx="72" cy="57" rx="5" ry="3" fill="#ff7896" opacity="0.45" />
      {face === "surprised" ? (
        <ellipse cx="50" cy="61" rx="5" ry="6" fill={mouthInk} />
      ) : face === "giggle" ? (
        <path d="M42 57 q8 12 16 0 z" fill={mouthInk} />
      ) : (
        <path d="M43 58 q7 6 14 0" stroke={mouthInk} strokeWidth="3.5" fill="none" strokeLinecap="round" />
      )}
      {!dim && def?.accessory === "propeller" && (
        <>
          <path d="M22 30 A28 26 0 0 1 78 30 Z" fill="#e8483f" />
          <path d="M36 30 A14 26 0 0 1 50 4 V30 Z" fill="#f2c94c" />
          <path d="M50 4 A14 26 0 0 1 64 30 H50 Z" fill="#3a6ad0" />
          <path d="M18 31 Q34 24 52 30" stroke="#e8483f" strokeWidth="5" fill="none" strokeLinecap="round" />
          <rect x="48" y="-6" width="4" height="10" fill="#f2c94c" />
          <ellipse cx="38" cy="-7" rx="13" ry="3.5" fill="#e8483f" />
          <ellipse cx="62" cy="-7" rx="13" ry="3.5" fill="#3a6ad0" />
        </>
      )}
      {!dim && def?.accessory === "showercap" && (
        <>
          <path d="M16 32 Q50 -10 84 32 Z" fill="#ff9fc4" />
          <path d="M14 33 q6 -6 12 0 q6 -6 12 0 q6 -6 12 0 q6 -6 12 0 q6 -6 12 0 q6 -6 12 0" stroke="#ffe0ee" strokeWidth="5" fill="none" strokeLinecap="round" />
          <circle cx="38" cy="18" r="3.5" fill="#fff" />
          <circle cx="58" cy="12" r="3" fill="#fff" />
          <circle cx="66" cy="24" r="3.5" fill="#fff" />
        </>
      )}
      {!dim && def?.accessory === "headphones" && (
        <>
          <path d="M14 46 Q14 4 50 4 Q86 4 86 46" stroke="#7a3a6a" strokeWidth="6" fill="none" />
          <rect x="6" y="38" width="14" height="22" rx="6" fill="#ff6fb5" />
          <rect x="80" y="38" width="14" height="22" rx="6" fill="#ff6fb5" />
          <circle cx="94" cy="22" r="4" fill="#ffd84a" />
          <path d="M97 22 V10" stroke="#ffd84a" strokeWidth="2.5" />
        </>
      )}
      {!dim && def?.accessory === "wings" && (
        <>
          <path d="M14 50 L-6 30 Q-4 44 -10 50 Q0 50 2 58 Q8 54 14 62 Z" fill="#3a2466" />
          <path d="M86 50 L106 30 Q104 44 110 50 Q100 50 98 58 Q92 54 86 62 Z" fill="#3a2466" />
          <path d="M34 14 l-4 -12 l9 9 z M66 14 l4 -12 l-9 9 z" fill="#3a2466" />
        </>
      )}
      {!dim && def?.accessory === "nightcap" && (
        <>
          <path d="M30 18 Q52 -6 82 6 L70 26 Q50 14 30 18z" fill="#3d63c9" />
          <circle cx="83" cy="6" r="6" fill="#f4f1ff" />
          <path d="M28 20 Q50 10 72 26" stroke="#f4f1ff" strokeWidth="5" fill="none" strokeLinecap="round" />
        </>
      )}
      {!dim && def?.accessory === "bib" && (
        <>
          <path d="M34 66 q16 16 32 0 z" fill="#fffaf0" />
          <circle cx="50" cy="69" r="2.5" fill="#ff7a6b" />
          <path d="M88 52 v26 M84 52 v8 M92 52 v8" stroke="#d8dde8" strokeWidth="3" strokeLinecap="round" />
        </>
      )}
      {!dim && def?.accessory === "tophat" && (
        <>
          <rect x="34" y="-6" width="30" height="22" rx="2" fill="#2e1f4f" transform="rotate(-12 50 10)" />
          <rect x="34" y="8" width="30" height="5" fill="#ff6fb5" transform="rotate(-12 50 10)" />
          <rect x="26" y="13" width="46" height="5" rx="2" fill="#2e1f4f" transform="rotate(-12 50 10)" />
        </>
      )}
      {boo && (
        <>
          <path d="M40 74 l-10 -6 v12 z M60 74 l10 -6 v12 z" fill="#ff5c8a" />
          <circle cx="50" cy="74" r="4" fill="#ff86a8" />
        </>
      )}
    </svg>
  );
}
