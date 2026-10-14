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
  /** Checkerboard tiles (the bathroom) instead of planks. */
  tiles?: boolean;
}

export function floorTexture(style: FloorStyle): THREE.Texture {
  return cached(`floor:${style.base}:${style.seed}`, () => {
    const [c, ctx] = canvas(512, 512);
    const rand = prng(style.seed);
    if (style.tiles) {
      const t = 64;
      for (let y = 0; y < 512; y += t) {
        for (let x = 0; x < 512; x += t) {
          const dark = ((x + y) / t) % 2 === 1;
          ctx.fillStyle = shade(dark ? style.seam : style.base, 0.94 + rand() * 0.1);
          ctx.fillRect(x, y, t, t);
          ctx.fillStyle = "rgba(255,255,255,0.08)";
          ctx.fillRect(x + 4, y + 4, t - 8, 6);
        }
      }
      ctx.strokeStyle = "rgba(30,40,45,0.5)";
      ctx.lineWidth = 3;
      for (let i = 0; i <= 512; i += t) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, 512);
        ctx.moveTo(0, i);
        ctx.lineTo(512, i);
        ctx.stroke();
      }
      return finish(`floor:${style.base}:${style.seed}`, c, { repeat: true });
    }
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
  kind: "stripes" | "damask" | "dots" | "bricks" | "stars" | "tiles" | "planks";
  wainscot: string;
  trim: string;
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

/** Bare vertical boards from floor to ceiling (the attic). */
function drawPlanks(ctx: CanvasRenderingContext2D, style: WallStyle, W: number, H: number) {
  const rand = prng(19);
  const bw = 42;
  for (let x = 0; x < W; x += bw) {
    ctx.fillStyle = shade(style.paper, 0.8 + rand() * 0.35);
    ctx.fillRect(x, 0, bw, H);
    ctx.strokeStyle = shade(style.paper, 0.7);
    ctx.lineWidth = 1;
    for (let g = 0; g < 3; g++) {
      const gx = x + 6 + rand() * (bw - 12);
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.bezierCurveTo(gx + rand() * 6 - 3, H * 0.3, gx + rand() * 6 - 3, H * 0.7, gx, H);
      ctx.stroke();
    }
    // a knot now and then
    if (rand() < 0.5) {
      ctx.fillStyle = shade(style.paper, 0.6);
      ctx.beginPath();
      ctx.ellipse(x + bw / 2, rand() * H, 4, 7, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = style.pattern;
    ctx.fillRect(x, 0, 3, H);
    // nails at the cross beams
    ctx.fillStyle = "#2a2018";
    for (const y of [H * 0.18, H * 0.62]) {
      ctx.beginPath();
      ctx.arc(x + bw / 2, y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // two horizontal battens
  for (const y of [H * 0.16, H * 0.6]) {
    ctx.fillStyle = shade(style.paper, 0.72);
    ctx.fillRect(0, y, W, 14);
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(0, y + 14, W, 3);
  }
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "rgba(0,0,0,0.25)");
  grad.addColorStop(0.5, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.2)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}

/** Canvas bottom = floor. Lower third wood panels, chair rail, patterned wallpaper above. */
export function wallTexture(style: WallStyle): THREE.Texture {
  const key = `wall:${style.paper}:${style.kind}:${style.wainscot}`;
  return cached(key, () => {
    const W = 256;
    const H = 512;
    const [c, ctx] = canvas(W, H);
    const rand = prng(7);
    if (style.kind === "planks") {
      drawPlanks(ctx, style, W, H);
      return finish(key, c, { repeat: true });
    }
    const railY = Math.round(H * 0.64); // from top
    // wallpaper
    ctx.fillStyle = style.paper;
    ctx.fillRect(0, 0, W, railY);
    if (style.kind === "stars") {
      // night-sky nursery paper: stars and little moons
      ctx.fillStyle = style.pattern;
      for (let y = 26; y < railY; y += 58) {
        for (let x = 20; x < W + 32; x += 64) {
          const ox = (Math.floor(y / 58) % 2) * 32;
          if ((x / 64 + Math.floor(y / 58)) % 3 === 0) {
            ctx.beginPath();
            ctx.arc((x + ox) % W, y, 9, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = style.paper;
            ctx.beginPath();
            ctx.arc(((x + ox) % W) + 4, y - 3, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = style.pattern;
          } else drawStar(ctx, (x + ox) % W, y, 8);
        }
      }
    } else if (style.kind === "tiles") {
      const t = 32;
      for (let y = 0; y < railY; y += t) {
        for (let x = 0; x < W; x += t) {
          ctx.fillStyle = shade(style.paper, 0.92 + rand() * 0.14);
          ctx.fillRect(x, y, t, t);
        }
      }
      ctx.fillStyle = style.pattern;
      for (let i = 0; i <= W; i += t) ctx.fillRect(i - 1, 0, 2, railY);
      for (let i = 0; i <= railY; i += t) ctx.fillRect(0, i - 1, W, 2);
    } else if (style.kind === "stripes") {
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
    // wainscot panels (big white tiles in the bathroom)
    ctx.fillStyle = style.wainscot;
    ctx.fillRect(0, railY + 12, W, H - railY - 12);
    if (style.kind === "tiles") {
      const t = 42;
      ctx.fillStyle = shade(style.wainscot, 0.75);
      for (let x = 0; x <= W; x += t) ctx.fillRect(x - 1, railY + 12, 2, H - railY - 12);
      for (let y = railY + 12; y < H; y += t) ctx.fillRect(0, y - 1, W, 2);
    } else {
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
 * `mask` paints Sneaky's bandit mask across the eyes; `glow` gives Shadow glowing eyes.
 */
export function faceTexture(expr: Expression, mask = false, glow = false): THREE.Texture {
  const key = `face:${expr}:${mask}:${glow}`;
  return cached(key, () => {
    const [c, ctx] = canvas(256, 256);
    ctx.clearRect(0, 0, 256, 256);
    const ink = glow ? "#1a1030" : "#231a33";
    const eyeY = 104;
    const lx = 92;
    const rx = 164;
    if (mask) {
      ctx.fillStyle = "rgba(25,45,35,0.92)";
      roundRect(ctx, 40, eyeY - 30, 176, 58, 26);
      ctx.fill();
    }
    const eyeInk = mask ? "#f2fff6" : glow ? "#fff27a" : ink;
    ctx.fillStyle = eyeInk;
    ctx.strokeStyle = eyeInk;
    if (glow) {
      ctx.shadowColor = "#ffd84a";
      ctx.shadowBlur = 16;
    }
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
      if (!mask && !glow && (expr === "happy" || expr === "surprised" || expr === "talk")) {
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(x + 4, eyeY - 6, expr === "surprised" ? 6 : 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = ink;
      }
    };
    eye(lx);
    eye(rx);
    ctx.shadowBlur = 0;
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

/** Long red hallway runner with a gold border. */
export function runnerTexture(): THREE.Texture {
  return cached("runner", () => {
    const [c, ctx] = canvas(512, 128);
    ctx.fillStyle = "#c9a24a";
    ctx.fillRect(0, 0, 512, 128);
    ctx.fillStyle = "#8a2333";
    ctx.fillRect(8, 8, 496, 112);
    ctx.strokeStyle = "#c9a24a";
    ctx.lineWidth = 3;
    ctx.strokeRect(18, 18, 476, 92);
    ctx.fillStyle = "#c9a24a";
    for (let x = 50; x < 480; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, 64 - 14);
      ctx.lineTo(x + 14, 64);
      ctx.lineTo(x, 64 + 14);
      ctx.lineTo(x - 14, 64);
      ctx.closePath();
      ctx.fill();
    }
    return finish("runner", c);
  });
}

/** Lobby paintings: a ghost family portrait, or the hotel under the moon. */
export function paintingTexture(kind: "family" | "hotel"): THREE.Texture {
  const key = `painting:${kind}`;
  return cached(key, () => {
    const [c, ctx] = canvas(160, 200);
    if (kind === "family") {
      const g = ctx.createLinearGradient(0, 0, 0, 200);
      g.addColorStop(0, "#3a2a5a");
      g.addColorStop(1, "#1f1636");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 160, 200);
      const ghost = (x: number, y: number, s: number, col: string) => {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(x, y, 18 * s, Math.PI, 0);
        ctx.lineTo(x + 18 * s, y + 26 * s);
        for (let i = 0; i < 4; i++) ctx.lineTo(x + 18 * s - (i + 0.5) * 9 * s, y + (i % 2 ? 26 : 20) * s);
        ctx.lineTo(x - 18 * s, y + 26 * s);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#231a33";
        ctx.beginPath();
        ctx.ellipse(x - 6 * s, y - 2 * s, 2.5 * s, 3.5 * s, 0, 0, Math.PI * 2);
        ctx.ellipse(x + 6 * s, y - 2 * s, 2.5 * s, 3.5 * s, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#231a33";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y + 5 * s, 5 * s, 0.2, Math.PI - 0.2);
        ctx.stroke();
      };
      ghost(52, 92, 1.3, "#f4f1ff");
      ghost(110, 96, 1.15, "#e8dcff");
      ghost(82, 140, 0.8, "#fff4d6");
      ctx.fillStyle = "#c9a24a";
      ctx.font = "bold 14px serif";
      ctx.textAlign = "center";
      ctx.fillText("THE BOOS", 80, 186);
    } else {
      const g = ctx.createLinearGradient(0, 0, 0, 200);
      g.addColorStop(0, "#15123a");
      g.addColorStop(1, "#4a3a7a");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 160, 200);
      ctx.fillStyle = "#fff6d8";
      ctx.beginPath();
      ctx.arc(118, 40, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1a1230";
      ctx.fillRect(30, 90, 100, 90);
      ctx.beginPath();
      ctx.moveTo(22, 92);
      ctx.lineTo(80, 50);
      ctx.lineTo(138, 92);
      ctx.fill();
      ctx.fillStyle = "#ffd36b";
      for (const [x, y] of [
        [45, 110],
        [75, 110],
        [105, 110],
        [45, 140],
        [105, 140]
      ])
        ctx.fillRect(x, y, 12, 14);
      ctx.fillStyle = "#2e7d4a";
      ctx.fillRect(0, 178, 160, 22);
    }
    return finish(key, c);
  });
}

/** Glowing icons: a padlock on locked doors, a down-arrow over the door to go to. */
export function iconTexture(kind: "lock" | "arrow"): THREE.Texture {
  const key = `icon:${kind}`;
  return cached(key, () => {
    const [c, ctx] = canvas(128, 128);
    const g = ctx.createRadialGradient(64, 64, 8, 64, 64, 62);
    g.addColorStop(0, kind === "lock" ? "rgba(190,150,255,0.55)" : "rgba(255,226,140,0.6)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    if (kind === "lock") {
      ctx.strokeStyle = "#e8dcff";
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.arc(64, 54, 16, Math.PI, 0);
      ctx.stroke();
      ctx.fillStyle = "#c9b4ff";
      ctx.fillRect(40, 54, 48, 38);
      ctx.fillStyle = "#4a2f8a";
      ctx.beginPath();
      ctx.arc(64, 70, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(61, 70, 6, 12);
    } else {
      ctx.fillStyle = "#ffe08a";
      ctx.strokeStyle = "#7a4a00";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(40, 30);
      ctx.lineTo(88, 30);
      ctx.lineTo(88, 62);
      ctx.lineTo(108, 62);
      ctx.lineTo(64, 106);
      ctx.lineTo(20, 62);
      ctx.lineTo(40, 62);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    return finish(key, c);
  });
}

/** A shaft of light: bright at one end, fading along its length, soft at the sides. */
export function beamTexture(): THREE.Texture {
  return cached("beam", () => {
    const [c, ctx] = canvas(256, 64);
    const along = ctx.createLinearGradient(0, 0, 256, 0);
    along.addColorStop(0, "rgba(255,255,255,0.95)");
    along.addColorStop(0.7, "rgba(255,255,255,0.35)");
    along.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = along;
    ctx.fillRect(0, 0, 256, 64);
    // soften the long edges
    ctx.globalCompositeOperation = "destination-in";
    const across = ctx.createLinearGradient(0, 0, 0, 64);
    across.addColorStop(0, "rgba(0,0,0,0)");
    across.addColorStop(0.3, "rgba(0,0,0,1)");
    across.addColorStop(0.7, "rgba(0,0,0,1)");
    across.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = across;
    ctx.fillRect(0, 0, 256, 64);
    return finish("beam", c);
  });
}

/** A soap bubble: clear middle, bright rim and a highlight. */
export function bubbleTexture(): THREE.Texture {
  return cached("bubble", () => {
    const [c, ctx] = canvas(64, 64);
    const g = ctx.createRadialGradient(32, 32, 18, 32, 32, 30);
    g.addColorStop(0, "rgba(255,255,255,0.05)");
    g.addColorStop(0.75, "rgba(220,250,255,0.35)");
    g.addColorStop(0.92, "rgba(255,255,255,0.95)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(32, 32, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath();
    ctx.ellipse(23, 21, 6, 4, -0.6, 0, Math.PI * 2);
    ctx.fill();
    return finish("bubble", c);
  });
}

/** A soft lumpy cloud of steam. */
export function steamTexture(): THREE.Texture {
  return cached("steam", () => {
    const [c, ctx] = canvas(128, 128);
    const rand = prng(31);
    for (let i = 0; i < 9; i++) {
      const x = 34 + rand() * 60;
      const y = 40 + rand() * 50;
      const r = 22 + rand() * 20;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, "rgba(255,255,255,0.7)");
      g.addColorStop(0.6, "rgba(255,255,255,0.3)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 128, 128);
    }
    return finish("steam", c);
  });
}

/** An eighth note, drawn (no font needed). */
export function noteTexture(): THREE.Texture {
  return cached("note", () => {
    const [c, ctx] = canvas(64, 64);
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "rgba(255,255,255,0.8)";
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.ellipse(24, 46, 10, 7.5, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(31, 12, 4.5, 34);
    ctx.beginPath();
    ctx.moveTo(35, 12);
    ctx.quadraticCurveTo(50, 18, 47, 32);
    ctx.quadraticCurveTo(45, 22, 35, 22);
    ctx.closePath();
    ctx.fill();
    return finish("note", c);
  });
}

/** A ghost-shaped shadow glimpsed through the steam. */
export function silhouetteTexture(): THREE.Texture {
  return cached("silhouette", () => {
    const [c, ctx] = canvas(128, 128);
    ctx.fillStyle = "rgba(30,90,110,0.9)";
    ctx.beginPath();
    ctx.arc(64, 54, 34, Math.PI, 0);
    ctx.lineTo(98, 104);
    for (let k = 0; k < 6; k++) ctx.lineTo(98 - (k + 0.5) * (68 / 6), k % 2 ? 104 : 94);
    ctx.lineTo(30, 104);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(170,250,255,0.9)";
    ctx.beginPath();
    ctx.ellipse(52, 56, 5, 7, 0, 0, Math.PI * 2);
    ctx.ellipse(76, 56, 5, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    return finish("silhouette", c);
  });
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
