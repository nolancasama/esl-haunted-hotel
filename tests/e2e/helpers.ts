import { expect, type Page } from "@playwright/test";
import { BROWSER_STUBS } from "./stubs";

export interface HhState {
  screen: string;
  phase: string;
  mode: string;
  micState: string;
  clue: { spotId: string; objectId: string; prep: string; noun: string; text: string } | null;
  clueShown: boolean;
  status: string | null;
  round: number;
  index: number;
  stats: { correctAnswers: number; firstTryAnswers: number; wrongAnswers: number; wrongSearches: number; relocations: number } | null;
  captured: string[];
  answer: { status: string; buttons: boolean; disabled: string[]; filled: string | null; misses: number };
  focusId: string | null;
  searchId: string | null;
  selectedSpot: string | null;
  helpLevel: number;
  player: { x: number; z: number };
  ghostAnim: string;
}

export const PREPS = ["in", "on", "under", "by"] as const;

/** Open the game with speech stubs, fast pacing and the test hook. Returns collected page errors. */
export async function boot(page: Page, query = ""): Promise<string[]> {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.addInitScript(BROWSER_STUBS);
  await page.goto(`/?e2e=1&fast=1&seed=11${query}`);
  await expect(page.getByTestId("start")).toBeVisible();
  return errors;
}

export function state(page: Page): Promise<HhState> {
  return page.evaluate(() => (window as unknown as { __hh: { state(): HhState } }).__hh.state());
}

export async function waitPhase(page: Page, phase: string | string[], timeout = 30_000) {
  const phases = Array.isArray(phase) ? phase : [phase];
  await page.waitForFunction(
    (ps) => ps.includes((window as unknown as { __hh: { state(): { phase: string } } }).__hh.state().phase),
    phases,
    { timeout }
  );
}

export async function hook<T>(page: Page, fn: string, ...args: unknown[]): Promise<T> {
  return page.evaluate(
    ([name, a]) => {
      const api = (window as unknown as { __hh: Record<string, (...x: unknown[]) => unknown> }).__hh;
      return api[name as string](...(a as unknown[])) as T;
    },
    [fn, args] as const
  );
}

export async function setSpeech(page: Page, plan: { say?: string | null; error?: string | null }) {
  await page.evaluate((p) => {
    const w = window as unknown as { __speech: { say: string | null; error: string | null } };
    w.__speech.say = p.say ?? null;
    w.__speech.error = p.error ?? null;
  }, plan);
}

/** Walk up to an object (teleport next to it) and open the close-up with E. */
export async function openCloseUp(page: Page, objectId: string) {
  await hook(page, "goTo", objectId);
  await page.waitForTimeout(150);
  await page.keyboard.press("KeyE");
  await waitPhase(page, "search");
  // Let the camera settle so markers sit where they will be clicked.
  await page.waitForTimeout(1300);
}

/** Click a search marker in the close-up. */
export async function clickMarker(page: Page, spotId: string) {
  const p = await hook<{ x: number; y: number } | null>(page, "screenOf", spotId);
  if (!p) throw new Error(`no marker for ${spotId}`);
  await page.mouse.click(p.x, p.y);
}

/** Search the current clue's spot and wait for the answer phase. */
export async function findGhost(page: Page) {
  const s = await state(page);
  if (!s.clue) throw new Error("no clue");
  await openCloseUp(page, s.clue.objectId);
  await clickMarker(page, s.clue.spotId);
  await waitPhase(page, "answer");
  return s.clue;
}
