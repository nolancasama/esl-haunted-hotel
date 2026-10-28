import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { MatchState } from "../../src/game/hideSeek/types";
import type { HidingSpot } from "../../src/game/world/world";
import { hook, setSpeech, state, waitPhase } from "./helpers";
import { BROWSER_STUBS } from "./stubs";

type Snapshot = MatchState & {
  phase: string;
  englishOpen: boolean;
  spots: HidingSpot[];
  reachable: HidingSpot[];
  targets: HidingSpot[];
  decision: { phase: "decision" | "destination"; secondsLeft: number; searchNumber: number } | null;
};
const snapshot = (page: Page) => hook<Snapshot | null>(page, "hs");
const command = (page: Page, name: string, ...args: unknown[]) => hook<{ ok: boolean; reason?: string }>(page, "hsCommand", name, ...args);
const scale = (page: Page, value: number) => hook(page, "hsTimeScale", value);

async function until(page: Page, description: string, predicate: (s: Snapshot) => boolean, timeout = 60_000) {
  await expect.poll(async () => {
    const s = await snapshot(page);
    return Boolean(s && predicate(s));
  }, { timeout, message: `HARNESS_PRECONDITION_FAILED: ${description}` }).toBe(true);
}

async function open(page: Page, query = "&ghost=shadow&room=dining&seed=4", mic = false, japanese = false) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.addInitScript(BROWSER_STUBS);
  await page.addInitScript((settings) => {
    localStorage.setItem("hh.settings.v1", JSON.stringify({ ...settings, englishLevel: "standard" }));
  }, { mic, japanese });
  await page.goto(`/?e2e=1&fast=1&mode=hideseek${query}`);
  await expect(page.getByTestId("hideseek")).toBeVisible({ timeout: 60_000 });
  await page.waitForFunction(() => Boolean((window as unknown as { __hh?: { hs?: unknown } }).__hh?.hs));
  await scale(page, 0);
  return errors;
}

async function chooseStart(page: Page, spotId = "dining.table.under") {
  await until(page, "match setup", (s) => s.status === "setup" && s.reachable.some((spot) => spot.id === spotId));
  await page.getByTestId(`hs-spot-${spotId}`).click();
  await until(page, "starting English question", (s) => s.english?.spotId === spotId);
}

async function answerTiles(page: Page) {
  const s = await snapshot(page);
  expect(s?.english, "HARNESS_PRECONDITION_FAILED: English panel is closed").toBeTruthy();
  const spot = s!.spots.find((item) => item.id === s!.english!.spotId);
  expect(spot, "HARNESS_PRECONDITION_FAILED: panel spot missing").toBeTruthy();
  await page.getByTestId(`hs-word-${spot!.prep}`).click();
  await until(page, "accepted tile answer", (next) => !next.english && next.status === "playing");
}


/** The English card should follow the selected ghost, not stay stuck at the viewport edge. */
async function expectQuestionBesideGhost(page: Page) {
  await expect.poll(async () => page.evaluate(() => {
    const api = (window as unknown as { __hh: {
      hs(): Snapshot;
      project(x: number, y: number, z: number): { x: number; y: number } | null;
      hsCamera(): { mode: string; settled: boolean };
    } }).__hh;
    const match = api.hs();
    const spot = match?.spots.find((item) => item.id === match.english?.spotId);
    const card = document.querySelector<HTMLElement>("[data-testid='hs-english']");
    const stage = document.querySelector<HTMLElement>("[data-testid='hs-question-stage']");
    if (!spot || !card || !stage || !api.hsCamera().settled) return false;
    const bounds = [-0.68 * Math.max(spot.scale[0], spot.scale[2]) - 0.07,
      0.68 * Math.max(spot.scale[0], spot.scale[2]) + 0.07];
    const extents = [];
    for (const y of [0.05, Math.max(0.95 * spot.scale[1], 0.85)])
      for (const dx of bounds) for (const dz of bounds) {
        const p = api.project(spot.pos.x + dx, spot.pos.y + y, spot.pos.z + dz);
        if (!p) return false;
        extents.push(p.x);
      }
    const ghost = api.project(spot.pos.x, spot.pos.y + Math.max(0.19, 0.45 * spot.scale[1]), spot.pos.z);
    if (!ghost) return false;
    const panel = card.getBoundingClientRect();
    const side = stage.dataset.side;
    const silhouetteLeft = Math.min(...extents), silhouetteRight = Math.max(...extents);
    const gap = side === "left" ? silhouetteLeft - panel.right : panel.left - silhouetteRight;
    return Boolean((side === "left" || side === "right") &&
      gap >= 15 && gap <= 31 &&
      ghost.y >= panel.top - 20 && ghost.y <= panel.bottom + 20 &&
      panel.left >= 7 && panel.right <= innerWidth - 7 &&
      panel.top >= 7 && panel.bottom <= innerHeight - 7);
  }), { timeout: 15_000, message: "English panel must clear the full ghost outline" }).toBe(true);
}

