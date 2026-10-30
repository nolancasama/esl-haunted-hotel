import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { boot, hook, waitPhase } from "./helpers";

interface Wing {
  unlocked: boolean;
  key: boolean;
  read: string[];
  solved: boolean;
  mysterySolved: boolean;
  note: string | null;
  room: string | null;
  doorsOpen: string[];
}
const wing = (page: Page) => hook<Wing>(page, "wing");
const shotDir = path.join(process.cwd(), ".tmp", "wing");

/** Chapter 2 on its own starts on the landing, upstairs. */
async function startUpstairs(page: Page, query = "") {
  await page.addInitScript(() => localStorage.setItem("hh.ch2.v1", "1"));
  const errors = await boot(page, `&mode=story&intro=0&chapter=2${query}`);
  await page.getByTestId("start").click();
  await waitPhase(page, "explore", 60_000);
  await mkdir(shotDir, { recursive: true });
  return errors;
}

/** A few rendered frames (software rendering in CI draws ~3 a second). */
async function settle(page: Page, frames = 4) {
  await page.evaluate((n) => new Promise<void>((resolve) => {
    let i = 0;
    const step = () => (++i >= n ? resolve() : requestAnimationFrame(step));
    requestAnimationFrame(step);
  }), frames);
}

/** Stand on the corridor side of a guest room's door, facing it. */
async function atDoor(page: Page, room: string) {
  const info = await hook<{ x: number; z: number }>(page, "objectInfo", `${room}.window`);
  const north = info.z < 0;
  await hook(page, "teleport", info.x, north ? -0.75 : 0.75, 1, north ? Math.PI : 0);
}

test("the Guest Wing stays locked until Chapter 2 has been finished", async ({ page }) => {
  const errors = await startUpstairs(page);
  expect((await wing(page)).unlocked).toBe(false);
  // From the top of the stairs the archway is straight ahead; the hallway beyond it is open.
  await hook(page, "teleport", 7.0, 0, 1, Math.PI / 2);
  await hook(page, "setYaw", -Math.PI / 2, 0.3);
  await settle(page);
  await page.screenshot({ path: path.join(shotDir, "stairs-top.png") });
  await hook(page, "teleport", 11.2, 0, 1, Math.PI / 2);
  await settle(page);
  await page.keyboard.press("KeyE");
  await expect.poll(async () => (await hook<{ lastToast: string | null }>(page, "state")).lastToast).toBe("wingLocked");
  expect((await wing(page)).doorsOpen).toEqual([]);
  // Walking into the closed doors does not get you through (camera west of the player: W walks east).
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(1200);
  await page.keyboard.up("KeyW");
  const s = await wing(page);
  expect(s.room).toBe("wingpassage");
  expect(s.doorsOpen).toEqual([]);
  await page.screenshot({ path: path.join(shotDir, "landing-locked.png") });
  expect(errors).toEqual([]);
});

test("the wing's doors open by hand; Room 206 needs its key; the mystery ends in Room 206", async ({ page }) => {
  test.setTimeout(480_000);
  const errors = await startUpstairs(page);
  await hook(page, "unlockWing");

  // The double doors at the end of the hallway from the landing (E beside them).
  await hook(page, "teleport", 9.6, 0, 1, Math.PI / 2);
  await hook(page, "setYaw", -Math.PI * 0.62, 0.3);
  await settle(page);
  await page.screenshot({ path: path.join(shotDir, "wing-doors.png") });
  await hook(page, "teleport", 11.2, 0, 1, Math.PI / 2);
  await settle(page);
  await page.keyboard.press("KeyE");
  await expect.poll(async () => (await wing(page)).doorsOpen).toContain("guestwing");
  await settle(page, 4);

  // Into the corridor: the camera turns to look down its length.
  await hook(page, "teleport", 13.0, 0, 1, Math.PI / 2);
  await expect.poll(async () => (await wing(page)).room).toBe("guesthall");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(shotDir, "corridor.png") });

  // Read the guest register.
  await hook(page, "goTo", "guesthall.register");
  await settle(page);
  await page.keyboard.press("KeyE");
  await expect(page.getByTestId("wing-note")).toHaveAttribute("data-note", "register");
  await expect(page.getByTestId("wing-note")).toContainText("Who stayed in Room 206?");
  await page.screenshot({ path: path.join(shotDir, "register.png") });
  await page.getByTestId("wing-note-close").click();
  await expect(page.getByTestId("wing-note")).toHaveCount(0);

  // Room 206 is locked without its key: walking into the door does not get you in.
  await atDoor(page, "g206");
  await settle(page, 3);
  await page.keyboard.press("KeyE");
  await expect.poll(async () => (await hook<{ lastToast: string | null }>(page, "state")).lastToast).toBe("needKey");
  expect((await wing(page)).doorsOpen).not.toContain("g206");

  // Every other room opens by hand and can be walked into.
  for (const room of ["g201", "g202", "g203", "g204", "g205"]) {
    await atDoor(page, room);
    await settle(page, 3);
    await page.keyboard.press("KeyE");
    await expect.poll(async () => (await wing(page)).doorsOpen, { message: room }).toContain(room);
    await settle(page, 4);
    const into = await hook<{ x: number; z: number }>(page, "objectInfo", `${room}.window`);
    // Walk through the open door with the keyboard (W is "away from the camera").
    await hook(page, "setYaw", into.z < 0 ? 0 : Math.PI, 0.55);
    await page.keyboard.down("KeyW");
    await expect.poll(async () => (await wing(page)).room, { timeout: 8000, message: `walk into ${room}` }).toBe(room);
    await page.waitForTimeout(500);
    await page.keyboard.up("KeyW");
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(shotDir, `${room}.png`) });
  }

  // The key in Room 204 opens Room 206.
  await hook(page, "goTo", "g204.key");
  await settle(page);
  await page.keyboard.press("KeyE");
  await expect(page.getByTestId("wing-note")).toHaveAttribute("data-note", "key204");
  await page.getByTestId("wing-note-close").click();
  expect((await wing(page)).key).toBe(true);
  await atDoor(page, "g206");
  await settle(page, 3);
  await page.keyboard.press("KeyE");
  await expect.poll(async () => (await wing(page)).doorsOpen).toContain("g206");

  // The photograph in Room 206: a short scene, then the reward.
  await hook(page, "goTo", "g206.photo");
  await settle(page);
  await page.keyboard.press("KeyE");
  await expect(page.getByTestId("wing-note")).toHaveAttribute("data-note", "photo206", { timeout: 30_000 });
  await page.screenshot({ path: path.join(shotDir, "mystery-solved.png") });
  const done = await wing(page);
  expect(done.solved).toBe(true);
  expect(done.mysterySolved).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem("hh.guestwing.mystery.v1"))).toBe("1");
  await page.getByTestId("wing-note-close").click();
  await waitPhase(page, "explore", 30_000);
  expect((await hook<{ busy: boolean }>(page, "state")).busy).toBe(false);
  await page.screenshot({ path: path.join(shotDir, "g206.png") });
  expect(errors).toEqual([]);
});

test("finishing Chapter 2 is what opens the wing on this device", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("hh.ch2.v1", "1");
    localStorage.setItem("hh.guestwing.v1", "1");
  });
  await boot(page, "&mode=story&intro=0&chapter=2");
  expect((await wing(page)).unlocked).toBe(true);
});
