// Reproducible construction close-ups. Run against unchanged HEAD first:
// node scripts/polish.mjs --before --gpu; then node scripts/polish.mjs --gpu
// Omit --gpu for SwiftShader. Requires the Vite dev server on port 5199.
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { transformWithOxc } from "vite";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const base = args.find((a) => !a.startsWith("--")) ?? "http://127.0.0.1:5199/";
const out = path.join(root, ".tmp", args.includes("--before") ? "polish-before" : "polish");
fs.mkdirSync(out, { recursive: true });
const src = fs.readFileSync(path.join(root, "tests/e2e/stubs.ts"), "utf8");
const browser = await chromium.launch({ args: args.includes("--gpu") ? ["--ignore-gpu-blocklist", "--enable-gpu"] : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.addInitScript(src.slice(src.indexOf("`") + 1, src.lastIndexOf("`")));
// Optional baseline recaptures use HEAD model source in the browser only.
// This avoids changing the working tree when improving a camera after edits.
if (args.includes("--head-models")) {
  if (!args.includes("--before")) throw new Error("--head-models requires --before");
  await page.route(/\/src\/scene\/models\/[a-z]+\.ts(?:\?.*)?$/, async (route) => {
    const filename = new URL(route.request().url()).pathname;
    const response = await route.fetch();
    const live = await response.text();
    const three = live.match(/from\s+["']([^"']*\/three\.js[^"']*)["']/)?.[1] ?? "/node_modules/.vite/deps/three.js";
    const source = execFileSync("git", ["show", `HEAD:${filename.slice(1)}`], { cwd: root, encoding: "utf8" });
    const result = await transformWithOxc(source, filename);
    const code = result.code.replace(/from\s+(["'])([^"']+)\1/g, (match, quote, specifier) => {
      const url = specifier === "three" ? three : specifier.startsWith(".")
        ? path.posix.normalize(path.posix.join(path.posix.dirname(filename), specifier)) + ".ts" : specifier;
      return `from ${quote}${url}${quote}`;
    });
    await route.fulfill({ status: 200, contentType: "application/javascript", body: code });
  });
}
const hook = (name, ...a) => page.evaluate(([n, p]) => window.__hh[n](...p), [name, a]);
try {
  await page.goto(`${base}?e2e=1&seed=4&mode=story&intro=0`);
  await page.getByTestId("start").click();
  await page.waitForFunction(() => window.__hh?.state().phase === "explore", null, { timeout: 60000 });
  const objects = await page.evaluate(async () => {
    const { WORLD } = await import("/src/game/world/world.ts");
    const ids = ["library.clock", "attic.clock", "library.bookshelf", "playroom.table", "playroom.teddy", "music.gramophone", "music.table"];
    return WORLD.objects.filter(o => ids.includes(o.id) || ["box", "crate", "trunk", "boxstack", "luggage"].includes(o.kind)
      || ["bed", "desk", "piano", "bathtub", "sink"].includes(o.kind))
      .map(o => ({ id: o.id, x: o.x, z: o.z, y: o.y, rot: o.rot, h: o.spec.h, w: o.spec.w, d: o.spec.d, floor: o.floor }));
  });
  let floor = null;
  const only = args.find(a => a.startsWith("--only="))?.slice(7);
  const selected = only ? objects.filter(o => o.id === only) : objects;
  for (const o of selected) {
    if (floor !== o.floor) {
      await hook("jump", o.floor ? 4 : 3);
      await page.waitForTimeout(2000);
      floor = o.floor;
    }
    // Keep the player out of the furniture shot, in the same room and floor.
    await hook("teleport", o.x < 0 ? -4 : 4, o.z < -4 ? -5 : o.z > 4 ? 5.4 : 0, o.floor);
    await page.waitForFunction(() => {
      const s = window.__hh.state();
      return s.phase === "explore" && !s.busy && !s.player.frozen;
    }, null, { timeout: 60000 });
    await page.waitForTimeout(600);
    const a = o.rot * Math.PI / 180;
    const transform = (x, y, z) => ({ x: o.x + x * Math.cos(a) + z * Math.sin(a), y: o.y + y, z: o.z - x * Math.sin(a) + z * Math.cos(a) });
    const size = Math.max(o.w, o.d, o.h, 0.8);
    // The cupboard north of this trunk blocks a camera from its left side.
    const obliqueSide = o.id === "storage.trunk" ? 0.85 : -0.85;
    for (const [name, side, rise] of [["close", 0.5, 0.4], ["oblique", obliqueSide, 0.85]]) {
      await hook("look", transform(side * size, o.h * 0.55 + rise * size, size * 1.6), transform(0, o.h * 0.5, 0), true);
      await page.waitForTimeout(450);
      const file = `${o.id.replaceAll(".", "-")}-${name}.png`;
      await page.screenshot({ path: path.join(out, file) });
      console.log(file);
    }
  }
  if (errors.length) throw new Error(errors.join("\n"));
  for (const name of ["polish-before", "polish"]) {
    const directory = path.join(root, ".tmp", name);
    if (fs.existsSync(directory)) fs.writeFileSync(path.join(directory, "files.txt"),
      fs.readdirSync(directory).filter(file => file.endsWith(".png")).sort().join("\n") + "\n");
  }
  console.log(`Saved ${selected.length * 2} screenshots to ${out}; browser errors: none`);
} finally {
  await browser.close();
}
