import { expect, test, type Page } from "@playwright/test";
import type { MatchState } from "../../src/game/hideSeek/types";
import type { HidingSpot } from "../../src/game/world/world";
import { hook } from "./helpers";
import { BROWSER_STUBS } from "./stubs";

type Snapshot = MatchState & {
  phase: string; englishOpen: boolean; suspicion: number; awareness: "hidden" | "suspicious" | "spotted";
  spots: HidingSpot[]; reachable: HidingSpot[];
  decision: { phase: "decision" | "destination"; secondsLeft: number; searchNumber: number } | null;
};
const snapshot = (page: Page) => hook<Snapshot | null>(page, "hs");
const scale = (page: Page, value: number) => hook(page, "hsTimeScale", value);

async function until(page: Page, description: string, predicate: (s: Snapshot) => boolean, timeout = 60_000) {
  await expect.poll(async () => {
    const s = await snapshot(page);
    return Boolean(s && predicate(s));
  }, { timeout, message: `HARNESS_PRECONDITION_FAILED: ${description}` }).toBe(true);
}

async function open(page: Page, query = "&ghost=shadow&room=dining&seed=4") {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.addInitScript(BROWSER_STUBS);
  await page.addInitScript(() => {
    localStorage.setItem("hh.settings.v1", JSON.stringify({ mic: false, japanese: false, englishLevel: "standard" }));
  });
  await page.goto(`/?e2e=1&fast=1&mode=hideseek${query}`);
  await expect(page.getByTestId("hideseek")).toBeVisible({ timeout: 60_000 });
  await page.waitForFunction(() => Boolean((window as unknown as { __hh?: { hs?: unknown } }).__hh?.hs));
  await scale(page, 0);
  return errors;
}

async function hide(page: Page, spotId = "dining.table.under") {
  await until(page, "match setup", (s) => s.status === "setup" && s.reachable.some((spot) => spot.id === spotId));
  await page.getByTestId(`hs-spot-${spotId}`).click();
  await until(page, "starting English question", (s) => s.english?.spotId === spotId);
  const spot = (await snapshot(page))!.spots.find((item) => item.id === spotId)!;
  await page.getByTestId(`hs-word-${spot.prep}`).click();
  await until(page, "accepted tile answer", (s) => !s.english && s.status === "playing");
}

test("compact top HUD replaces the old rail and follows each phase", async ({ page }) => {
  const errors = await open(page);
  // Setup: top bar, gear and spot list; no eye, no ability yet.
  await expect(page.locator(".hs-rail")).toHaveCount(0);
  await expect(page.getByTestId("hs-hud")).toContainText("Shadow");
  await expect(page.getByTestId("hs-searches")).toHaveAttribute("aria-label", "0 of 5 searches done");
  await expect(page.getByTestId("hs-relocations")).toHaveText("2/2");
  await expect(page.getByTestId("hs-dock")).toBeVisible();
  await expect(page.getByTestId("hs-awareness")).toHaveCount(0);
  await expect(page.getByTestId("hs-ability-dock")).toHaveCount(0);
  // The room name is announced briefly.
  await expect(page.getByTestId("hs-toast")).toContainText("Dining room");

  await hide(page);
  // Stay or Move: top bar suppressed, eye not competing, the ability still at hand beside the card.
  await expect(page.getByTestId("hs-decision-overlay")).toHaveAttribute("data-phase", "decision");
  await expect(page.getByTestId("hs-hud")).toBeHidden();
  await expect(page.getByTestId("hs-awareness")).toHaveAttribute("data-shown", "false");
  await expect(page.getByTestId("hs-dock")).toHaveCount(0);
  await page.getByTestId("hs-stay").click();

  // Hiding: no dock; the hiding place is announced, then fades; the eye shows "Hidden" for a moment.
  await expect(page.getByTestId("hs-hud")).toBeVisible();
  await expect(page.getByTestId("hs-current-spot")).toHaveText("Under the table");
  await scale(page, 0.5);
  await expect(page.getByTestId("hs-awareness")).toHaveAttribute("data-shown", "true");
  await scale(page, 0);
  const s = (await snapshot(page))!;
  await expect(page.getByTestId("hs-awareness")).toHaveAttribute("data-state", s.awareness);
  // No numeric suspicion anywhere on screen, but it is still in the test snapshot.
  expect(typeof s.suspicion).toBe("number");
  await expect(page.locator("meter")).toHaveCount(0);
  await expect(page.getByTestId("hs-match")).not.toContainText("%");
  await expect(page.getByTestId("hs-match")).not.toContainText("Suspicion");

  // Ability in the lower right, keyboard E works, then shows Used.
  const ability = (await page.getByTestId("hs-ability-dock").boundingBox())!;
  const view = page.viewportSize()!;
  expect(ability.x + ability.width).toBeGreaterThan(view.width - 40);
  expect(ability.y + ability.height).toBeGreaterThan(view.height - 40);
  await expect(page.getByTestId("hs-ability")).toHaveText(/Use Ability/);
  await page.keyboard.press("e");
  await until(page, "Shadow's Vanish armed from the keyboard", (next) => next.abilityUsed);
  await expect(page.getByTestId("hs-ability")).toHaveText("Used");
  await expect(page.getByTestId("hs-ability")).toBeDisabled();

  // The location control repeats the hiding place.
  await page.getByTestId("hs-where").click();
  await expect(page.getByTestId("hs-toast")).toContainText("Under the table");

  // A completed search fills a pip.
  await scale(page, 4);
  await until(page, "first search completes", (next) => next.stats.completedSearches >= 1 || next.status !== "playing", 120_000);
  await scale(page, 0);
  const after = (await snapshot(page))!;
  if (after.status === "playing") {
    await expect(page.getByTestId("hs-searches")).toHaveAttribute("aria-label", `${5 - after.searchesLeft} of 5 searches done`);
  }

  // Settings holds Main Menu; leaving clears every match indicator.
  await page.getByTestId("hs-settings").click();
  await expect(page.getByTestId("hs-main-menu")).toBeVisible();
  await page.getByTestId("hs-main-menu").click();
  await expect(page.getByTestId("start")).toBeVisible();
  await expect(page.getByTestId("hs-awareness")).toHaveCount(0);
  await expect(page.getByTestId("hs-hud")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("the stealth eye never outlives the match", async ({ page }) => {
  const errors = await open(page);
  await hide(page);
  await page.getByTestId("hs-stay").click();
  await scale(page, 40);
  await until(page, "match ends", (s) => s.status === "won" || s.status === "lost", 150_000);
  await expect(page.getByTestId("hs-awareness")).toHaveCount(0);
  await expect(page.getByTestId("hs-ability-dock")).toHaveCount(0);
  await expect(page.getByTestId("hs-results")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("hs-hud")).toHaveCount(0);
  expect(errors).toEqual([]);
});
