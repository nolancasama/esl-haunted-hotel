import { expect, test, type Page } from "@playwright/test";
import { boot, clickMarker, hook, openCloseUp, state, waitPhase, type HhState } from "./helpers";

type HardState = HhState & {
  hard: boolean;
  hardUnlocked: boolean;
  hardClue: { notIn: string[]; roomTold: boolean } | null;
  searched: string[];
  wrongSearches: number;
  medal: string | null;
  beaconDoor: string | null;
  doorsOpen: string[];
  chapter: number;
  scope: string;
  sunrise: boolean;
};
const hs = (page: Page) => state(page) as Promise<HardState>;
type Spot = { id: string; prep: string; objectId: string; room: string };
const CH1 = ["bedroom", "dining", "storage", "library"];
const CH2 = ["playroom", "bathroom", "music", "attic"];

/** Play the ending: wait for sunrise, then walk out of the front door to the results. */
async function walkOut(page: Page) {
  await page.waitForFunction(() => (window as unknown as { __hh: { state(): { sunrise: boolean } } }).__hh.state().sunrise, null, { timeout: 90_000 });
  await waitPhase(page, "explore", 60_000);
  await hook(page, "teleport", -8.3, 0);
  await page.waitForTimeout(400);
  await hook(page, "teleport", -9.2, 0);
  await expect(page.getByTestId("results")).toBeVisible({ timeout: 30_000 });
}

async function waitClue(page: Page) {
  await expect.poll(async () => (await hs(page)).clueShown, { timeout: 60_000, message: "HARNESS_PRECONDITION_FAILED: no clue" }).toBe(true);
  await waitPhase(page, ["explore", "search"]);
}

test("Hard Story is locked on a fresh profile and on old saves", async ({ page }) => {
  await page.addInitScript(() => {
    for (const k of ["hh.replay.v1", "hh.finish.v2", "hh.ch2.v1", "hh.hideseek.v1", "hh.guestwing.chapter2.v2"]) localStorage.setItem(k, "1");
  });
  const errors = await boot(page);
  await page.getByTestId("start").click();
  const hard = page.getByTestId("choice-hard");
  await expect(hard).toBeVisible();
  await expect(hard).toBeDisabled();
  await expect(hard).toHaveClass(/locked/);
  await expect(hard).toContainText("Finish Normal Story to unlock!");
  await expect(hard).toContainText("ふつうの ストーリーを クリアすると あそべるよ！");
  await hard.click({ force: true });
  expect((await hs(page)).screen).toBe("title");
  expect((await hs(page)).hardUnlocked).toBe(false);
  expect(errors).toEqual([]);
});

test("finishing Chapter 1 alone does not open Hard Story", async ({ page }) => {
  test.setTimeout(240_000);
  const errors = await boot(page, "&mode=story&intro=0&chapter=1");
  await page.getByTestId("start").click();
  await waitPhase(page, "explore");
  await hook(page, "finish");
  await walkOut(page);
  await expect(page.getByTestId("hard-unlocked")).toHaveCount(0);
  expect((await hs(page)).hardUnlocked).toBe(false);
  expect(await page.evaluate(() => localStorage.getItem("hh.hardstory.v1"))).toBeNull();
  expect(errors).toEqual([]);
});

