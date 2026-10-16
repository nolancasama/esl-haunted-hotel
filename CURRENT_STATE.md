# Current State

## Status
**Chapter 2 (upstairs) is done and tested.** The full game has 8 ghosts on two floors.
Unit tests, typecheck, build and all e2e specs (including `tests/e2e/chapter2.spec.ts`)
pass. The visuals were checked in screenshots at 1366x768 and 844x390 touch
(`.tmp/upstairs`, `.tmp/ending`). The repository is public and every push to `main`
deploys to GitHub Pages (https://nolancasama.github.io/esl-haunted-hotel/).
**2026-10-16:** The intro's startled hop and turn are now actually visible. Before, the
player was faded out by the "standing in the camera's way" rule during the whole reaction.
Camera shots can now set `keepPlayer`. The reaction is bigger (crouch, 0.3 m hop,
squash/stretch, arms up, 0.75 s turn). **Outdoor rain** (`scene/Rain.tsx`): 2,600 instanced
shader streaks plus 160 splash rings in 2 draw calls, lamp-lit, slanted by gusting wind,
hidden above the drawn walls when indoors, fading out over the sunrise. Checked in
screenshots on GPU and SwiftShader: `node scripts/intro.mjs` (`.tmp/intro`) and
`node scripts/rain.mjs` (`.tmp/rain`), both against a dev server on 5199.

## What Exists
- **2026-10-16 beacon entry:** the current open gold ring starts a normal nav
  walk about 1 m inside its room; the stairs ring follows the gated ramp.
  Held input into the room preserves this walk; sideways/away input cancels.
  Each beacon arming fires once, including after cancellation. Existing room
  entry still owns the ghost introduction and clue. Door lock billboards sit
  proud of the camera-facing door surface, including the double entrance.
  `beacon.spec.ts` passes all six keyboard/mouse/joystick, cancellation, locked
  gate and continuous stair tests; 378 unit tests, typecheck and build pass.
  The held-input helper test failed on an injected cancellation bug; its source
  was restored exactly (SHA-256 verified). Screenshots of entry/clue and the
  entrance/room locks are under `.tmp/beacon` for Claude's visual review.
  The requested `story.spec.ts -g "rooms open in order"` regression remains
  unverified: both combined and isolated runs stopped reporting progress; the
  isolated run was interrupted after exceeding its configured five-minute
  timeout without returning a result. No broader browser suite was run.
- **Controls:** tap/click floor destinations to follow smoothed collision-safe
  paths through open doors and the gated stair ramp. Furniture taps approach and
  search automatically. A cyan floor ring marks the destination. WASD/arrows and
  the virtual joystick interrupt travel; camera drags never start travel.
- **Chapter 1 (ground floor):** lobby hub, bedroom (Sleepy), dining (Hungry), storage
  (Sneaky), library (Mischief, 4 rounds). Intro, story, sunrise ending, replay.
- **Two stacked floors.** `FLOOR_Y = {0: 0, 1: 2.8}`. Rooms, walls, doors and objects carry
  a floor, and `roomAt(x, z, floor)`. Colliders are tagged per floor or `"all"`. The stairs are a
  walkable ramp (`STAIRS` in `rooms.ts`) at x 3.6→6.4. They rise east from the lobby to the
  landing, and the floor flips halfway up (`floorState`/`moveBody` in `collision.ts`). An iron
  gate (door id `"stairs"`) blocks them until Chapter 2. Only the floor you are on is drawn,
  plus the stairs, the lobby floor seen through the stairwell, and a one-draw-call
  `GroundShell` for the outer walls.
- **Chapter 2 rooms:** landing; playroom (Bouncy, moving toys); bathroom (Bubbles, steam,
  fan switch, drifting silhouette); music room (Melody, instruments play); attic (Shadow,
  4 rounds). Shadow's escapes after its first three answers come with a blackout and rattles.
  The fourth answer is the capture, with no blackout.
- **Progression:** `storyPlan(scope)` with scope `all|ch1|ch2`; `chapterBreakAfter`. After the
  4th capture in the full adventure, the Chapter 2 cutscene plays (`director.chapterTwo`,
  skippable) and opens the gate. HUD and lobby board show 4 ghosts, then 8. After the 8th,
  the lantern blazes and the sunrise ending plays. Chapter 1 on its own still ends after 4.
- **Title:** Start plus chips All 8 / Chapter 1 / Chapter 2 (locked until Chapter 1 is done,
  `hh.ch2.v1`) / Practice, and "Random hiding places" once replay is unlocked. URL:
  `?chapter=1|2`, `?mode=practice|replay`. Results: up to 8 ghost cards, Time, Main Menu.
- **Short screens:** the round pips sit under the ghost count (grid in the
  `max-height: 520px` block), so they stay clear of the clue card.
- **Test hooks** (`src/game/e2e.ts`): `teleport(x,z,floor,yaw?)`, `goTo`, `jump(index, round)`,
  `setYaw`, `steam`, `wobble`, `fanSwitchTest`, `look(pos, target, keepPlayer?)` (fixed camera shot),
  `timeScale(s)` (slow motion for filming). State includes floor, chapter, scope, steam,
  fanOn, blackout, player yaw/startle/opacity, path length/index/destination and
  camera yaw. Tap tests use `project(x,y,z)`, `objectInfo(id)` and
  `startTrace`/`stopTrace` for real canvas pixels and frame-by-frame movement.
- **Scripts:** `scripts/upstairs.mjs --part=rooms|stairs|tricks|cutscene`,
  `scripts/ending.mjs [url] [WxH] [--touch]`, `scripts/intro.mjs [url] [--speed=] [--gpu]`,
  `scripts/rain.mjs [url] [--gpu]` (all need a dev server on 5199).
- **E2E:** `story.spec.ts`, `practice.spec.ts`, `chapter2.spec.ts`, `tapmove.spec.ts`.
  Tap movement covers floor/furniture taps, retargeting, obstacles, doors, both
  floors/stairs, drag rejection, keyboard interruption and existing UI/markers.
  The drag test was shown to fail with tap drag-rejection disabled (0.31 m of
  unintended movement); the injected change was restored exactly.
  The intro-skip check holds its speech stub for 2 s so assertion polling cannot
  miss the first accelerated subtitle; production intro timing is unchanged.
  In chapter2, tests B–E
  were shown to fail on injected bugs (Chapter 2 starting downstairs, floor never flipping,
  no blackout on escape, fan doing nothing). The intro movement test in `story.spec.ts`
  was shown to fail on the old teleport, on the old instant half-turn, and (2026-10-16) on
  the old entrance shot that faded the player out during the reaction.

## Known Issues
- Software-rendered (SwiftShader) runs are only 2–7 fps, so the full-adventure e2e test
  takes a few minutes (timeout 420 s). Draw calls: ~100–200 per floor.
- `fanSwitchTest` forces the steam to its target in one frame instead of waiting for the
  fade. It checks the switch's effect, not the easing animation.
- The `ending.mjs` results shot after `jump` shows only 1 correct answer. That is expected,
  because `jump` skips the earlier answers.

## Next Steps
1. Play it on a real Chromebook / phone: stairs feel, attic blackout, bathroom steam.
2. When ready, publish (make the repo public, enable Pages; commands in README).

## Codex / Delegated Work
`tests/e2e/chapter2.spec.ts` and the `fanSwitchTest` hook were written by Codex (routed),
reviewed and accepted by Claude. Codex's run timed out after the spec was green. Every
mutation it injected was checked as reverted.
