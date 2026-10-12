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
  const ink = "#231a33";
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
        <ellipse cx="50" cy="61" rx="5" ry="6" fill={ink} />
      ) : face === "giggle" ? (
        <path d="M42 57 q8 12 16 0 z" fill={ink} />
      ) : (
        <path d="M43 58 q7 6 14 0" stroke={ink} strokeWidth="3.5" fill="none" strokeLinecap="round" />
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