test("finishing the full Normal Story opens Hard Story, and it stays open after a reload", async ({ page }) => {
  test.setTimeout(240_000);
  const errors = await boot(page, "&mode=story&intro=0");
  await page.getByTestId("start").click();
  await waitPhase(page, "explore");
  expect((await hs(page)).scope).toBe("all");
  await hook(page, "finish");
  await walkOut(page);
  await expect(page.getByTestId("hard-unlocked")).toBeVisible();
  expect((await hs(page)).hardUnlocked).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem("hh.hardstory.v1"))).toBe("1");

  // A plain link (the ?mode=story link would start the story straight from Start).
  await page.goto("/?e2e=1&fast=1&seed=11");
  await expect(page.getByTestId("start")).toBeVisible();
  await page.getByTestId("start").click();
  await expect(page.getByTestId("choice-hard")).toBeEnabled();
  await expect(page.getByTestId("hard-unlocked-badge")).toBeVisible();
  await expect(page.getByTestId("choice-hard")).toHaveClass(/just-unlocked/);
  // The celebration plays once.
  await page.reload();
  await expect(page.getByTestId("start")).toBeVisible();
  await page.getByTestId("start").click();
  await expect(page.getByTestId("choice-hard")).toBeEnabled();
  await expect(page.getByTestId("hard-unlocked-badge")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("Hard Story: no room beacon, every room open, misses in other rooms, room clues, notes and a medal", async ({ page }) => {
  test.setTimeout(300_000);
  await page.addInitScript(() => localStorage.setItem("hh.hardstory.v1", "1"));
  const errors = await boot(page, "&intro=0");
  await page.getByTestId("start").click();
  await page.getByTestId("choice-hard").click();
  await waitClue(page);
  let s = await hs(page);
  expect(s.hard).toBe(true);
  expect(s.mode).toBe("story");
  expect(s.beaconDoor).toBeNull();
  for (const r of CH1) expect(s.doorsOpen).toContain(r);
  expect(s.hardClue).toEqual({ notIn: [], roomTold: false });
  await hook(page, "setMic", false);

  const spots = await hook<Spot[]>(page, "allSpots");
  const ghostRoom = spots.find((x) => x.id === s.clue!.spotId)!.room;
  // Two misses in rooms other than the ghost's (preferring the place the clue names there).
  const elsewhere = spots.filter((x) => CH1.includes(x.room) && x.room !== ghostRoom);
  const match = elsewhere.find((x) => x.prep === s.clue!.prep && x.objectId.split(".")[1] === s.clue!.objectId.split(".")[1]);
  const first = match ?? elsewhere[0];
  const second = elsewhere.find((x) => x.room !== first.room && x.objectId !== first.objectId)!;

  await openCloseUp(page, first.objectId);
  await clickMarker(page, first.id);
  await expect(page.getByTestId("caption")).toBeVisible();
  await expect(page.getByTestId("caption").getByTestId("no-ghost")).toBeVisible();
  await waitPhase(page, "search");
  s = await hs(page);
  expect(s.wrongSearches).toBe(1);
  expect(s.searched).toEqual([first.id]);
  // The same place again is remembered and costs nothing.
  await clickMarker(page, first.id);
  await waitPhase(page, "search");
  expect((await hs(page)).wrongSearches).toBe(1);
  await page.keyboard.press("Escape");
  await waitPhase(page, "explore");

  await openCloseUp(page, second.objectId);
  await clickMarker(page, second.id);
  await expect.poll(async () => {
    const c = (await hs(page)).hardClue!;
    return c.notIn.length + (c.roomTold ? 1 : 0);
  }, { timeout: 20_000 }).toBe(1);
  s = await hs(page);
  for (const r of s.hardClue!.notIn) expect(r).not.toBe(ghostRoom);
  await expect(page.getByTestId("clue-room")).toHaveCount(1);
  await waitPhase(page, "search");
  await page.keyboard.press("Escape");
  await waitPhase(page, "explore");

  await page.getByTestId("notebook-button").click();
  const notes = page.getByTestId("notebook");
  await expect(notes).toBeVisible();
  await expect(notes.locator("li")).toHaveCount(4);
  for (const r of s.hardClue!.notIn) await expect(page.getByTestId(`note-${r}`)).toHaveAttribute("data-status", "clear");
  if (match) await expect(page.getByTestId(`note-${first.room}`)).toHaveAttribute("data-status", "clear");
  if (!s.hardClue!.roomTold) await expect(page.getByTestId(`note-${ghostRoom}`)).not.toHaveAttribute("data-status", "here");
  await page.screenshot({ path: ".tmp/hard/notebook-1366.png" });
  await page.getByTestId("notebook-close").click();

  await openCloseUp(page, s.clue!.objectId);
  await clickMarker(page, s.clue!.spotId);
  await waitPhase(page, "answer");
  await page.getByTestId(`word-${s.clue!.prep}`).click();
  await expect(page.getByTestId("medal-pop")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("medal-pop")).toHaveAttribute("data-medal", "silver");
  expect(errors).toEqual([]);
});

test("Hard Story Chapter 2: only the stairs glow, upstairs rooms open, and the ending shows medals", async ({ page }) => {
  test.setTimeout(300_000);
  await page.addInitScript(() => localStorage.setItem("hh.hardstory.v1", "1"));
  const errors = await boot(page, "&intro=0");
  await page.getByTestId("start").click();
  await page.getByTestId("choice-hard").click();
  await waitClue(page);
  await hook(page, "jump", 4);
  await expect.poll(async () => (await hs(page)).index).toBe(4);
  await waitClue(page);
  let s = await hs(page);
  expect(s.chapter).toBe(2);
  for (const r of CH2) expect(s.doorsOpen).toContain(r);
  expect(s.beaconDoor).toBe("stairs");
  // Upstairs, nothing points at a room.
  await hook(page, "teleport", 7.05, 0, 1);
  await expect.poll(async () => (await hs(page)).beaconDoor, { timeout: 10_000 }).toBeNull();
  s = await hs(page);
  expect(CH2).toContain((await hook<Spot[]>(page, "allSpots")).find((x) => x.id === s.clue!.spotId)!.room);

  await hook(page, "finish");
  await walkOut(page);
  await expect(page.getByTestId("hard-summary")).toBeVisible();
  for (const g of ["sleepy", "shadow"]) await expect(page.getByTestId(`medal-${g}`)).toBeVisible();
  await expect(page.getByTestId("hard-unlocked")).toHaveCount(0);
  await expect(page.getByTestId("replay-unlocked")).toHaveCount(0);
  await page.screenshot({ path: ".tmp/hard/results-1366.png" });
  await page.getByTestId("play-again").click();
  await waitClue(page);
  expect((await hs(page)).hard).toBe(true);
  expect(errors).toEqual([]);
});

for (const viewport of [{ width: 1366, height: 768 }, { width: 1024, height: 600 }]) {
  test(`the Hard Story card and notebook fit at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize(viewport);
    await page.addInitScript(() => localStorage.setItem("hh.hardstory.v1", "1"));
    const errors = await boot(page, "&intro=0");
    await page.getByTestId("start").click();
    await page.screenshot({ path: `.tmp/hard/stages-${viewport.width}x${viewport.height}.png` });
    await page.getByTestId("choice-hard").click();
    await waitClue(page);
    await page.getByTestId("notebook-button").click();
    await expect(page.getByTestId("notebook")).toBeVisible();
    for (const id of ["notebook", "clue", "counter", "settings"]) {
      const b = (await page.getByTestId(id).boundingBox())!;
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(viewport.width + 1);
      expect(b.y + b.height).toBeLessThanOrEqual(viewport.height + 1);
    }
    const clue = (await page.getByTestId("clue").boundingBox())!;
    const note = (await page.getByTestId("notebook").boundingBox())!;
    expect(Math.max(0, Math.min(clue.x + clue.width, note.x + note.width) - Math.max(clue.x, note.x)) * Math.max(0, Math.min(clue.y + clue.height, note.y + note.height) - Math.max(clue.y, note.y))).toBe(0);
    await page.screenshot({ path: `.tmp/hard/notebook-${viewport.width}x${viewport.height}.png` });
    expect(errors).toEqual([]);
  });
}
