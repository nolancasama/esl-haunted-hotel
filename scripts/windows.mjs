// Screenshots of the real windows: each window type from inside (close and from the normal
// follow camera), and from the garden. Saves to .tmp/windows.
// Usage: node scripts/windows.mjs [baseUrl] [--gpu]   (needs a dev or preview server)
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const base = args.find((a) => !a.startsWith("--")) ?? "http://127.0.0.1:5199/";
const gpu = args.includes("--gpu");
const outDir = path.join(root, ".tmp", "windows");
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
let n = 0;
const shot = async (name) => {
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(outDir, `${String(++n).padStart(2, "0")}-${name}.png`) });
  console.log("shot", n, name);
};
const P = (x, y, z) => ({ x, y, z });
// [name, player x, z, floor, camera pos, camera target] (camera null = follow camera, facing yaw)
const views = [
  ["bedroom-close", -3, -8.2, 0, P(-1.6, 1.7, -7.4), P(-3, 1.55, -11)],
  ["bedroom-follow", -3, -8.4, 0, null, Math.PI],
  ["dining-oblique", 2.2, -8.4, 0, P(4.6, 2.2, -7.2), P(2.2, 1.5, -11)],
  ["library-close", -6.2, 6.2, 0, P(-4.6, 1.7, 7.6), P(-8, 1.55, 6.2)],
  ["garden-west-library", -4, 6, 0, P(-12.5, 2.1, 9.5), P(-8, 1.4, 6.2)],
  ["garden-north", -3, -8, 0, P(-1, 2.4, -16.5), P(-1, 1.3, -11)],
  ["playroom-close", -4.6, -8.4, 1, P(-3.2, 4.5, -7.4), P(-4.6, 4.35, -11)],
  ["playroom-follow", -4.6, -8.6, 1, null, Math.PI],
  ["landing-close", -6.4, 0, 1, P(-4.6, 4.5, 1.6), P(-8, 4.35, 0)],
  ["music-close", -3.4, 8.6, 1, P(-2, 4.5, 7.6), P(-3.4, 4.35, 11)],
  ["attic-round-close", 5.6, 8.8, 1, P(6.8, 4.5, 7.8), P(5.6, 4.42, 11)]
];

await page.goto(`${base}?e2e=1&seed=4&mode=story&intro=0`);
await page.waitForTimeout(2500);
await page.getByTestId("start").click();
await page.waitForFunction(() => window.__hh.state().phase === "explore", null, { timeout: 60000 });
await page.waitForTimeout(2500);
for (const [name, x, z, floor, cam, target] of views) {
  await hook("teleport", x, z, floor);
  if (cam) await hook("look", cam, target, true);
  else {
    await hook("look", null);
    await hook("setYaw", target);
  }
  await shot(name);
}
console.log("errors:", errors.length ? errors.join("\n") : "none");
await browser.close();
