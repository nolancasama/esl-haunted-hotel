# Haunted Hotel: Ghost Hunt

A spooky-but-cute 3D exploration game for Japanese elementary students (grades 5–6)
learning **in · on · under · by**.

> **Where is the ghost?** — *It's under the bed.*

You are trapped in an old hotel on a stormy night. Boo, a friendly ghost, says four
mischievous ghosts are hiding. Boo gives each clue in English ("It's under the
bed!"); you search the room, find the ghost, then say where it is. Catch all four
and the front door opens at sunrise.

**Play:** https://nolancasama.github.io/esl-haunted-hotel/ (Chrome on a computer,
Chromebook or Android).

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

A full game takes about 10 minutes. After you finish, **Replay** hides the ghosts
in new places (always valid, unambiguous ones).

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
- **Links:** `?mode=practice` — one room, one ghost, all four prepositions
  (about 3 minutes); `?mode=replay` — random hiding places straight away;
  `?intro=0` — skip the opening.
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

Visual checks (dev server on port 5199): `node scripts/shots.mjs`,
`node scripts/reveals.mjs` (every hiding spot's reveal) and
`node scripts/story.mjs` (the whole story) save screenshots to `.tmp/`.

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
