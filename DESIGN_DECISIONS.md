# Design Decisions

## 2026-10-16 — Furniture construction polish

- Furniture contact shadows use a single horizontal face at 12 mm, above the
  rugs' 6 mm surface. This keeps UNDER spaces readable on either floor without
  coincident box tops, depth flags or render-order exceptions.
- Books stand 4 mm above boards with individual depth setbacks and small lateral
  gaps; leaning boxes were intersecting both their neighbours and the boards.
  Clock hood mouldings meet in successive layers and the crown arches upward.
- Chest lids meet the body at the rim with matching footprints; bands and handles
  sit outside the panels. Existing animated hinges and hiding spots stay fixed.
  The gramophone uses a connected hollow horn above its cabinet and a separate
  platter, record and pivoted tone arm. Geometry stays merged with similar segment
  counts, following the Chromebook rendering budget.

## 2026-10-16 — Beacon proximity entry

- The gold ring is an entry trigger at its nominal 0.62 m outer radius, on
  the player's floor, for the current open beacon door only. It shares the
  tap movement guard. Fixed beacon positions are cached; each frame needs one
  squared-distance check and no allocation.
- Entry supplies a path to the existing tap follower, about 1 m across the
  threshold (snapped by navigation). Stairs reuse the ramp route to the landing,
  accounting for its 1:1 slope in automatic walking speed so a 0.1 s controller
  frame travels less than 0.4 m in 3D.
  There is no extra destination ring. Collision, floor changes and the existing
  once-only room introduction/clue detector remain responsible for arrival.
- Held keys or joystick input pointing into the room (positive world-space dot
  product) preserve automatic entry. Sideways/away input cancels immediately;
  taps replace the path normally. This lets students keep holding the movement
  that brought them onto the ring without accidentally cancelling the assist.
- An arming is consumed before planning and remains consumed after cancellation,
  even after leaving the ring. A different beacon value or progression re-arming
  permits another entry. Returning over a used ring cannot start a loop.

## 2026-10-16 — Global tap-to-move navigation

- **Taps supply waypoints to the existing player controller.** A cached 0.25 m
  grid is built from WORLD's floor-specific wall, furniture and door colliders,
  inflated by the player radius plus a small steering allowance. Door masks track
  the same `rt.doorsOpen.has(id)` predicate as collision. A* runs on a new tap,
  with one retry if stuck; collision-checked line-of-sight smoothing removes grid
  steps. Movement still uses the keyboard/joystick speed, acceleration, turning,
  `moveBody` and `floorState`; the ramp is the only link between floors.
  Rejected: a navmesh dependency (unnecessary size and setup for fixed rectangular
  rooms), and straight-line walking (gets stuck on furniture and walls).
- **Floor taps travel; furniture taps travel then search.** Object approaches
  must satisfy interaction distance and `nearestSearchable`. Open thresholds
  lead just through the door; locked doors use the existing locked toast/sound.
  Invalid floor points snap to reachable space in the destination room, never
  across a locked wall. The stairs tap traverses the ramp; its gate still follows
  Chapter 2 progression. A subtle cyan ring marks floor destinations in one draw
  call and fades on arrival; furniture uses its existing interaction highlight.
- **Manual input and camera gestures remain in charge.** Keys/joystick cancel
  a path. Pointer travel over 8 px, including a gesture returning to its start,
  suppresses all movement clicks. Only canvas geometry receives movement taps;
  menus, cutscenes, reveals, close-ups and frozen states cannot start a path.
  Search markers retain their existing close-up behavior. No new camera rotation,
  idle raycasts, per-frame pathfinding, assets or npm dependencies.

This file records meaningful product, UX, visual, architectural, or behavioral decisions for this project.

For each significant decision, record:

- Date
- What was decided or changed
- Why
- Previous approach, if relevant
- Rejected alternatives, if useful

Only record decisions that may be useful to understand later.

