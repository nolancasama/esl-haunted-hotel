import * as THREE from "three";

/**
 * Every texture is drawn on a canvas at runtime: nothing to download on a
 * school network, nothing that can fail to load.
 */

const cache = new Map<string, THREE.Texture>();

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  return [c, ctx];
}

function finish(key: string, c: HTMLCanvasElement, opts: { repeat?: boolean; srgb?: boolean } = {}): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(c);
  if (opts.srgb !== false) tex.colorSpace = THREE.SRGBColorSpace;
  if (opts.repeat) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
  }
  tex.anisotropy = 4;
  cache.set(key, tex);
  return tex;
}

function cached<T extends THREE.Texture>(key: string, make: () => T): T {
  return (cache.get(key) as T) ?? make();
}

/** Deterministic pseudo-random for stable textures. */
function prng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function shade(hex: string, k: number): string {
  const c = new THREE.Color(hex);
  c.multiplyScalar(k);
  return `#${c.getHexString()}`;
}

// ---------------------------------------------------------------- floors

export interface FloorStyle {
  base: string;
  seam: string;
  seed: number;
}

export function floorTexture(style: FloorStyle): THREE.Texture {
  return cached(`floor:${style.base}:${style.seed}`, () => {
    const [c, ctx] = canvas(512, 512);
    const rand = prng(style.seed);
    const plankH = 64;
    for (let row = 0; row < 512 / plankH; row++) {
      let x = -Math.floor(rand() * 200);
      while (x < 512) {
        const len = 180 + rand() * 220;
        const k = 0.85 + rand() * 0.3;
        ctx.fillStyle = shade(style.base, k);
        ctx.fillRect(x, row * plankH, len, plankH);
        // grain
        ctx.strokeStyle = shade(style.base, k * 0.86);
        ctx.lineWidth = 1;
        for (let g = 0; g < 4; g++) {
          const y = row * plankH + 8 + rand() * (plankH - 16);
          ctx.beginPath();
          ctx.moveTo(x + 4, y);
          ctx.bezierCurveTo(x + len * 0.3, y + rand() * 6 - 3, x + len * 0.7, y + rand() * 6 - 3, x + len - 4, y);
          ctx.stroke();
        }
        ctx.fillStyle = style.seam;
        ctx.fillRect(x, row * plankH, 3, plankH);
        x += len;
      }
      ctx.fillStyle = style.seam;
      ctx.fillRect(0, row * plankH, 512, 3);
    }
    return finish(`floor:${style.base}:${style.seed}`, c, { repeat: true });
  });
}

// ----------------------------------------------------------------- walls

export interface WallStyle {
  paper: string;
  pattern: string;
  kind: "stripes" | "damask" | "dots" | "bricks";
  wainscot: string;
  trim: string;
}

