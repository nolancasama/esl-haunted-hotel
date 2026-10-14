// Visual check of Chapter 2: the title, the stairs, the landing, the four upstairs rooms,
// their tricks (toys, steam, instruments, the blackout) and the Chapter 2 cutscene.
// Saves screenshots to .tmp/upstairs. Expects a dev server (default port 5199).
// Usage: node scripts/upstairs.mjs [baseUrl] [viewport WxH] [--part=rooms|stairs|cutscene|tricks|all]
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const base = process.argv[2] ?? "http://127.0.0.1:5199/";
const [vw, vh] = (process.argv.find((a) => /^\d+x\d+$/.test(a)) ?? "1366x768").split("x").map(Number);
const part = (process.argv.find((a) => a.startsWith("--part=")) ?? "--part=all").slice(7);
const outDir = path.join(root, ".tmp", "upstairs");
fs.mkdirSync(outDir, { recursive: true });
const stubsSrc = fs.readFileSync(path.join(root, "tests", "e2e", "stubs.ts"), "utf8");
const stubs = stubsSrc.slice(stubsSrc.indexOf("`") + 1, stubsSrc.lastIndexOf("`"));

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const tag = `${vw}x${vh}`;
let n = 0;
const logs = [];

async function open(query, unlocked = true) {
  const page = await browser.newPage({ viewport: { width: vw, height: vh } });
  page.on("console", (m) => m.type() === "error" && logs.push(`[error] ${m.text()}`));
  page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));
  await page.addInitScript(stubs);
  if (unlocked) await page.addInitScript(() => {
    localStorage.setItem("hh.ch2.v1", "1");
    localStorage.setItem("hh.replay.v1", "1");
  });
  await page.goto(`${base}?e2e=1&seed=4${query}`);
  await page.waitForTimeout(1500);
  return page;
}
const shot = async (page, name) => {
  const file = path.join(outDir, `${tag}-${String(++n).padStart(2, "0")}-${name}.png`);
  await page.screenshot({ path: file });
  console.log("saved", path.relative(root, file));
};
const st = (page) => page.evaluate(() => window.__hh.state());
const until = (page, fn, arg, timeout = 30000) => page.waitForFunction(fn, arg, { timeout });
const phase = (page, p) => until(page, (x) => [].concat(x).includes(window.__hh.state().phase), p);
const hook = (page, name, ...args) => page.evaluate(([f, a]) => window.__hh[f](...a), [name, args]);

if (part === "all" || part === "rooms") {
  const page = await open("&chapter=2");
  await shot(page, "title-unlocked");
  await page.getByTestId("start").click();
  await page.waitForTimeout(900);
  await shot(page, "ch2-card");
  await phase(page, "explore");
  await page.waitForTimeout(800);
  await shot(page, "landing-start");
  // each room, from just inside its door, looking in
  const rooms = [
    ["playroom", -4, -5.0, 0],
    ["bathroom", 4, -5.0, 0],
    ["music", -4, 5.0, Math.PI],
    ["attic", 4, 5.0, Math.PI]
  ];
  for (const [name, x, z, yaw] of rooms) {
    await hook(page, "teleport", x, z, 1);
    await hook(page, "setYaw", yaw, 0.9);
    await page.waitForTimeout(1300);
    await shot(page, `room-${name}`);
    await hook(page, "setYaw", yaw + 0.8, 1.05);
    await page.waitForTimeout(1100);
    await shot(page, `room-${name}-b`);
  }
  await hook(page, "teleport", -3, 0, 1);
  await hook(page, "setYaw", -0.5, 0.95);
  await page.waitForTimeout(1200);
  await shot(page, "landing-west");
  await page.close();
}

if (part === "all" || part === "stairs") {
  const page = await open("&chapter=2");
  await page.getByTestId("start").click();
  await phase(page, "explore");
  // from the lobby: the stairs with the gate open (Chapter 2 opens them)
  await hook(page, "teleport", 1.2, 1.8, 0);
  await hook(page, "setYaw", -1.0, 0.85);
  await page.waitForTimeout(1300);
  await shot(page, "stairs-from-lobby");
  // walk up with the keyboard: the camera behind (west), so W walks east up the steps
  await hook(page, "teleport", 2.9, 0, 0);
  await hook(page, "setYaw", -Math.PI / 2, 0.9);
  await page.waitForTimeout(900);
  await page.keyboard.down("KeyW");
  for (let i = 1; i <= 4; i++) {
    await page.waitForTimeout(330);
    const p = (await st(page)).player;
    console.log(`climb ${i}: x=${p.x.toFixed(2)} y=${p.y.toFixed(2)} floor=${p.floor} stairs=${p.stairs}`);
    await shot(page, `climb-${i}`);
  }
  await page.waitForTimeout(500);
  await page.keyboard.up("KeyW");
  await page.waitForTimeout(600);
  console.log("after climb:", JSON.stringify((await st(page)).player));
  await shot(page, "climb-top");
  // and back down: the camera east of the player, W walks west down the steps
  await hook(page, "teleport", 7.0, 0, 1);
  await hook(page, "setYaw", Math.PI / 2, 0.9);
  await page.waitForTimeout(900);
  await page.keyboard.down("KeyW");
  for (let i = 1; i <= 3; i++) {
    await page.waitForTimeout(450);
    const p = (await st(page)).player;
    console.log(`descend ${i}: x=${p.x.toFixed(2)} y=${p.y.toFixed(2)} floor=${p.floor} stairs=${p.stairs}`);
    await shot(page, `descend-${i}`);
  }
  await page.waitForTimeout(600);
  await page.keyboard.up("KeyW");
  await page.waitForTimeout(500);
  console.log("after descent:", JSON.stringify((await st(page)).player));
  await shot(page, "descend-bottom");
  await page.close();
}

