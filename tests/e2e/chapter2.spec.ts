import { expect, test, type Page } from "@playwright/test";
import { boot, clickMarker, hook, openCloseUp, state, waitAnswered, waitPhase, type HhState } from "./helpers";

type ChapterState = HhState & {
  ghost: string;
  lantern: string[];
  doorsOpen: string[];
  busy: boolean;
  sunrise: boolean;
  scope: string;
  chapter: number;
  cutscene: string | null;
  viewFloor: number;
  steam: number;
  fanOn: boolean;
  blackout: boolean;
  player: HhState["player"] & { y: number; floor: number; stairs: boolean };
};

const chapterState = (page: Page) => state(page) as Promise<ChapterState>;

const GHOSTS = ["sleepy", "hungry", "sneaky", "mischief", "bouncy", "bubbles", "melody", "shadow"];
const ROUNDS = [1, 1, 1, 4, 1, 1, 1, 4];
const ROOMS: Record<string, [number, number, number]> = {
  sleepy: [-4, -4.8, 0],
  hungry: [4, -4.8, 0],
  sneaky: [4, 4.8, 0],
  mischief: [-4, 4.8, 0],
  bouncy: [-4, -4.8, 1],
  bubbles: [4, -4.8, 1],
  melody: [-4, 4.8, 1],
  shadow: [4, 4.8, 1]
};

async function enterCurrentRoom(page: Page) {
  const s = await chapterState(page);
  const [x, z, floor] = ROOMS[s.ghost];
  await hook(page, "teleport", x, z > 0 ? z - 1.2 : z + 1.2, floor);
  await hook(page, "teleport", x, z, floor);
  await page.waitForFunction(() => (window as unknown as { __hh: { state(): { clueShown: boolean } } }).__hh.state().clueShown, null, {
    timeout: 30_000
  });
}

/** Use the real find-and-answer UI, with the microphone disabled. */
async function answerCurrentClue(page: Page) {
  await waitPhase(page, "explore");
  const clue = (await chapterState(page)).clue!;
  await openCloseUp(page, clue.objectId);
  await clickMarker(page, clue.spotId);
  await waitPhase(page, "answer");
  await page.getByTestId(`word-${clue.prep}`).click();
  await waitAnswered(page, clue.prep);
  return clue;
}

async function unlockAndStartChapter2(page: Page) {
  await page.addInitScript(() => localStorage.setItem("hh.ch2.v1", "1"));
  const errors = await boot(page, "&mode=story&intro=0&chapter=2");
  await page.getByTestId("start").click();
  await waitPhase(page, "explore");
  return errors;
}

test("the full adventure catches all eight ghosts before sunrise", async ({ page }) => {
  test.setTimeout(420_000);
  const errors = await boot(page, "&mode=story&intro=0");
  await page.getByTestId("start").click();
  await hook(page, "setMic", false);
  await waitPhase(page, "explore");

  for (let index = 0; index < GHOSTS.length; index++) {
    const ghost = GHOSTS[index];
    const before = await chapterState(page);
    expect(before.ghost).toBe(ghost);
    expect(before.sunrise).toBe(false);
    expect(before.phase).not.toBe("outro");
    if (index < 4) expect(before.doorsOpen).not.toContain("stairs");

    await enterCurrentRoom(page);
    for (let round = 0; round < ROUNDS[index]; round++) {
      const atRound = await chapterState(page);
      expect(atRound.sunrise).toBe(false);
      expect(atRound.phase).not.toBe("outro");
      if (index < 4) expect(atRound.doorsOpen).not.toContain("stairs");
      await answerCurrentClue(page);

      if (round + 1 < ROUNDS[index]) {
        await page.waitForFunction(
          ([wantedIndex, wantedRound]) => {
            const s = (window as unknown as { __hh: { state(): { index: number; round: number; phase: string; busy: boolean } } }).__hh.state();
            return s.index === wantedIndex && s.round === wantedRound && s.phase === "explore" && !s.busy;
          },
          [index, round + 1],
          { timeout: 40_000 }
        );
      }
    }

    await page.waitForFunction(
      (count) => (window as unknown as { __hh: { state(): { lantern: string[] } } }).__hh.state().lantern.length === count,
      index + 1,
      { timeout: 40_000 }
    );
    expect((await chapterState(page)).lantern).toEqual(GHOSTS.slice(0, index + 1));

    if (index < 3) {
      const after = await chapterState(page);
      expect(after.doorsOpen).not.toContain("stairs");
      expect(after.sunrise).toBe(false);
      expect(after.phase).not.toBe("outro");
      await page.waitForFunction(
        () => {
          const s = (window as unknown as { __hh: { state(): { phase: string; busy: boolean } } }).__hh.state();
          return s.phase === "explore" && !s.busy;
        },
        null,
        { timeout: 40_000 }
      );
    } else if (index === 3) {
      await expect(page.getByTestId("skip")).toBeVisible({ timeout: 40_000 });
      expect((await chapterState(page)).cutscene).toBe("chapter2");
      await page.getByTestId("skip").click();
      await page.waitForFunction(
        () => {
          const s = (window as unknown as { __hh: { state(): { chapter: number; phase: string; busy: boolean; doorsOpen: string[] } } }).__hh.state();
          return s.chapter === 2 && s.phase === "explore" && !s.busy && s.doorsOpen.includes("stairs");
        },
        null,
        { timeout: 40_000 }
      );
    } else if (index < 7) {
      const after = await chapterState(page);
      expect(after.sunrise).toBe(false);
      expect(after.phase).not.toBe("outro");
      await page.waitForFunction(
        () => {
          const s = (window as unknown as { __hh: { state(): { phase: string; busy: boolean } } }).__hh.state();
          return s.phase === "explore" && !s.busy;
        },
        null,
        { timeout: 40_000 }
      );
    }
  }

  await waitPhase(page, "outro", 60_000);
  await page.waitForFunction(() => (window as unknown as { __hh: { state(): { sunrise: boolean } } }).__hh.state().sunrise, null, {
    timeout: 60_000
  });
  await waitPhase(page, "explore", 60_000);
  await hook(page, "teleport", -8.3, 0, 0);
  await hook(page, "teleport", -9.2, 0, 0);
  await expect(page.getByTestId("results")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("results-ghosts").locator('[data-testid^="result-"]')).toHaveCount(8);
  await expect(page.getByTestId("stat-correct")).toHaveText("14");
  expect((await chapterState(page)).captured).toEqual(GHOSTS);
  expect(errors).toEqual([]);
});

