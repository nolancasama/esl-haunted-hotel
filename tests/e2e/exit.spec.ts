import { expect, test, type Page } from "@playwright/test";
import { boot, hook, state, waitPhase } from "./helpers";

type P = { x: number; z: number; floor: number };
type S = { phase: string; screen: string; exitActive: boolean; sunrise: boolean; player: P; clue: { objectId: string; spotId: string; prep: string } | null; clueShown: boolean };
const st = (page: Page) => state(page) as unknown as Promise<S>;

/** Chapter 1: jump to Mischief's last round, catch it, and wait for the exit walk to begin. */
async function toExit(page: Page) {
  const errors = await boot(page, "&mode=story&intro=0&chapter=1");
  await page.getByTestId("start").click();
  await waitPhase(page, "explore");
  await hook(page, "jump", 3, 3);
  await page.waitForTimeout(400);
  await hook(page, "teleport", -4, 7.5, 0);
  await page.waitForFunction(() => (window as unknown as { __hh: { state(): S } }).__hh.state().clueShown, null, { timeout: 40_000 });
  await waitPhase(page, "explore", 40_000);
  const s = await st(page);
  await hook(page, "setMic", false);
  await hook(page, "goTo", s.clue!.objectId);
  await page.waitForTimeout(400);
  await page.keyboard.press("KeyE");
  await waitPhase(page, "search");
  await hook(page, "select", s.clue!.spotId);
  await page.keyboard.press("KeyE");
  await waitPhase(page, "answer");
  await page.getByTestId(`word-${s.clue!.prep}`).click();
  await page.waitForFunction(() => (window as unknown as { __hh: { state(): S } }).__hh.state().exitActive, null, { timeout: 90_000 });
  await waitPhase(page, "explore", 30_000);
  return errors;
}

/** Record the player's position every frame (catches a jump or a turn back into the house). */
async function trace(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { exitTrace: P[]; __hh: { state(): S } };
    w.exitTrace = [];
    const tick = () => {
      const s = w.__hh.state();
      w.exitTrace.push({ ...s.player });
      if (s.screen === "game") requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

test("the exit walk starts inside the front door, backwards does nothing, and a tap anywhere walks straight out to the results", async ({ page }) => {
  test.setTimeout(240_000);
  const errors = await toExit(page);
  const start = (await st(page)).player;
  expect(start.x).toBeGreaterThan(-7.2);
  expect(start.x).toBeLessThan(-6);
  expect(Math.abs(start.z)).toBeLessThan(0.05);

  // Back into the house: nothing happens.
  await page.keyboard.down("KeyS");
  await page.waitForTimeout(1500);
  await page.keyboard.up("KeyS");
  expect((await st(page)).player.x).toBeLessThan(start.x + 0.02);

  // A tap on the lobby floor off to the side (where tap-to-move would go) only walks the player out.
  await trace(page);
  const p = await hook<{ x: number; y: number }>(page, "project", -6.9, 0, 2.6);
  await page.mouse.click(p.x, p.y);
  await expect(page.getByTestId("results")).toBeVisible({ timeout: 90_000 });
  const frames = await page.evaluate(() => (window as unknown as { exitTrace: P[] }).exitTrace);
  expect(frames.length).toBeGreaterThan(3);
  for (let i = 1; i < frames.length; i++) {
    expect(frames[i].x).toBeLessThanOrEqual(frames[i - 1].x + 0.001); // only ever forward
    expect(Math.abs(frames[i].z)).toBeLessThan(0.15); // on the track, through the middle of the door
  }
  expect(errors).toEqual([]);
});

test("holding a sideways key also walks out along the track, and the results come once", async ({ page }) => {
  test.setTimeout(240_000);
  const errors = await toExit(page);
  await trace(page);
  await page.keyboard.down("KeyA");
  await expect(page.getByTestId("results")).toBeVisible({ timeout: 90_000 });
  await page.keyboard.up("KeyA");
  const frames = await page.evaluate(() => (window as unknown as { exitTrace: P[] }).exitTrace);
  for (const f of frames) expect(Math.abs(f.z)).toBeLessThan(0.15);
  await page.waitForTimeout(2000);
  await expect(page.getByTestId("results")).toHaveCount(1);
  expect(errors).toEqual([]);
});
