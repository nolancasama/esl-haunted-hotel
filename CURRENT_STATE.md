# Current State

## Status
**2026-10-30: The Guest Wing moved to the back; the front restored.** At the user's request the
wing is now east of the landing: straight ahead from the top of the stairs an open archway
(`u-e-lan`, no door) leads into a 4 m windowed hallway (`wingpassage`), and the GUEST ROOMS
double doors at its far end (x = 12, 5.6 m from the top step) open on the corridor (x 12–27)
and the six rooms. It stands on a closed stone base over the back garden (`wingBase` in
`Outside.tsx`: plinth, string course, blind arches); two back-garden trees moved clear. The
front is exactly as before the wing: the landing's west window, the open porch and path,
the original trees and rain (`Outside.tsx`/`Rain.tsx` reverted, plus the east rain mask).
**Bug fixed:** the deployed 2026-10-29 build hid the hotel's front (west) walls and front door,
because the wing's renderer culling matched wall ids starting "w-" and the ground-floor west
walls are "w-bed", "w-lob", "w-lib". The wing's walls are now "gw-..." and
`world/wing.test.ts` checks that only the wing's own walls carry that prefix.

**2026-10-29: The Forgotten Guest Wing.** A real upstairs extension with a corridor and six
5 x 5 m guest rooms three a side (201/203/205 north, 202/204/206 south). Each room has its
own identity (Tidy, Traveler's,
Family, Garden, Old-Fashioned, Forgotten) and 11–12 hiding spots covering in/on/under/by.
In the story the wing opens once Chapter 2 is finished; its doors open by hand (tap, E or
walking into them), and the optional mystery "Who stayed in Room 206?" (register, note,
suitcase, photo, painting, the 206 key, then a short scene with Pip's photograph) can be
solved every playthrough. In Hide & Seek, **Guest Wing** is one challenge area with a picker
for Rooms 201–206; the collection is now 72 (8 ghosts x 9 areas) and old records are kept.
`chapter2.spec.ts` "the full adventure…" is a pre-existing flake (see Known Issues): it
failed 1 of 3 repeats on this branch and 3 of 3 on the previous `main` build. Claude
reviewed `.tmp/wing/` (story rooms, corridor, register, mystery, exterior, front, pickers at
1024x600 and 844x390) and `.tmp/wing/hideseek/` (all six rooms: overview, close-up question,
first-person hiding).

**2026-10-28: Hide & Seek HUD redesign.** The full-height left rail is gone. In its place:
a narrow top-centre bar (ghost, five search pips, Moves n/2, a where-am-I pin), a gear in
the top right (Settings now holds **Main Menu** during a match, `hs-main-menu`), short
notices under the bar (room name, hiding place, "No moves left", status lines), a
bottom-right ability card (`hs-ability`, also key E), and detective subtitles in the lower
centre. A left dock (`hs-dock`) appears only while English or a spot list is open, and the
room camera frames beside it (and below the 10-second destination card); first-person and
third-person shots are no longer shifted sideways. The numeric suspicion meter is replaced
by a contextual stealth eye (`hs-awareness`, `data-state` hidden/suspicious/spotted):
`hideSeek/awareness.ts` derives it from the detective's suspicion plus the new
`MatchState.seenAt` (time the perception boundary last had the ghost in sight; never in
`DetectiveView`), so proximity alone never shows Spotted. The heartbeat still tracks
distance only. Numeric suspicion and `awareness` stay in the `hs()` snapshot. New
`tests/e2e/hud.spec.ts`; `awareness.test.ts`.

**2026-10-27: First-person hiding, heartbeat and the clock door are done.** Hide & Seek now
hides in the ghost's own view (per-spot viewpoints in all 8 rooms), decides strategy in
the overhead view, follows relocations in third person, and ends with a held first-person
moment and a short shot of the ghost. A procedural heartbeat speeds up as the detective
nears; detective footsteps are panned by distance. Settings → Hide & Seek toggles both
features. The grandfather clock door now meets the cornice. Typecheck, build, 499 unit
tests and every e2e spec pass (`firstperson.spec.ts` 4/4 + 13 Hide & Seek + 55 others,
run in two batches). Claude reviewed rendered views of every hiding place
(`node scripts/firstperson.mjs`, `.tmp/firstperson/sheet-*.png`), a staged Bedroom flow
(`--part=flow`), and 1024x600 and 844x390. Not yet heard: the heartbeat and footsteps on
real speakers (headless runs have no audible output).

**2026-10-25: Hide & Seek (Ghost Mode) is done.** The stage list is now All Levels /
Hide & Seek, and Hide & Seek unlocks with Chapter 1. Eight ghosts x eight rooms
lead into a 3D match against the human detective, with English questions, abilities
and results. Typecheck, build and 477 unit tests pass. The full e2e suite passed
59/61. The two failures (beacon backwards-cancel, story "locked door") both passed
when rerun alone. Claude reviewed `node scripts/hideseek.mjs` screenshots at all three
sizes (`.tmp/hideseek/`) after one visual correction pass (vision cone clipped to
walls, decoy label, Melody notes, results buttons, Beginner tiles).

**Chapter 2 (upstairs) is done and tested.** The full game has 8 ghosts on two floors.
That baseline passed unit tests, typecheck, build and the then-existing e2e specs
(including `tests/e2e/chapter2.spec.ts`). Its visuals were checked at 1366x768 and 844x390 touch
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
- **Guest Wing (2026-10-29):** plan in `rooms.ts` (`WING`, `GUEST_ROOMS`, `guestBounds()`,
  `GUEST_INFO`, `PASSAGE_RECT`, `WING_RECT`, `inWingFootprint()`, generated `wingWalls()`
  ("gw-" ids) and guest doors, `OPENABLE_DOORS`); room ids `wingpassage` (the hallway from the
  landing), `guesthall`, `g201`–`g206` (floor 1, x 8–27). Furniture in `furniture.ts` is laid out once per room
  in a "north" frame and mirrored for the south rooms (`guestRoom()`); new kinds `smallbed`,
  `walllamp`, `frame` (pictures, photos, note, key board; flat), `register`, `coatrack`,
  `opencase`, `pot`; the rocking chair gained an "on" seat; suitcases and trunks are `box`
  variants (same cavity, so "in" fits the same way). Guest-room furniture is a Hide & Seek
  hiding place only (`interactive` is false in the story), so nothing in the wing disturbs
  the hunt. Story logic in `game/guestWing.ts` (`doorAccess`, `WING_NOTES`) and the
  director (`openByHand`, `tryDoor`, `openWayInto`, `readWingNote`, `wingFinale`,
  `wingAmbience`: corridor clock tick, floor creaks, camera turns down the corridor);
  `rt.wing` holds the per-playthrough key/clues; `hh.guestwing.v1` (set when Chapter 2 is
  finished; older saves with a finished story but no `hh.finish.v2` mark also open it) and
  `hh.guestwing.mystery.v1` (reward). Clue card `ui/WingNote.tsx`. Doors: brass number
  plaques on the corridor side, the glazed wing doors with their sign, padlocks only on
  doors that are really locked. Room 206's lamp flickers softly; the corridor's light follows
  the player; the camera turns to look east down the hallway and corridor. Exterior: the
  closed stone base in `Outside.tsx` (`wingBase`), rain masks in `Rain.tsx`.
- **Rendering budget (2026-10-29):** wall pieces are merged per wall line (one mesh, three
  material groups; `lineView()` in `Hotel.tsx`), which cut draw calls in the original areas
  (landing east 170→106, bathroom 135→84, playroom 132→87). The wing is drawn only from
  the east half of the upstairs or inside it, and wing furniture only within 11 m along the
  corridor; busiest view (corridor) ~270 calls, a guest room ~180.
- **Hide & Seek in the wing:** `PLAY_ROOMS` / `CHALLENGE_AREAS` in `records.ts` (Guest Wing =
  one area, `rooms: GUEST_ROOMS`; informational per-room wins in `hh.hideseek.guestrooms.v1`,
  outside the total). Selection: `hs-area-guestwing` → `hs-guest-select` (Back returns to the
  room list). The overview camera's nearest distance scales with the room; in Hide & Seek
  any wall between the camera and the room's middle is cut away. Navigation blockers are
  limited to colliders near the room. Balance holds over 14 rooms (sensible 47–80%).
- **Wing tests:** `tests/e2e/wing.spec.ts` (locked before Chapter 2; doors open by hand;
  every room entered by keyboard; 206 needs the key; register, key and the mystery scene),
  Guest Wing selection + per-room close-up/first-person checks in `hideseek.spec.ts`, records
  (72, one record for six rooms, an old 64-entry book intact), spot/geometry/reachability
  tests over all 14 rooms. Hooks: `wing()`, `unlockWing()`.
- **UI design system (2026-10-19):** tokens and shared classes at the top of `src/styles.css`
  (`.panel`, `.btn-primary`/`.btn-secondary` aliased to `primary`/`secondary`, `.icon-btn`,
  `.ghost-medallion`, word tiles, switches, sliders). System serif display font only.
  Title: HAUNTED HOTEL "in Matsubara", Start, Settings. Start opens the stage list
  (`data-testid=stages`): All Levels / Hide & Seek, tap to play, Random toggle once
  unlocked, Back. Hide & Seek unlocks after Chapter 1 (`hh.ch2.v1` or
  `hh.hideseek.v1`). Chapter and Practice teacher links remain available. A link
  naming the stage (`?mode=story|practice|replay`, `?chapter=1|2`) skips the list; every
  e2e spec and dev script boots with one. `title.spec.ts` covers the list. Counter medallions flash once on capture. Settings grouped Speech /
  Sound / Language / Camera (two columns on short screens). Reduced-motion supported.
- **Doors (2026-10-19):** leaves fill the opening up to the frame head (3 mm clearance);
  heights come from the wall opening via `doorFit()` (`rooms.ts`), checked by `doors.test.ts`.
- **First-person hiding (2026-10-27):** `hideSeek/views.ts` (pure: `hidingView(spot)`,
  `cameraMode(...)`), `scene/HideSeekCamera.tsx` (timed blends, look input, writes
  `hsPresentation.cameraSettling` so decision countdowns wait for the camera; `hsCam`
  is read by furniture, ghost and hooks), `audio/heartbeat.ts` + `audio.setHeartbeat`
  (one scheduler on its own ducked bus), heartbeat driver in `HideSeekScene.tsx`. Lids
  and the clock door open for the detective in Hide & Seek; a peeking lid is lifted a
  crack. Results wait `RESULTS_DELAY_MS` (2.6 s) for the closing shot. Settings
  `firstPerson`, `heartbeat` (default on); a ⚙ button in the Hide & Seek HUD.
  Hooks: `hsCamera()`, `hsPreview(spotId|null)` (any spot's view, for visual checks).
- **Hide & Seek (2026-10-25):** ghost selection (all eight), room selection (all eight),
  a live 3D detective match, and friendly Escaped!/Found! results. Direct links
  `?mode=hideseek&ghost=&room=&seed=` skip the named selections. The accepted pure
  simulation in `src/game/hideSeek/` owns all strategy and English rules; the session
  store drives it from the render clock and translates events into speech, subtitles,
  sounds and visual cues. Story input and its director are suspended during the mode.
  Fixed room cameras, spot markers and an accessible spot list accompany Stay / Move /
  Ability controls. English help uses Beginner / Standard / Advanced, with microphone
  recognition and tile fallback; an open English panel freezes simulation time.
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
- **Unlocks:** Chapter 2 on its own opens once Chapter 1 is done (`hh.ch2.v1`); "Random
  hiding places" once replay is unlocked; last stage and toggle in `hh.menu.v1`.
  Results: up to 8 ghost cards, Time, Main Menu.
- **Short screens:** the round pips sit under the ghost count (grid in the
  `max-height: 520px` block), so they stay clear of the clue card.
- **Test hooks** (`src/game/e2e.ts`): `teleport(x,z,floor,yaw?)`, `goTo`, `jump(index, round)`,
  `setYaw`, `steam`, `wobble`, `fanSwitchTest`, `look(pos, target, keepPlayer?)` (fixed camera shot),
  `timeScale(s)` (slow motion for filming). State includes floor, chapter, scope, steam,
  fanOn, blackout, player yaw/startle/opacity, path length/index/destination and
  camera yaw. Tap tests use `project(x,y,z)`, `objectInfo(id)` and
  `startTrace`/`stopTrace` for real canvas pixels and frame-by-frame movement.
- **Hide & Seek hooks** (`window.__hh`, `?e2e=1`): `hs()` provides a read-only cloned
  match snapshot, including phase, config, detective pose/target, ghost transit,
  English panel, counters, effects, stats and public spot/reachable/target lists.
  `hsCommand(name, ...args)` drives the core commands (plus session `start` and
  `pickSpot`); `hsTimeScale(s)` scales only the match clock, with zero for visual
  staging. Existing `project(x,y,z)` projects scene markers and actor measurements.
- **Scripts:** `scripts/upstairs.mjs --part=rooms|stairs|tricks|cutscene`,
  `scripts/ending.mjs [url] [WxH] [--touch]`, `scripts/intro.mjs [url] [--speed=] [--gpu]`,
  `scripts/rain.mjs [url] [--gpu]`, `scripts/ui.mjs [url] [WxH] [--touch]` (all three sizes by
  default), `scripts/doors.mjs [url] [--out=dir]` (all need a dev server on 5199).
- **Hide & Seek visual script:** `scripts/hideseek.mjs [url] [WxH] [--touch]`
  captures ghost/room selection, three room matches, all English help levels, eight
  ability effects and both results at 1366x768, 1024x600 and 844x390 touch. Output:
  `.tmp/hideseek/<size>/`, including `measurements.json` for panel/actor overlaps,
  clipping, overflow, semantic state and renderer workload. Running this script and
  final aesthetic acceptance are controller-owned; implementation does not mark it accepted.
- **First-person visual script:** `node scripts/firstperson.mjs [--part=views|flow] [--room=] [--gpu]`
  (dev server on 5199): every spot's first-person view as per-room contact sheets, or a
  staged Bedroom match. Output `.tmp/firstperson/`.
- **E2E:** `firstperson.spec.ts` (camera modes through hide/Move/relocate/arrive, look
  limits by keys and drag, First-person off, heartbeat lifecycle; shown to fail when
  relocation stays overhead), `story.spec.ts`, `practice.spec.ts`, `chapter2.spec.ts`, `tapmove.spec.ts`, `beacon.spec.ts`, `exit.spec.ts`.
  `hideseek.spec.ts` covers selection, tile/speech English, frozen/walking detective,
  seeded stay win/loss, relocation budget, Hungry/Shadow abilities, results navigation
  and all eight room starts. `title.spec.ts` covers Hide & Seek unlock/deep links.
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
- `chapter2.spec.ts` "the full adventure catches all eight ghosts" is flaky under repeated
  SwiftShader load (2026-10-30): a search-marker click sometimes never reaches the answer
  phase (bathroom basket, attic table seen). The previous `main` build failed it 3/3 with
  `--repeat-each=3`, this branch 1/3; it passes alone. Probably the 1.3 s close-up settle in
  `openCloseUp` is too short at ~3 fps. Not fixed here.
- Guest Wing: software rendering (SwiftShader) shows the mystery scene's camera mid-blend in
  screenshots because frames are slow; on real hardware it settles in under a second. Not
  yet heard on speakers: the corridor clock tick and floor creaks. Old saves that finished
  only Chapter 1 before this update find the wing open too (they cannot be told apart).
- At 844x390 the Hide & Seek room list scrolls to reach the Guest Wing card.
- `beacon.spec.ts` "backwards input cancels…" failed once in a full e2e run (2026-10-19:
  the player ended 0.2 m deeper than the ~1 m entry allows, W held under SwiftShader
  load) and passed the other three times, alone and in a full run. A timing flake in
  the walk-distance check; not investigated.
- `story.spec.ts` "a locked door says so" timed out waiting for the toast late in the
  19-minute full run (2026-10-25) and passed alone. Probably SwiftShader load; watch it.
- Hide & Seek has no in-browser e2e for Shadow's Vanish move. The core unit tests cover it.
  The detective has one tuned difficulty (no selector, by design).
- Software-rendered (SwiftShader) runs are only 2–7 fps, so the full-adventure e2e test
  takes a few minutes (timeout 420 s). Draw calls: ~100–200 per floor.
- `fanSwitchTest` forces the steam to its target in one frame instead of waiting for the
  fade. It checks the switch's effect, not the easing animation.
- The `ending.mjs` results shot after `jump` shows only 1 correct answer. That is expected,
  because `jump` skips the earlier answers.

## Next Steps
00. On a real Chromebook: walk the Guest Wing (frame rate in the corridor, the camera in the
   narrow corridor and rooms, door taps by touch) and solve the 206 mystery with a student.
0. On a real Chromebook: listen to the heartbeat and footsteps (loudness against the
   detective's speech, 62/124 Hz thump on small speakers) and check first-person frame rate
   and drag-to-look by touch. Tuning is in `audio/heartbeat.ts` and `thump()` in `audio.ts`.
1. Play Hide & Seek with students on a real Chromebook: pacing of detective walks and the
   decision window, whether children understand the detective's announcements, and
   balance per ghost (seeded balance: stay ~19% win, sensible play 44–75%).
2. Play the story on a real Chromebook / phone: stairs feel, attic blackout, bathroom steam,
   touch sizes, results scrolling at 390 px.

## Codex / Delegated Work
First-person hiding/heartbeat/clock door (2026-10-27) was written by Claude directly at the
user's request ("do yourself"); nothing delegated, nothing pending.
Hide & Seek (2026-10-25) was written by Codex (routed) in four orders: simulation core,
stage list/unlock, playable integration, visual corrections. Claude froze the rules
(DESIGN_DECISIONS), reviewed each and accepted them. Nothing is pending.
The 2026-10-19 UI redesign was written by Codex (routed) until it hit its usage limit;
Claude reviewed the partial work, finished it (results layout, button contrast, tap-through
subtitles/hints, Prettier formatting) and accepted it. Nothing is pending.
`tests/e2e/chapter2.spec.ts` and the `fanSwitchTest` hook were written by Codex (routed),
reviewed and accepted by Claude. Codex's run timed out after the spec was green. Every
mutation it injected was checked as reverted.