test("Chapter 2 alone starts upstairs with the stairs gate open", async ({ page }) => {
  const errors = await unlockAndStartChapter2(page);
  const s = await chapterState(page);
  expect(s.scope).toBe("ch2");
  expect(s.chapter).toBe(2);
  expect(s.player.floor).toBe(1);
  expect(s.viewFloor).toBe(1);
  expect(s.doorsOpen).toContain("stairs");
  expect(errors).toEqual([]);
});

test("the keyboard walks up and down the stairs", async ({ page }) => {
  const errors = await unlockAndStartChapter2(page);

  await hook(page, "teleport", 2.9, 0, 0);
  await hook(page, "setYaw", -Math.PI / 2, 0.9);
  expect((await chapterState(page)).player.floor).toBe(0);
  await page.keyboard.down("KeyW");
  try {
    await page.waitForFunction(() => (window as unknown as { __hh: { state(): { player: { floor: number } } } }).__hh.state().player.floor === 1, null, {
      timeout: 30_000
    });
  } finally {
    await page.keyboard.up("KeyW");
  }
  expect((await chapterState(page)).player.floor).toBe(1);

  await hook(page, "teleport", 7, 0, 1);
  await hook(page, "setYaw", Math.PI / 2, 0.9);
  await page.keyboard.down("KeyW");
  try {
    await page.waitForFunction(() => (window as unknown as { __hh: { state(): { player: { floor: number } } } }).__hh.state().player.floor === 0, null, {
      timeout: 30_000
    });
  } finally {
    await page.keyboard.up("KeyW");
  }
  expect((await chapterState(page)).player.floor).toBe(0);
  expect(errors).toEqual([]);
});

test("Shadow escapes in blackout three times, then stays visible for capture", async ({ page }) => {
  test.setTimeout(180_000);
  const errors = await unlockAndStartChapter2(page);
  await hook(page, "setMic", false);
  await hook(page, "jump", 3);
  await hook(page, "teleport", 4, 5.5, 1);
  await page.waitForFunction(() => {
    const s = (window as unknown as { __hh: { state(): { ghost: string; clueShown: boolean; phase: string } } }).__hh.state();
    return s.ghost === "shadow" && s.clueShown && s.phase === "explore";
  });

  const preps: string[] = [];
  for (let round = 0; round < 4; round++) {
    const before = await chapterState(page);
    expect(before.blackout).toBe(false);
    preps.push(before.clue!.prep);

    if (round === 3) {
      await page.evaluate(() => {
        const w = window as unknown as Window & { __hh: { state(): { blackout: boolean } }; __sawBlackout: boolean; __blackoutWatch: number };
        w.__sawBlackout = false;
        w.__blackoutWatch = window.setInterval(() => {
          if (w.__hh.state().blackout) w.__sawBlackout = true;
        }, 20);
      });
    }

    await answerCurrentClue(page);
    if (round < 3) {
      await page.waitForFunction(() => (window as unknown as { __hh: { state(): { blackout: boolean } } }).__hh.state().blackout, null, {
        timeout: 15_000
      });
      await page.waitForFunction(
        (nextRound) => {
          const s = (window as unknown as { __hh: { state(): { round: number; phase: string; busy: boolean; blackout: boolean } } }).__hh.state();
          return s.round === nextRound && s.phase === "explore" && !s.busy && !s.blackout;
        },
        round + 1,
        { timeout: 40_000 }
      );
    }
  }

  await page.waitForFunction(() => (window as unknown as { __hh: { state(): { lantern: string[] } } }).__hh.state().lantern.includes("shadow"), null, {
    timeout: 40_000
  });
  const sawFinalBlackout = await page.evaluate(() => {
    const w = window as unknown as Window & { __sawBlackout: boolean; __blackoutWatch: number };
    window.clearInterval(w.__blackoutWatch);
    return w.__sawBlackout;
  });
  expect(preps).toEqual(["on", "in", "under", "by"]);
  expect(sawFinalBlackout).toBe(false);
  expect(errors).toEqual([]);
});

test("the bathroom fan switch clears thick steam", async ({ page }) => {
  const errors = await unlockAndStartChapter2(page);
  await hook(page, "goTo", "bathroom.switch");
  const change = await hook<{ before: { steam: number; fanOn: boolean }; after: { steam: number; fanOn: boolean } }>(page, "fanSwitchTest");
  expect(change.before).toEqual({ steam: 1, fanOn: false });
  expect(change.after.fanOn).toBe(true);
  expect(change.after.steam).toBeLessThan(0.15);
  expect(errors).toEqual([]);
  await page.close();
});
