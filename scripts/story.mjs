// Plays the whole story in Chromium and saves screenshots to .tmp/story.
// Usage: node scripts/story.mjs [baseUrl] [extra query]
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const base = process.argv[2] ?? "http://127.0.0.1:5199/";
const extra = process.argv[3] ?? "";
const outDir = path.join(root, ".tmp", "story");
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
const stubsSrc = fs.readFileSync(path.join(root, "tests", "e2e", "stubs.ts"), "utf8");
const stubs = stubsSrc.slice(stubsSrc.indexOf("`") + 1, stubsSrc.lastIndexOf("`"));

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.addInitScript(stubs);
await page.addInitScript(() => {
  window.__keyLog = [];
  const log = (t) => (e) => {
    window.__keyLog.push(`${t}:${e.code}:${window.__hh?.state().phase}:${document.activeElement?.tagName}`);
    if (window.__keyLog.length > 12) window.__keyLog.shift();
  };
  window.addEventListener("keydown", log("down"), true);
  window.addEventListener("keyup", log("up"), true);
});
await page.goto(`${base}?e2e=1&seed=4${extra}`);
await page.waitForTimeout(1500);

let n = 0;
const shot = async (name) => {
  await page.screenshot({ path: path.join(outDir, `${String(++n).padStart(2, "0")}-${name}.png`) });
  console.log("shot", n, name);
};
const st = () => page.evaluate(() => window.__hh.state());
const until = async (fn, arg, timeout = 30000) => {
  try {
    await page.waitForFunction(fn, arg, { timeout });
  } catch (e) {
    console.log("TIMEOUT waiting for", fn.toString().slice(0, 120));
    console.log("state:", JSON.stringify(await st()).slice(0, 900));
    console.log(errors.join("\n"));
    await shot("timeout");
    throw e;
  }
};
const phase = (p) => until((x) => [].concat(x).includes(window.__hh.state().phase), p);

// Long stub voice during the intro so each line waits for "next".
await page.evaluate(() => (window.__ttsMs = 20000));
await page.getByTestId("start").click();
await until(() => window.__hh.state().phase === "intro");
await page.waitForTimeout(1700);
await shot("intro-arrive");
await page.waitForTimeout(2600);
await shot("intro-slam");
// Photograph each story line as it comes, then advance it (lines also advance by themselves).
const seenLines = new Set();
while ((await st()).phase === "intro") {
  const s = await st();
  if (s.line?.wait && !seenLines.has(s.line.en)) {
    seenLines.add(s.line.en);
    await page.waitForTimeout(500);
    await shot(`intro-line-${seenLines.size}`);
    if (seenLines.size === 3) await page.evaluate(() => (window.__ttsMs = 150));
    await page.keyboard.press("Space");
  }
  await page.waitForTimeout(150);
}
console.log("intro lines:", [...seenLines].join(" | "));
await page.evaluate(() => (window.__ttsMs = 150));
await phase("explore");
await page.waitForTimeout(1200);
await shot("lobby-beacon");

const ROOM_ENTRY = { bedroom: [-4, -4.9], dining: [4, -4.9], storage: [4, 4.9], library: [-4, 4.9] };
const ROOM_OF = { sleepy: "bedroom", hungry: "dining", sneaky: "storage", mischief: "library" };

for (let ghost = 0; ghost < 4; ghost++) {
  let s = await st();
  const room = ROOM_OF[s.ghost];
  // step in through the open door (controls are camera-relative, so place the player directly)
  const [ex, ez] = ROOM_ENTRY[room];
  await page.evaluate(([x, z]) => window.__hh.teleport(x, z > 0 ? z - 1.2 : z + 1.2), [ex, ez]);
  await page.waitForTimeout(500);
  await page.evaluate(([x, z]) => window.__hh.teleport(x, z), [ex, ez]);
  await until(() => window.__hh.state().clueShown === true);
  await page.waitForTimeout(1600);
  await shot(`${room}-clue`);
  const rounds = s.ghost === "mischief" ? 4 : 1;
  for (let r = 0; r < rounds; r++) {
    await until(() => window.__hh.state().phase === "explore" && window.__hh.state().clueShown);
    s = await st();
    await page.evaluate((id) => window.__hh.goTo(id), s.clue.objectId);
    await page.waitForTimeout(300);
    const before = await st();
    await page.keyboard.press("KeyE");
    await page.waitForTimeout(300);
    const after = await st();
    if (after.phase !== "search") {
      console.log("E did not open the close-up:", JSON.stringify({ before: [before.phase, before.focusId, before.busy, before.line], after: [after.phase, after.focusId, after.busy], key: await page.evaluate(() => window.__keyLog) }));
    }
    await phase("search");
    await page.evaluate((id) => window.__hh.select(id), s.clue.spotId);
    await page.waitForTimeout(1200);
    if (r === 0) await shot(`${room}-search`);
    await page.keyboard.press("KeyE");
    await phase("answer");
    await page.waitForTimeout(1300);
    await shot(`${room}-found-${s.clue.prep}`);
    await page.evaluate((say) => (window.__speech.say = say), `it's ${s.clue.prep} the ${s.clue.noun}`);
    await page.keyboard.press("Space");
    await until(() => window.__hh.state().answer.status === "correct");
    if (r === rounds - 1) {
      await page.waitForTimeout(1500);
      await shot(`${room}-capture`);
    }
    await until(() => ["explore", "outro"].includes(window.__hh.state().phase) && !window.__hh.state().busy, null, 40000);
  }
  await page.waitForTimeout(900);
  if (ghost < 3) await shot(`after-${room}`);
}

// The ending: photograph Boo's lines, then the sunrise.
await until(() => window.__hh.state().phase === "outro" || window.__hh.state().sunrise);
await page.evaluate(() => (window.__ttsMs = 20000));
const outroLines = new Set();
while (!(await st()).sunrise) {
  const s = await st();
  if (s.line?.wait && !outroLines.has(s.line.en)) {
    outroLines.add(s.line.en);
    await page.waitForTimeout(500);
    await shot(`outro-line-${outroLines.size}`);
    await page.keyboard.press("Space");
  }
  await page.waitForTimeout(150);
}
await page.evaluate(() => (window.__ttsMs = 150));
console.log("outro lines:", [...outroLines].join(" | "));
await page.waitForTimeout(3500);
await shot("outro-sunrise");
await until(() => window.__hh.state().phase === "explore");
await page.waitForTimeout(800);
await shot("outro-walk");
await page.keyboard.down("KeyA");
await page.waitForTimeout(1800);
await page.keyboard.up("KeyA");
await until(() => window.__hh.state().screen === "results");
await page.waitForTimeout(1500);
await shot("results");
console.log(JSON.stringify((await st()).stats));
console.log(errors.length ? errors.join("\n") : "no page errors");
await browser.close();
