// Spot checks: the entrance lock from inside and outside (with the door locked), and a
// window at sunrise. Saves to .tmp/checks.
// Usage: node scripts/checks.mjs [baseUrl] [--gpu]   (needs a dev or preview server)
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const base = args.find((a) => !a.startsWith("--")) ?? "http://127.0.0.1:5199/";
const gpu = args.includes("--gpu");
const outDir = path.join(root, ".tmp", "checks");
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
const hook = (name, ...a) => page.evaluate(([f, x]) => window.__hh[f](...x), [name, a]);
const until = (fn, timeout = 60000) => page.waitForFunction(fn, null, { timeout });
let n = 0;
const shot = async (name) => {
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(outDir, `${String(++n).padStart(2, "0")}-${name}.png`) });
  console.log("shot", n, name);
};
const P = (x, y, z) => ({ x, y, z });

await page.goto(`${base}?e2e=1&seed=4&mode=story&intro=0`);
await page.waitForTimeout(2500);
await page.getByTestId("start").click();
await until(() => window.__hh.state().phase === "explore");
await page.waitForTimeout(2000);
// The entrance is locked once the story starts.
await hook("teleport", -5.5, 1.5, 0);
await hook("look", P(-5.2, 1.7, 1.8), P(-8, 1.2, 0), true);
await shot("entrance-lock-inside");
await hook("look", P(-6.4, 1.4, 0.6), P(-8, 1.2, 0), true);
await shot("entrance-lock-inside-close");
await hook("look", P(-11.2, 1.7, 1.6), P(-8, 1.2, 0), true);
await shot("entrance-lock-outside");
// Other locked doors keep their icons (dining from the lobby).
await hook("look", P(3, 2.2, -1.2), P(4, 1.2, -4), true);
await shot("dining-lock");
await hook("look", null);

// The sunrise ending, then each window type from inside.
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
await page.waitForTimeout(5000);
// The ending puts the player downstairs, where the upper floor is not drawn: ground-floor windows only.
await hook("look", P(-1.6, 1.7, -7.4), P(-3, 1.55, -11), true);
await shot("dawn-bedroom-window");
console.log("errors:", errors.length ? errors.join("\n") : "none");
await browser.close();
