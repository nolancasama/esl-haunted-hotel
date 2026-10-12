import { expect, test } from "@playwright/test";
import { boot, clickMarker, findGhost, hook, openCloseUp, PREPS, setSpeech, state, waitPhase } from "./helpers";

// Phase 1: the bedroom prototype (one ghost, four rounds: in / on / under / by).
const PRACTICE = "&mode=practice";

test("a full practice round: clue, search, spoken answers, escapes, capture, results", async ({ page }) => {
  const errors = await boot(page, PRACTICE);
  await page.getByTestId("start").click();
  await waitPhase(page, "explore");

  const seen: string[] = [];
  for (let round = 0; round < 4; round++) {
    const s = await state(page);
    // The displayed clue is made from the ghost's real hiding spot.
    await expect(page.getByTestId("clue-text")).toHaveText(s.clue!.text);
    const clue = await findGhost(page);
    seen.push(clue.prep);
    // While answering, the clue text is hidden: the student has to produce the word.
    await expect(page.getByTestId("clue")).toHaveCount(0);
    await expect(page.getByTestId("frame")).toContainText(`the ${clue.noun}.`);

    if (round === 0) {
      // A wrong spoken answer gets a retry, not a game over.
      const other = PREPS.find((p) => p !== clue.prep)!;
      await setSpeech(page, { say: `it's ${other} the ${clue.noun}` });
      await page.keyboard.press("Space");
      await expect(page.getByTestId("blank")).toHaveClass(/wrong/);
      expect((await state(page)).phase).toBe("answer");
    }

    await setSpeech(page, { say: `It's ${clue.prep} the ${clue.noun}.` });
    await page.keyboard.press("Space");
    await expect(page.getByTestId("blank")).toHaveText(clue.prep);
    if (round < 3) await waitPhase(page, "explore");
  }

  await expect(page.getByTestId("results")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("stat-correct")).toHaveText("4");
  expect(new Set(seen).size).toBe(4);
  const final = await state(page);
  expect(final.captured).toEqual(["sleepy"]);
  expect(final.stats!.wrongAnswers).toBe(1);
  expect(errors).toEqual([]);
});

test("an empty search names the place in English and counts as a miss", async ({ page }) => {
  const errors = await boot(page, PRACTICE);
  await page.getByTestId("start").click();
  await waitPhase(page, "explore");
  const s = await state(page);
  const spots = await hook<Array<{ id: string; prep: string }>>(page, "spotsOf", s.clue!.objectId);
  const wrong = spots.find((x) => x.id !== s.clue!.spotId)!;
  await openCloseUp(page, s.clue!.objectId);
  await clickMarker(page, wrong.id);
  await expect(page.getByTestId("caption")).toHaveText(`No ghost ${wrong.prep} the ${s.clue!.noun}.`);
  await waitPhase(page, "search");
  expect((await state(page)).stats!.wrongSearches).toBe(1);
  // Back out with Esc.
  await page.keyboard.press("Escape");
  await waitPhase(page, "explore");
  expect(errors).toEqual([]);
});

test("the ghost slips away after two empty searches, and the new clue leads to it", async ({ page }) => {
  const errors = await boot(page, PRACTICE);
  await page.getByTestId("start").click();
  await waitPhase(page, "explore");
  const first = (await state(page)).clue!;
  // Two empty searches on other objects.
  const decoys = (await hook<Array<{ id: string; objectId: string; room: string }>>(page, "allSpots")).filter(
    (x) => x.room === "bedroom" && x.objectId !== first.objectId
  );
  const d1 = decoys[0];
  const d2 = decoys.find((x) => x.objectId !== d1.objectId)!;
  await openCloseUp(page, d1.objectId);
  await clickMarker(page, d1.id);
  await waitPhase(page, "search");
  await page.keyboard.press("Escape");
  await waitPhase(page, "explore");
  expect((await state(page)).clue!.spotId).toBe(first.spotId); // one miss: it stays
  await openCloseUp(page, d2.objectId);
  await clickMarker(page, d2.id);
  // Second miss: it pops out, laughs, zooms off and Boo gives a new clue.
  await page.waitForFunction(() => (window as unknown as { __hh: { state(): { ghostAnim: string } } }).__hh.state().ghostAnim === "escape");
  await waitPhase(page, "explore");
  const moved = (await state(page)).clue!;
  expect(moved.spotId).not.toBe(first.spotId);
  expect((await state(page)).stats!.relocations).toBe(1);
  await expect(page.getByTestId("clue-text")).toHaveText(moved.text);
  // The spot the new clue names is exactly where the ghost is.
  await findGhost(page);
  expect((await state(page)).ghostAnim).toBe("found");
  expect(errors).toEqual([]);
});

test("a blocked microphone falls back to the word buttons", async ({ page }) => {
  const errors = await boot(page, PRACTICE);
  await page.getByTestId("start").click();
  await waitPhase(page, "explore");
  const clue = await findGhost(page);
  await expect(page.getByTestId("mic")).toBeVisible();
  await expect(page.getByTestId(`word-${clue.prep}`)).toBeDisabled();
  await setSpeech(page, { error: "not-allowed" });
  await page.keyboard.press("Space");
  await expect(page.getByTestId(`word-${clue.prep}`)).toBeEnabled();
  expect((await state(page)).micState).toBe("blocked");
  await page.getByTestId(`word-${clue.prep}`).click();
  await expect(page.getByTestId("blank")).toHaveText(clue.prep);
  expect(errors).toEqual([]);
});

test("mic-free mode: wrong buttons grey out, the right one fills the sentence", async ({ page }) => {
  const errors = await boot(page, PRACTICE);
  await page.getByTestId("start").click();
  await waitPhase(page, "explore");
  await hook(page, "setMic", false);
  const clue = await findGhost(page);
  await expect(page.getByTestId("mic")).toHaveCount(0);
  const wrong = PREPS.find((p) => p !== clue.prep)!;
  await page.getByTestId(`word-${wrong}`).click();
  await expect(page.getByTestId(`word-${wrong}`)).toBeDisabled();
  await expect(page.getByTestId("blank")).toHaveClass(/wrong/);
  await page.keyboard.press(`Digit${PREPS.indexOf(clue.prep as (typeof PREPS)[number]) + 1}`);
  await expect(page.getByTestId("blank")).toHaveText(clue.prep);
  expect(errors).toEqual([]);
});

test("three missed spoken tries open the word buttons (no dead end)", async ({ page }) => {
  const errors = await boot(page, PRACTICE);
  await page.getByTestId("start").click();
  await waitPhase(page, "explore");
  const clue = await findGhost(page);
  for (let i = 0; i < 3; i++) {
    await setSpeech(page, { say: null }); // silence
    await page.keyboard.press("Space");
    await page.waitForFunction((n) => (window as unknown as { __hh: { state(): { answer: { misses: number; listening: boolean } } } }).__hh.state().answer.misses >= n, i + 1);
    await page.waitForFunction(() => !(window as unknown as { __hh: { state(): { answer: { listening: boolean } } } }).__hh.state().answer.listening);
  }
  await expect(page.getByTestId(`word-${clue.prep}`)).toBeEnabled();
  expect(errors).toEqual([]);
});