test("initial and relocation questions show the selected ghost in a close-up without committing movement", async ({ page }) => {
  await open(page);
  await chooseStart(page);
  const start = (await snapshot(page))!;
  await expect(page.getByTestId("hs-question-stage")).toBeVisible();
  await expect.poll(async () => (await hook<{ mode: string }>(page, "hsCamera")).mode).toBe("answerCloseup");
  await expectQuestionBesideGhost(page);
  expect(start.status).toBe("setup");
  expect(start.ghost.spotId).toBeNull();
  await answerTiles(page);
  await until(page, "initial answer accepted", (s) => s.status === "playing");
  await page.getByTestId("hs-move").click();
  await until(page, "destination picker", (s) => s.decision?.phase === "destination");
  const s = (await snapshot(page))!;
  const timeLeftBeforeSelection = s.decision!.secondsLeft;
  const destination = s.reachable.find((spot) => spot.id !== s.ghost.spotId);
  expect(destination).toBeDefined();
  await page.getByTestId(`hs-spot-${destination!.id}`).click();
  await until(page, "relocation English", (s) => s.english?.spotId === destination!.id);
  await expect.poll(async () => (await hook<{ mode: string; spotId: string | null }>(page, "hsCamera")).mode).toBe("answerCloseup");
  await expectQuestionBesideGhost(page);
  const question = (await snapshot(page))!;
  expect(question.ghost.spotId).toBe(s.ghost.spotId);
  expect(question.stats.relocations).toBe(s.stats.relocations);
  await expect(page.getByTestId("hs-cancel-answer")).toHaveText("Back");
  await page.getByTestId("hs-cancel-answer").click();
  await until(page, "returned to destination picker", (snap) => !snap.english && snap.decision?.phase === "destination");
  const returned = (await snapshot(page))!;
  expect(returned.decision?.secondsLeft).toBeCloseTo(timeLeftBeforeSelection);
  expect(returned.stats.relocations).toBe(s.stats.relocations);
  await expect(page.getByTestId("hs-question-stage")).toHaveCount(0);
});

test("Back on the first English question returns to initial spot selection", async ({ page }) => {
  await open(page);
  await chooseStart(page);
  await expect(page.getByTestId("hs-cancel-answer")).toHaveText("Back");
  await page.getByTestId("hs-cancel-answer").click();
  await until(page, "initial picker restored", (s) => s.status === "setup" && !s.english);
  await expect(page.getByTestId("hs-picker")).toBeVisible();
  await expect(page.getByTestId("hs-question-stage")).toHaveCount(0);
});

