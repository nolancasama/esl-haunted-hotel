import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { lineFade } from "./wallFade";
import { useGame } from "../game/store";
import { GHOSTS, GHOST_ORDER } from "../game/ghosts";
import { WORLD } from "../game/world/world";

/**
 * The lobby's ghost counter: four ghost-shaped slots that light up in each
 * ghost's colour as it is caught, with "n / 4" underneath.
 */
function drawBoard(ctx: CanvasRenderingContext2D, caught: string[]) {
  const W = 512;
  const H = 280;
  ctx.clearRect(0, 0, W, H);
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#2c1a33");
  bg.addColorStop(1, "#1a0f22");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#c9a24a";
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, W - 20, H - 20);
  ctx.fillStyle = "#ffd36b";
  ctx.font = "bold 40px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("GHOSTS", W / 2, 46);
  GHOST_ORDER.forEach((id, i) => {
    const x = 84 + i * 115;
    const y = 150;
    const got = caught.includes(id);
    if (got) {
      const glow = ctx.createRadialGradient(x, y, 4, x, y, 60);
      glow.addColorStop(0, GHOSTS[id].glow);
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(x - 60, y - 60, 120, 120);
    }
    ctx.fillStyle = got ? GHOSTS[id].color : "#3a2f48";
    ctx.beginPath();
    ctx.arc(x, y - 8, 30, Math.PI, 0);
    ctx.lineTo(x + 30, y + 34);
    for (let k = 0; k < 6; k++) ctx.lineTo(x + 30 - (k + 0.5) * 10, y + (k % 2 ? 34 : 26));
    ctx.lineTo(x - 30, y + 34);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = got ? "#231a33" : "#6d5f85";
    if (got) {
      ctx.beginPath();
      ctx.ellipse(x - 10, y - 8, 4.5, 6.5, 0, 0, Math.PI * 2);
      ctx.ellipse(x + 10, y - 8, 4.5, 6.5, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.font = "bold 34px system-ui, sans-serif";
      ctx.fillText("?", x, y + 2);
    }
  });
  ctx.fillStyle = "#f4f1ff";
  ctx.font = "bold 36px system-ui, sans-serif";
  ctx.fillText(`${caught.length} / 4`, W / 2, 238);
}

export function GhostBoard() {
  const lantern = useGame((s) => s.lantern);
  const { canvas, ctx, tex, mat } = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 280;
    const ctx = canvas.getContext("2d")!;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
    return { canvas, ctx, tex, mat };
  }, []);
  useEffect(() => {
    drawBoard(ctx, lantern);
    tex.needsUpdate = true;
  }, [lantern, ctx, tex, canvas]);
  const board = WORLD.objectById.get("lobby.board");
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (ref.current && board) ref.current.visible = Math.min(...board.wallLines.map((id) => lineFade.get(id) ?? 1)) > 0.4;
  });
  if (!board) return null;
  return (
    <mesh ref={ref} position={[board.x, 1.9, board.z + 0.045]} material={mat}>
      <planeGeometry args={[2.2, 1.2]} />
    </mesh>
  );
}
