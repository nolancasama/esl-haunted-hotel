import { useEffect, useRef } from "react";
import { GameScene } from "./scene/GameScene";
import { Hud } from "./ui/Hud";
import { TouchControls } from "./ui/TouchControls";
import { SettingsModal } from "./ui/Settings";
import { ResultsScreen, TitleScreen } from "./ui/Screens";
import { installKeyboard } from "./input/keyboard";
import { director } from "./game/director";
import { getGame, setGame, useGame } from "./game/store";
import { rt } from "./game/runtime";

/** Drag anywhere on the 3D view to turn the camera (mouse or touch). */
function useCameraDrag(ref: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let id: number | null = null;
    let lx = 0;
    let ly = 0;
    const down = (e: PointerEvent) => {
      if (e.pointerType === "touch") setGame({ touch: true });
      const target = e.target as HTMLElement;
      if (target.closest(".ui, button, input, .answer-panel, .modal")) return;
      id = e.pointerId;
      lx = e.clientX;
      ly = e.clientY;
    };
    const move = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      const dx = e.clientX - lx;
      const dy = e.clientY - ly;
      lx = e.clientX;
      ly = e.clientY;
      const g = getGame();
      if (g.screen !== "game" || g.phase !== "explore" || rt.camera.mode !== "follow") return;
      const s = g.settings.cameraSensitivity;
      rt.camera.yaw -= dx * 0.0055 * s;
      rt.camera.pitch = Math.min(1.15, Math.max(0.62, rt.camera.pitch + dy * 0.0028 * s));
    };
    const up = (e: PointerEvent) => {
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
  useEffect(() => installKeyboard(director.onKey), []);
  useEffect(() => {
    if (window.matchMedia?.("(pointer: coarse)").matches) setGame({ touch: true });
  }, []);
  useCameraDrag(wrap);
  return (
    <div className="app" ref={wrap}>
      <GameScene />
      <div className="vignette" />
      <Hud />
      <TouchControls />
      <TitleScreen />
      <ResultsScreen />
      <SettingsModal />
      <Fade />
    </div>
  );
}
