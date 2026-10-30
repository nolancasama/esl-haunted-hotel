import { director } from "../game/director";
import { getGame } from "../game/store";

/**
 * Debug shortcuts. Ctrl+Shift+D turns debug mode on/off on any build (on from the start on
 * the dev server or with ?debug=1). While it is on: `]` next ghost, `[` previous ghost,
 * `}` (Shift+]) the ending. Ctrl+Shift+D is matched by `code` so it works with the IME on;
 * the brackets by `key` so they work on US and JIS keyboards.
 */
export function installDebugKeys(startOn: boolean) {
  let on = false;
  let badge: HTMLDivElement | null = null;
  const setOn = (next: boolean) => {
    on = next;
    if (on && !badge) {
      badge = document.createElement("div");
      badge.textContent = "DEBUG  ]  next ghost   [  previous   }  ending   Ctrl+Shift+D  off";
      Object.assign(badge.style, {
        position: "fixed", left: "8px", bottom: "8px", zIndex: "9999", padding: "4px 8px",
        font: "12px monospace", whiteSpace: "pre", color: "#fff", background: "rgba(160,0,0,0.8)",
        borderRadius: "4px", pointerEvents: "none"
      });
      document.body.appendChild(badge);
    } else if (!on && badge) {
      badge.remove();
      badge = null;
    }
  };
  setOn(startOn);

  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    if (e.ctrlKey && e.shiftKey && !e.altKey && e.code === "KeyD") {
      e.preventDefault();
      setOn(!on);
      return;
    }
    if (!on || e.ctrlKey || e.metaKey || e.altKey) return;
    const hunt = getGame().hunt;
    if (!hunt || hunt.status === "done") return;
    const last = hunt.encounters.length - 1;
    if (e.key === "]") {
      if (hunt.index >= last) director.debugFinish();
      else director.debugJump(hunt.index + 1);
    } else if (e.key === "[") director.debugJump(Math.max(0, hunt.index - 1));
    else if (e.key === "}") director.debugFinish();
    else return;
    e.preventDefault();
  });
}
