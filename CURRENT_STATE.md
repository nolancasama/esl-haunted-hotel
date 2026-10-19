# Current State

## Status
**Chapter 2 (upstairs) is done and tested.** The full game has 8 ghosts on two floors.
Unit tests, typecheck, build and all e2e specs (including `tests/e2e/chapter2.spec.ts`)
pass. The visuals were checked in screenshots at 1366x768 and 844x390 touch
(`.tmp/upstairs`, `.tmp/ending`). The repository is public and every push to `main`
deploys to GitHub Pages (https://nolancasama.github.io/esl-haunted-hotel/).
**2026-10-16:** All 34 e2e specs pass (tap-to-move, beacon entry included). The intro's startled hop and turn are now actually visible. Before, the
player was faded out by the "standing in the camera's way" rule during the whole reaction.
Camera shots can now set `keepPlayer`. The reaction is bigger (crouch, 0.3 m hop,
squash/stretch, arms up, 0.75 s turn). **Outdoor rain** (`scene/Rain.tsx`): 2,600 instanced
shader streaks plus 160 splash rings in 2 draw calls, lamp-lit, slanted by gusting wind,
hidden above the drawn walls when indoors, fading out over the sunrise. Checked in
screenshots on GPU and SwiftShader: `node scripts/intro.mjs` (`.tmp/intro`) and
`node scripts/rain.mjs` (`.tmp/rain`), both against a dev server on 5199.

**2026-10-19:** Storybook-hotel UI redesign (title, HUD, answer panel, dialogue, settings,
results) and the door-gap fix. Checked in `node scripts/ui.mjs` screenshots at all three
sizes (`.tmp/ui/`, no clipping/overlap reported) and `node scripts/doors.mjs` (`.tmp/doors`).

## What Exists
- **UI design system (2026-10-19):** tokens and shared classes at the top of `src/styles.css`
  (`.panel`, `.btn-primary`/`.btn-secondary` aliased to `primary`/`secondary`, `.icon-btn`,
  `.ghost-medallion`, word tiles, switches, sliders). System serif display font only.
  Title: "Full Adventure" / Chapter 1 / Chapter 2 (locked card says "Finish Chapter 1") /
  Practice cards. Counter medallions flash once on capture. Settings grouped Speech /
  Sound / Language / Camera (two columns on short screens). Reduced-motion supported.
- **Doors (2026-10-19):** leaves fill the opening up to the frame head (3 mm clearance);
  heights come from the wall opening via `doorFit()` (`rooms.ts`), checked by `doors.test.ts`.
- **Ending exit (2026-10-16):** after the last ghost the player walks out on a one-way track
  from just inside the front door (`logic/exitTrack.ts`); every input walks forward, nothing
  else moves them; results come once on the porch.
- **Beacon entry (2026-10-16):** walking onto the current open gold ring (keys, joystick,
  or a tap walk that ends there) walks ~1 m into the room; the stairs ring walks up the
  ramp. Only input clearly pointing back cancels it (sideways does not). Fires once, re-arms
  after stepping off. A tap walk only passing over a ring is not taken over. `beacon.spec.ts`.
- **Real windows (2026-10-16):** holes in the outer walls with faint glass; rain falls all
  round the hotel and is lit by the windows; garden on every side. `windows.test.ts`,
  `node scripts/windows.mjs` (`.tmp/windows`).
- **Model polish (2026-10-16):** clock crowns, books, under-furniture shadows above rugs,
  teddy, gramophone, chests/trunks. `models/polish.test.ts`, `node scripts/polish.mjs`.
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
  `scripts/rain.mjs [url] [--gpu]`, `scripts/ui.mjs [url] [WxH] [--touch]` (all three sizes by
  default), `scripts/doors.mjs [url] [--out=dir]` (all need a dev server on 5199).
- **E2E:** `story.spec.ts`, `practice.spec.ts`, `chapter2.spec.ts`, `tapmove.spec.ts`, `beacon.spec.ts`, `exit.spec.ts`.
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
1. Play it on a real Chromebook / phone: stairs feel, attic blackout, bathroom steam, and
   the new UI (system serif title on ChromeOS fonts, touch sizes, results scrolling at 390 px).
2. When ready, publish (make the repo public, enable Pages; commands in README).

## Codex / Delegated Work
The 2026-10-19 UI redesign was written by Codex (routed) until it hit its usage limit;
Claude reviewed the partial work, finished it (results layout, button contrast, tap-through
subtitles/hints, Prettier formatting) and accepted it. Nothing is pending.
`tests/e2e/chapter2.spec.ts` and the `fanSwitchTest` hook were written by Codex (routed),
reviewed and accepted by Claude. Codex's run timed out after the spec was green. Every
mutation it injected was checked as reverted.