/** Canvas bottom = floor. Lower third wood panels, chair rail, patterned wallpaper above. */
export function wallTexture(style: WallStyle): THREE.Texture {
  const key = `wall:${style.paper}:${style.kind}:${style.wainscot}`;
  return cached(key, () => {
    const W = 256;
    const H = 512;
    const [c, ctx] = canvas(W, H);
    const rand = prng(7);
    const railY = Math.round(H * 0.64); // from top
    // wallpaper
    ctx.fillStyle = style.paper;
    ctx.fillRect(0, 0, W, railY);
    if (style.kind === "stripes") {
      ctx.fillStyle = style.pattern;
      for (let x = 0; x < W; x += 64) ctx.fillRect(x + 20, 0, 22, railY);
      ctx.fillStyle = shade(style.pattern, 1.1);
      for (let x = 0; x < W; x += 64) ctx.fillRect(x + 28, 0, 4, railY);
    } else if (style.kind === "damask") {
      ctx.fillStyle = style.pattern;
      for (let y = 30; y < railY; y += 90) {
        for (let x = 0; x <= W; x += 128) {
          const ox = (Math.floor(y / 90) % 2) * 64;
          drawDamask(ctx, x + ox, y, 26);
        }
      }
    } else if (style.kind === "dots") {
      ctx.fillStyle = style.pattern;
      for (let y = 24; y < railY; y += 48) {
        for (let x = 16; x < W; x += 64) {
          const ox = (Math.floor(y / 48) % 2) * 32;
          ctx.beginPath();
          ctx.arc((x + ox) % W, y, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc((x + ox) % W, y - 11, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else {
      // bricks / stone for the storage room
      const bh = 34;
      for (let row = 0; row * bh < railY + bh; row++) {
        const off = (row % 2) * 40;
        for (let x = -off; x < W; x += 80) {
          ctx.fillStyle = shade(style.paper, 0.85 + rand() * 0.3);
          ctx.fillRect(x + 2, row * bh + 2, 76, bh - 4);
        }
      }
      ctx.fillStyle = style.pattern;
      for (let row = 0; row * bh < railY; row++) ctx.fillRect(0, row * bh, W, 2);
    }
    // soft vertical shading so tiling is less visible
    const grad = ctx.createLinearGradient(0, 0, 0, railY);
    grad.addColorStop(0, "rgba(0,0,0,0.18)");
    grad.addColorStop(0.4, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0,0.08)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, railY);
    // chair rail
    ctx.fillStyle = style.trim;
    ctx.fillRect(0, railY, W, 12);
    ctx.fillStyle = shade(style.trim, 1.3);
    ctx.fillRect(0, railY, W, 3);
    // wainscot panels
    ctx.fillStyle = style.wainscot;
    ctx.fillRect(0, railY + 12, W, H - railY - 12);
    ctx.strokeStyle = shade(style.wainscot, 0.7);
    ctx.lineWidth = 4;
    for (let x = 0; x < W; x += 128) {
      ctx.strokeRect(x + 14, railY + 30, 100, H - railY - 70);
    }
    ctx.strokeStyle = shade(style.wainscot, 1.25);
    ctx.lineWidth = 2;
    for (let x = 0; x < W; x += 128) {
      ctx.strokeRect(x + 18, railY + 34, 92, H - railY - 78);
    }
    // baseboard
    ctx.fillStyle = style.trim;
    ctx.fillRect(0, H - 22, W, 22);
    ctx.fillStyle = shade(style.trim, 0.6);
    ctx.fillRect(0, H - 22, W, 3);
    return finish(key, c, { repeat: true });
  });
}

function drawDamask(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.bezierCurveTo(x + s * 0.9, y - s * 0.5, x + s * 0.6, y + s * 0.4, x, y + s);
  ctx.bezierCurveTo(x - s * 0.6, y + s * 0.4, x - s * 0.9, y - s * 0.5, x, y - s);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y + s * 1.25, s * 0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x - s * 0.7, y + s * 0.6, s * 0.14, 0, Math.PI * 2);
  ctx.arc(x + s * 0.7, y + s * 0.6, s * 0.14, 0, Math.PI * 2);
  ctx.fill();
}

// ------------------------------------------------------------------ misc

export function glowTexture(): THREE.Texture {
  return cached("glow", () => {
    const [c, ctx] = canvas(128, 128);
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.25, "rgba(255,255,255,0.55)");
    g.addColorStop(0.6, "rgba(255,255,255,0.12)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    return finish("glow", c);
  });
}

export function dotTexture(): THREE.Texture {
  return cached("dot", () => {
    const [c, ctx] = canvas(32, 32);
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.5, "rgba(255,255,255,0.35)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 32, 32);
    return finish("dot", c);
  });
}

/** Search marker: a glowing ring with a question mark. Same for every spot, so it gives nothing away. */
export function markerTexture(selected: boolean): THREE.Texture {
  return cached(`marker:${selected}`, () => {
    const [c, ctx] = canvas(128, 128);
    const g = ctx.createRadialGradient(64, 64, 10, 64, 64, 62);
    g.addColorStop(0, selected ? "rgba(255,240,170,0.95)" : "rgba(210,190,255,0.85)");
    g.addColorStop(0.62, selected ? "rgba(255,200,90,0.85)" : "rgba(150,120,255,0.6)");
    g.addColorStop(1, "rgba(120,90,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(64, 64, 62, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = selected ? "#fff6d5" : "rgba(255,255,255,0.9)";
    ctx.beginPath();
    ctx.arc(64, 64, 40, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = selected ? "#7a4300" : "#3b2a7a";
    ctx.font = "bold 58px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("?", 64, 68);
    return finish(`marker:${selected}`, c);
  });
}

/** Stormy night seen through a window. */
export function nightWindowTexture(): THREE.Texture {
  return cached("night", () => {
    const [c, ctx] = canvas(256, 256);
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, "#1b1446");
    g.addColorStop(0.6, "#3a2a78");
    g.addColorStop(1, "#5a3f8f");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    // clouds
    const rand = prng(3);
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = `rgba(${90 + rand() * 40},${80 + rand() * 30},${150 + rand() * 50},0.35)`;
      ctx.beginPath();
      ctx.ellipse(rand() * 256, 40 + rand() * 120, 40 + rand() * 50, 14 + rand() * 12, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // moon
    ctx.fillStyle = "rgba(255,248,220,0.95)";
    ctx.beginPath();
    ctx.arc(190, 60, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2a1f5e";
    ctx.beginPath();
    ctx.arc(180, 54, 20, 0, Math.PI * 2);
    ctx.fill();
    // hills / trees silhouette
    ctx.fillStyle = "#120b2a";
    ctx.beginPath();
    ctx.moveTo(0, 256);
    for (let x = 0; x <= 256; x += 16) ctx.lineTo(x, 200 + Math.sin(x * 0.05) * 14 + rand() * 10);
    ctx.lineTo(256, 256);
    ctx.fill();
    return finish("night", c);
  });
}

export function rainTexture(): THREE.Texture {
  return cached("rain", () => {
    const [c, ctx] = canvas(128, 256);
    const rand = prng(11);
    ctx.strokeStyle = "rgba(190,200,255,0.55)";
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 70; i++) {
      const x = rand() * 128;
      const y = rand() * 256;
      const l = 10 + rand() * 18;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 3, y + l);
      ctx.stroke();
    }
    return finish("rain", c, { repeat: true });
  });
}

/** Patchwork quilt for the bed. */
export function quiltTexture(): THREE.Texture {
  return cached("quilt", () => {
    const [c, ctx] = canvas(256, 256);
    const colors = ["#5b7fd6", "#7d9be6", "#e3a7c7", "#f2d189", "#8bc6b3", "#9c86e0"];
    const rand = prng(5);
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        ctx.fillStyle = colors[Math.floor(rand() * colors.length)];
        ctx.fillRect(x * 64, y * 64, 64, 64);
        ctx.strokeStyle = "rgba(255,255,255,0.55)";
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 2;
        ctx.strokeRect(x * 64 + 5, y * 64 + 5, 54, 54);
      }
    }
    return finish("quilt", c, { repeat: true });
  });
}

export function rugTexture(main: string, border: string): THREE.Texture {
  const key = `rug:${main}:${border}`;
  return cached(key, () => {
    const [c, ctx] = canvas(256, 192);
    ctx.fillStyle = border;
    ctx.fillRect(0, 0, 256, 192);
    ctx.fillStyle = main;
    ctx.fillRect(14, 14, 228, 164);
    ctx.strokeStyle = border;
    ctx.lineWidth = 4;
    ctx.strokeRect(26, 26, 204, 140);
    ctx.fillStyle = border;
    for (const [x, y] of [
      [128, 96],
      [60, 60],
      [196, 60],
      [60, 132],
      [196, 132]
    ]) {
      ctx.beginPath();
      ctx.moveTo(x, y - 18);
      ctx.lineTo(x + 18, y);
      ctx.lineTo(x, y + 18);
      ctx.lineTo(x - 18, y);
      ctx.closePath();
      ctx.fill();
    }
    return finish(key, c);
  });
}

// ----------------------------------------------------------------- faces

export type Expression = "happy" | "surprised" | "giggle" | "sleepy" | "dizzy" | "talk" | "smile";

/**
 * Ghost face drawn for a sphere-segment decal (u = left->right, v = top->bottom).
 * `mask` paints Sneaky's bandit mask across the eyes.
 */
export function faceTexture(expr: Expression, mask = false): THREE.Texture {
  const key = `face:${expr}:${mask}`;
  return cached(key, () => {
    const [c, ctx] = canvas(256, 256);
    ctx.clearRect(0, 0, 256, 256);
    const ink = "#231a33";
    const eyeY = 104;
    const lx = 92;
    const rx = 164;
    if (mask) {
      ctx.fillStyle = "rgba(25,45,35,0.92)";
      roundRect(ctx, 40, eyeY - 30, 176, 58, 26);
      ctx.fill();
    }
    ctx.fillStyle = mask ? "#f2fff6" : ink;
    ctx.strokeStyle = mask ? "#f2fff6" : ink;
    ctx.lineCap = "round";
    ctx.lineWidth = 9;
    const eye = (x: number) => {
      switch (expr) {
        case "surprised":
          ctx.beginPath();
          ctx.ellipse(x, eyeY, 17, 21, 0, 0, Math.PI * 2);
          ctx.fill();
          break;
        case "giggle":
        case "smile":
          ctx.beginPath();
          ctx.arc(x, eyeY + 8, 14, Math.PI * 1.1, Math.PI * 1.9);
          ctx.stroke();
          break;
        case "sleepy":
          ctx.beginPath();
          ctx.arc(x, eyeY - 2, 14, Math.PI * 0.15, Math.PI * 0.85);
          ctx.stroke();
          break;
        case "dizzy":
          ctx.lineWidth = 6;
          ctx.beginPath();
          for (let a = 0; a < Math.PI * 4; a += 0.2) {
            const r = 2 + a * 2.4;
            const px = x + Math.cos(a) * r;
            const py = eyeY + Math.sin(a) * r;
            if (a === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.stroke();
          ctx.lineWidth = 9;
          break;
        default:
          ctx.beginPath();
          ctx.ellipse(x, eyeY, 12, 17, 0, 0, Math.PI * 2);
          ctx.fill();
      }
      if (!mask && (expr === "happy" || expr === "surprised" || expr === "talk")) {
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(x + 4, eyeY - 6, expr === "surprised" ? 6 : 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = ink;
      }
    };
    eye(lx);
    eye(rx);
    // cheeks
    ctx.fillStyle = "rgba(255,120,150,0.35)";
    ctx.beginPath();
    ctx.ellipse(62, 146, 16, 10, 0, 0, Math.PI * 2);
    ctx.ellipse(194, 146, 16, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    // mouth
    ctx.fillStyle = ink;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 8;
    const my = 160;
    switch (expr) {
      case "surprised":
        ctx.beginPath();
        ctx.ellipse(128, my + 4, 14, 18, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      case "giggle":
        ctx.beginPath();
        ctx.moveTo(100, my - 6);
        ctx.quadraticCurveTo(128, my + 38, 156, my - 6);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#ff7d9b";
        ctx.beginPath();
        ctx.ellipse(128, my + 12, 12, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      case "sleepy":
        ctx.beginPath();
        ctx.ellipse(128, my + 2, 8, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      case "dizzy":
        ctx.beginPath();
        ctx.moveTo(100, my);
        for (let x = 100; x <= 156; x += 4) ctx.lineTo(x, my + Math.sin((x - 100) * 0.35) * 6);
        ctx.stroke();
        break;
      case "talk":
        ctx.beginPath();
        ctx.ellipse(128, my + 2, 16, 13, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      default:
        ctx.beginPath();
        ctx.arc(128, my - 8, 20, Math.PI * 0.15, Math.PI * 0.85);
        ctx.stroke();
    }
    return finish(key, c);
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Clock face for the grandfather clock. */
export function clockFaceTexture(): THREE.Texture {
  return cached("clockface", () => {
    const [c, ctx] = canvas(128, 128);
    ctx.fillStyle = "#f3e7c8";
    ctx.beginPath();
    ctx.arc(64, 64, 62, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#3a2a1a";
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = "#3a2a1a";
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.fillRect(64 + Math.sin(a) * 50 - 2, 64 - Math.cos(a) * 50 - 2, 4, 4);
    }
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(64, 64);
    ctx.lineTo(64, 28);
    ctx.moveTo(64, 64);
    ctx.lineTo(90, 72);
    ctx.stroke();
    return finish("clockface", c);
  });
}