Do NOT record:
- trivial UI adjustments
- routine bug fixes
- formatting changes
- mechanical refactors with no design consequence
- every individual code modification

Git is the source of truth for detailed code-change history.

A useful rule:

> If a future developer or AI could reasonably ask, "Why is it designed this way?", record the answer here.

## 2026-10-12 — Brief accepted, with these changes

The brief ("Haunted Hotel: Ghost Hunt", in / on / under / by for Japanese grade 5–6
beginners) was accepted as the product definition. Changes made while planning:

- **The preposition must decide the search, not the noun.** The brief's example
  spots (under the bed, in the toy box, on the desk, by the window) each use a
  different object, so a student only needed to catch "bed". Every searchable
  object now has two or three spots with different prepositions (on / under / by
  the bed; in / on / by the box; ...). Rejected: one spot per object.
- **One noun, one object per room.** "Under the chair" in a room with six chairs
  has no single answer, so duplicates (dining chairs, crates) are decor and cannot
  be searched. Clue nouns come from the brief's familiar list plus katakana
  loanwords children know (sofa, piano, clock). Wardrobe, cabinet, barrel, trunk
  and cupboard stay decor. Tests assert noun uniqueness per room.
- **"Visually meaningful" is tested geometry.** Furniture kinds (`world/kinds.ts`)
  carry the surface, clearance, cavity and side gap each preposition needs; both
  the 3D models and the hiding spots are built from those numbers, and
  `spots.test.ts` checks ON sits on the surface, UNDER fits below the clearance,
  IN is inside the cavity (peeking out when revealed), BY is beside and the
  object is the nearest thing. The test was shown to fail on broken geometry.
- **The clue text hides while answering.** Otherwise the answer is just reading
  the clue aloud. The student sees the ghost in place and the frame
  "It's ____ the bed." and has to produce the word.
- **Search close-up with identical "?" markers.** Approach an object, press E (or
  tap it): the camera frames it and every spot gets the same marker, so only the
  marker's position carries the meaning. Rejected: per-spot proximity in the world
  (on/under the same bed overlap) and labelled markers ("under") that would turn
  listening into text matching.
- **Empty searches teach.** A small gag item appears and the caption names the
  chosen place: "No ghost under the bed." (preposition highlighted).
- **Relocation hides the destination.** The ghost pops out where it was, laughs,
  loops round the room and vanishes; Boo then says the new clue. Watching it fly
  to the new spot would make the clue unnecessary.
