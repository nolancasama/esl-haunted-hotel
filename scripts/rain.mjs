// Screenshots of the outdoor rain: the intro walk-in, a fixed exterior shot at night, and the
// same shot through the sunrise ending (the rain should thin out and stop). Saves to .tmp/rain.
// Usage: node scripts/rain.mjs [baseUrl] [--gpu]   (needs a dev or preview server)
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const base = args.find((a) => !a.startsWith("--")) ?? "http://127.0.0.1:5199/";
const gpu = args.includes("--gpu");
const outDir = path.join(root, ".tmp", "rain");
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
const stubsSrc = fs.readFileSync(path.join(root, "tests", "e2e", "stubs.ts"), "utf8");
const stubs = stubsSrc.slice(stubsSrc.indexOf("`") + 1, stubsSrc.lastIndexOf("`"));

const browser = await chromium.launch({
  args: gpu ? ["--ignore-gpu-blocklist", "--enable-gpu"] : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
});
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.addInitScript(stubs);
let n = 0;
const shot = async (name) => {
  await page.screenshot({ path: path.join(outDir, `${String(++n).padStart(2, "0")}-${name}.png`) });
  console.log("shot", n, name);
};
const until = (fn, arg, timeout = 60000) => page.waitForFunction(fn, arg, { timeout });
const hook = (name, ...a) => page.evaluate(([f, x]) => window.__hh[f](...x), [name, a]);
// Outside on the path, looking back at the porch, the lamps and the entrance.
const EXTERIOR = [{ x: -17.5, y: 2.2, z: 1.2 }, { x: -9.4, y: 1.3, z: 0 }];
const PORCH = [{ x: -12.2, y: 1.5, z: -2.6 }, { x: -9.2, y: 0.9, z: 0.4 }];

// 1. The intro: the player arrives from the rain.
await page.goto(`${base}?e2e=1&seed=4&mode=story`);
await page.waitForTimeout(1500);
await page.evaluate(() => (window.__ttsMs = 4000));
await page.getByTestId("start").click();
await until(() => window.__hh.state().phase === "intro");
await hook("timeScale", 0.3);
await page.waitForTimeout(1200);
await shot("intro-walk-in");
await hook("look", ...EXTERIOR, true);
await page.waitForTimeout(900);
await shot("intro-exterior");
await hook("look", ...PORCH, true);
await page.waitForTimeout(900);
await shot("intro-porch");
await hook("look", null);
await hook("timeScale", 1);

// 2. The ending: the same exterior shot as the sun comes up.
await page.goto(`${base}?e2e=1&seed=4&intro=0&mode=story`);
await page.waitForTimeout(1500);
await page.getByTestId("start").click();
await until(() => window.__hh.state().phase === "explore");
await hook("look", ...EXTERIOR, true);
await page.waitForTimeout(900);
await shot("night-exterior");
await hook("look", null);
await hook("jump", 7, 3);
await page.waitForTimeout(400);
await hook("teleport", 4, 5.4, 1);
await until(() => window.__hh.state().clueShown);
await until(() => window.__hh.state().phase === "explore");
const s = await page.evaluate(() => window.__hh.state());
await hook("setMic", false);
await hook("goTo", s.clue.objectId);
await page.waitForTimeout(400);
await page.keyboard.press("KeyE");
await until(() => window.__hh.state().phase === "search");
await hook("select", s.clue.spotId);
await page.keyboard.press("KeyE");
await until(() => window.__hh.state().phase === "answer");
await page.getByTestId(`word-${s.clue.prep}`).click();
await until(() => window.__hh.state().sunrise);
// The ending's own camera keeps moving; hold the exterior shot to compare like with like.
for (const [i, wait] of [0, 900, 1800, 4000].entries()) {
  await page.waitForTimeout(wait - (i ? [0, 900, 1800, 4000][i - 1] : 0));
  await hook("look", ...EXTERIOR, true);
  await page.waitForTimeout(250);
  const t = await page.evaluate(() => window.__hh.state().time);
  await shot(`sunrise-${i}-t${t.toFixed(1)}`);
}
console.log("errors:", errors.length ? errors.join("\n") : "none");
await browser.close();
