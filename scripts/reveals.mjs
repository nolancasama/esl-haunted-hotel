// Screenshot every hiding spot's reveal (the view the student answers from).
// Usage: node scripts/reveals.mjs [baseUrl] [room]
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const base = process.argv[2] ?? "http://127.0.0.1:5199/";
const roomFilter = process.argv[3] ?? "";
const outDir = path.join(root, ".tmp", "reveals");
fs.mkdirSync(outDir, { recursive: true });
const stubsSrc = fs.readFileSync(path.join(root, "tests", "e2e", "stubs.ts"), "utf8");
const stubs = stubsSrc.slice(stubsSrc.indexOf("`") + 1, stubsSrc.lastIndexOf("`"));

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.addInitScript(stubs);
await page.goto(`${base}?e2e=1&seed=5${process.argv[4] ? "&" + process.argv[4] : ""}&mode=story`);
await page.waitForTimeout(1200);
await page.getByTestId("start").click();
await page.waitForFunction(() => window.__hh.state().phase === "explore", null, { timeout: 30000 });
// Buttons mode keeps this fast.
await page.evaluate(() => window.__hh.setMic?.(false));

const spots = await page.evaluate(() => window.__hh.allSpots());
for (const spot of spots.filter((s) => s.id.startsWith(roomFilter))) {
  await page.evaluate((id) => window.__hh.debugSetSpot(id), spot.id);
  await page.evaluate((id) => window.__hh.goTo(id), spot.objectId);
  await page.waitForTimeout(250);
  await page.keyboard.press("KeyE");
  await page.waitForFunction(() => window.__hh.state().phase === "search", null, { timeout: 10000 });
  await page.evaluate((id) => window.__hh.select(id), spot.id);
  await page.waitForTimeout(500);
  await page.keyboard.press("KeyE");
  await page.waitForFunction(() => window.__hh.state().phase === "answer", null, { timeout: 15000 });
  await page.waitForTimeout(1400);
  await page.screenshot({ path: path.join(outDir, `${spot.id}.png`) });
  console.log("saved", spot.id);
  await page.getByTestId(`word-${spot.prep}`).click();
  await page.waitForFunction(() => window.__hh.state().phase === "explore", null, { timeout: 30000 });
}
console.log(errors.length ? errors.join("\n") : "no page errors");
await browser.close();
