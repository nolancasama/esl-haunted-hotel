import { expect, test, type Page } from "@playwright/test";
import { boot, clickMarker, hook, state, waitPhase, type HhState } from "./helpers";

type Point = { x: number; z: number };
type Frame = Point & { y: number; floor: number; stairs: boolean; phase: string };
type TapState = Omit<HhState, "player"> & {
  player: Point & {
    y: number; floor: number; frozen: boolean; stepping: boolean; speed: number; pathLength: number;
    destination: (Point & { floor: number; objectId: string | null }) | null;
  };
  cameraYaw: number;
  settingsOpen: boolean;
  time: number;
  busy: boolean;
  lastToast: string | null;
};
type BrowserApi = { state(): TapState; camera(): { x: number; y: number; z: number } };
const tapState = (page: Page) => state(page) as Promise<TapState>;
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);

test.afterEach(async ({ page }, info) => {
  if (info.status === info.expectedStatus) return;
  await info.attach("movement-state", {
    body: JSON.stringify({ state: await tapState(page), frames: await hook(page, "stopTrace") }),
    contentType: "application/json"
  });
});

// The project hook only finds pixels. All movement below starts with real canvas pointer events.
async function clickWorld(page: Page, x: number, y: number, z: number, touch = false) {
  const p = await hook<{ x: number; y: number }>(page, "project", x, y, z);
  expect(p.x).toBeGreaterThan(5);
  expect(p.x).toBeLessThan(1361);
  expect(p.y).toBeGreaterThan(5);
  expect(p.y).toBeLessThan(763);
  expect(await page.evaluate(({ x: px, y: py }) => document.elementFromPoint(px, py)?.tagName, p)).toBe("CANVAS");
  if (touch) {
    // The desktop project has no emulated touchscreen; dispatch actual touch PointerEvents to its canvas.
    await page.locator("canvas").dispatchEvent("pointerdown", { pointerType: "touch", pointerId: 7, isPrimary: true, clientX: p.x, clientY: p.y, button: 0, buttons: 1 });
    await page.locator("canvas").dispatchEvent("pointerup", { pointerType: "touch", pointerId: 7, isPrimary: true, clientX: p.x, clientY: p.y, button: 0, buttons: 0 });
    await page.locator("canvas").dispatchEvent("click", { pointerType: "touch", pointerId: 7, clientX: p.x, clientY: p.y, button: 0 });
  } else await page.mouse.click(p.x, p.y);
}

async function ready(page: Page, encounter = 0) {
  const errors = await boot(page, "&mode=story&intro=0");
  await page.getByTestId("start").click();
  await waitPhase(page, "explore");
  if (encounter) await hook(page, "jump", encounter);
  await page.waitForFunction(() => {
    const s = (window as unknown as { __hh: BrowserApi }).__hh.state();
    return s.phase === "explore" && !s.busy && !s.player.frozen;
  });
  return errors;
}

/** A fixed high shot makes the chosen floor/furniture visible without changing movement. */
async function shot(page: Page, x: number, z: number, floor = 0, height = 15) {
  const pos = { x, y: floor * 2.8 + height, z: z + 6 };
  await hook(page, "look", pos, { x, y: floor * 2.8 + 0.1, z }, true);
  await page.waitForFunction((want) => {
    const c = (window as unknown as { __hh: BrowserApi }).__hh.camera();
    return Math.hypot(c.x - want.x, c.y - want.y, c.z - want.z) < 0.05;
  }, pos);
}

async function arrive(page: Page, x: number, z: number, floor = 0, timeout = 90_000) {
  await page.waitForFunction(({ x: px, z: pz, floor: f }) => {
    const s = (window as unknown as { __hh: BrowserApi }).__hh.state();
    return s.player.floor === f && !s.player.destination && Math.hypot(s.player.x - px, s.player.z - pz) < 0.42;
  }, { x, z, floor }, { timeout });
}

async function frames(page: Page) {
  const trace = await hook<Frame[]>(page, "stopTrace");
  expect(trace.length).toBeGreaterThan(5);
  let moved = 0;
  for (let i = 1; i < trace.length; i++) {
    const step = Math.hypot(trace[i].x - trace[i - 1].x, trace[i].z - trace[i - 1].z);
    expect(step, `frame ${i} must walk continuously`).toBeLessThan(0.4);
    expect(Math.abs(trace[i].y - trace[i - 1].y), `frame ${i} must climb continuously`).toBeLessThan(0.4);
    if (step > 0.002) moved++;
  }
  expect(moved).toBeGreaterThan(4);
  return trace;
}

