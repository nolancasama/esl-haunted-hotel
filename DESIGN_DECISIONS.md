# Design Decisions

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

## 2026-10-12 — Phase 1 practice ghost

Phase 1 is one ghost in the bedroom that must be answered four times (it escapes
after each correct answer to a preposition not yet used), so one round practises
in / on / under / by, then it is captured. It also slips away after two empty
searches on a clue (once per round). Kept as `?mode=practice`.
