// Hide & Seek first-person views. Requires the dev server on port 5199.
// Usage: node scripts/firstperson.mjs [baseUrl] [--part=views|flow] [--room=bedroom] [--gpu]
//   views: every hiding place's first-person view in every room, one contact sheet per room.
//   flow:  a staged Bedroom match: reveal, Stay/Move overlay, approach, Move picker, relocation, found.
// Output: .tmp/firstperson/
import { chromium, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const base = args.find((arg) => /^https?:/.test(arg)) ?? "http://localhost:5199/";
const part = args.find((arg) => arg.startsWith("--part="))?.slice(7) ?? "views";
const only = args.find((arg) => arg.startsWith("--room="))?.slice(7);
const ROOMS = ["bedroom", "dining", "storage", "library", "playroom", "bathroom", "music", "attic"];
const out = path.join(root, ".tmp/firstperson");
fs.mkdirSync(out, { recursive: true });
const source = fs.readFileSync(path.join(root, "tests/e2e/stubs.ts"), "utf8");
const stubs = source.slice(source.indexOf("`") + 1, source.lastIndexOf("`"));
const browser = await chromium.launch({
  args: args.includes("--gpu") ? ["--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"]
    : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"]
});

async function openMatch(room, ghost = "sleepy", seed = 4, size = { width: 1366, height: 768 }) {
  const context = await browser.newContext({ viewport: size, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.addInitScript(stubs);
  await page.addInitScript(() => localStorage.setItem("hh.settings.v1", JSON.stringify({ mic: false, japanese: false, englishLevel: "standard" })));
  await page.goto(`${base}?e2e=1&fast=1&mode=hideseek&ghost=${ghost}&room=${room}&seed=${seed}`);
  await page.waitForFunction(() => Boolean(window.__hh?.hs?.()), undefined, { timeout: 90_000 });
  const hook = (name, ...params) => page.evaluate(([key, values]) => window.__hh[key](...values), [name, params]);
  const frames = (count = 4) => page.evaluate((target) => new Promise((resolve) => {
    let n = 0;
    const tick = () => { if (++n >= target) resolve(); else requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }), count);
  const until = (description, predicate, timeout = 60_000) => expect.poll(async () => Boolean(await predicate()), { timeout, intervals: [100, 250, 500], message: description }).toBe(true);
  await hook("hsTimeScale", 0);
  return { context, page, errors, hook, frames, until };
}

async function hide(m, spotId) {
  const s = await m.hook("hs");
  const spot = s.spots.find((item) => item.id === spotId);
  if (!(await m.hook("hsCommand", "chooseStart", spotId)).ok) throw new Error(`chooseStart ${spotId}`);
  if (!(await m.hook("hsCommand", "answerEnglish", [spot.prep])).ok) throw new Error(`answer ${spotId}`);
}

async function sheet(name, items) {
  const page = await browser.newPage({ viewport: { width: 1380, height: 400 }, deviceScaleFactor: 1 });
  const tiles = items.map(({ label, file }) => `<figure><img src="data:image/png;base64,${fs.readFileSync(file).toString("base64")}"><figcaption>${label}</figcaption></figure>`).join("");
  await page.setContent(`<style>body{margin:0;background:#111;display:grid;grid-template-columns:repeat(3,456px);gap:4px;font:14px sans-serif;color:#eee}
    figure{margin:0}img{width:456px;display:block}figcaption{padding:2px 6px}</style>${tiles}`);
  await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: true });
  await page.close();
}

if (part === "views") {
  for (const room of only ? [only] : ROOMS) {
    const m = await openMatch(room);
    const spots = (await m.hook("hs")).spots;
    await hide(m, spots[0].id);
    // Clear the Stay/Move card so each view is unobstructed (the clock is stopped).
    await m.page.getByTestId("hs-stay").click({ timeout: 30_000 });
    const items = [];
    for (const spot of spots) {
      await m.hook("hsPreview", spot.id);
      await m.until(`${spot.id} first-person view settled`, async () => {
        const c = await m.hook("hsCamera");
        return c.mode === "firstPerson" && c.spotId === spot.id && c.settled;
      });
      await m.frames(6);
      const file = path.join(out, room, `${spot.id}.png`);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      // The picture right of the HUD rail (the first-person view's centre sits there).
      await m.page.screenshot({ path: file, clip: { x: 300, y: 0, width: 1066, height: 600 } });
      items.push({ label: spot.id, file });
    }
    await sheet(`sheet-${room}`, items);
    if (m.errors.length) console.log(room, "errors:", m.errors);
    console.log(`${room}: ${items.length} views`);
    await m.context.close();
  }
}

if (part === "flow") {
  const room = only ?? "bedroom";
  const m = await openMatch(room, "sleepy", 5);
  const items = [];
  const shot = async (label) => {
    await m.frames(4);
    const file = path.join(out, "flow", `${String(items.length).padStart(2, "0")}-${label}.png`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    await m.page.screenshot({ path: file });
    const c = await m.hook("hsCamera");
    const s = await m.hook("hs");
    items.push({ label: `${label} · ${c.mode} · ${s.decision?.phase ?? "-"} ${s.decision ? s.decision.secondsLeft.toFixed(1) : ""}`, file });
    console.log(label, c.mode, c.settled, s.phase, s.decision?.phase, s.decision?.secondsLeft);
  };
  const start = `${room}.bed.under`;
  await m.hook("hsCommand", "chooseStart", start);
  await shot("english-start");
  await m.hook("hsCommand", "answerEnglish", ["under"]);
  await shot("reveal");
  await m.until("first person settled", async () => (await m.hook("hsCamera")).settled);
  await shot("decision-first-person");
  await m.page.getByTestId("hs-stay").click();
  // Let the detective walk until it is near the bed, or finishes a search.
  await m.hook("hsTimeScale", 1);
  await m.until("detective approaching", async () => {
    const s = await m.hook("hs");
    return s.decision || s.status !== "playing" || Math.hypot(s.detective.x - s.ghost.x, s.detective.z - s.ghost.z) < 2.2 || s.phase === "search";
  }, 120_000);
  await m.hook("hsTimeScale", 0);
  await shot("approach");
  await m.hook("hsTimeScale", 1);
  await m.until("next decision", async () => { const s = await m.hook("hs"); return s.decision || s.status !== "playing"; }, 180_000);
  await m.hook("hsTimeScale", 0);
  let s = await m.hook("hs");
  if (s.decision?.phase === "decision") {
    await m.hook("hsTimeScale", 1);
    await m.page.getByTestId("hs-move").click();
    await m.until("overhead picker settled", async () => (await m.hook("hsCamera")).settled);
    await m.hook("hsTimeScale", 0);
    await shot("destination-picker");
    s = await m.hook("hs");
    const target = s.reachable[0];
    await m.page.getByTestId(`hs-spot-${target.id}`).click();
    await m.hook("hsCommand", "answerEnglish", [target.prep]);
    await m.hook("hsTimeScale", 0.5);
    await m.until("relocating", async () => (await m.hook("hsCamera")).mode === "relocating");
    await m.page.waitForTimeout(1500);
    await m.hook("hsTimeScale", 0);
    await shot("relocating");
    await m.hook("hsTimeScale", 1);
    await m.until("arrived, first person", async () => { const c = await m.hook("hsCamera"); return c.mode === "firstPerson" && c.settled; }, 60_000);
    await m.hook("hsTimeScale", 0);
    await shot("arrived");
  }
  // Play out (timeouts default to Stay) until the end, caught on the frame it happens.
  await m.hook("hsTimeScale", 4);
  await m.page.waitForFunction(() => window.__hh.hs().status !== "playing", undefined, { polling: "raf", timeout: 300_000 });
  await m.hook("hsTimeScale", 0);
  await shot("ended-hold");
  await m.until("closing shot settled", async () => { const c = await m.hook("hsCamera"); return c.mode !== "firstPerson" && c.settled; });
  // Screenshots can be slower than the 2.6 s closing shot; look at the scene under the card.
  const hideCard = await m.page.addStyleTag({ content: "[data-testid=hs-results]{visibility:hidden}" });
  await shot("closing-shot");
  await hideCard.evaluate((node) => node.remove());
  await m.page.getByTestId("hs-results").waitFor({ timeout: 10_000 });
  await shot("results");
  await sheet(`sheet-flow-${room}`, items);
  if (m.errors.length) console.log("errors:", m.errors);
  await m.context.close();
}
await browser.close();