test("empty floor mouse/touch taps walk continuously and a new tap replaces the destination", async ({ page }, testInfo) => {
  const errors = await ready(page);
  await hook(page, "teleport", -5.8, -1.5, 0);
  await shot(page, -3.5, -1.5);
  await hook(page, "startTrace");
  await clickWorld(page, 2, 0.015, -1.5);
  await page.waitForFunction(() => {
    const s = (window as unknown as { __hh: BrowserApi }).__hh.state();
    return s.player.destination !== null && s.player.x > -5.2 && s.player.x < -2.5;
  });
  const walking = await tapState(page);
  expect(walking.player.destination).not.toBeNull();
  expect(walking.player.destination!.x).toBeCloseTo(2, 0);
  await clickWorld(page, -4.6, 0.015, 1, true);
  await page.waitForFunction(() => {
    const d = (window as unknown as { __hh: BrowserApi }).__hh.state().player.destination;
    return d !== null && Math.hypot(d.x + 4.6, d.z - 1) < 0.35;
  });
  await page.screenshot({ path: testInfo.outputPath("destination-ring.png") });
  await arrive(page, -4.6, 1);
  const trace = await frames(page);
  expect(trace.some((f) => f.z > 0.6)).toBe(true);
  expect(errors).toEqual([]);
});

test("one far furniture tap walks through its doorway and opens search automatically", async ({ page }) => {
  const errors = await ready(page);
  await hook(page, "teleport", -4, -1.8, 0);
  await shot(page, -4.5, -5.7, 0, 19);
  const bed = await hook<{ x: number; y: number; z: number }>(page, "objectInfo", "bedroom.bed");
  await hook(page, "startTrace");
  await clickWorld(page, bed.x, bed.y, bed.z);
  await waitPhase(page, "search", 120_000);
  const s = await tapState(page);
  expect(s.searchId).toBe("bedroom.bed");
  expect(s.player.destination).toBeNull();
  const trace = await frames(page);
  expect(trace.some((f) => Math.abs(f.z + 4) < 0.4 && Math.abs(f.x + 4) < 0.65)).toBe(true);
  expect(errors).toEqual([]);
});

test("a floor destination across dining furniture walks around its footprint", async ({ page }) => {
  const errors = await ready(page, 1);
  await hook(page, "teleport", 1.7, -7.6, 0);
  await shot(page, 4, -7.6);
  const table = await hook<{ rect: { x0: number; x1: number; z0: number; z1: number } }>(page, "objectInfo", "dining.table");
  await hook(page, "startTrace");
  await clickWorld(page, 6.1, 0.015, -7.6);
  await arrive(page, 6.1, -7.6);
  const trace = await frames(page);
  for (const f of trace) expect(f.x > table.rect.x0 && f.x < table.rect.x1 && f.z > table.rect.z0 && f.z < table.rect.z1).toBe(false);
  expect(trace.some((f) => Math.abs(f.z + 7.6) > 0.9)).toBe(true);
  expect(errors).toEqual([]);
});

test("an open doorway tap enters a room; a later floor tap crosses between downstairs rooms", async ({ page }) => {
  test.setTimeout(240_000);
  const errors = await ready(page, 1);
  await hook(page, "teleport", -4, -2.6, 0);
  await shot(page, -4, -3.4);
  await hook(page, "startTrace");
  await clickWorld(page, -4, 0.015, -4.15);
  await page.waitForFunction(() => {
    const p = (window as unknown as { __hh: BrowserApi }).__hh.state().player;
    return p.z < -4.45 && !p.destination;
  }, null, { timeout: 60_000 });
  await frames(page);
  await shot(page, 0, -3.8, 0, 20);
  await hook(page, "startTrace");
  await clickWorld(page, 4, 0.015, -5);
  await arrive(page, 4, -5, 0, 150_000);
  const trace = await frames(page);
  expect(trace.some((f) => f.z > -3.7)).toBe(true);
  expect(trace.some((f) => Math.abs(f.x - 4) < 0.7 && Math.abs(f.z + 4) < 0.4)).toBe(true);
  expect(errors).toEqual([]);
});

test("a locked door tap stays put and shows the existing locked feedback", async ({ page }) => {
  const errors = await ready(page);
  await hook(page, "teleport", 4, -2.6, 0);
  await shot(page, 4, -3.5);
  const before = await tapState(page);
  await clickWorld(page, 4, 0.015, -4.1);
  await page.waitForFunction(() => (window as unknown as { __hh: BrowserApi }).__hh.state().lastToast === "locked");
  const after = await tapState(page);
  expect(after.player.destination).toBeNull();
  expect(distance(before.player, after.player)).toBeLessThan(0.05);
  expect(errors).toEqual([]);
});

test("stairs taps walk up and back down the ramp with the Chapter 2 gate open", async ({ page }) => {
  test.setTimeout(240_000);
  const errors = await ready(page, 4);
  await hook(page, "teleport", 2.7, 0, 0);
  await shot(page, 4.6, 0, 0, 13);
  await hook(page, "startTrace");
  await clickWorld(page, 5, 1.4, 0);
  await arrive(page, 7, 0, 1, 100_000);
  const up = await frames(page);
  expect(up.some((f) => f.stairs && f.y > 0.2 && f.y < 2.6)).toBe(true);
  expect(up.some((f) => f.floor === 0)).toBe(true);
  expect(up.some((f) => f.floor === 1)).toBe(true);
  for (const f of up.filter((p) => p.y > 0.05 && p.y < 2.75)) expect(f.x).toBeGreaterThan(3.5);
  await shot(page, 4.8, 0, 1, 13);
  await hook(page, "startTrace");
  await clickWorld(page, 5, 1.4, 0, true);
  await arrive(page, 2.9, 0, 0, 100_000);
  const down = await frames(page);
  expect(down.some((f) => f.stairs && f.y > 0.2 && f.y < 2.6)).toBe(true);
  expect(errors).toEqual([]);
});

