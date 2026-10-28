import { expect, test, type Page } from "@playwright/test";
import type { MatchState } from "../../src/game/hideSeek/types";
import type { HidingSpot } from "../../src/game/world/world";
import { hook } from "./helpers";
import { BROWSER_STUBS } from "./stubs";

type Snapshot = MatchState & {
  phase: string;
  reachable: HidingSpot[];
  spots: HidingSpot[];
  decision: { phase: "decision" | "destination"; secondsLeft: number; searchNumber: number } | null;
};
interface Camera {
  mode: string; spotId: string | null; settled: boolean; lookYaw: number; lookPitch: number;
  pos: { x: number; y: number; z: number }; fov: number; near: number; heartbeat: boolean;
}
const snapshot = (page: Page) => hook<Snapshot | null>(page, "hs");
const camera = (page: Page) => hook<Camera>(page, "hsCamera");
const scale = (page: Page, value: number) => hook(page, "hsTimeScale", value);

async function until<T>(page: Page, description: string, read: (page: Page) => Promise<T>, predicate: (value: T) => boolean, timeout = 60_000) {
  await expect.poll(async () => predicate(await read(page)), { timeout, message: `HARNESS_PRECONDITION_FAILED: ${description}` }).toBe(true);
}

async function open(page: Page, settings: Record<string, unknown> = {}, query = "&ghost=sleepy&room=bedroom&seed=4") {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.addInitScript(BROWSER_STUBS);
  await page.addInitScript((extra) => {
    localStorage.setItem("hh.settings.v1", JSON.stringify({ mic: false, japanese: false, englishLevel: "standard", ...extra }));
  }, settings);
  await page.goto(`/?e2e=1&fast=1&mode=hideseek${query}`);
  await expect(page.getByTestId("hideseek")).toBeVisible({ timeout: 60_000 });
  await page.waitForFunction(() => Boolean((window as unknown as { __hh?: { hs?: unknown } }).__hh?.hs));
  await scale(page, 0);
  return errors;
}

async function hideAt(page: Page, spotId: string) {
  await until(page, "match setup", snapshot, (s) => s?.status === "setup");
  await page.getByTestId(`hs-spot-${spotId}`).click();
  const prep = spotId.split(".").pop()!;
  await page.getByTestId(`hs-word-${prep}`).click();
  await until(page, "hidden and playing", snapshot, (s) => s?.status === "playing" && !s.english);
}

test("hiding goes first person; Move picks in the overhead view and relocates in third person", async ({ page }) => {
  const errors = await open(page);
  expect((await camera(page)).mode).toBe("overview");
  await hideAt(page, "bedroom.bed.under");
  // The decision waits for the camera: shown at 5 while the ghost is revealed and the view travels.
  await until(page, "first-person view settled", camera, (c) => c.mode === "firstPerson" && c.settled && c.spotId === "bedroom.bed.under");
  expect((await snapshot(page))!.decision).toMatchObject({ phase: "decision", secondsLeft: 5 });
  const fp = await camera(page);
  expect(fp.pos.y).toBeLessThan(0.38); // under the bed's 0.38 m clearance
  expect(fp.near).toBeLessThanOrEqual(0.05);
  await expect(page.getByTestId("hs-decision-overlay")).toHaveAttribute("data-phase", "decision");

  await page.getByTestId("hs-move").click();
  await until(page, "overhead destination picker", camera, (c) => c.mode === "destinationSelection" && c.settled);
  expect((await snapshot(page))!.decision).toMatchObject({ phase: "destination", secondsLeft: 10 });
  const target = (await snapshot(page))!.reachable.find((spot) => spot.id === "bedroom.bed.on")!;
  expect(target).toBeTruthy();
  await page.getByTestId(`hs-spot-${target.id}`).click();
  expect((await camera(page)).mode).toBe("destinationSelection");
  await page.getByTestId("hs-word-on").click();
  await until(page, "relocation started", snapshot, (s) => Boolean(s?.ghost.transit));
  await until(page, "third-person follow", camera, (c) => c.mode === "relocating");
  await scale(page, 1);
  await until(page, "first person at the new spot", camera, (c) => c.mode === "firstPerson" && c.spotId === "bedroom.bed.on" && c.settled);
  await scale(page, 0);
  expect((await snapshot(page))!.relocationsLeft).toBe(1);
  expect(errors).toEqual([]);
});

test("Stay keeps the first-person view, and the look is limited to the hiding place", async ({ page }) => {
  const errors = await open(page);
  await hideAt(page, "bedroom.desk.under");
  await until(page, "first-person view settled", camera, (c) => c.mode === "firstPerson" && c.settled);
  await page.getByTestId("hs-stay").click();
  await until(page, "decision closed", snapshot, (s) => !s?.decision);
  const before = await camera(page);
  expect(before.mode).toBe("firstPerson");
  // Arrow keys turn, but only so far.
  await page.keyboard.down("ArrowLeft");
  await page.waitForTimeout(2500);
  await page.keyboard.up("ArrowLeft");
  const left = await camera(page);
  expect(left.lookYaw).toBeGreaterThan(0.3);
  expect(left.lookYaw).toBeLessThanOrEqual(Math.PI / 4 + 1e-6);
  expect(left.pos).toEqual(before.pos);
  // Dragging the picture turns back the other way.
  const box = (await page.locator("canvas").boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.5, { steps: 6 });
  await page.mouse.up();
  await until(page, "drag turned the view", camera, (c) => c.lookYaw < left.lookYaw - 0.2);
  expect((await camera(page)).pos).toEqual(before.pos);
  expect(errors).toEqual([]);
});

test("First-person hiding off keeps the original overhead view throughout", async ({ page }) => {
  const errors = await open(page, { firstPerson: false });
  await hideAt(page, "bedroom.bed.under");
  await expect(page.getByTestId("hs-decision-overlay")).toBeVisible();
  await page.waitForTimeout(1500);
  const c = await camera(page);
  expect(c.mode).toBe("overview");
  expect(c.pos.y).toBeGreaterThan(5);
  expect(errors).toEqual([]);
});

test("the heartbeat runs only during a match, never twice, and stops when switched off or left", async ({ page }) => {
  const errors = await open(page);
  expect((await camera(page)).heartbeat).toBe(false);
  await hideAt(page, "bedroom.bed.under");
  // It starts once the detective is within earshot (about 6.5 m).
  await scale(page, 1);
  await until(page, "heartbeat scheduler running", camera, (c) => c.heartbeat, 120_000);
  await scale(page, 0);
  // Settings pause the match; switching the sound off stops the scheduler.
  await page.getByTestId("hs-settings").click();
  await page.getByTestId("toggle-heartbeat").click();
  await page.getByTestId("settings-close").click();
  await until(page, "heartbeat stopped when switched off", camera, (c) => !c.heartbeat, 30_000);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("hh.settings.v1")!).heartbeat)).toBe(false);
  await page.getByTestId("hs-settings").click();
  await page.getByTestId("toggle-heartbeat").click();
  await page.getByTestId("settings-close").click();
  await until(page, "heartbeat back on", camera, (c) => c.heartbeat, 30_000);
  // Leaving Hide & Seek stops it for good.
  await page.getByTestId("hs-settings").click();
  await page.getByTestId("hs-main-menu").click();
  await until(page, "heartbeat stopped after leaving", camera, (c) => !c.heartbeat, 30_000);
  expect(errors).toEqual([]);
});
