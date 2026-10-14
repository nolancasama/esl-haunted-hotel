import { useRef, useState } from "react";
import { useGame } from "../game/store";
import { director } from "../game/director";
import { rt } from "../game/runtime";
import { WORLD } from "../game/world/world";

const RADIUS = 52;

/** Left thumb stick. Writes straight into the runtime input (no React state per frame). */
function Joystick() {
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const pointer = useRef<number | null>(null);
  const origin = useRef({ x: 0, y: 0 });

  const update = (e: React.PointerEvent) => {
    let dx = e.clientX - origin.current.x;
    let dy = e.clientY - origin.current.y;
    const l = Math.hypot(dx, dy);
    if (l > RADIUS) {
      dx = (dx / l) * RADIUS;
      dy = (dy / l) * RADIUS;
    }
    setKnob({ x: dx, y: dy });
    const dead = 0.15;
    const nx = dx / RADIUS;
    const ny = -dy / RADIUS;
    rt.joy.x = Math.abs(nx) < dead ? 0 : nx;
    rt.joy.y = Math.abs(ny) < dead ? 0 : ny;
    rt.joy.active = true;
  };
  const end = () => {
    pointer.current = null;
    setKnob({ x: 0, y: 0 });
    rt.joy.x = 0;
    rt.joy.y = 0;
    rt.joy.active = false;
  };

  return (
    <div
      className="joystick ui"
      data-testid="joystick"
      onPointerDown={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        origin.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        pointer.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        update(e);
      }}
      onPointerMove={(e) => {
        if (pointer.current === e.pointerId) update(e);
      }}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <div className="joystick-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </div>
  );
}

export function TouchControls() {
  const touch = useGame((s) => s.touch);
  const screen = useGame((s) => s.screen);
  const phase = useGame((s) => s.phase);
  const focus = useGame((s) => s.focusId);
  if (!touch || screen !== "game") return null;
  return (
    <>
      {phase === "explore" && <Joystick />}
      {phase === "explore" && focus && (
        <button className="touch-action ui" onClick={() => director.interact()} aria-label="Search" data-testid="touch-search">
          <span aria-hidden="true">{WORLD.objectById.get(focus)?.action === "fan" ? "🌀" : "🔍"}</span>
        </button>
      )}
    </>
  );
}
