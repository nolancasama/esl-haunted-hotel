# Current State

## Status
Playable and complete through all three phases of the brief: the full hotel story
(4 rooms, 4 ghosts, intro, sunrise ending, results), random Replay mode, and the
Phase 1 bedroom prototype kept as `?mode=practice`. Deployed from `main` to
GitHub Pages by `.github/workflows/deploy-pages.yml`.

## What Exists
- **Game:** lobby + bedroom / dining / storage / library, unlocked in order (door
  beacon, padlocks). Clue on room entry → close-up search with identical "?"
  markers → reveal → spoken (Web Speech, forgiving matcher) or tapped answer →
  capture into the lantern. Ghost personalities (Sleepy tutorial, Hungry and
  Sneaky relocate, Sneaky's rattles, Mischief's four rounds). Help ladders for
  searching and answering; no dead ends.
- **World data:** `src/game/world/` (kinds with preposition geometry, placements,
  rooms/walls/doors). 49 hiding spots, all geometry-tested.
- **Logic:** `src/game/logic/` (pure hunt state machine, clues, speech matcher,
  plans incl. replay randomiser). Director in `src/game/director.ts`.
- **Scene:** procedural models (`src/scene/models/`), textures, cutaway walls,
  doors, lights (lightning, flicker, sunrise), ghosts/Boo, effects, cobwebs,
  adaptive pixel ratio, lens shift during answers.
- **Audio:** procedural Web Audio (rain, thunder, music-box waltz, SFX), TTS
  with watchdog, recognition wrapper with 8 s cap.
- **Tests:** 194 unit tests (`npm test`); 10 Playwright e2e tests
  (`npm run e2e`, practice + story; both specs proven to fail on an injected bug).
- **Visual scripts:** `scripts/shots.mjs` (practice flow, any viewport,
  `--touch`), `scripts/reveals.mjs` (every hiding spot), `scripts/story.mjs`
  (whole story). They expect a dev server on port 5199.

## Current Work
None in progress.

## Known Issues
- Not yet tried on a real classroom Chromebook, Android phone or with real
  children's speech; recognition variants (`speechMatch.ts`) should be extended
  from real transcripts.
- Headless checks use SwiftShader (software WebGL), so frame rates there say
  nothing about real devices. Renderer load is ~100–200 draw calls and ~25k
  triangles per frame.
- `THREE.Clock` deprecation warning comes from React Three Fiber internals.

## Next Steps
- Classroom test: speech recognition accuracy, pacing (~10 min target), whether
  students find the camera drag and the close-up markers without help.
- Optional: per-teacher class settings via URL, more hiding places per room,
  recorded voice clips instead of TTS.

## Codex / Delegated Work
None. Built directly by Claude at the user's request ("do not send to router").
