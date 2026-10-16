import { expect, test, type Page } from "@playwright/test";
import { boot, clickMarker, hook, openCloseUp, setSpeech, state, waitAnswered, waitPhase, type HhState } from "./helpers";

// Phase 2: the full hotel story.
const INSIDE: Record<string, [number, number]> = {
  bedroom: [-4, -4.8],
  dining: [4, -4.8],
  storage: [4, 4.8],
  library: [-4, 4.8]
};
const ROOM_OF: Record<string, string> = { sleepy: "bedroom", hungry: "dining", sneaky: "storage", mischief: "library" };

type StoryState = HhState & { ghost: string; lantern: string[]; beaconDoor: string | null; doorsOpen: string[]; awaitingEntry: boolean; busy: boolean; sunrise: boolean; replayUnlocked: boolean };
const story = (page: Page) => state(page) as Promise<StoryState>;

/** Walk through the open door of the current ghost's room. */
async function enterCurrentRoom(page: Page) {
  const s = await story(page);
  const [x, z] = INSIDE[ROOM_OF[s.ghost]];
  await hook(page, "teleport", x, z > 0 ? z - 1.2 : z + 1.2);
  await page.waitForTimeout(200);
  await hook(page, "teleport", x, z);
  await page.waitForFunction(() => (window as unknown as { __hh: { state(): { clueShown: boolean } } }).__hh.state().clueShown, null, { timeout: 30_000 });
}

/** Find the ghost and say the answer. */
async function catchOnce(page: Page) {
  await waitPhase(page, "explore");
  const s = await story(page);
  await openCloseUp(page, s.clue!.objectId);
  await clickMarker(page, s.clue!.spotId);
  await waitPhase(page, "answer");
  await setSpeech(page, { say: `it's ${s.clue!.prep} the ${s.clue!.noun}` });
  await page.keyboard.press("Space");
  await waitAnswered(page, s.clue!.prep);
  await page.waitForFunction(
    () => {
      const st = (window as unknown as { __hh: { state(): { phase: string; busy: boolean } } }).__hh.state();
      return ["explore", "outro"].includes(st.phase) && !st.busy;
    },
    null,
    { timeout: 40_000 }
  );
  return s.clue!;
}

