// Films the opening cutscene (walk in, door slam, startled hop and turn, Boo) as a
// sequence of screenshots in .tmp/intro, in slow motion so every pose is caught.
// Usage: node scripts/intro.mjs [baseUrl] [--speed=0.3] [--gpu] [--every=350] [--size=1366x768]
// Needs a dev server (npm run dev -- --port 5199) or a preview server.
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const opt = (name, def) => args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? def;
const base = args.find((a) => !a.startsWith("--")) ?? "http://127.0.0.1:5199/";
const speed = Number(opt("speed", "0.3"));
const every = Number(opt("every", "350"));
const [w, h] = opt("size", "1366x768").split("x").map(Number);
const gpu = args.includes("--gpu");
const outDir = path.join(root, ".tmp", "intro");
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
const stubsSrc = fs.readFileSync(path.join(root, "tests", "e2e", "stubs.ts"), "utf8");
const stubs = stubsSrc.slice(stubsSrc.indexOf("`") + 1, stubsSrc.lastIndexOf("`"));

const browser = await chromium.launch({
  args: gpu ? ["--ignore-gpu-blocklist", "--enable-gpu"] : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
});
const page = await browser.newPage({ viewport: { width: w, height: h } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.addInitScript(stubs);
await page.goto(`${base}?e2e=1&seed=4&mode=story`);
await page.waitForTimeout(1500);
await page.evaluate(() => (window.__ttsMs = 4000));
await page.getByTestId("start").click();
await page.waitForFunction(() => window.__hh?.state().phase === "intro");
await page.evaluate((s) => window.__hh.timeScale(s), speed);

let n = 0;
let slamAt = null;
const t0 = Date.now();
while (Date.now() - t0 < 120000) {
  const s = await page.evaluate(() => {
    const st = window.__hh.state();
    return { phase: st.phase, time: st.time, p: st.player, line: st.line?.en ?? null };
  });
  if (s.phase !== "intro") break;
  if (s.p.startle && slamAt === null) slamAt = s.time;
  const since = slamAt === null ? "" : ` +${(s.time - slamAt).toFixed(2)}s`;
  const name = `${String(++n).padStart(3, "0")}`;
  await page.screenshot({ path: path.join(outDir, `${name}.png`) });
  console.log(
    name,
    `t=${s.time.toFixed(2)}${since}`,
    `x=${s.p.x.toFixed(2)} z=${s.p.z.toFixed(2)} yaw=${s.p.yaw.toFixed(2)} o=${s.p.opacity.toFixed(2)}`,
    s.p.startle ? "STARTLE" : "",
    s.line ?? ""
  );
  if (s.line) break; // Boo is talking: the part we film is over
  await page.waitForTimeout(every);
}
console.log("frames:", n, "errors:", errors.length ? errors.join("\n") : "none");
await browser.close();