- **Multi-round ghosts escape after correct answers until all four prepositions
  are used** (the brief's Mischief, and the Phase 1 practice ghost). Relocation
  never moves such a ghost to an already-answered preposition; if no valid spot
  exists it stays put (found by the random-player simulation test).
- **Search help ladder per clue** (no dead ends): 2 empty searches → Boo repeats
  the clue; 3 → a picture hint of the preposition (box-and-ghost icon, not a
  translation); 5 → the right object glows; 7 → the right marker glows.
  Relocations per round are capped so a struggling student is not chased forever.
- **Camera: elevated diorama view with cutaway walls.** A whole wall line (door
  included) fades when the camera is on its far side from the player. Rejected: a
  low over-the-shoulder camera, which fights walls indoors and causes dizziness.
  Mouse/touch drag turns the camera; no auto-rotation or bobbing.
- **Close-ups keep the view clear:** the player steps to the object's front corner
  (away from any BY spot), fades out if still in the camera line, and Boo leaves
  close-ups. UNDER reveals use a near-floor camera so the ghost is visible below
  the rail; UNDER ghosts sit at the front edge of the space underneath.

## 2026-10-12 — Speech follows the rules proven in the other ESL games

- One press of Space / the mic = one bounded session (8 s cap). Interim results
  are accepted the moment they contain the right preposition; wrong is decided
  only when the attempt ends (esl-time).
- Only the top hypothesis judges; alternatives rescue only a result with no
  preposition at all (esl-time). Judged on the preposition alone, so "under",
  "under bed" and "It's under the bed." all pass; by/bye/buy and ander/anda are
  accepted variants. Saying three or more different prepositions does not count.
- Only permission/hardware errors (not-allowed, service-not-allowed,
  audio-capture) switch to the word buttons at once; silence and a single network
  error are just a miss (esl-counting). Ladder: miss 1 "Try again", miss 2 Boo
  models the sentence, miss 3 the word buttons become tappable.
- The four words are always visible under the sentence; they are inert while
  speech is the mode (a child cannot say a word they have not seen) and tappable
  in mic-free mode or after the rescue. Mic-free is a Settings choice for the
  teacher, not a per-question button (in esl-verbs most students ticked it).
- The microphone is requested once on Start, with an 8 s timeout. Music and rain
  go silent while the mic is open and duck under Boo's voice.
- Instructions/UI chrome have optional Japanese (hiragana-forward); target English
  (clues, the question, answers) is never translated.

## 2026-10-12 — Everything procedural, nothing downloaded

All sound (rain, thunder, a quiet music-box waltz, giggles, captures), all
textures (wallpaper, floors, faces, the stormy window) and all models are generated
at runtime. No asset files, webfonts or CDNs: the game must start on a school
network that blocks or slows them. Fixed light set (hemisphere, moon, one warm
"room light" that moves to the player's room, the lantern) because changing light
counts recompiles shaders on Chromebooks.

## 2026-10-15 — Intro slam reaction; no coplanar tops

- **The front door slams only once the player has arrived inside.** The intro
  waits for the scripted walk to finish (not a fixed 2.3 s). Previously, on a
  slow device the walk was cut short and the player was teleported in, then
  snapped 180° (a `stepTo` on the spot sets the yaw instantly). If the walk
  still has not finished after 15 s and the player is in the doorway, they are
  moved in behind a short fade, never in view.
- **A startled hop and turn** (`logic/startle.ts`, played by `Player`): a 15 cm
  arc of 0.34 s, arms flung out and a lean back, a soft landing squash, and a
  0.55 s eased turn that starts mid-hop. A near half-turn goes round the side
  that faces the camera, so the face shows. The animation is driven by game
  time (`rt.time`), so it plays the same at any frame rate, with fewer frames on
  slow machines. Then about 0.9 s looking at the door before Boo appears. Any
  scene cut (`placePlayer`, so Skip too) clears it. Rejected: a bigger cartoon
  jump (too much for the tone), and turning after landing (two reactions, not
  one).
- **No two surfaces share a plane where both can be seen.** Lobby/landing plant:
  the soil disc's top was flush with the rim's closed top. Now the rim is 4 mm
  lower, so the soil sits 6 mm proud. Sink: the water disc's top was flush with
  the basin's closed top. Now the water dips into the basin and stands 4 mm
  proud, and the side aprons stop at the front one. The fix is the geometry,
  not `polygonOffset` or depth tricks. Offsets of 4–6 mm hold even on a 16-bit
  depth buffer at room distance.

## 2026-10-14 — Chapter 2: upstairs, eight ghosts

- **Two stacked floors with walkable ramp stairs** (lobby → landing, the floor
  flips halfway up). Only the floor you are on is drawn, plus the stairs, the
  lobby seen through the stairwell and one cheap `GroundShell` for the outer
  walls, so upstairs stays in the same ~100–200 draw-call budget. Rejected: a
  separate scene or level load (breaks the walk-in story), drawing both floors
  (doubles the draw calls on Chromebooks).
- **An iron gate closes the stairs until the 4th ghost** in the full adventure;
  the Chapter 2 cutscene (skippable) opens it. The HUD and lobby board show 4
  ghosts and then 8 (two rows), so Chapter 1 never feels "half done".
- **Four upstairs rooms with familiar clue nouns** (toy box, table, bathtub,
  sink, basket, piano, drum, sofa, clock, window...), following the same one
  noun per room rule. Room tricks are atmosphere only: Bouncy's toys move,
  Melody's instruments play, Shadow's attic blacks out and rattles while Shadow
  escapes after each of its first three answers. The fourth answer is the capture,
  with no blackout, so the finale is never hidden in the dark.
- **The bathroom steam silhouette never marks a spot.** It drifts on its own
  path; a fan switch clears the steam. A silhouette pointing at the ghost would
  replace listening.
- **Shadow is the finale:** four rounds in the attic, all four prepositions, like
  Mischief. After the 8th ghost the lantern blazes and the existing sunrise
  ending plays.
- **Chapter 1 on its own keeps its four-ghost ending.** Chapter 2 unlocks after
  Chapter 1 is finished (stored on the device). Title chips: All 8 / Chapter 1 /
  Chapter 2 / Practice, plus "Random hiding places" once replay is unlocked.
  `?chapter=1|2` for teachers who split it over two lessons. Rejected: forcing
  the full 20-minute run (too long for one lesson).

## 2026-10-13 — Phase 3: polish for classrooms and phones

- **Lens shift while answering.** The answer panel covers up to ~45% of a
  landscape phone; the camera's view is shifted up by half the panel height (no
  perspective change), so the found ghost stays visible above it. Rejected:
  shrinking the panel (the four words must stay big enough to tap).
- **Short screens** (≤ 520 px high) get compact title and results cards, and
  the results buttons are sticky at the bottom of the card.
- **Adaptive pixel ratio:** starts at up to 1.5×; if frames stay under ~28 fps
  for 4 s it drops to 1× once and never flips back. Renderer load is ~100–200
  draw calls and ~25k triangles. Rejected: a graphics setting (teachers should
  not need to tune it).
- **Cobwebs** in upper room corners (thin line webs, fade with their walls) —
  the last atmosphere item from the brief.
- **Replay** is Play Again after the story and a title button once unlocked;
  `?mode=replay` jumps to it.

## 2026-10-13 — Phase 2: the hotel and the story

- **A lobby hub with four rooms, opened one at a time** (bedroom → dining →
  storage → library). The current room's door swings open with a creak, a
  golden arrow and floor ring mark it, other doors show a padlock (bumping one
  says "まだ あかないよ"). The clue starts when the student walks in, so a clue
  can only ever mean the room they are standing in. Cleared rooms stay open and
  their objects stay searchable for fun (a search there never counts as a miss).
  Rejected: all rooms open at once (clues would need room names; "the window"
  exists in three rooms).
- **Storage boxes carry colours** (red / blue / yellow box). It is Sneaky's
  "careful listening" twist with words grade 3 already taught, and the only way
  to have several boxes and still one referent per clue.
- **Personalities are behaviour, not harder English:** Sleepy never moves and
  shows the picture hint from the start (tutorial); Hungry slips away after 2
  empty searches; Sneaky after 3 and makes other objects rattle (never its own
  hiding place); Mischief after 2, and needs four answers with four different
  prepositions. Each announces itself on entry (snore, "Yum yum!", rattle,
  "Catch me!") and makes the same harmless noise now and then.
- **The story's starting spots are fixed** (under / on / in / by, then
  Mischief's scripted rounds), so a class shares one story; Replay randomises.
- **Intro:** walk in from the rain, the door slams, lights flicker, Boo appears
  and says the brief's three lines (each waits for ▶ / Space or the voice plus a
  moment; Skip is always there). **Ending:** fade to the lobby, "Great job! / You
  found four ghosts!", the front door unlocks, the sun comes up (warm light,
  rain stops, birds), the student walks out (auto-walk after 9 s) → results.
