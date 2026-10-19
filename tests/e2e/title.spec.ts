import { expect, test } from "@playwright/test";
import { boot, state, waitPhase } from "./helpers";

test("Start opens the stage list; Back returns to the title and a stage starts the game", async ({ page }) => {
  const errors = await boot(page, "&intro=0");
  await expect(page.getByTestId("title")).toContainText("in Matsubara");
  await expect(page.getByTestId("choice-all")).toHaveCount(0);

  await page.getByTestId("start").click();
  await expect(page.getByTestId("stages")).toBeVisible();
  await expect(page.getByTestId("choice-ch2")).toBeDisabled();
  await page.getByTestId("stages-back").click();
  await expect(page.getByTestId("start")).toBeVisible();
  expect((await state(page)).screen).toBe("title");

  await page.getByTestId("start").click();
  await page.getByTestId("choice-ch1").click();
  await waitPhase(page, "explore");
  const s = (await state(page)) as unknown as { mode: string; scope: string };
  expect(s.mode).toBe("story");
  expect(s.scope).toBe("ch1");
  expect(errors).toEqual([]);
});

test("a link that names the stage starts it straight from Start", async ({ page }) => {
  const errors = await boot(page, "&mode=practice");
  await page.getByTestId("start").click();
  await waitPhase(page, "explore");
  await expect(page.getByTestId("stages")).toHaveCount(0);
  expect((await state(page)).mode).toBe("practice");
  expect(errors).toEqual([]);
});
