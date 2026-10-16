// Visual check of the full adventure's ending: Shadow's last find, the grand capture,
// the lantern blazing with all eight ghosts, the sunrise in the lobby and the results.
// Also the title and HUD at the given viewport. Saves screenshots to .tmp/ending.
// Usage: node scripts/ending.mjs [baseUrl] [viewport WxH] [--touch]
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const base = process.argv[2] ?? "http://127.0.0.1:5199/";
const [vw, vh] = (process.argv.find((a) => /^\d+x\d+$/.test(a)) ?? "1366x768").split("x").map(Number);
const touch = process.argv.includes("--touch");
const outDir = path.join(root, ".tmp", "ending");
fs.mkdirSync(outDir, { recursive: true });
const stubsSrc = fs.readFileSync(path.join(root, "tests", "e2e", "stubs.ts"), "utf8");
const stubs = stubsSrc.slice(stubsSrc.indexOf("`") + 1, stubsSrc.lastIndexOf("`"));

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const context = await browser.newContext({ viewport: { width: vw, height: vh }, hasTouch: touch });
const page = await context.newPage();
const logs = [];
page.on("console", (m) => m.type() === "error" && logs.push(`[error] ${m.text()}`));
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));
await page.addInitScript(stubs);
await page.addInitScript(() => {
  localStorage.setItem("hh.ch2.v1", "1");
  localStorage.setItem("hh.replay.v1", "1");
});
const tag = `${vw}x${vh}${touch ? "-touch" : ""}`;
let n = 0;
const shot = async (name) => {
  const file = path.join(outDir, `${tag}-${String(++n).padStart(2, "0")}-${name}.png`);
  await page.screenshot({ path: file });
  console.log("saved", path.relative(root, file));
};
const st = () => page.evaluate(() => window.__hh.state());
const until = (fn, arg, timeout = 40000) => page.waitForFunction(fn, arg, { timeout });
const hook = (name, ...args) => page.evaluate(([f, a]) => window.__hh[f](...a), [name, args]);

await page.goto(`${base}?e2e=1&seed=4&intro=0`);
await page.waitForTimeout(1500);
await shot("title");
await page.getByTestId("start").click();
await until(() => window.__hh.state().phase === "explore");
await page.waitForTimeout(500);
await shot("chapter1-hud");
// Shadow's fourth find: the last answer of the game.
await hook("jump", 7, 3);
await page.waitForTimeout(400);
await hook("teleport", 4, 5.4, 1);
await until(() => window.__hh.state().clueShown);
await until(() => window.__hh.state().phase === "explore");
await page.waitForTimeout(600);
await shot("chapter2-hud");
const s = await st();
console.log("last clue:", s.clue.text);
await hook("setMic", false);
await hook("goTo", s.clue.objectId);
await page.waitForTimeout(400);
await page.keyboard.press("KeyE");
await until(() => window.__hh.state().phase === "search");
await hook("select", s.clue.spotId);
await page.keyboard.press("KeyE");
await until(() => window.__hh.state().phase === "answer");
await page.waitForTimeout(700);
await shot("last-find");
await page.getByTestId(`word-${s.clue.prep}`).click();
await page.waitForTimeout(1500);
await shot("big-capture");
await until(() => window.__hh.state().phase === "outro");
await page.waitForTimeout(1600);
await shot("lantern-blaze");
await until(() => window.__hh.state().sunrise, null, 60000);
await page.waitForTimeout(1800);
await shot("sunrise");
await until(() => window.__hh.state().phase === "explore", null, 60000);
await page.waitForTimeout(1500);
await shot("exit-start");
// One tap anywhere walks the player out along the exit track.
await page.mouse.click(vw / 2, vh * 0.75);
await page.waitForTimeout(1200);
await shot("exit-walking");
await until(() => window.__hh.state().screen === "results" || window.__hh.state().player.x < -8, null, 30000);
await hook("teleport", -8.3, 0, 0);
await page.waitForTimeout(400);
await hook("teleport", -9.2, 0, 0);
await until(() => window.__hh.state().screen === "results", null, 30000);
await page.waitForTimeout(1500);
await shot("results");
console.log("stats:", JSON.stringify((await st()).stats));
console.log(logs.length ? logs.join("\n") : "no console errors");
await browser.close();