test("formal decision pauses the detective, then opens a ten-second relocation picker", async ({ page }) => {
  const errors = await open(page);
  await chooseStart(page);
  await answerTiles(page);
  const before = (await snapshot(page))!;
  await expect(page.getByTestId("hs-decision-overlay")).toBeVisible();
  await expect(page.getByTestId("hs-decision-overlay")).toHaveAttribute("data-phase", "decision");
  await expect(page.getByTestId("hs-decision-time")).toHaveText("5");
  expect(before.decision).toMatchObject({ phase: "decision", secondsLeft: 5, searchNumber: 1 });
  await scale(page, 1);
  await expect.poll(async () => (await snapshot(page))?.decision?.secondsLeft ?? 0).toBeLessThan(4);
  await scale(page, 0);
  const paused = (await snapshot(page))!;
  expect(paused.time).toBe(before.time);
  expect(paused.detective.x).toBe(before.detective.x);
  expect(paused.detective.z).toBe(before.detective.z);
  expect(paused.detective.suspicion).toBe(before.detective.suspicion);
  await page.getByTestId("hs-move").click();
  await expect(page.getByTestId("hs-decision-overlay")).toHaveAttribute("data-phase", "destination");
  await expect(page.getByTestId("hs-decision-time")).toHaveText("10");
  await page.getByTestId("hs-spot-dining.window.by").click();
  await until(page, "relocation English opens without a timer", (s) => s.english?.spotId === "dining.window.by" && !s.decision);
  expect((await snapshot(page))!.relocationsLeft).toBe(2);
  await page.getByTestId("hs-word-by").click();
  await until(page, "English accepted and move spent", (s) => !s.english && s.relocationsLeft === 1);
  expect(errors).toEqual([]);
});

test("ten-second destination timeout defaults to Stay without using a relocation", async ({ page }) => {
  const errors = await open(page);
  await chooseStart(page);
  await answerTiles(page);
  await page.getByTestId("hs-move").click();
  await expect(page.getByTestId("hs-stay-here")).toBeVisible();
  await scale(page, 30);
  await until(page, "timed selection expired and detective resumed", (s) => s.time > 0 && s.relocationsLeft === 2 && s.decision?.phase !== "destination", 30_000);
  await scale(page, 0);
  const current = (await snapshot(page))!;
  expect(current.stats.relocations).toBe(0);
  expect(errors).toEqual([]);
});

test("all eight ghosts and rooms are selectable; button English retries without advancing the match", async ({ page }) => {
  const errors = await open(page, "");
  for (const id of ["sleepy", "hungry", "sneaky", "mischief", "bouncy", "bubbles", "melody", "shadow"]) {
    await expect(page.getByTestId(`hs-ghost-${id}`)).toBeEnabled();
  }
  await page.getByTestId("hs-ghost-hungry").click();
  for (const room of ["bedroom", "dining", "storage", "library", "playroom", "bathroom", "music", "attic"]) {
    await expect(page.getByTestId(`hs-room-${room}`)).toBeEnabled();
  }
  await page.getByTestId("hs-room-dining").click();
  await chooseStart(page);
  await expect(page.getByTestId("hs-mic")).toHaveCount(0);
  await expect(page.getByTestId("hs-english")).not.toContainText("I'm under the table.");
  await expect(page.getByTestId("hs-english")).not.toContainText("I’m under the table.");
  await page.getByTestId("hs-word-on").click();
  await until(page, "wrong answer stays open", (s) => s.english?.attempts === 1);
  expect((await snapshot(page))!.time).toBe(0);
  await answerTiles(page);
  expect((await snapshot(page))!.stats).toMatchObject({ wrongAnswers: 1, firstTryAccuracy: 0 });
  expect(errors).toEqual([]);
});

test("speech accepts I am under the table and English freezes detective pose, time and suspicion", async ({ page }) => {
  const errors = await open(page, undefined, true);
  await chooseStart(page);
  await setSpeech(page, { say: "I am under the table" });
  await page.getByTestId("hs-mic").click();
  await until(page, "spoken starting answer accepted", (s) => s.status === "playing" && !s.english);
  const initial = (await snapshot(page))!;
  await scale(page, 1);
  await until(page, "detective really walked", (s) => Math.hypot(s.detective.x - initial.detective.x, s.detective.z - initial.detective.z) > 0.1);
  await scale(page, 0);
  const current = (await snapshot(page))!;
  const destination = current.reachable.find((spot) => spot.id !== current.detective.target);
  expect(destination, "HARNESS_PRECONDITION_FAILED: no safe English destination").toBeTruthy();
  expect(await command(page, "requestMove", destination!.id)).toEqual({ ok: true });
  expect(await command(page, "beginEnglish")).toEqual({ ok: true });
  await until(page, "relocation English open", (s) => Boolean(s.english));
  const frozen = (await snapshot(page))!;
  await scale(page, 50);
  // Count real renderer opportunities, rather than sleeping and hoping a frame ran.
  await page.evaluate(() => new Promise<void>((resolve) => {
    let frames = 0;
    const next = () => { if (++frames === 4) resolve(); else requestAnimationFrame(next); };
    requestAnimationFrame(next);
  }));
  const after = (await snapshot(page))!;
  expect({ time: after.time, detective: after.detective, suspicion: after.detective.suspicion }).toEqual({ time: frozen.time, detective: frozen.detective, suspicion: frozen.detective.suspicion });
  await scale(page, 0);
  expect(errors).toEqual([]);
});

