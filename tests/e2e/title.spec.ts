import { expect, test, type Page } from "@playwright/test";
import { boot, hook, state, waitPhase, type HhState } from "./helpers";
import { BROWSER_STUBS } from "./stubs";

type TitleState = HhState & {
  scope: string;
  hideSeekUnlocked: boolean;
  hideSeekLink: { ghost?: string; room?: string; seed?: number } | null;
  englishLevel: string;
};
const titleState = (page: Page) => state(page) as Promise<TitleState>;

for (const viewport of [{ width: 1366, height: 768 }, { width: 1024, height: 600 }, { width: 844, height: 390 }]) {
  test(`the two stage cards and replay controls fit at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.addInitScript(() => {
      localStorage.setItem("hh.ch2.v1", "1");
      localStorage.setItem("hh.replay.v1", "1");
    });
    const errors = await boot(page);
    await page.getByTestId("start").click();
    const stages = page.getByTestId("stages");
    await expect(stages, "HARNESS_PRECONDITION_FAILED: stage list did not open").toBeVisible();
    await expect(page.getByTestId("replay-mode"), "HARNESS_PRECONDITION_FAILED: replay toggle is not unlocked").toBeVisible();
    await expect(page.getByTestId("choice-hideseek")).toBeEnabled();
    await expect(stages.locator('[data-testid^="choice-"]')).toHaveCount(2);
    const boxes = await Promise.all(["stages", "choice-all", "choice-hideseek", "replay-mode", "stages-back"].map((id) => page.getByTestId(id).boundingBox()));
    for (const box of boxes) {
      expect(box, "HARNESS_PRECONDITION_FAILED: stage element has no bounds").not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1);
    }
    const controls = boxes.slice(1).map((box) => box!);
    for (let i = 0; i < controls.length; i++) {
      for (let j = i + 1; j < controls.length; j++) {
        const a = controls[i];
        const b = controls[j];
        const overlap = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x))
          * Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
        expect(overlap).toBe(0);
      }
    }
    const overflow = await page.evaluate(() => ({
      x: document.documentElement.scrollWidth > window.innerWidth,
      y: document.documentElement.scrollHeight > window.innerHeight
    }));
    expect(overflow).toEqual({ x: false, y: false });
    await page.screenshot({ path: `.tmp/ui/${viewport.width}x${viewport.height}/stages-title-test.png` });
    expect(errors).toEqual([]);
  });
}

test("Start opens exactly two stages; Back returns and All Levels starts the full adventure", async ({ page }) => {
  const errors = await boot(page, "&intro=0");
  await expect(page.getByTestId("title")).toContainText("in Matsubara");
  await expect(page.getByTestId("choice-all")).toHaveCount(0);

  await page.getByTestId("start").click();
  const stages = page.getByTestId("stages");
  await expect(stages, "HARNESS_PRECONDITION_FAILED: stage list did not open").toBeVisible();
  await expect(stages.locator('[data-testid^="choice-"]')).toHaveCount(2);
  await expect(page.getByTestId("choice-all")).toContainText("All Levels");
  await expect(page.getByTestId("choice-all")).toContainText("Find all eight ghosts!");
  await expect(page.getByTestId("choice-hideseek")).toContainText("Hide & Seek");
  await expect(page.getByTestId("choice-all")).toBeFocused();
  await page.getByTestId("stages-back").click();
  await expect(page.getByTestId("start")).toBeVisible();
  expect((await state(page)).screen).toBe("title");

  await page.getByTestId("start").click();
  await page.getByTestId("choice-all").click();
  await waitPhase(page, "explore");
  const s = await titleState(page);
  expect(s.mode).toBe("story");
  expect(s.scope).toBe("all");
  expect(errors).toEqual([]);
});

test("Hide & Seek is visibly locked and cannot be activated on a fresh profile", async ({ page }) => {
  const errors = await boot(page);
  expect(await page.evaluate(() => [localStorage.getItem("hh.ch2.v1"), localStorage.getItem("hh.hideseek.v1")]),
    "HARNESS_PRECONDITION_FAILED: unlock flags were already present").toEqual([null, null]);
  await page.getByTestId("start").click();
  const locked = page.getByTestId("choice-hideseek");
  await expect(locked, "HARNESS_PRECONDITION_FAILED: Hide & Seek card missing").toBeVisible();
  await expect(locked).toBeDisabled();
  await expect(locked).toHaveClass(/locked/);
  await expect(locked).toContainText("Complete Chapter 1 to unlock!");
  await locked.click({ force: true });
  expect((await state(page)).screen).toBe("title");
  await expect(page.getByTestId("stages")).toBeVisible();
  await page.getByTestId("choice-all").focus();
  await page.keyboard.press("Tab");
  await expect(page.getByTestId("stages-back")).toBeFocused();
  await locked.evaluate((button: HTMLButtonElement) => button.focus());
  await expect(locked).not.toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("start")).toBeVisible();
  await page.getByTestId("start").click();
  await page.getByTestId("choice-all").focus();
  await page.keyboard.press("Tab");
  // Space never activates buttons: installKeyboard prevents it for gameplay.
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("start")).toBeVisible();
  await expect(page.getByTestId("hideseek")).toHaveCount(0);
  expect((await titleState(page)).hideSeekUnlocked).toBe(false);
  expect(errors).toEqual([]);
});

for (const key of ["hh.ch2.v1", "hh.hideseek.v1"]) {
  test(`Hide & Seek opens for an existing ${key} unlock`, async ({ page }) => {
    await page.addInitScript((flag) => localStorage.setItem(flag, "1"), key);
    const errors = await boot(page);
    expect(await page.evaluate((flag) => localStorage.getItem(flag), key),
      "HARNESS_PRECONDITION_FAILED: unlock flag was not preset").toBe("1");
    await page.getByTestId("start").click();
    await expect(page.getByTestId("choice-hideseek")).toBeEnabled();
    expect((await titleState(page)).hideSeekUnlocked).toBe(true);
    await page.getByTestId("choice-hideseek").click();
    await expect(page.getByTestId("hideseek")).toBeVisible();
    expect((await state(page)).screen).toBe("hideseek");
    await page.getByTestId("hideseek-back").click();
    await expect(page.getByTestId("start")).toBeVisible();
    await page.getByTestId("start").click();
    await expect(page.getByTestId("choice-hideseek")).toBeFocused();
    expect(errors).toEqual([]);
  });
}

for (const link of [
  { query: "&chapter=1&intro=0", mode: "story", scope: "ch1" },
  { query: "&chapter=2&intro=0", mode: "story", scope: "ch2" },
  { query: "&mode=practice", mode: "practice", scope: "ch1" }
]) {
  test(`${link.query} still starts the linked stage from Start`, async ({ page }) => {
    const errors = await boot(page, link.query);
    await page.getByTestId("start").click();
    await waitPhase(page, "explore");
    await expect(page.getByTestId("stages")).toHaveCount(0);
    const s = await titleState(page);
    expect(s.mode).toBe(link.mode);
    expect(s.scope).toBe(link.scope);
    expect(errors).toEqual([]);
  });
}

for (const link of [
  { params: "", expected: {} },
  { params: "&ghost=shadow&room=attic&seed=-42", expected: { ghost: "shadow", room: "attic", seed: -42 } },
  { params: "&ghost=unknown&room=unknown&seed=3.5", expected: {} },
  { params: "&ghost=sleepy&room=bedroom&seed=abc", expected: { ghost: "sleepy", room: "bedroom" } }
]) {
  test(`a direct Hide & Seek link bypasses the lock and validates params: ${link.params || "none"}`, async ({ page }) => {
    await page.addInitScript(BROWSER_STUBS);
    await page.goto(`/?e2e=1&fast=1&mode=hideseek${link.params}`);
    await expect(page.getByTestId("hideseek"), "HARNESS_PRECONDITION_FAILED: direct entry did not render").toBeVisible();
    const s = await titleState(page);
    expect(s.screen).toBe("hideseek");
    expect(s.hideSeekUnlocked).toBe(false);
    expect(s.hideSeekLink).toEqual(link.expected);
    await expect(page.getByTestId("stages")).toHaveCount(0);
  });
}

test("English help defaults to Standard and persists alongside existing settings", async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("hh.settings.v1")) localStorage.setItem("hh.settings.v1", JSON.stringify({ mic: false, japanese: false }));
  });
  const errors = await boot(page);
  expect((await titleState(page)).englishLevel).toBe("standard");
  await page.getByRole("button", { name: /Settings/ }).click();
  const choices = page.getByRole("group", { name: "English help" });
  await expect(choices, "HARNESS_PRECONDITION_FAILED: English help control missing").toBeVisible();
  await expect(choices.getByRole("button", { name: /Standard/ })).toHaveAttribute("aria-pressed", "true");
  await choices.getByRole("button", { name: /Beginner/ }).click();
  expect((await titleState(page)).englishLevel).toBe("beginner");
  await choices.getByRole("button", { name: /Advanced/ }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("hh.settings.v1") ?? "{}"))).toMatchObject({ englishLevel: "advanced", mic: false, japanese: false });
  await page.reload();
  await expect(page.getByTestId("start")).toBeVisible();
  expect((await titleState(page)).englishLevel).toBe("advanced");
  expect(errors).toEqual([]);
});

test("the fourth capture in All Levels saves Hide & Seek unlock immediately", async ({ page }) => {
  const errors = await boot(page, "&intro=0");
  expect((await titleState(page)).hideSeekUnlocked,
    "HARNESS_PRECONDITION_FAILED: profile already unlocked").toBe(false);
  await page.getByTestId("start").click();
  await page.getByTestId("choice-all").click();
  await waitPhase(page, "explore");
  await hook(page, "jump", 3, 3);
  await expect.poll(async () => {
    const s = await state(page);
    return { index: s.index, round: s.round, phase: s.phase };
  }, { message: "HARNESS_PRECONDITION_FAILED: jump did not reach the fourth ghost's final round" }).toEqual({ index: 3, round: 3, phase: "explore" });
  await hook(page, "teleport", -4, 7.5, 0);
  await expect.poll(async () => (await state(page)).clueShown,
    { message: "HARNESS_PRECONDITION_FAILED: fourth ghost clue not shown", timeout: 40_000 }).toBe(true);
  await waitPhase(page, "explore");
  const clue = (await state(page)).clue;
  expect(clue, "HARNESS_PRECONDITION_FAILED: fourth capture has no clue").not.toBeNull();
  await hook(page, "setMic", false);
  await hook(page, "goTo", clue!.objectId);
  await expect.poll(async () => (await state(page)).focusId,
    { message: "HARNESS_PRECONDITION_FAILED: fourth ghost object not in reach" }).toBe(clue!.objectId);
  await page.keyboard.press("KeyE");
  await waitPhase(page, "search");
  await hook(page, "select", clue!.spotId);
  await page.keyboard.press("KeyE");
  await waitPhase(page, "answer");
  await page.getByTestId(`word-${clue!.prep}`).click();
  await expect.poll(async () => (await titleState(page)).hideSeekUnlocked, { timeout: 40_000 }).toBe(true);
  expect((await state(page)).captured).toHaveLength(4);
  expect((await titleState(page)).scope).toBe("all");
  expect(await page.evaluate(() => [localStorage.getItem("hh.ch2.v1"), localStorage.getItem("hh.hideseek.v1")])).toEqual(["1", "1"]);
  expect(errors).toEqual([]);
});
