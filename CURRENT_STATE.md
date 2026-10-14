# Current State

## Status
**Chapter 2 (upstairs) is done and tested.** The full game has 8 ghosts on two floors.
Unit tests, typecheck, build and all e2e specs (including `tests/e2e/chapter2.spec.ts`)
pass. The visuals were checked in screenshots at 1366x768 and 844x390 touch
(`.tmp/upstairs`, `.tmp/ending`). The repository is still private, so GitHub Pages is not
live yet (see README for the publish commands).

## What Exists
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
- **Test hooks** (`src/game/e2e.ts`): `teleport(x,z,floor)`, `goTo`, `jump(index, round)`,
  `setYaw`, `steam`, `wobble`, `fanSwitchTest`. State includes floor, chapter, scope, steam,
  fanOn, blackout.
- **Scripts:** `scripts/upstairs.mjs --part=rooms|stairs|tricks|cutscene`,
  `scripts/ending.mjs [url] [WxH] [--touch]` (both need a dev server on 5199).
- **E2E:** `story.spec.ts`, `practice.spec.ts`, `chapter2.spec.ts`. In chapter2, tests B–E
  were shown to fail on injected bugs (Chapter 2 starting downstairs, floor never flipping,
  no blackout on escape, fan doing nothing).

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
