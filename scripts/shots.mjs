// Visual check: drives the game in Chromium and saves screenshots to .tmp/shots.
// Usage: node scripts/shots.mjs [baseUrl] [viewport WxH] [--touch]
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const base = process.argv[2] ?? "http://127.0.0.1:5199/";
const [vw, vh] = (process.argv[3] ?? "1366x768").split("x").map(Number);
const touch = process.argv.includes("--touch");
const outDir = path.join(root, ".tmp", "shots");
fs.mkdirSync(outDir, { recursive: true });

const stubsSrc = fs.readFileSync(path.join(root, "tests", "e2e", "stubs.ts"), "utf8");
const stubs = stubsSrc.slice(stubsSrc.indexOf("`") + 1, stubsSrc.lastIndexOf("`"));

const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"]
});
const context = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1, hasTouch: touch, isMobile: false });
const page = await context.newPage();
const logs = [];
page.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning") logs.push(`[${m.type()}] ${m.text()}`);
});
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));
await page.addInitScript(stubs);

const tag = `${vw}x${vh}${touch ? "-touch" : ""}`;
let n = 0;
const shot = async (name) => {
  const file = path.join(outDir, `${tag}-${String(++n).padStart(2, "0")}-${name}.png`);
  await page.screenshot({ path: file });
  console.log("saved", path.relative(root, file));
};
const state = () => page.evaluate(() => window.__hh.state());
const waitPhase = async (phase, timeout = 20000) => {
  await page.waitForFunction((p) => window.__hh.state().phase === p, phase, { timeout });
};

await page.goto(`${base}?e2e=1&seed=3`);
await page.waitForTimeout(2500);
await shot("title");

await page.getByTestId("start").click();
await waitPhase("explore");
await page.waitForTimeout(600);
await shot("explore-start");

// Walk a little with the keyboard.
await page.keyboard.down("KeyW");
await page.waitForTimeout(700);
await page.keyboard.up("KeyW");
await page.waitForTimeout(400);
await shot("walked");

// Go to the bed (the first clue) and open the close-up.
let s = await state();
console.log("clue:", s.clue.text);
await page.evaluate((id) => window.__hh.goTo(id), s.clue.objectId);
await page.waitForTimeout(700);
await shot("near-object");
await page.keyboard.press("KeyE");
await waitPhase("search");
await page.waitForTimeout(1300);
await shot("search-view");

// Wrong spot first.
const spots = await page.evaluate((id) => window.__hh.spotsOf(id), s.clue.objectId);
const wrong = spots.find((x) => x.id !== s.clue.spotId);
const pos = await page.evaluate((id) => window.__hh.screenOf(id), wrong.id);
await page.mouse.click(pos.x, pos.y);
await page.waitForTimeout(1100);
await shot("empty-search");
await waitPhase("search");

// Right spot.
const pos2 = await page.evaluate((id) => window.__hh.screenOf(id), s.clue.spotId);
await page.mouse.click(pos2.x, pos2.y);
await waitPhase("answer");
await page.waitForTimeout(900);
await shot("found-answer");

// Wrong spoken answer, then the right one.
await page.evaluate(() => (window.__speech.say = "it's on the bed"));
await page.keyboard.press("Space");
await page.waitForTimeout(900);
await shot("wrong-answer");
s = await state();
await page.evaluate((prep) => (window.__speech.say = `it's ${prep} the bed`), s.clue.prep);
await page.keyboard.press("Space");
await page.waitForTimeout(500);
await shot("correct-answer");
await page.waitForTimeout(1500);
await shot("escape");
await waitPhase("explore");
await page.waitForTimeout(400);
await shot("next-clue");

// Finish the remaining rounds through the buttons path (settings: mic off).
await page.getByTestId("settings").click();
await page.waitForTimeout(300);
await shot("settings");
await page.getByTestId("toggle-mic").click();
await page.getByTestId("settings-close").click();
for (let round = 0; round < 3; round++) {
  s = await state();
  if (s.screen !== "game") break;
  await page.evaluate((id) => window.__hh.goTo(id), s.clue.objectId);
  await page.waitForTimeout(300);
  await page.keyboard.press("KeyE");
  await waitPhase("search");
  await page.evaluate((id) => window.__hh.select(id), s.clue.spotId);
  await page.keyboard.press("KeyE");
  await waitPhase("answer");
  await page.waitForTimeout(700);
  if (round === 0) await shot("buttons-answer");
  await page.getByTestId(`word-${s.clue.prep}`).click();
  if (round === 2) {
    await page.waitForTimeout(900);
    await shot("capture");
  }
  await page.waitForFunction(() => ["explore", "outro"].includes(window.__hh.state().phase), null, { timeout: 30000 });
}
await page.waitForFunction(() => window.__hh.state().screen === "results", null, { timeout: 30000 });
await page.waitForTimeout(800);
await shot("results");

console.log("final state:", JSON.stringify((await state()).stats));
console.log(logs.length ? logs.join("\n") : "no console errors");
await browser.close();
