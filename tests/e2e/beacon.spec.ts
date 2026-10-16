import { expect, test, type Page } from "@playwright/test";
import { boot, hook, state, waitPhase, type HhState } from "./helpers";

type Spot = { x: number; z: number; floor: number };
type BeaconState = Omit<HhState, "player"> & {
  player: Spot & { y: number; autoEntry: boolean; frozen: boolean; destination: Spot | null };
  beaconDoor: string | null;
  beaconStarts: number;
  roomIntroductions: number;
  busy: boolean;
  time: number;
  lastToast: string | null;
};
type Api = { state(): BeaconState; camera(): { x: number; y: number; z: number } };
type Frame = Spot & { y: number; stairs: boolean };
const read = (page: Page) => state(page) as Promise<BeaconState>;

async function ready(page: Page, index = 0) {
  const errors = await boot(page, "&mode=story&intro=0");
  await page.getByTestId("start").click();
  await waitPhase(page, "explore");
  if (index) await hook(page, "jump", index);
  await page.waitForFunction(() => {
    const s = (window as unknown as { __hh: Api }).__hh.state();
    return s.phase === "explore" && !s.busy && !s.player.frozen;
  });
  await hook(page, "setYaw", 0);
  return errors;
}

async function setup(page: Page, id = "bedroom", open = true) {
  // Position outside the radius before arming. Only the approach under test uses real movement.
  await hook(page, "teleport", id === "stairs" ? 1.7 : -4, id === "stairs" ? 0 : -1.9, 0);
  return hook<Spot>(page, "beaconSetup", id, open);
}

async function autoStarted(page: Page) {
  await page.waitForFunction(() => (window as unknown as { __hh: Api }).__hh.state().player.autoEntry);
}

async function settledEntry(page: Page, starts: number, introductions: number) {
  await page.waitForFunction(() => {
    const s = (window as unknown as { __hh: Api }).__hh.state();
    return !s.player.destination && s.player.z < -4.6 && s.clueShown && !s.busy;
  }, null, { timeout: 90_000 });
  const s = await read(page);
  expect(s.player.x).toBeCloseTo(-4, 0);
  expect(s.player.z).toBeGreaterThan(-5.4);
  expect(s.beaconStarts).toBe(starts + 1);
  expect(s.roomIntroductions).toBe(introductions + 1);
  expect(s.clue?.text).toBeTruthy();
}

async function letFramesPass(page: Page, seconds = 0.8) {
  const before = (await read(page)).time;
  await page.waitForFunction((target) => (window as unknown as { __hh: Api }).__hh.state().time > target, before + seconds);
}

async function clickCircle(page: Page, spot: Spot) {
  const pos = { x: spot.x, y: 15, z: spot.z + 6 };
  await hook(page, "look", pos, { x: spot.x, y: 0.1, z: spot.z }, true);
  await page.waitForFunction((want) => {
    const c = (window as unknown as { __hh: Api }).__hh.camera();
    return Math.hypot(c.x - want.x, c.y - want.y, c.z - want.z) < 0.05;
  }, pos);
  const pixel = await hook<{ x: number; y: number }>(page, "project", spot.x, 0.015, spot.z);
  expect(await page.evaluate((p) => document.elementFromPoint(p.x, p.y)?.tagName, pixel)).toBe("CANVAS");
  await page.mouse.click(pixel.x, pixel.y);
}

test.afterEach(async ({ page }, info) => {
  if (info.status === info.expectedStatus) return;
  await info.attach("beacon-state", { body: JSON.stringify(await read(page)), contentType: "application/json" });
});

test("held W keeps the automatic doorway walk, introduces the ghost once, and exit does not retrigger", async ({ page }, info) => {
  const errors = await ready(page);
  await setup(page);
  const before = await read(page);
  await page.keyboard.down("KeyW");
  try {
    // This must still be a path while W is held, well after the initial trigger frame.
    await page.waitForFunction(() => {
      const s = (window as unknown as { __hh: Api }).__hh.state();
      return s.player.autoEntry && s.player.z < -3.7;
    });
    const during = await read(page);
    expect(during.player.destination?.z).toBeLessThan(-4.6);
  } finally { await page.keyboard.up("KeyW"); }
  await settledEntry(page, before.beaconStarts, before.roomIntroductions);
  await page.screenshot({ path: info.outputPath("beacon-entry-clue.png") });

  // Walk out again through the same circle with real keyboard movement.
  await hook(page, "setYaw", 0);
  await page.keyboard.down("KeyS");
  try {
    await page.waitForFunction(() => (window as unknown as { __hh: Api }).__hh.state().player.z > -2.9);
  } finally { await page.keyboard.up("KeyS"); }
  await letFramesPass(page);
  const after = await read(page);
  expect(after.player.autoEntry).toBe(false);
  expect(after.beaconStarts).toBe(before.beaconStarts + 1);
  expect(after.roomIntroductions).toBe(before.roomIntroductions + 1);
  expect(errors).toEqual([]);
});

test("a mouse floor tap onto the beacon continues through the doorway", async ({ page }) => {
  const errors = await ready(page);
  const spot = await setup(page);
  const before = await read(page);
  await clickCircle(page, spot);
  await autoStarted(page);
  await settledEntry(page, before.beaconStarts, before.roomIntroductions);
  expect(errors).toEqual([]);
});

