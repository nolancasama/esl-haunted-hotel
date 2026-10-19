// Representative UI frames, driven through the real game, UI and speech callbacks.
// Usage: node scripts/ui.mjs [baseUrl] [WxH] [--touch]
// With no viewport argument, capture all three classroom/landscape-phone sizes.
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const base = args.find((arg) => /^https?:/.test(arg)) ?? "http://127.0.0.1:5199/";
const requested = args.find((arg) => /^\d+x\d+$/.test(arg));
const viewports = requested
  ? [{ size: requested, touch: args.includes("--touch") }]
  : [{ size: "1366x768", touch: false }, { size: "1024x600", touch: false }, { size: "844x390", touch: true }];
const stubSource = fs.readFileSync(path.join(root, "tests/e2e/stubs.ts"), "utf8");
const stubs = stubSource.slice(stubSource.indexOf("`") + 1, stubSource.lastIndexOf("`"));
const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"]
});

async function captureViewport({ size, touch }) {
  const [width, height] = size.split("x").map(Number);
  const tag = `${size}${touch ? "-touch" : ""}`;
  const dir = path.join(root, ".tmp/ui", tag);
  fs.mkdirSync(dir, { recursive: true });
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  const measurements = [];
  let number = 0;
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.addInitScript(stubs);
  // Hold only the test recognizer's delivery, so the real listening/interim UI
  // remains visible without inventing a game or recognizer state.
  await page.addInitScript(() => {
    const Original = window.SpeechRecognition;
    class HeldRecognition extends Original {
      start() {
        if (!window.__uiHoldSpeech) { super.start(); return; }
        window.__speech.starts++;
        window.__uiHeldRecognition = this;
        const result = [{ transcript: "I think" }];
        result.isFinal = false;
        setTimeout(() => this.onresult?.({ resultIndex: 0, results: [result] }), 60);
      }
    }
    window.SpeechRecognition = window.webkitSpeechRecognition = HeldRecognition;
    window.__uiReleaseSpeech = (text) => {
      const recognition = window.__uiHeldRecognition;
      if (!recognition) throw new Error("No held recognition session");
      window.__uiHoldSpeech = false;
      const result = [{ transcript: text }];
      result.isFinal = true;
      recognition.onresult?.({ resultIndex: 0, results: [result] });
      recognition._finish();
      window.__uiHeldRecognition = null;
    };
  });
  const hook = (name, ...values) => page.evaluate(([key, params]) => window.__hh[key](...params), [name, values]);
  const state = () => hook("state");
  const until = async (description, fn, arg, timeout = 45000) => {
    try { await page.waitForFunction(fn, arg, { timeout }); }
    catch (error) { throw new Error(`HARNESS_PRECONDITION_FAILED [${tag}] ${description}: ${error.message}`); }
  };
  const phase = (expected) => until(`phase ${expected}`, (p) => window.__hh.state().phase === p, expected);
  const visible = async (testid) => {
    try { await page.getByTestId(testid).waitFor({ state: "visible", timeout: 45000 }); }
    catch (error) { throw new Error(`HARNESS_PRECONDITION_FAILED [${tag}] visible ${testid}: ${error.message}`); }
  };
  async function frameStillPresent(name, moment) {
    const present = await page.evaluate((label) => {
      const s = window.__hh.state();
      const el = (id) => document.querySelector(`[data-testid="${id}"]`);
      const shown = (id) => Boolean(el(id)?.getClientRects().length);
      const frozen = (selector) => document.querySelector(selector)?.getAnimations({ subtree: true }).some((a) => a.playState === "paused" && a.currentTime > 0);
      switch (label) {
        case "title-first-visit-locked": return s.screen === "title" && el("choice-ch2")?.disabled && el("choice-all")?.getAttribute("aria-checked") === "true";
        case "title-unlocked": return s.screen === "title" && !el("choice-ch2")?.disabled && shown("replay-mode");
        case "intro-boo-next-skip": return s.phase === "intro" && s.line?.wait && shown("next") && shown("skip");
        case "hint-bar": return shown("hint");
        case "explore-boo-speaking": return s.phase === "explore" && el("clue")?.classList.contains("speaking");
        case "touch-joystick-search": return shown("joystick") && shown("touch-search");
        case "search-empty-caption": return shown("caption") && el("caption")?.classList.contains("empty");
        case "answer-idle": return s.phase === "answer" && s.answer.status === "idle" && shown("answer-panel");
        case "answer-listening-interim": return s.phase === "answer" && s.answer.listening && s.answer.heard === "I think" && shown("answer-panel");
        case "answer-wrong": return s.phase === "answer" && s.answer.status === "wrong" && shown("answer-panel");
        case "answer-correct-sparkle": return s.answer.status === "correct" && shown("answer-panel") && frozen(".answer-panel.correct") && Boolean(document.querySelector(".answer-sparkles i"));
        case "capture-counter-flash": return s.lantern.length === 1 && frozen(".counter-portrait.capture-flash");
        case "answer-buttons-used-word": return s.phase === "answer" && s.answer.buttons && s.answer.disabled.length > 0 && shown("answer-panel");
        case "settings": return s.settingsOpen && shown("settings-close");
        case "chapter-two-card": return s.chapterCard === "CHAPTER 2" && shown("chapter-card");
        case "upstairs-eight-ghost-counter": return s.player.floor === 1 && el("counter")?.textContent.includes("/8");
        case "results-four-ghosts": return s.screen === "results" && s.captured.length === 4;
        case "results-eight-ghosts": return s.screen === "results" && s.captured.length === 8;
        default: return false;
      }
    }, name);
    if (!present) throw new Error(`HARNESS_PRECONDITION_FAILED [${tag}] ${name} no longer represents its required state ${moment}`);
  }
  async function shot(name) {
    await frameStillPresent(name, "before screenshot");
    const file = `${String(++number).padStart(2, "0")}-${name}.png`;
    measurements.push(await page.evaluate((label) => {
      const testids = ["counter", "clue", "settings", "answer-panel", "hint", "subtitle", "joystick", "touch-search", "settings-close", "start", "play-again", "main-menu"];
      const boxes = {};
      const clipped = [];
      for (const id of testids) {
        const el = document.querySelector(`[data-testid="${id}"]`);
        if (!el || !el.getClientRects().length) continue;
        const r = el.getBoundingClientRect();
        boxes[id] = { x: r.x, y: r.y, width: r.width, height: r.height };
        if (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1) clipped.push(id);
      }
      const overlap = (a, b) => a && b && Math.min(a.x + a.width, b.x + b.width) > Math.max(a.x, b.x) + 1 && Math.min(a.y + a.height, b.y + b.height) > Math.max(a.y, b.y) + 1;
      const overlaps = [["counter", "clue"], ["clue", "settings"], ["joystick", "hint"], ["touch-search", "hint"], ["joystick", "subtitle"], ["touch-search", "subtitle"], ["answer-panel", "hint"]]
        .filter(([a, b]) => overlap(boxes[a], boxes[b]));
      const internal = (selector) => {
        const node = document.querySelector(selector);
        if (!node || !node.getClientRects().length) return null;
        return { clientWidth: node.clientWidth, scrollWidth: node.scrollWidth, clientHeight: node.clientHeight, scrollHeight: node.scrollHeight, overflowX: node.scrollWidth > node.clientWidth + 1, overflowY: node.scrollHeight > node.clientHeight + 1 };
      };
      return {
        frame: label, boxes, clipped, overlaps,
        internalOverflow: { title: internal(".title-card"), words: internal(".words"), wordTiles: [...document.querySelectorAll(".word")].map((node) => ({ word: node.dataset.testid, clientWidth: node.clientWidth, scrollWidth: node.scrollWidth })) },
        documentOverflow: { x: document.documentElement.scrollWidth > innerWidth, y: document.documentElement.scrollHeight > innerHeight }
      };
    }, name));
    await page.screenshot({ path: path.join(dir, file) });
    await frameStillPresent(name, "after screenshot");
    console.log("saved", path.relative(root, path.join(dir, file)));
  }
  async function open(query) {
    await page.goto(`${base.replace(/\/$/, "")}/?e2e=1&fast=1&seed=4${query}`);
    await visible("start");
    await until("E2E hook installed", () => Boolean(window.__hh));
    await page.waitForTimeout(450); // Let the title's short entrance animation settle.
  }
  async function settled() {
    await until("finished answer/capture", () => {
      const s = window.__hh.state();
      return s.screen === "results" || s.phase === "intro" || ((s.phase === "explore" || s.phase === "outro") && !s.busy);
    });
  }
  async function findCurrent() {
    await phase("explore");
    let s = await state();
    await hook("goTo", s.clue.objectId);
    await until("current clue visible and object in reach", (id) => {
      const s = window.__hh.state();
      return s.phase === "explore" && s.clueShown && s.focusId === id;
    }, s.clue.objectId);
    // A room introduction may be finishing while the clue is already visible.
    await until("director ready for search", () => !window.__hh.state().busy);
    s = await state();
    await page.keyboard.press("KeyE");
    await phase("search");
    await hook("select", s.clue.spotId);
    await page.keyboard.press("KeyE");
    await phase("answer");
    return s.clue;
  }
  async function answerCurrent() {
    const clue = await findCurrent();
    await page.getByTestId(`word-${clue.prep}`).click();
    await settled();
  }
  async function finishResults() {
    await until("ending exit track", () => window.__hh.state().exitActive, null, 90000);
    await hook("teleport", -8.3, 0, 0);
    await hook("teleport", -9.2, 0, 0);
    await until("results screen", () => window.__hh.state().screen === "results");
    await visible("play-again");
    await page.waitForTimeout(350);
  }
  // Freeze CSS at a representative point, leaving all game timers and state real.
  async function armAnimationFrame(selector) {
    await page.evaluate((target) => {
      window.__uiAnimationFrozen = false;
      const deadline = performance.now() + 15000;
      const freeze = () => {
        const el = document.querySelector(target);
        if (el) {
          const animations = el.getAnimations({ subtree: true });
          if (animations.length) {
            animations.forEach((animation) => { animation.pause(); animation.currentTime = 230; });
            window.__uiAnimationFrozen = true;
            return;
          }
        }
        if (performance.now() < deadline) requestAnimationFrame(freeze);
      };
      requestAnimationFrame(freeze);
    }, selector);
  }

  try {
    await open("");
    await until("Chapter 2 locked on first visit", () => document.querySelector('[data-testid="choice-ch2"]').disabled);
    await shot("title-first-visit-locked");
    await page.evaluate(() => {
      localStorage.setItem("hh.ch2.v1", "1");
      localStorage.setItem("hh.replay.v1", "1");
      localStorage.setItem("hh.menu.v1", JSON.stringify({ choice: "all", random: false }));
    });
    await open("");
    await until("Chapter 2 and replay unlocked", () => !document.querySelector('[data-testid="choice-ch2"]').disabled && Boolean(document.querySelector('[data-testid="replay-mode"]')));
    await shot("title-unlocked");
    await page.getByTestId("choice-ch1").click();
    await page.evaluate(() => { window.__ttsMs = 60000; });
    await page.getByTestId("start").click();
    await visible("next");
    await visible("skip");
    await shot("intro-boo-next-skip");
    await page.evaluate(() => { window.__ttsMs = 120; });
    await page.getByTestId("skip").click();
    await phase("explore");
    await visible("hint");
    await shot("hint-bar");
    // Replay holds the actual clueSpeaking flag long enough to film its ring.
    let s = await state();
    await hook("goTo", s.clue.objectId);
    await visible("clue");
    await until("Boo's initial clue finished", () => !document.querySelector('[data-testid="clue"]').classList.contains("speaking"));
    await page.evaluate(() => { window.__ttsMs = 60000; });
    await page.getByTestId("replay").click();
    await until("Boo speaking clue", () => document.querySelector('[data-testid="clue"]')?.classList.contains("speaking"));
    await shot("explore-boo-speaking");
    await until("focused searchable furniture", (id) => window.__hh.state().focusId === id, s.clue.objectId);
    if (touch) {
      await visible("joystick");
      await visible("touch-search");
      await shot("touch-joystick-search");
    }
    await page.evaluate(() => { window.__ttsMs = 120; window.speechSynthesis.cancel(); });
    await until("Boo replay complete", () => !document.querySelector('[data-testid="clue"]').classList.contains("speaking"));
    await page.keyboard.press("KeyE");
    await phase("search");
    await page.waitForTimeout(700);
    const spots = await hook("spotsOf", s.clue.objectId);
    const wrongSpot = spots.find((spot) => spot.id !== s.clue.spotId);
    await hook("setPace", 4);
    await hook("select", wrongSpot.id);
    await page.keyboard.press("KeyE");
    await visible("caption");
    await shot("search-empty-caption");
    await hook("setPace", 1);
    await phase("search");
    s = await state();
    await hook("select", s.clue.spotId);
    await page.keyboard.press("KeyE");
    await phase("answer");
    await page.waitForTimeout(300);
    await shot("answer-idle");
    const wrongPrep = ["in", "on", "under", "by"].find((prep) => prep !== s.clue.prep);
    await page.evaluate(() => { window.__uiHoldSpeech = true; });
    await page.getByTestId("mic").click();
    await until("listening with interim words", () => { const a = window.__hh.state().answer; return a.listening && a.heard === "I think"; });
    await shot("answer-listening-interim");
    await page.evaluate((prep) => window.__uiReleaseSpeech(`it's ${prep} the bed`), wrongPrep);
    await until("wrong spoken answer", () => window.__hh.state().answer.status === "wrong");
    await shot("answer-wrong");
    await armAnimationFrame(".answer-panel.correct");
    await page.evaluate((prep) => { window.__speech.say = `it's ${prep} the bed`; window.__ttsMs = 60000; }, s.clue.prep);
    await page.getByTestId("mic").click();
    await until("correct answer sparkle", () => window.__hh.state().answer.status === "correct" && window.__uiAnimationFrozen);
    await shot("answer-correct-sparkle");
    await armAnimationFrame(".counter-portrait.capture-flash");
    await page.evaluate(() => window.speechSynthesis.cancel());
    await until("first ghost captured with counter flash", () => window.__hh.state().lantern.length === 1 && window.__uiAnimationFrozen);
    await shot("capture-counter-flash");
    await page.evaluate(() => { document.getAnimations().forEach((animation) => { if (animation.playState === "paused") animation.play(); }); window.__ttsMs = 50; window.speechSynthesis.cancel(); });
    await settled();
    await hook("setPace", 0.25);
    await hook("setMic", false);
    const buttonsClue = await findCurrent();
    const used = ["in", "on", "under", "by"].find((prep) => prep !== buttonsClue.prep);
    await page.getByTestId(`word-${used}`).click();
    await until("used word in button mode", (prep) => window.__hh.state().answer.disabled.includes(prep), used);
    await shot("answer-buttons-used-word");
    await page.getByTestId("settings").click();
    await visible("settings-close");
    await shot("settings");
    await page.getByTestId("settings-close").click();
    await page.getByTestId(`word-${buttonsClue.prep}`).click();
    await settled();
    // Complete the real remaining answers so the four-ghost gallery has sentences.
    for (let guard = 0; guard < 12; guard++) {
      s = await state();
      if (s.phase === "outro" || s.screen === "results") break;
      await answerCurrent();
    }
    await finishResults();
    await shot("results-four-ghosts");

    // A second adventure exercises all eight names/answer sentences, the chapter
    // banner and the two-row counter without altering any store state directly.
    await open("&intro=0");
    await page.getByTestId("choice-all").click();
    await page.getByTestId("start").click();
    await phase("explore");
    await hook("setMic", false);
    await hook("setPace", 0.15);
    await page.evaluate(() => { window.__ttsMs = 30; });
    let chapterShot = false;
    for (let guard = 0; guard < 24; guard++) {
      s = await state();
      if (s.phase === "outro" || s.screen === "results") break;
      if (s.phase === "intro") {
        // SwiftShader can spend longer than 2.8 s inside screenshot(); extend
        // the real banner timer before Skip creates it, then resume fast play.
        await hook("setPace", 4);
        await visible("skip");
        await page.getByTestId("skip").click();
        await until("Chapter 2 banner", () => window.__hh.state().chapterCard === "CHAPTER 2");
        await page.waitForTimeout(180);
        await shot("chapter-two-card");
        await hook("setPace", 0.15);
        await phase("explore");
        await hook("teleport", -4, -4.8, 1);
        await visible("clue");
        await until("eight-ghost counter upstairs", () => window.__hh.state().player.floor === 1 && document.querySelector('[data-testid="counter"]').textContent.includes("/8"));
        await page.waitForTimeout(300);
        await shot("upstairs-eight-ghost-counter");
        chapterShot = true;
        await hook("setPace", 0.15);
      }
      await answerCurrent();
    }
    if (!chapterShot) throw new Error(`HARNESS_PRECONDITION_FAILED [${tag}] Chapter 2 transition never reached`);
    await finishResults();
    await shot("results-eight-ghosts");
    const final = await state();
    console.log(`[${tag}] ${number} frames; real answers=${final.stats.correctAnswers}; console errors=${errors.length}`);
  } finally {
    fs.writeFileSync(path.join(dir, "measurements.json"), JSON.stringify({ viewport: tag, frames: measurements, errors }, null, 2));
    await context.close();
  }
  if (errors.length) throw new Error(`[${tag}] browser errors: ${errors.join("; ")}`);
}

try {
  for (const viewport of viewports) await captureViewport(viewport);
  console.log("UI screenshots and measurements: .tmp/ui/");
} finally {
  await browser.close();
}
