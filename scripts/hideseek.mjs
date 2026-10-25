// Controller-owned visual acceptance. Requires the dev server on port 5199.
// Usage: node scripts/hideseek.mjs [baseUrl] [WxH] [--touch]
import { chromium, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const base = args.find((arg) => /^https?:/.test(arg)) ?? "http://localhost:5199/";
const requested = args.find((arg) => /^\d+x\d+$/.test(arg));
const viewports = requested ? [{ size: requested, touch: args.includes("--touch") }] : [
  { size: "1366x768", touch: false }, { size: "1024x600", touch: false }, { size: "844x390", touch: true }
];
const source = fs.readFileSync(path.join(root, "tests/e2e/stubs.ts"), "utf8");
const stubs = source.slice(source.indexOf("`") + 1, source.lastIndexOf("`"));
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });

async function capture({ size, touch }) {
  const [width, height] = size.split("x").map(Number);
  const dir = path.join(root, ".tmp/hideseek", size);
  fs.mkdirSync(dir, { recursive: true });
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  const frames = [];
  let sequence = 0;
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.addInitScript(stubs);
  await page.addInitScript(() => localStorage.setItem("hh.settings.v1", JSON.stringify({ mic: false, japanese: true, englishLevel: "standard" })));
  const hook = (name, ...params) => page.evaluate(([key, values]) => window.__hh[key](...values), [name, params]);
  const state = () => hook("hs");
  const speed = (value) => hook("hsTimeScale", value);
  const command = async (name, ...params) => {
    const result = await hook("hsCommand", name, ...params);
    if (!result?.ok) throw new Error(`HARNESS_PRECONDITION_FAILED [${size}] command ${name}: ${JSON.stringify(result)}`);
  };
  const until = (description, predicate, timeout = 60_000) => expect.poll(async () => {
    const s = await state();
    return Boolean(s && predicate(s));
  }, { timeout, intervals: [100, 250, 500], message: `HARNESS_PRECONDITION_FAILED [${size}] ${description}` }).toBe(true);
  const visible = async (id) => {
    try { await page.getByTestId(id).waitFor({ state: "visible", timeout: 60_000 }); }
    catch (error) { throw new Error(`HARNESS_PRECONDITION_FAILED [${size}] visible ${id}: ${error.message}`); }
  };
  const renderFrames = (count = 5) => page.evaluate((target) => new Promise((resolve) => {
    let count = 0;
    const tick = () => { if (++count >= target) resolve(); else requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }), count);

  async function shot(name, valid) {
    await speed(0);
    await renderFrames();
    if (!await valid(await state())) throw new Error(`HARNESS_PRECONDITION_FAILED [${size}] ${name} missing before screenshot`);
    const measurement = await page.evaluate((label) => {
      const s = window.__hh.hs();
      const ids = ["hs-hud", "hs-english", "hs-subtitle", "subtitle", "hs-results", "hs-ghost-select", "hs-room-select", "hideseek-back", "hs-menu"];
      const boxes = {};
      const clipped = [];
      const internalOverflow = [];
      for (const id of ids) {
        const node = document.querySelector(`[data-testid="${id}"]`);
        if (!node?.getClientRects().length) continue;
        const r = node.getBoundingClientRect();
        boxes[id] = { x: r.x, y: r.y, width: r.width, height: r.height };
        if (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1) clipped.push(id);
        if (node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 1) internalOverflow.push({ id, clientWidth: node.clientWidth, scrollWidth: node.scrollWidth, clientHeight: node.clientHeight, scrollHeight: node.scrollHeight });
      }
      const intersects = (a, b) => a && b && Math.min(a.x + a.width, b.x + b.width) > Math.max(a.x, b.x) + 1 && Math.min(a.y + a.height, b.y + b.height) > Math.max(a.y, b.y) + 1;
      const overlaps = [["hs-hud", "hs-english"], ["hs-hud", "hs-subtitle"], ["hs-english", "hs-subtitle"]].filter(([a, b]) => intersects(boxes[a], boxes[b]));
      const upstairs = ["playroom", "bathroom", "music", "attic"].includes(s?.config.room);
      const project = (x, y, z) => window.__hh.project(x, y, z);
      const preview = s?.status === "setup" && s.english?.starting ? s.spots.find((spot) => spot.id === s.english.spotId)?.hidePos : null;
      const ghost = preview ?? s?.ghost;
      const actors = s ? { ghost: project(ghost.x, ghost.y + 0.25, ghost.z), detective: project(s.detective.x, (upstairs ? 2.8 : 0) + 0.8, s.detective.z) } : {};
      const actorOverlaps = [];
      const actorsOutside = [];
      for (const [actor, point] of Object.entries(actors)) {
        if (!point) continue;
        if (point.x < 0 || point.x > innerWidth || point.y < 0 || point.y > innerHeight) actorsOutside.push(actor);
        for (const id of ["hs-hud", "hs-english", "hs-subtitle"]) {
          if (intersects({ x: point.x - 12, y: point.y - 20, width: 24, height: 40 }, boxes[id])) actorOverlaps.push([actor, id]);
        }
      }
      return { frame: label, state: s, boxes, clipped, overlaps, internalOverflow, actors, actorOverlaps, actorsOutside, renderer: window.__hh.stats(), documentOverflow: { x: document.documentElement.scrollWidth > innerWidth, y: document.documentElement.scrollHeight > innerHeight } };
    }, name);
    const file = `${String(++sequence).padStart(2, "0")}-${name}.png`;
    await page.screenshot({ path: path.join(dir, file) });
    if (!await valid(await state())) throw new Error(`HARNESS_PRECONDITION_FAILED [${size}] ${name} missing after screenshot`);
    frames.push({ ...measurement, file });
    console.log("saved", path.relative(root, path.join(dir, file)));
  }

  async function start(ghost, room, level = "standard", seed = 4) {
    await command("start", ghost, room, seed, level);
    await speed(0);
    await until(`${ghost}/${room} setup`, (s) => s.status === "setup" && s.config.ghost === ghost && s.config.room === room && s.config.level === level);
  }
  async function choose(spotId) {
    const s = await state();
    const spot = spotId ? s.reachable.find((item) => item.id === spotId) : s.reachable.find((item) => item.prep === "by") ?? s.reachable[0];
    if (!spot) throw new Error(`HARNESS_PRECONDITION_FAILED [${size}] no requested start ${spotId}`);
    await page.getByTestId(`hs-spot-${spot.id}`).click();
    await until("English opened for chosen spot", (next) => next.english?.spotId === spot.id);
    return spot;
  }
  async function answer() {
    const s = await state();
    const spot = s.spots.find((item) => item.id === s.english?.spotId);
    if (!spot) throw new Error(`HARNESS_PRECONDITION_FAILED [${size}] no English spot`);
    await page.getByTestId(`hs-word-${spot.prep}`).click();
    await until("English accepted", (next) => next.status === "playing" && !next.english);
  }

  try {
    await page.goto(`${base.replace(/\/$/, "")}/?e2e=1&fast=1&mode=hideseek&seed=4`);
    await visible("hs-ghost-sleepy");
    await shot("ghost-select", async () => page.getByTestId("hs-ghost-sleepy").isVisible());
    await page.getByTestId("hs-ghost-shadow").click();
    await visible("hs-room-attic");
    await shot("room-select", async () => page.getByTestId("hs-room-attic").isVisible());
    await page.getByTestId("hs-room-attic").click();
    await until("selected room match created", (s) => s.status === "setup");

    for (const room of ["playroom", "library", "attic"]) {
      await start("sleepy", room);
      await choose();
      await answer();
      await speed(0.25);
      await until(`${room} detective searching`, (s) => s.status === "playing" && s.detective.phase === "search");
      await shot(`match-${room}-mid-search`, (s) => s.status === "playing" && s.detective.phase === "search");
    }
    for (const level of ["beginner", "standard", "advanced"]) {
      await start("hungry", "dining", level);
      await choose("dining.table.under");
      await shot(`english-${level}`, (s) => s.config.level === level && Boolean(s.english));
    }
    for (const ghost of ["sleepy", "hungry", "sneaky", "mischief", "bouncy", "bubbles", "melody", "shadow"]) {
      await start(ghost, "dining");
      await choose("dining.table.under");
      await answer();
      await page.getByTestId("hs-ability").click();
      if (ghost === "hungry" || ghost === "mischief") {
        await page.getByTestId("hs-spot-dining.basket.in").click();
      }
      await until(`${ghost} ability used`, (s) => s.abilityUsed);
      if (["sneaky", "bouncy", "shadow"].includes(ghost)) {
        await page.getByTestId("hs-move").click();
        await page.getByTestId("hs-spot-dining.window.by").click();
        await answer();
        const from = (await state()).ghost;
        await speed(0.25);
        await until(`${ghost} move visible`, (s) => s.ghost.transit && Math.hypot(s.ghost.x - from.x, s.ghost.z - from.z) > 0.1);
      }
      const effectActive = (s) => {
        if (s.status !== "playing" || !s.abilityUsed) return false;
        switch (ghost) {
          case "sleepy": return s.effects.sleepySearch === s.stats.completedSearches;
          case "hungry": return s.detective.clues.some((clue) => clue.kind === "munch");
          case "sneaky": return s.ghost.transit && s.ghost.silent;
          case "mischief": return Boolean(s.effects.decoy);
          case "bouncy": return s.ghost.transit && s.ghost.loudness === 1.6;
          case "bubbles": return s.effects.bubbles.length > 0;
          case "melody": return Boolean(s.effects.music);
          case "shadow": return s.ghost.transit && s.ghost.invisible;
          default: return false;
        }
      };
      await until(`${ghost} specific effect active`, effectActive);
      await shot(`ability-${ghost}`, effectActive);
    }
    for (const [seed, outcome] of [[4, "won"], [5, "lost"]]) {
      await start("shadow", "dining", "standard", seed);
      await choose("dining.table.under");
      await answer();
      await speed(30);
      await until(`seed ${seed} reaches ${outcome}`, (s) => s.status === outcome, 90_000);
      await shot(`results-${outcome}`, (s) => s.status === outcome);
    }
  } finally {
    fs.writeFileSync(path.join(dir, "measurements.json"), JSON.stringify({ viewport: size, touch, frames, errors }, null, 2));
    await context.close();
  }
  if (errors.length) throw new Error(`[${size}] browser errors: ${errors.join("; ")}`);
}

try {
  for (const viewport of viewports) await capture(viewport);
  console.log("Hide & Seek screenshots and measurements: .tmp/hideseek/");
} finally {
  await browser.close();
}