test("held joystick movement onto the beacon continues into the room", async ({ page }) => {
  const errors = await ready(page);
  await setup(page);
  const before = await read(page);
  await hook(page, "joy", 0, 1);
  try {
    await page.waitForFunction(() => {
      const p = (window as unknown as { __hh: Api }).__hh.state().player;
      return p.autoEntry && p.z < -3.7;
    });
  } finally { await hook(page, "joy", 0, 0); }
  await settledEntry(page, before.beaconStarts, before.roomIntroductions);
  expect(errors).toEqual([]);
});

test("walking along the wall onto the circle (sideways key held) still carries the player into the room", async ({ page }) => {
  const errors = await ready(page);
  await setup(page);
  // West of the ring, on its line: with camera yaw 0, D walks +x along the lobby wall onto it.
  await hook(page, "teleport", -6.4, -3.3, 0);
  const before = await read(page);
  await page.keyboard.down("KeyD");
  try {
    await autoStarted(page);
    // Arrived ~1 m inside: let go (after that the key moves the player freely again, as it should).
    await page.waitForFunction(() => {
      const p = (window as unknown as { __hh: Api }).__hh.state().player;
      return !p.autoEntry && !p.destination && p.z < -4.6;
    }, null, { timeout: 60_000 });
  } finally {
    await page.keyboard.up("KeyD");
  }
  await settledEntry(page, before.beaconStarts, before.roomIntroductions);
  expect(errors).toEqual([]);
});

test("backwards input cancels; the circle stays quiet until the player steps off it, then works again", async ({ page }) => {
  const errors = await ready(page);
  await setup(page);
  await page.keyboard.down("KeyW");
  await autoStarted(page);
  await page.keyboard.up("KeyW");
  const triggered = await read(page);
  // S points back out of the doorway: cancel, and keep walking back off the ring.
  await page.keyboard.down("KeyS");
  try {
    await page.waitForFunction(() => {
      const p = (window as unknown as { __hh: Api }).__hh.state().player;
      return !p.autoEntry && !p.destination;
    });
    await letFramesPass(page, 1.2);
  } finally {
    await page.keyboard.up("KeyS");
  }
  const cancelled = await read(page);
  expect(cancelled.beaconStarts).toBe(triggered.beaconStarts); // no retrigger on the way off
  expect(cancelled.player.z).toBeGreaterThan(-3.3 + 0.62); // off the ring, back in the lobby
  // Walking onto it again tries again.
  await page.keyboard.down("KeyW");
  try {
    await settledEntry(page, triggered.beaconStarts, triggered.roomIntroductions);
  } finally {
    await page.keyboard.up("KeyW");
  }
  expect(errors).toEqual([]);
});

test("locked beacon door and closed stairs gate stay inert without locked feedback", async ({ page }, info) => {
  const errors = await ready(page);
  for (const id of ["bedroom", "stairs"]) {
    if (id === "stairs") {
      await hook(page, "jump", 4);
      await page.waitForFunction(() => {
        const s = (window as unknown as { __hh: Api }).__hh.state();
        return s.phase === "explore" && !s.busy && !s.player.frozen;
      });
    }
    const spot = await setup(page, id, false);
    const before = await read(page);
    await hook(page, "teleport", spot.x, spot.z, spot.floor);
    await letFramesPass(page);
    const after = await read(page);
    expect(after.beaconDoor).toBe(id);
    expect(after.beaconStarts).toBe(before.beaconStarts);
    expect(after.player.destination).toBeNull();
    expect(after.lastToast).toBe(before.lastToast);
    expect(after.player.floor).toBe(0);
    if (id === "bedroom") {
      for (const view of [
        { name: "entrance-lock", pos: { x: -4.5, y: 3, z: 2.5 }, target: { x: -8, y: 1.25, z: 0 } },
        { name: "room-lock", pos: { x: -4, y: 3, z: 0 }, target: { x: -4, y: 1.25, z: -4 } }
      ]) {
        await hook(page, "look", view.pos, view.target, true);
        await page.waitForFunction((want) => {
          const c = (window as unknown as { __hh: Api }).__hh.camera();
          return Math.hypot(c.x - want.x, c.y - want.y, c.z - want.z) < 0.05;
        }, view.pos);
        await page.screenshot({ path: info.outputPath(`${view.name}.png`) });
      }
      await hook(page, "look", null);
    }
  }
  expect(errors).toEqual([]);
});

test("Chapter 2 stairs beacon walks continuously up the ramp to floor 1", async ({ page }) => {
  const errors = await ready(page, 4);
  await setup(page, "stairs");
  const before = await read(page);
  await hook(page, "startTrace");
  await hook(page, "joy", 1, 0);
  try { await autoStarted(page); }
  finally { await hook(page, "joy", 0, 0); }
  await page.waitForFunction(() => {
    const p = (window as unknown as { __hh: Api }).__hh.state().player;
    return p.floor === 1 && p.x > 6.7 && !p.destination;
  }, null, { timeout: 120_000 });
  const frames = await hook<Frame[]>(page, "stopTrace");
  expect(frames.length).toBeGreaterThan(5);
  expect(frames.some((p) => p.stairs && p.y > 0.2 && p.y < 2.6)).toBe(true);
  expect(frames.some((p) => p.floor === 0)).toBe(true);
  expect(frames.some((p) => p.floor === 1)).toBe(true);
  for (let i = 1; i < frames.length; i++) {
    const a = frames[i - 1], b = frames[i];
    expect(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z), `frame ${i} must walk, never teleport`).toBeLessThan(0.4);
  }
  expect((await read(page)).beaconStarts).toBe(before.beaconStarts + 1);
  expect(errors).toEqual([]);
});