- **Replay** unlocks after the story (stored on the device) and is what Play
  Again starts: random predefined spots, three different starting prepositions
  for the first three ghosts, Mischief's four in random order. Plan tests run a
  random student through 200 stories and 200 replays without a dead end.
- **The camera turns once, gently, when a ghost's room starts,** so the room is
  in front of the student (library and storage are entered heading "down").
  Keys held through the turn keep walking the way they were going (input basis
  is locked until released); dragging cancels the turn. Rejected: continuous
  auto-follow rotation (dizzying), never turning (south rooms were seen
  backwards from the doorway).
- **Things hung on a wall disappear with it** in the cutaway view (paintings,
  the ghost board, windows); each knows its wall line.
- **Hats are pressed flat in tight "under" spots** and the geometry test
  includes the flattened hat height, so nothing pokes through a bed or desk.
- **Students can search while Boo is still reading the clue.** Entering a room
  no longer locks the controls (E was silently ignored for the first seconds).
- **Hints vs. toasts.** The standing hint (go to the open door, walk out) and
  short messages (locked, microphone blocked) are separate, so a short message
  never erases the standing hint.

## 2026-10-12 — Phase 1 practice ghost

Phase 1 is one ghost in the bedroom that must be answered four times (it escapes
after each correct answer to a preposition not yet used), so one round practises
in / on / under / by, then it is captured. It also slips away after two empty
searches on a clue (once per round). Kept as `?mode=practice`.

