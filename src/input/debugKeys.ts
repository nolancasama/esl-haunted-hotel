import { director } from "../game/director";
import { getGame } from "../game/store";

/**
 * Debug shortcuts (dev server or ?debug=1 only, so a class can never trigger them):
 * `]` next ghost, `[` previous ghost, `}` (Shift+]) the ending.
 * Matched by `key`, not `code`, so the brackets work on US and JIS keyboards.
 */
export function installDebugKeys() {
  window.addEventListener("keydown", (e) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
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
    console.info(`[debug] ${e.key} -> encounter ${getGame().hunt?.index}`);
  });
}
