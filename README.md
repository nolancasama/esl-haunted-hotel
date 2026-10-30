# Haunted Hotel: Ghost Hunt

A spooky-but-cute 3D exploration game for Japanese elementary students (grades 5–6)
learning **in · on · under · by**.

> **Where is the ghost?** — *It's under the bed.*

You are trapped in an old hotel on a stormy night. Boo, a friendly ghost, says
mischievous ghosts are hiding. Boo gives each clue in English ("It's under the
bed!"); you search the room, find the ghost, then say where it is. Catch the four
downstairs and the stairs open; catch all eight and the front door opens at sunrise.

**Play:** https://nolancasama.github.io/esl-haunted-hotel/ once the repository is
published (Chrome on a computer, Chromebook or Android). To publish:
`gh repo edit nolancasama/esl-haunted-hotel --visibility public --accept-visibility-change-consequences`,
then `gh api -X POST repos/nolancasama/esl-haunted-hotel/pages -f build_type=workflow`
and re-run the "Test and deploy to GitHub Pages" workflow. Until then, `npm run dev`
or `npm run build && npm run preview` runs it locally.

## How it plays

1. **Listen.** Walk into a room. Boo asks *"Where is the ghost?"* and gives the
   clue. 🔊 replays it.
2. **Search.** Walk up to a piece of furniture and press **E** (or tap it). The
   close-up shows a ? at each place you can look: on it, under it, in it, by it.
   Every object has two or three places, so you have to understand the
   preposition, not just the noun. An empty place tells you where you looked:
   *"No ghost on the bed."*
3. **Say it.** When you find the ghost, the clue disappears and you answer:
   *It's ____ the bed.* Press **Space** (or 🎤) and say it. Without a microphone,
   tap **IN / ON / UNDER / BY**.
4. **Catch it.** A correct answer pulls the ghost into your lantern. A wrong one
   just makes it giggle, and you try again.

| Ghost | Room | What it does |
| --- | --- | --- |
| Sleepy (blue) | Bedroom | Never moves (the tutorial; a picture hint helps) |
| Hungry (orange) | Dining room | Sits by the cake; slips away after 2 empty searches |
| Sneaky (green) | Storage room | Red / blue / yellow boxes; rattles other things to distract you |
| Mischief (purple) | Library | Escapes after each answer until you have used all four prepositions |
| Bouncy (yellow) | Playroom (upstairs) | Loves toys, which move by themselves; slips away after 2 empty searches |
| Bubbles (aqua) | Bathroom | Hides in the steam; the fan switch clears it |
| Melody (pink) | Music room | The instruments play; slips away after 2 empty searches |
| Shadow (dark purple) | Attic | The finale: four answers, all four prepositions; the lights go out each time it escapes |

**Chapter 1** (downstairs) and **Chapter 2** (upstairs) take about 10 minutes
each. **All 8** plays both in one go. Chapter 2 on its own unlocks after Chapter 1
is finished. After you finish, **Random hiding places** hides the ghosts in new
places (always valid, unambiguous ones).

## Controls

| | Keyboard / mouse | Touch |
| --- | --- | --- |
| Walk | WASD or arrow keys | left stick |
| Turn the camera | drag | drag |
| Search | **E** (or click the furniture) | 🔍 or tap the furniture |
| Choose a place | ← → / click a ? | tap a ? |
| Back | Esc | もどる |
| Speak | **Space** | 🎤 |
| Answer with buttons | 1 2 3 4 | tap the word |
| Listen again | R / 🔊 | 🔊 |

## For teachers

- **Settings (⚙):** speak or tap answers (turn the microphone off for a
  mic-free class), music and sound volume, Japanese hints on/off, slower English
  voice, camera speed. Settings are remembered on the device.
- **Speech recognition** uses the browser (Chrome / Edge) and needs the
  internet. If the microphone is blocked or speech cannot be heard after three
  tries, the word buttons appear automatically — nobody gets stuck.
- English clues are spoken with the device's text-to-speech and always shown on
  screen.
- **Links:** Start normally opens a stage list (Full Adventure, Chapter 1,
  Chapter 2, Practice). A link that names the stage skips the list, so Start
  plays it at once: `?mode=story` — the full adventure; `?chapter=1` /
  `?chapter=2` — one floor only (for two lessons); `?mode=practice` — one room,
  one ghost, all four prepositions (about 3 minutes); `?mode=replay` — random
  hiding places; `?intro=0` — skip the opening.
- No accounts, no downloads, no tracking. Nothing is sent anywhere except the
  browser's own speech recognition.

## Development

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (hiding-spot geometry, clues, speech matching, hunt logic, plans)
npm run e2e        # build + Playwright playthroughs
npm run build      # production build in dist/ (relative paths, works on GitHub Pages)
```

Debug keys (dev server, or any build with `?debug=1`): `]` next ghost, `[`
previous ghost, `}` (Shift+]) jump to the ending.

Visual checks (dev server on port 5199): `node scripts/shots.mjs`,
`node scripts/reveals.mjs` (every hiding spot's reveal) and
`node scripts/story.mjs` (the whole story), `node scripts/upstairs.mjs`
(stairs, upstairs rooms, tricks, cutscene) and `node scripts/ending.mjs` (the
eight-ghost ending) save screenshots to `.tmp/`.

React 19 + TypeScript + Three.js via React Three Fiber, zustand, Vite, Vitest,
Playwright. Everything — models, textures, sound and music — is generated in
code; there are no asset files.

| Folder | What lives there |
| --- | --- |
| `src/game/world` | rooms, walls, furniture data and the hiding spots built from it |
| `src/game/logic` | pure, tested game logic: hunt state machine, clues, speech matching, plans |
| `src/game/director.ts` | runs the game: clues, search, answers, captures, story, ending |
| `src/scene` | the 3D scene (R3F components, procedural models and textures) |
| `src/ui` | HUD, answer panel, settings, title and results screens |
| `src/audio` | Web Audio sound and music, text-to-speech, speech recognition |

Design decisions are recorded in [DESIGN_DECISIONS.md](DESIGN_DECISIONS.md);
current status in [CURRENT_STATE.md](CURRENT_STATE.md).