test("the intro: walk in, the door slams once you are inside, a hop and a smooth turn to face it", async ({ page }) => {
  const errors = await boot(page, "&mode=story");
  // Record every rendered frame from the start of the intro until Boo speaks.
  await page.evaluate(() => {
    type P = { x: number; z: number; yaw: number; startle: boolean; opacity: number };
    const api = (window as unknown as { __hh: { state(): { phase: string; player: P; doorsOpen: string[]; line: unknown } } }).__hh;
    const w = window as unknown as { introFrames: { x: number; z: number; yaw: number; startle: boolean; opacity: number; door: boolean }[]; introDone: boolean };
    w.introFrames = [];
    w.introDone = false;
    const tick = () => {
      const s = api.state();
      if (s.phase === "intro") w.introFrames.push({ ...s.player, door: s.doorsOpen.includes("entrance") });
      if (s.phase === "intro" && s.line) w.introDone = true;
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.getByTestId("start").click();
  await page.waitForFunction(() => (window as unknown as { introDone: boolean }).introDone, null, { timeout: 60_000 });
  const frames = await page.evaluate(() => (window as unknown as { introFrames: { x: number; z: number; yaw: number; startle: boolean; opacity: number; door: boolean }[] }).introFrames);
  const walk = frames.slice(frames.findIndex((f) => f.x < -9)); // after the cut to the doorstep
  expect(walk.length).toBeGreaterThan(5);
  let maxStep = 0;
  let maxTurn = 0;
  for (let i = 1; i < walk.length; i++) {
    maxStep = Math.max(maxStep, Math.hypot(walk[i].x - walk[i - 1].x, walk[i].z - walk[i - 1].z));
    let d = Math.abs(walk[i].yaw - walk[i - 1].yaw) % (Math.PI * 2);
    if (d > Math.PI) d = Math.PI * 2 - d;
    maxTurn = Math.max(maxTurn, d);
  }
  expect(maxStep).toBeLessThan(0.4); // no teleport (a frame moves at most ~0.22 m, even at 10 fps or less)
  expect(maxTurn).toBeLessThan(2.4); // no instant half-turn
  const slam = walk.findIndex((f) => !f.door);
  expect(slam).toBeGreaterThan(0);
  expect(walk[slam].x).toBeGreaterThan(-7.6); // inside before the door shuts
  const reaction = walk.slice(slam);
  expect(reaction.some((f) => f.startle)).toBe(true);
  // the whole reaction is on screen: the player is never faded out for standing in the camera's way
  for (const f of reaction) expect(f.opacity).toBeGreaterThan(0.9);
  // the hop and turn happen on the spot
  for (const f of reaction) expect(Math.hypot(f.x - walk[slam].x, f.z - walk[slam].z)).toBeLessThan(0.05);
  // ...through some in-between headings, ending up looking at the door (west)
  const turning = reaction.filter((f) => f.startle && Math.abs(Math.cos(f.yaw)) > 0.3).length;
  expect(turning).toBeGreaterThan(0);
  const last = walk[walk.length - 1];
  expect(Math.sin(last.yaw)).toBeLessThan(-0.95);
  expect(errors).toEqual([]);
});

test("the intro plays, can be skipped, and opens only the bedroom", async ({ page }) => {
  const errors = await boot(page, "&mode=story");
  // The default 120 ms voice + fast pause is shorter than expect's polling interval.
  await page.evaluate(() => { (window as unknown as { __ttsMs: number }).__ttsMs = 2000; });
  await page.getByTestId("start").click();
  await waitPhase(page, "intro");
  await expect(page.getByTestId("subtitle")).toContainText("Oh no! Four ghosts are hiding!", { timeout: 30_000 });
  await page.getByTestId("skip").click();
  await waitPhase(page, "explore");
  const s = await story(page);
  expect(s.doorsOpen).toEqual(["bedroom"]);
  expect(s.beaconDoor).toBe("bedroom");
  expect(s.clueShown).toBe(false); // the clue waits until you walk in
  await expect(page.getByTestId("counter")).toContainText("0/4");
  expect(errors).toEqual([]);
});

// Chapter 1 on its own keeps the original four-ghost story and its sunrise ending.
test("rooms open in order, every clue leads to its ghost, and the ending leads to results and replay", async ({ page }) => {
  test.setTimeout(300_000);
  const errors = await boot(page, "&mode=story&intro=0&chapter=1");
  await page.getByTestId("start").click();
  await waitPhase(page, "explore");
  const caught: string[] = [];
  const mischiefPreps: string[] = [];
  for (let ghost = 0; ghost < 4; ghost++) {
    const before = await story(page);
    const room = ROOM_OF[before.ghost];
    // only this room (and rooms already cleared) are open
    expect(before.doorsOpen).toContain(room);
    expect(before.doorsOpen.length).toBe(ghost + 1);
    await enterCurrentRoom(page);
    await expect(page.getByTestId("clue-text")).toHaveText((await story(page)).clue!.text);
    const rounds = before.ghost === "mischief" ? 4 : 1;
    for (let r = 0; r < rounds; r++) {
      const clue = await catchOnce(page);
      if (before.ghost === "mischief") mischiefPreps.push(clue.prep);
    }
    caught.push(before.ghost);
    if (ghost < 3) {
      await expect(page.getByTestId("counter")).toContainText(`${ghost + 1}/4`);
      expect((await story(page)).lantern).toEqual(caught);
    }
  }
  expect(new Set(mischiefPreps).size).toBe(4);
  // The ending: the front door opens at sunrise and you walk out.
  await page.waitForFunction(() => (window as unknown as { __hh: { state(): { sunrise: boolean } } }).__hh.state().sunrise, null, { timeout: 60_000 });
  await waitPhase(page, "explore", 60_000);
  await hook(page, "teleport", -8.3, 0);
  await page.waitForTimeout(400);
  await hook(page, "teleport", -9.2, 0);
  await expect(page.getByTestId("results")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("stat-correct")).toHaveText("7");
  await expect(page.getByTestId("replay-unlocked")).toBeVisible();
  expect((await story(page)).replayUnlocked).toBe(true);
  // Play Again = replay mode, with the same rooms.
  await page.getByTestId("play-again").click();
  await waitPhase(page, "explore", 30_000);
  const replay = await story(page);
  expect(replay.mode).toBe("replay");
  expect(replay.ghost).toBe("sleepy");
  expect(errors).toEqual([]);
});

test("Hungry slips away after two empty searches and the new clue is right", async ({ page }) => {
  const errors = await boot(page, "&mode=story&intro=0");
  await page.getByTestId("start").click();
  await waitPhase(page, "explore");
  await enterCurrentRoom(page);
  await catchOnce(page); // Sleepy
  await waitPhase(page, "explore");
  await enterCurrentRoom(page); // dining
  const first = (await story(page)).clue!;
  expect(first.spotId).toBe("dining.table.on");
  const decoys = (await hook<Array<{ id: string; objectId: string; room: string }>>(page, "allSpots")).filter(
    (x) => x.room === "dining" && x.objectId !== first.objectId
  );
  const d1 = decoys[0];
  const d2 = decoys.find((x) => x.objectId !== d1.objectId)!;
  await waitPhase(page, "explore");
  await openCloseUp(page, d1.objectId);
  await clickMarker(page, d1.id);
  await waitPhase(page, "search");
  await page.keyboard.press("Escape");
  await waitPhase(page, "explore");
  await openCloseUp(page, d2.objectId);
  await clickMarker(page, d2.id);
  await page.waitForFunction(() => (window as unknown as { __hh: { state(): { ghostAnim: string } } }).__hh.state().ghostAnim === "escape");
  await waitPhase(page, "explore");
  const moved = (await story(page)).clue!;
  expect(moved.spotId).not.toBe(first.spotId);
  await expect(page.getByTestId("clue-text")).toHaveText(moved.text);
  await catchOnce(page);
  expect((await story(page)).lantern).toEqual(["sleepy", "hungry"]);
  expect(errors).toEqual([]);
});

test("a locked door says so", async ({ page }) => {
  const errors = await boot(page, "&mode=story&intro=0");
  await page.getByTestId("start").click();
  await waitPhase(page, "explore");
  // Walk into the (locked) library door from the lobby.
  await hook(page, "teleport", -4, 2.6);
  const before = await story(page);
  expect(before.doorsOpen).not.toContain("library");
  // Hold the key that moves the player towards +z (camera-relative): find it by trying.
  for (const key of ["KeyS", "KeyW"]) {
    await page.keyboard.down(key);
    await page.waitForTimeout(1200);
    await page.keyboard.up(key);
    const s = await story(page);
    if (s.player.z > 3.4) break;
    await hook(page, "teleport", -4, 2.6);
  }
  await page.waitForFunction(() => (window as unknown as { __hh: { state(): { lastToast: string | null } } }).__hh.state().lastToast === "locked");
  expect((await story(page)).player.z).toBeLessThan(4); // the door really blocks
  // When the message fades, the "go to the open door" hint is back.
  await expect(page.getByTestId("hint")).toContainText(/あいている ドアへ|open door/, { timeout: 10_000 });
  expect(errors).toEqual([]);
});
