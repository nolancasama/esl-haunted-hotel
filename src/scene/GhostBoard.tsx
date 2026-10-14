import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { lineFade } from "./wallFade";
import { useGame, visibleGhosts } from "../game/store";
import { GHOSTS, CHAPTER_GHOSTS } from "../game/ghosts";
import { WORLD } from "../game/world/world";
import { rt } from "../game/runtime";
import type { GhostId } from "../game/types";

/**
 * The lobby's ghost counter: ghost-shaped slots that light up in each
 * ghost's colour as it is caught, with "n / 4" (or "n / 8" once Chapter 2
 * opens) underneath.
 */
function drawBoard(ctx: CanvasRenderingContext2D, ghosts: GhostId[], caught: string[]) {
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
  const two = ghosts.length > 4;
  const s = two ? 0.62 : 1;
  ghosts.forEach((id, i) => {
    const row = two ? Math.floor(i / 4) : 0;
    const col = i % 4;
    const x = 84 + col * 115;
    const y = two ? 112 + row * 70 : 150;
    const got = caught.includes(id);
    if (got) {
      const glow = ctx.createRadialGradient(x, y, 4, x, y, 60 * s);
      glow.addColorStop(0, GHOSTS[id].glow);
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(x - 60 * s, y - 60 * s, 120 * s, 120 * s);
    }
    ctx.fillStyle = got ? GHOSTS[id].color : "#3a2f48";
    ctx.beginPath();
    ctx.arc(x, y - 8 * s, 30 * s, Math.PI, 0);
    ctx.lineTo(x + 30 * s, y + 34 * s);
    for (let k = 0; k < 6; k++) ctx.lineTo(x + 30 * s - (k + 0.5) * 10 * s, y + (k % 2 ? 34 : 26) * s);
    ctx.lineTo(x - 30 * s, y + 34 * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = got ? (GHOSTS[id].glowEyes ? "#fff27a" : "#231a33") : "#6d5f85";
    if (got) {
      ctx.beginPath();
      ctx.ellipse(x - 10 * s, y - 8 * s, 4.5 * s, 6.5 * s, 0, 0, Math.PI * 2);
      ctx.ellipse(x + 10 * s, y - 8 * s, 4.5 * s, 6.5 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.font = `bold ${Math.round(34 * s)}px system-ui, sans-serif`;
      ctx.fillText("?", x, y + 2 * s);
    }
  });
  ctx.fillStyle = "#f4f1ff";
  ctx.font = "bold 36px system-ui, sans-serif";
  ctx.fillText(`${caught.filter((c) => ghosts.includes(c as GhostId)).length} / ${ghosts.length}`, W / 2, 238);
}

export function GhostBoard() {
  const lantern = useGame((s) => s.lantern);
  const hunt = useGame((s) => s.hunt);
  const scope = useGame((s) => s.scope);
  const chapter = useGame((s) => s.chapter);
  const mode = useGame((s) => s.mode);
  const ghosts = useMemo(() => {
    const v = visibleGhosts({ hunt, scope, chapter, mode });
    // Chapter 2 on its own: the board still counts the whole hotel, with the ground floor done.
    return v.length ? (scope === "ch2" ? [...CHAPTER_GHOSTS[1], ...v] : v) : CHAPTER_GHOSTS[1];
  }, [hunt, scope, chapter, mode]);
  const caught = useMemo(() => (scope === "ch2" ? [...CHAPTER_GHOSTS[1], ...lantern] : lantern), [scope, lantern]);
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
    drawBoard(ctx, ghosts, caught);
    tex.needsUpdate = true;
  }, [ghosts, caught, ctx, tex, canvas]);
  const board = WORLD.objectById.get("lobby.board");
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (ref.current && board)
      ref.current.visible = rt.view.floor === 0 && Math.min(...board.wallLines.map((id) => lineFade.get(id) ?? 1)) > 0.4;
  });
  if (!board) return null;
  return (
    <mesh ref={ref} position={[board.x, 1.9, board.z + 0.045]} material={mat}>
      <planeGeometry args={[2.2, 1.2]} />
    </mesh>
  );
}