## 2026-10-16 — Outdoor rainfall

- **Outdoor rain uses two batched shader systems:** 2,100 instanced streaks in
  one draw call and 160 porch/path splash rings in one more. Static seeds and
  `rt.time` drive wrapped falling motion and slow wind gusts without per-drop
  CPU updates, keeping the effect cheap on school Chromebooks. Sparse brighter
  near streaks layer over dimmer distant rain; lamp proximity adds warm light.
  The west volume is clipped outside the hotel footprint, remains visible on
  both floors, and fades with sunrise before becoming invisible at full daylight.
  Rejected: per-drop React components (CPU and draw-call overhead), and a
  full-screen post effect (rain would overlay indoor rooms and lack world depth).
- **Rain must never read as indoors.** The cutaway hotel draws only the floor
  you are on, so from inside (or with the follow camera swung out over the
  wall while the player is inside) rain above the drawn walls' top is
  discarded. Rain still shows through the open door and over the porch.
- **Each drop's start height is independent of its speed.** Both came from one
  seed, which made the rain fall in horizontal sheets early in a session (the
  intro). The wind drift is centred on the fall, and the near layer falls from
  4.5 m, so the dense rain stays over the porch and path where cameras look.
- **Far streaks stay about a pixel wide and dim to match.** Without
  antialiasing (SwiftShader, some Chromebooks) sub-pixel streaks flickered at
  full strength and piled into a bright band at the horizon.

## 2026-10-16 — The intro reaction is now visible (and bigger)

- **Why the startle "did nothing": the player was invisible during it.** The
  player fades out when standing between a scripted camera and its target, and
  the old entrance shot looked through the player at the door, so the hop and
  turn played at opacity ~0. A shot can now set `keepPlayer`. The entrance shot
  is a held three-quarter view (door on the left, player clear of it on the
  right) with `keepPlayer`, and so is Boo's reveal shot. On slow devices the
  camera ease into Boo's shot used to fade the player out as well. The intro
  e2e test now checks the player's opacity through the reaction, and fails on
  the old shot.
- **A readable cartoon reaction**, reversing the 2026-10-15 "small hop" choice,
  which proved too subtle at cutscene distance: a flinch crouch, a 0.3 m hop
  (about a quarter of the player's height) of 0.5 s with squash and stretch,
  arms thrown up, a recoil lean, a 0.75 s turn mostly done in the air, then
  1.2 s staring at the shut door before Boo. The lantern now hangs upright from
  the hand however the arm moves; with the arm up, its dark base showed as a
  black disc. Rejected: a camera cut at the slam (the reaction would play during
  a camera move).
