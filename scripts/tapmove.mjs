// Screenshots of tap-to-move driven by real clicks on the canvas: a floor tap in the lobby
// (destination ring, walking), a locked door, and a tap on furniture in another room
// (walks through the doorway and opens the search). Saves to .tmp/tapmove.
// Usage: node scripts/tapmove.mjs [baseUrl] [--gpu] [--touch]   (needs a dev or preview server)
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const base = args.find((a) => !a.startsWith("--")) ?? "http://127.0.0.1:5199/";
const gpu = args.includes("--gpu");
const touch = args.includes("--touch");
const outDir = path.join(root, ".tmp", "tapmove");
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
const stubsSrc = fs.readFileSync(path.join(root, "tests", "e2e", "stubs.ts"), "utf8");
const stubs = stubsSrc.slice(stubsSrc.indexOf("`") + 1, stubsSrc.lastIndexOf("`"));

const browser = await chromium.launch({
  args: gpu ? ["--ignore-gpu-blocklist", "--enable-gpu"] : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
});
const page = await browser.newPage({ viewport: { width: 1366, height: 768 }, hasTouch: touch });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.addInitScript(stubs);
let n = 0;
const st = () => page.evaluate(() => window.__hh.state());
const shot = async (name) => {
  const s = await st();
  await page.screenshot({ path: path.join(outDir, `${String(++n).padStart(2, "0")}-${name}.png`) });
  console.log("shot", n, name, `phase=${s.phase} x=${s.player.x.toFixed(2)} z=${s.player.z.toFixed(2)} toast=${s.lastToast ?? ""}`);
};
const hook = (name, ...a) => page.evaluate(([f, x]) => window.__hh[f](...x), [name, a]);
const tapWorld = async (x, y, z) => {
  const p = await hook("project", x, y, z);
  const tag = await page.evaluate(({ x: px, y: py }) => document.elementFromPoint(px, py)?.tagName, p);
  if (tag !== "CANVAS") throw new Error(`(${x}, ${z}) is under ${tag}, not the canvas`);
  if (touch) await page.touchscreen.tap(p.x, p.y);
  else await page.mouse.click(p.x, p.y);
};

await page.goto(`${base}?e2e=1&seed=4&mode=story&intro=0`);
await page.waitForTimeout(2500);
await page.getByTestId("start").click();
await page.waitForFunction(() => {
  const s = window.__hh.state();
  return s.phase === "explore" && !s.busy && !s.player.frozen;
}, null, { timeout: 60000 });
await page.waitForTimeout(2500);
await shot("start");

// 1. A floor tap in the lobby, with the ordinary follow camera.
await tapWorld(-3.0, 0, -1.8);
await page.waitForTimeout(300);
await shot("floor-tap-ring");
await page.waitForTimeout(900);
await shot("floor-walking");
await page.waitForFunction(() => !window.__hh.state().player.destination, null, { timeout: 30000 });
await page.waitForTimeout(200);
await shot("floor-arrived");

// 2. A locked door (dining), from a high view of the lobby.
const HIGH = [{ x: 0, y: 12, z: 6 }, { x: 0, y: 0, z: -2 }];
await hook("look", ...HIGH, true);
await page.waitForTimeout(1200);
await tapWorld(4, 1.1, -4);
await page.waitForTimeout(500);
await shot("locked-door");

// 3. Furniture in the bedroom, tapped from the lobby: walk through the doorway, search opens.
await hook("look", { x: -4, y: 12, z: 3 }, { x: -4, y: 0, z: -5 }, true);
await page.waitForTimeout(1200);
await tapWorld(-7.5, 0.45, -6.3);
await page.waitForTimeout(200);
await hook("look", null);
for (let i = 0; i < 6; i++) {
  await page.waitForTimeout(700);
  if ((await st()).phase !== "explore") break;
  await shot(`to-desk-${i}`);
}
await page.waitForFunction(() => window.__hh.state().phase === "search", null, { timeout: 40000 });
await page.waitForTimeout(1500);
await shot("desk-search-opened");
console.log("errors:", errors.length ? errors.join("\n") : "none");
await browser.close();
