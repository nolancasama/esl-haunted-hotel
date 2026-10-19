// Close-ups of every hinged door, closed, from both sides (plus the bedroom door open and
// the entrance from the porch), to check the leaves meet their frames. Saves to .tmp/doors.
// Usage: node scripts/doors.mjs [baseUrl] [--out=dir] [--gpu]   (needs a dev or preview server)
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const base = args.find((a) => !a.startsWith("--")) ?? "http://127.0.0.1:5199/";
const gpu = args.includes("--gpu");
const outDir = path.join(root, ".tmp", args.find((a) => a.startsWith("--out="))?.slice(6) ?? "doors");
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
const stubsSrc = fs.readFileSync(path.join(root, "tests", "e2e", "stubs.ts"), "utf8");
const stubs = stubsSrc.slice(stubsSrc.indexOf("`") + 1, stubsSrc.lastIndexOf("`"));

const browser = await chromium.launch({
  args: gpu ? ["--ignore-gpu-blocklist", "--enable-gpu"] : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
});
const page = await browser.newPage({ viewport: { width: 1024, height: 600 } });
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

// [id, floor, axis, at, from, to, side of the room (+1/-1 along the door's normal)]
const doors = [
  ["bedroom", 0, "x", -4, -4.8, -3.2, -1],
  ["dining", 0, "x", -4, 3.2, 4.8, -1],
  ["library", 0, "x", 4, -4.8, -3.2, 1],
  ["storage", 0, "x", 4, 3.2, 4.8, 1],
  ["entrance", 0, "z", -8, -1.1, 1.1, 1],
  ["playroom", 1, "x", -4, -4.8, -3.2, -1],
  ["bathroom", 1, "x", -4, 3.2, 4.8, -1],
  ["music", 1, "x", 4, -4.8, -3.2, 1],
  ["attic", 1, "x", 4, 3.4, 4.6, 1]
];
// A point `d` metres off the door's middle on side `s`, shifted `t` along it.
const at = ([, , axis, a, from, to], s, d, t, y) => {
  const c = (from + to) / 2 + t;
  return axis === "x" ? P(c, y, a + s * d) : P(a + s * d, y, c);
};

await page.goto(`${base}?e2e=1&seed=4&mode=story&intro=0`);
await page.waitForTimeout(2500);
await page.getByTestId("start").click();
await page.waitForFunction(() => window.__hh.state().phase === "explore", null, { timeout: 60000 });
await page.waitForTimeout(1500);
// Close the bedroom door the story opened; park the beacon at the stairs.
await hook("beaconSetup", "bedroom", false);
await hook("beaconSetup", "stairs", false);
await page.waitForTimeout(1500);

for (const door of doors) {
  const [id, floor, , , , , side] = door;
  const y = floor ? 2.8 : 0;
  for (const [label, s] of [
    ["hall", -side],
    ["room", side]
  ]) {
    const p = at(door, s, 1.6, 1.8, 0);
    await hook("teleport", door[2] === "x" ? p.x : p.x, door[2] === "x" ? p.z : p.z, floor);
    await hook("look", at(door, s, 2.3, 0.9, y + 1.45), at(door, 0, 0, 0, y + 1.85), true);
    await shot(`${id}-${label}`);
  }
}

// Swing check: the bedroom door opening and fully open, from the lobby and from inside.
await hook("beaconSetup", "bedroom", true);
await page.waitForTimeout(400);
await hook("teleport", -2.2, -2.2, 0);
await hook("look", P(-2.6, 1.8, -1.2), P(-4, 1.6, -4.4), true);
await shot("bedroom-opening");
await page.waitForTimeout(1200);
await shot("bedroom-open-hall");
await hook("teleport", -2.4, -6, 0);
await hook("look", P(-2.4, 1.7, -6.6), P(-4, 1.5, -4), true);
await shot("bedroom-open-room");
// The entrance from the porch, with the follow camera's height.
await hook("teleport", -9.6, 1.6, 0);
await hook("look", P(-11, 2.4, 1.2), P(-8, 1.8, 0), true);
await shot("entrance-porch");

console.log("errors:", errors.length ? errors.join("\n") : "none");
await browser.close();