if (part === "all" || part === "tricks") {
  const page = await open("&chapter=2");
  await page.getByTestId("start").click();
  await phase(page, "explore");
  // playroom toys
  await hook(page, "teleport", -4, -5.2, 1);
  await hook(page, "setYaw", 0.3, 0.95);
  await page.waitForTimeout(1500);
  for (const id of ["playroom.horse", "playroom.train", "playroom.teddy"]) await hook(page, "wobble", id);
  await page.waitForTimeout(250);
  await shot(page, "toys-moving");
  // bathroom steam with the silhouette
  await hook(page, "jump", 1);
  await page.waitForTimeout(400);
  await hook(page, "teleport", 3.6, -5.4, 1);
  await hook(page, "setYaw", 0.25, 0.95);
  await page.waitForTimeout(2500);
  await hook(page, "steam", 1);
  await page.waitForTimeout(1200);
  await shot(page, "steam");
  await hook(page, "goTo", "bathroom.switch");
  await page.waitForTimeout(700);
  await shot(page, "fan-switch-focus");
  await page.keyboard.press("KeyE");
  await page.waitForTimeout(1600);
  await shot(page, "fan-on");
  // music room: an instrument plays
  await hook(page, "jump", 2);
  await page.waitForTimeout(400);
  await hook(page, "teleport", -4, 5.4, 1);
  await hook(page, "setYaw", Math.PI - 0.3, 0.95);
  await page.waitForTimeout(2500);
  await hook(page, "wobble", "music.drum");
  await page.waitForTimeout(400);
  await shot(page, "music-room");
  // attic: Shadow's round 2 (a find, then the blackout)
  await hook(page, "jump", 3, 1);
  await page.waitForTimeout(400);
  await hook(page, "teleport", 4, 5.4, 1);
  await hook(page, "setYaw", Math.PI + 0.3, 0.95);
  await until(page, () => window.__hh.state().clueShown);
  await phase(page, "explore");
  const s = await st(page);
  console.log("attic clue:", s.clue.text);
  await hook(page, "setMic", false);
  await hook(page, "goTo", s.clue.objectId);
  await page.waitForTimeout(500);
  await page.keyboard.press("KeyE");
  await phase(page, "search");
  await hook(page, "select", s.clue.spotId);
  await page.keyboard.press("KeyE");
  await phase(page, "answer");
  await page.waitForTimeout(600);
  await shot(page, "shadow-found");
  await page.getByTestId(`word-${s.clue.prep}`).click();
  await until(page, () => window.__hh.state().blackout);
  await page.waitForTimeout(500);
  await shot(page, "shadow-blackout");
  await page.close();
}

if (part === "all" || part === "cutscene") {
  const page = await open("&intro=0");
  await page.getByTestId("start").click();
  await phase(page, "explore");
  await page.waitForTimeout(700);
  await shot(page, "full-start");
  // Mischief's last round: one answer from the end of Chapter 1.
  await hook(page, "jump", 3, 3);
  await page.waitForTimeout(400);
  await hook(page, "teleport", -4, 5.4, 0);
  await until(page, () => window.__hh.state().clueShown);
  await phase(page, "explore");
  const s = await st(page);
  await hook(page, "setMic", false);
  await hook(page, "goTo", s.clue.objectId);
  await page.waitForTimeout(400);
  await page.keyboard.press("KeyE");
  await phase(page, "search");
  await hook(page, "select", s.clue.spotId);
  await page.keyboard.press("KeyE");
  await phase(page, "answer");
  await page.evaluate(() => (window.__ttsMs = 1500));
  await page.getByTestId(`word-${s.clue.prep}`).click();
  await until(page, () => window.__hh.state().cutscene === "chapter2", null, 40000);
  for (const [name, wait] of [
    ["cut-fade-lobby", 1800],
    ["cut-bang", 900],
    ["cut-chandelier", 1300],
    ["cut-gate", 1700],
    ["cut-boo", 1500]
  ]) {
    await page.waitForTimeout(wait);
    await shot(page, name);
  }
  // advance the lines
  for (let i = 0; i < 4; i++) {
    await page.waitForTimeout(500);
    if ((await st(page)).line?.wait) {
      await shot(page, `cut-line-${i}`);
      await page.keyboard.press("Space");
    }
  }
  await until(page, () => window.__hh.state().chapter === 2, null, 20000);
  await shot(page, "cut-chapter-2");
  await phase(page, "explore");
  await page.waitForTimeout(2600);
  await shot(page, "ch2-begins-beacon-stairs");
  console.log("after cutscene:", JSON.stringify(await st(page)).slice(0, 600));
  await page.close();
}

console.log(logs.length ? logs.join("\n") : "no console errors");
await browser.close();