for (const outcome of [{ seed: 4, status: "won", title: "Escaped!" }, { seed: 5, status: "lost", title: "Found!" }] as const) {
  test(`staying reaches ${outcome.title}; results navigation restores the menu`, async ({ page }) => {
    const errors = await open(page, `&ghost=shadow&room=dining&seed=${outcome.seed}`);
    await chooseStart(page);
    await answerTiles(page);
    await expect(page.getByTestId("hs-stay")).toBeEnabled();
    await page.getByTestId("hs-stay").click();
    await scale(page, 30);
    await until(page, `${outcome.status} result from seeded stay scenario`, (s) => s.status === outcome.status, 90_000);
    await expect(page.getByText(outcome.title, { exact: true })).toBeVisible();
    if (outcome.status === "won") {
      expect((await snapshot(page))!.stats.completedSearches).toBe(5);
      await page.getByTestId("hs-play-again").click();
      await scale(page, 0);
      await until(page, "Play Again creates same ghost and room with a new seed", (s) => s.status === "setup" && s.config.seed !== outcome.seed && s.config.ghost === "shadow" && s.config.room === "dining");
      await chooseStart(page);
      await answerTiles(page);
      // Restore the known real match through the session command, never mutate state.
      expect(await command(page, "start", "shadow", "dining", 5, "standard")).toMatchObject({ ok: true });
      await chooseStart(page);
      await answerTiles(page);
      await scale(page, 30);
      await until(page, "second match reaches results", (s) => s.status === "lost", 90_000);
      await page.getByTestId("hs-choose-ghost").click();
      await expect(page.getByTestId("hs-ghost-sleepy")).toBeVisible();
      await page.getByTestId("hideseek-back").click();
    } else {
      await page.getByTestId("hs-menu").click();
    }
    await expect(page.getByTestId("start")).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test("two real relocations spend the budget and a third is rejected", async ({ page }) => {
  const errors = await open(page);
  await chooseStart(page);
  await answerTiles(page);
  await page.getByTestId("hs-ability").click();
  await until(page, "Shadow ability armed", (s) => s.abilityUsed && s.effects.nextMove === "invisible");
  await expect(page.getByTestId("hs-ability")).toBeDisabled();
  await page.getByTestId("hs-move").click();
  await page.getByTestId("hs-spot-dining.window.by").click();
  await answerTiles(page);
  expect((await snapshot(page))!.relocationsLeft).toBe(1);
  await expect(page.getByTestId("hs-relocations")).toHaveText("1/2");
  await scale(page, 1);
  await until(page, "first move completes and a search releases the next move", (s) => s.status === "playing" && !s.ghost.transit && !s.movedThisSearch && s.stats.completedSearches >= 1);
  await scale(page, 0);
  await page.getByTestId("hs-move").click();
  await page.getByTestId("hs-spot-dining.table.by").click();
  await answerTiles(page);
  expect((await snapshot(page))!.relocationsLeft).toBe(0);
  await expect(page.getByTestId("hs-relocations")).toHaveText("0/2");
  await expect(page.getByTestId("hs-toast")).toContainText("No moves left");
  await scale(page, 1);
  await until(page, "second relocation arrives", (s) => s.status === "playing" && !s.ghost.transit);
  await scale(page, 0);
  expect((await snapshot(page))!.stats.relocations).toBe(2);
  expect(await command(page, "requestMove", "dining.table.under")).toEqual({ ok: false, reason: "no-relocations" });
  expect(errors).toEqual([]);
});

test("Hungry targets a spot without English and its ability can be used only once", async ({ page }) => {
  const errors = await open(page, "&ghost=hungry&room=dining&seed=4");
  await chooseStart(page);
  await answerTiles(page);
  await page.getByTestId("hs-ability").click();
  await page.getByTestId("hs-spot-dining.basket.in").click();
  await until(page, "Hungry ability consumed", (s) => s.abilityUsed);
  await expect(page.getByTestId("hs-ability")).toBeDisabled();
  expect((await snapshot(page))!.english).toBeNull();
  expect((await snapshot(page))!.relocationsLeft).toBe(2);
  expect(await command(page, "useAbility", "dining.table.under")).toEqual({ ok: false, reason: "ability-used" });
  expect(errors).toEqual([]);
});

test("every room boots a playable match without browser errors", async ({ page }) => {
  test.setTimeout(300_000);
  const errors = await open(page);
  for (const room of ["bedroom", "dining", "storage", "library", "playroom", "bathroom", "music", "attic"]) {
    expect(await command(page, "start", "sleepy", room, 4, "standard")).toMatchObject({ ok: true });
    await scale(page, 0);
    await until(page, `${room} setup`, (s) => s.config.room === room && s.status === "setup" && s.reachable.length >= 11);
    const first = (await snapshot(page))!.reachable[0];
    await chooseStart(page, first.id);
    await answerTiles(page);
    expect((await snapshot(page))!.config.room).toBe(room);
    await expect(page.locator("canvas")).toBeVisible();
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  }
  expect(errors).toEqual([]);
});

for (const [width, height, touch] of [[1366, 768, false], [1024, 600, false], [844, 390, true]] as const) {
  test(`responsive English and live scene remain clear at ${width}x${height}${touch ? " touch" : ""}`, async ({ browser }, testInfo) => {
    test.setTimeout(180_000);
    const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL, viewport: { width, height }, hasTouch: touch, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const dir = path.join(process.cwd(), ".tmp", "hideseek", `${width}x${height}`);
    const measurements: unknown[] = [];
    await mkdir(dir, { recursive: true });
    try {
      const errors = await open(page, undefined, false, true);
      await chooseStart(page);
      const initial = (await snapshot(page))!;
      const settleCamera = () => page.evaluate(() => new Promise<void>((resolve, reject) => {
        const api = (window as unknown as { __hh: { hs(): Snapshot; project(x: number, y: number, z: number): { x: number; y: number } | null } }).__hh;
        const started = performance.now();
        let previous: { x: number; y: number }[] | null = null;
        let stable = 0;
        const frame = () => {
          const s = api.hs();
          const preview = s.english ? s.spots.find((spot) => spot.id === s.english!.spotId)?.pos : null;
          const ghost = preview ?? s.ghost;
          const points = [api.project(ghost.x, ghost.y + 0.3, ghost.z), api.project(s.detective.x, 0.8, s.detective.z)];
          if (points.every((point) => point !== null)) {
            const next = points as { x: number; y: number }[];
            stable = previous && next.every((point, i) => Math.hypot(point.x - previous![i].x, point.y - previous![i].y) < 0.35) ? stable + 1 : 0;
            previous = next;
            if (stable >= 3) { resolve(); return; }
          }
          if (performance.now() - started > 60_000) { reject(new Error("HARNESS_PRECONDITION_FAILED: camera projections never settled")); return; }
          requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      }));
      const measure = (english: boolean) => page.evaluate((needsEnglish) => {
        const api = (window as unknown as { __hh: { hs(): Snapshot; project(x: number, y: number, z: number): { x: number; y: number } | null } }).__hh;
        const s = api.hs();
        const box = (selector: string) => {
          const node = document.querySelector(selector);
          if (!node?.getClientRects().length) return null;
          const r = node.getBoundingClientRect();
          return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
        };
        const hud = box('[data-testid="hs-hud"]');
        const panel = box('[data-testid="hs-english"]');
        const dock = box('[data-testid="hs-dock"]');
        const ability = box('[data-testid="hs-ability-dock"]');
        const subtitle = box('[data-testid="hs-subtitle"]');
        const gear = box('[data-testid="hs-settings"]');
        const preview = s.english ? s.spots.find((spot) => spot.id === s.english!.spotId)?.pos : null;
        const ghost = preview ?? s.ghost;
        const actors = { ghost: api.project(ghost.x, ghost.y + 0.3, ghost.z), detective: api.project(s.detective.x, 0.8, s.detective.z) };
        type Box = NonNullable<typeof hud>;
        const within = (r: Box) => r.x >= -1 && r.y >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1;
        const hits = (a: Box | null, b: Box | null) => Boolean(a && b && Math.min(a.right, b.right) > Math.max(a.x, b.x) + 1 && Math.min(a.bottom, b.bottom) > Math.max(a.y, b.y) + 1);
        const pieces = { hud, dock, ability, subtitle, gear };
        const overlaps = Object.entries(pieces).flatMap(([a, ra], i) => Object.entries(pieces).slice(i + 1).filter(([, rb]) => hits(ra, rb)).map(([b]) => `${a}/${b}`));
        const overlap = overlaps.length > 0;
        const covered = (p: { x: number; y: number }) => Object.values(pieces).some((r) => r && p.x > r.x - 8 && p.x < r.right + 8 && p.y > r.y - 8 && p.y < r.bottom + 8);
        const actorsClear = (needsEnglish ? [actors.ghost] : Object.values(actors)).every((p) => p && p.x > 8 && p.x < innerWidth - 8 && p.y > 8 && p.y < innerHeight - 8 && !covered(p));
        // The old full-height rail is gone; the room is framed beside the dock only while it is open.
        const rail = document.querySelector(".hs-rail") !== null;
        return { english: needsEnglish, status: s.status, phase: s.detective.phase, hud, panel, dock, ability, subtitle, gear, rail, actors, overlaps, overlap, actorsClear, hudWithin: Boolean(hud && within(hud)), panelWithin: Boolean(!needsEnglish || panel && within(panel)) };
      }, english);

      await settleCamera();
      const english = await measure(true);
      expect(english.hud, "the progress HUD hides during the close-up question").toBeNull();
      expect(english.panel, "HARNESS_PRECONDITION_FAILED: English panel missing").not.toBeNull();
      expect(english.panelWithin).toBe(true);
      await expect(page.getByTestId("hs-question-stage")).toBeVisible();
      await expect.poll(async () => (await hook<{ mode: string; settled: boolean }>(page, "hsCamera")).mode).toBe("answerCloseup");
      expect(english.overlaps).toEqual([]);
      expect(english.rail).toBe(false);
      expect(english.actorsClear).toBe(true);
      await until(page, "English screenshot still has the starting question", (s) => Boolean(s.english) && s.time === initial.time);
      await page.screenshot({ path: path.join(dir, "validation-english.png"), timeout: 60_000 });
      measurements.push(english);

      await answerTiles(page);
      const beforeWalk = (await snapshot(page))!;
      await scale(page, 0.6);
      // Freeze in the same browser task that observes movement: a separate RPC
      // can arrive after a short approach has already become an inspection.
      await page.waitForFunction((before) => {
        const api = (window as unknown as { __hh: { hs(): Snapshot; hsTimeScale(scale: number): void } }).__hh;
        const s = api.hs();
        if (s.status !== "playing" || !["approach", "search"].includes(s.detective.phase) || Math.hypot(s.detective.x - before.x, s.detective.z - before.z) <= 0.1) return false;
        api.hsTimeScale(0);
        return true;
      }, { x: beforeWalk.detective.x, z: beforeWalk.detective.z }, { timeout: 60_000 }).catch(() => {
        throw new Error("HARNESS_PRECONDITION_FAILED: detective did not move before responsive match screenshot");
      });
      const frozen = (await snapshot(page))!;
      await settleCamera();
      const match = await measure(false);
      expect(match.phase, "HARNESS_PRECONDITION_FAILED: live match changed after the clock froze").toBe(frozen.detective.phase);
      expect(match.hudWithin).toBe(true);
      expect(match.overlaps).toEqual([]);
      expect(match.dock, "the left dock closes once English is answered").toBeNull();
      expect(match.ability, "the ability sits in the lower right during play").not.toBeNull();
      expect(match.ability!.right).toBeGreaterThan(width - 40);
      expect(match.hud!.y).toBeLessThan(20);
      expect(Math.abs((match.hud!.x + match.hud!.right) / 2 - width / 2)).toBeLessThan(2);
      expect(match.actorsClear).toBe(true);
      await page.screenshot({ path: path.join(dir, "validation-match.png"), timeout: 60_000 });
      measurements.push(match);
      expect(errors).toEqual([]);
    } finally {
      await writeFile(path.join(dir, "validation-measurements.json"), JSON.stringify({ width, height, touch, frames: measurements }, null, 2));
      await context.close();
    }
  });
}

test("a real canvas marker selects a spot, and story keyboard movement resumes after Main Menu", async ({ page }) => {
  test.setTimeout(180_000);
  const errors = await open(page);
  await until(page, "canvas marker starts reachable", (s) => s.status === "setup" && s.reachable.some((spot) => spot.id === "dining.window.by"));
  const spot = (await snapshot(page))!.reachable.find((item) => item.id === "dining.window.by")!;
  const marker = { x: spot.marker.x, y: spot.marker.y + 0.12, z: spot.marker.z };
  const projected = await page.evaluate((point) => new Promise<{ x: number; y: number }>((resolve, reject) => {
    const api = (window as unknown as { __hh: { project(x: number, y: number, z: number): { x: number; y: number } | null } }).__hh;
    let previous: { x: number; y: number } | null = null;
    let stable = 0;
    const started = performance.now();
    const frame = () => {
      const next = api.project(point.x, point.y, point.z);
      if (next) {
        stable = previous && Math.hypot(next.x - previous.x, next.y - previous.y) < 0.35 ? stable + 1 : 0;
        previous = next;
        if (stable >= 3) { resolve(next); return; }
      }
      if (performance.now() - started > 60_000) { reject(new Error("HARNESS_PRECONDITION_FAILED: marker camera never settled")); return; }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }), marker);
  expect(await page.evaluate(({ x, y }) => x > 0 && x < innerWidth && y > 0 && y < innerHeight && document.elementFromPoint(x, y)?.tagName === "CANVAS", projected), "HARNESS_PRECONDITION_FAILED: projected marker is covered or outside the canvas").toBe(true);
  await page.mouse.click(projected.x, projected.y);
  await until(page, "real canvas marker opened the selected English question", (s) => s.english?.spotId === spot.id);
  await answerTiles(page);
  // Main Menu lives in Settings during a match.
  await page.getByTestId("hs-settings").click();
  await page.getByTestId("hs-main-menu").click();
  await expect(page.getByTestId("start")).toBeVisible();
  expect(await snapshot(page)).toBeNull();
  await page.getByTestId("start").click();
  await expect(page.getByTestId("choice-all"), "HARNESS_PRECONDITION_FAILED: same-page stage list did not reopen").toBeVisible();
  await page.evaluate(() => { (window as unknown as { __ttsMs: number }).__ttsMs = 2000; });
  await page.getByTestId("choice-all").click();
  await expect(page.getByTestId("skip"), "HARNESS_PRECONDITION_FAILED: restored story intro did not start").toBeVisible({ timeout: 60_000 });
  await page.getByTestId("skip").click();
  await waitPhase(page, "explore", 60_000);
  await page.waitForFunction(() => {
    const s = (window as unknown as { __hh: { state(): { screen: string; phase: string; busy: boolean } } }).__hh.state();
    return s.screen === "game" && s.phase === "explore" && !s.busy;
  }, undefined, { timeout: 60_000 });
  await hook(page, "teleport", -4, 0, 0);
  const before = await state(page);
  expect(before.mode, "HARNESS_PRECONDITION_FAILED: All Levels did not restore story mode").toBe("story");
  await page.keyboard.down("KeyD");
  try {
    await expect.poll(async () => {
      const current = await state(page);
      return Math.hypot(current.player.x - before.player.x, current.player.z - before.player.z);
    }, { timeout: 30_000, message: "story keyboard movement should resume after Hide & Seek" }).toBeGreaterThan(0.15);
  } finally {
    await page.keyboard.up("KeyD");
  }
  expect(errors).toEqual([]);
});
