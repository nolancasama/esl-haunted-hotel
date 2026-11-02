import { useEffect, useLayoutEffect, useRef } from "react";
import { GameScene } from "./scene/GameScene";
import { Hud } from "./ui/Hud";
import { TouchControls } from "./ui/TouchControls";
import { SettingsModal } from "./ui/Settings";
import { ResultsScreen, TitleScreen } from "./ui/Screens";
import { HideSeekEntry } from "./ui/HideSeekEntry";
import { WingNote } from "./ui/WingNote";
import { installKeyboard } from "./input/keyboard";
import { director } from "./game/director";
import { getGame, setGame, useGame } from "./game/store";
import { tapGesture } from "./input/tap";
import { warmNav } from "./game/world/nav";

/** Track drag distance so moving a finger never accidentally selects a 3D object.\n * The story camera itself is automatic; only Hide & Seek has independent view controls. */
function useCanvasTapTracking(ref: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let id: number | null = null;
    const down = (e: PointerEvent) => {
      if (e.pointerType === "touch") setGame({ touch: true });
      const target = e.target as HTMLElement;
      if (target.closest(".ui, button, input, .answer-panel, .modal")) return;
      if (target.tagName !== "CANVAS") return;
      tapGesture.pointers++;
      tapGesture.cancelled = tapGesture.pointers > 1;
      tapGesture.x = e.clientX;
      tapGesture.y = e.clientY;
      tapGesture.started = performance.now();
      tapGesture.travel = 0;
      id = e.pointerId;
    };
    const move = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      tapGesture.travel = Math.max(tapGesture.travel, Math.hypot(e.clientX - tapGesture.x, e.clientY - tapGesture.y));
      if (performance.now() - tapGesture.started > 450 && tapGesture.travel > 3) tapGesture.cancelled = true;
      // A drag only cancels taps; it never changes the story camera angle.
    };
    const up = (e: PointerEvent) => {
      tapGesture.pointers = Math.max(0, tapGesture.pointers - 1);
      if (e.type === "pointercancel") tapGesture.cancelled = true;
      if (e.pointerId === id) id = null;
    };
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [ref]);
}

function Fade() {
  const fade = useGame((s) => s.fade);
  return <div className="fade" style={{ opacity: fade }} />;
}

export function App() {
  const wrap = useRef<HTMLDivElement>(null);
  const screen = useGame((s) => s.screen);
  useLayoutEffect(() => {
    if (screen === "hideseek") director.suspendForHideSeek();
  }, [screen]);
  useEffect(() => installKeyboard((code) => {
    if (getGame().screen !== "hideseek") director.onKey(code);
  }), []);
  // Build the tap-to-move grid while the title screen is up, not on the first tap
  // (~0.3 s on a desktop, over a second on a slow Chromebook).
  useEffect(() => {
    const id = window.setTimeout(warmNav, 1200);
    return () => window.clearTimeout(id);
  }, []);
  useEffect(() => {
    if (window.matchMedia?.("(pointer: coarse)").matches) setGame({ touch: true });
  }, []);
  useCanvasTapTracking(wrap);
  return (
    <div className="app" ref={wrap}>
      <GameScene />
      <div className="vignette" />
      <Hud />
      <WingNote />
      <TouchControls />
      <TitleScreen />
      <HideSeekEntry />
      <ResultsScreen />
      <SettingsModal />
      <Fade />
    </div>
  );
}