test("floor taps navigate between upstairs rooms through the landing", async ({ page }) => {
  test.setTimeout(240_000);
  const errors = await ready(page, 5);
  await hook(page, "teleport", -4, -4.8, 1);
  await shot(page, 0, -3.7, 1, 20);
  await hook(page, "startTrace");
  await clickWorld(page, 4, 2.815, -5.2);
  await arrive(page, 4, -5.2, 1, 150_000);
  const trace = await frames(page);
  expect(trace.every((f) => f.floor === 1)).toBe(true);
  expect(trace.some((f) => f.z > -3.7)).toBe(true);
  expect(errors).toEqual([]);
});

test("camera drags do not walk and WASD immediately interrupts a tap path", async ({ page }) => {
  const errors = await ready(page);
  await hook(page, "teleport", -5.8, -1.5, 0);
  await hook(page, "look", null);
  await hook(page, "setYaw", 0, 0.95);
  await page.waitForFunction(() => {
    const c = (window as unknown as { __hh: BrowserApi }).__hh.camera();
    return Math.abs(c.x + 5.8) < 0.1 && c.z > 2;
  });
  const p = await hook<{ x: number; y: number }>(page, "project", -4, 0.015, -1.5);
  const before = await tapState(page);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x + 110, p.y + 30, { steps: 12 });
  await page.mouse.up();
  await page.waitForFunction((yaw) => Math.abs((window as unknown as { __hh: BrowserApi }).__hh.state().cameraYaw - yaw) > 0.05, before.cameraYaw);
  const afterDrag = await tapState(page);
  expect(distance(before.player, afterDrag.player)).toBeLessThan(0.05);
  expect(afterDrag.player.destination).toBeNull();
  await shot(page, -3.5, -1.5);
  await clickWorld(page, -1.6, 0.015, -1.5);
  await page.waitForFunction(() => {
    const p2 = (window as unknown as { __hh: BrowserApi }).__hh.state().player;
    return p2.destination !== null && p2.x > -5.3;
  });
  await page.keyboard.down("KeyW");
  try {
    await page.waitForFunction(() => (window as unknown as { __hh: BrowserApi }).__hh.state().player.destination === null);
  } finally { await page.keyboard.up("KeyW"); }
  expect(errors).toEqual([]);
});

test("skip/settings UI and close-up question-mark taps still work without issuing movement", async ({ page }) => {
  const errors = await boot(page, "&mode=story");
  await page.getByTestId("start").click();
  await waitPhase(page, "intro");
  await page.getByTestId("skip").click();
  await waitPhase(page, "explore");
  expect((await tapState(page)).player.destination).toBeNull();
  await hook(page, "teleport", -4, -1.5, 0);
  const before = await tapState(page);
  await page.getByTestId("settings").click();
  await expect(page.getByTestId("settings-modal")).toBeVisible();
  await page.getByTestId("toggle-ja").click();
  await page.getByTestId("settings-close").click();
  expect(distance(before.player, (await tapState(page)).player)).toBeLessThan(0.05);
  expect((await tapState(page)).player.destination).toBeNull();
  await hook(page, "goTo", "bedroom.bed");
  await shot(page, -5.8, -9, 0, 12);
  const bed = await hook<{ x: number; y: number; z: number }>(page, "objectInfo", "bedroom.bed");
  await clickWorld(page, bed.x, bed.y, bed.z);
  await waitPhase(page, "search");
  // Search installs its own shot. Wait for the real camera to settle before clicking its marker.
  await page.waitForFunction(() => {
    const api = (window as unknown as { __hh: BrowserApi }).__hh;
    const s = api.state();
    return s.phase === "search" && !s.busy && !s.player.stepping && s.player.speed < 0.01;
  });
  const spots = await hook<{ id: string; prep: string }[]>(page, "spotsOf", "bedroom.bed");
  const clue = (await tapState(page)).clue!;
  expect(spots.some((s) => s.id === clue.spotId)).toBe(true);
  // Restore a precise fixed shot only for pixels; the actual marker still handles the tap.
  await shot(page, -5.8, -9, 0, 10);
  const searchPlayer = (await tapState(page)).player;
  await clickMarker(page, clue.spotId);
  await waitPhase(page, "answer");
  const afterMarker = await tapState(page);
  expect(afterMarker.player.destination).toBeNull();
  expect(distance(searchPlayer, afterMarker.player)).toBeLessThan(0.05);
  expect(errors).toEqual([]);
});
