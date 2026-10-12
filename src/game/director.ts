import { audio, type SfxName } from "../audio/audio";
import { tts } from "../audio/tts";
import { HARD_ERRORS, recognition, requestMicPermission } from "../audio/recognition";
import { EMPTY_ANSWER, getGame, saveSettings, setGame, type AnswerUi, type Mode, type Settings } from "./store";
import { resetRuntime, rt, type Gag } from "./runtime";
import { answerPrep, createHunt, currentEncounter, currentSpot, searchHelpLevel, searchSpot, type HuntState } from "./logic/hunt";
import { practicePlan } from "./logic/plans";
import { clueSpoken, emptyCaption, QUESTION, sentenceWith } from "./logic/clues";
import { judgeSpeech, type Judgement } from "./logic/speechMatch";
import { mulberry32, pick, type Rng } from "./logic/rng";
import { WORLD, type HidingSpot } from "./world/world";
import { INTERACT_RANGE, PRACTICE_START } from "./world/constants";
import { rectCenter, rectDistance } from "./world/geometry";
import { roomAt } from "./world/rooms";
import { GHOSTS } from "./ghosts";
import { PREPS, type Prep } from "./types";
import { LINE_JA } from "../ui/i18n";
import { captureShot, revealShot, searchShot, standPoint, viewDir } from "../scene/framing";
import { resolveCollisions } from "./world/collision";
import { cameraRef } from "../scene/CameraRig";
import { sparkle } from "../scene/Effects";
import * as THREE from "three";

/**
 * The director turns the pure hunt state machine into a game: it plays
 * Boo's lines, camera moves, search animations, the answer interaction and
 * the capture. Every async sequence is tied to a generation number, so going
 * back to the title cancels whatever was playing.
 */

class Cancelled extends Error {}

let gen = 0;
let pace = 1;
let rng: Rng = mulberry32(Date.now() >>> 0);
let busy = false;
let lineId = 0;
let captionId = 0;
let stopListening: (() => void) | null = null;
let lastActivity = 0;
let networkErrors = 0;
let idleTimer = 0;

const params = new URLSearchParams(typeof location !== "undefined" ? location.search : "");
if (params.has("seed")) rng = mulberry32(Number(params.get("seed")) || 1);
if (params.get("fast") === "1") pace = 0.25;

function alive(g: number) {
  if (g !== gen) throw new Cancelled();
}

function sleep(ms: number): Promise<void> {
  const g = gen;
  return new Promise((resolve, reject) =>
    window.setTimeout(() => (g === gen ? resolve() : reject(new Cancelled())), ms * pace)
  );
}

function run(fn: () => Promise<void>) {
  fn().catch((e) => {
    if (!(e instanceof Cancelled)) console.error(e);
  });
}

const hunt = (): HuntState => getGame().hunt!;
const setAnswer = (patch: Partial<AnswerUi>) => setGame({ answer: { ...getGame().answer, ...patch } });

function micUsable(): boolean {
  const g = getGame();
  return g.settings.mic && recognition.supported && g.micState !== "blocked" && g.micState !== "unsupported";
}

/** Boo (or a ghost) speaks a line, normally with a subtitle. */
async function say(en: string, opts: { speaker?: "boo" | "ghost"; pitch?: number; subtitle?: boolean } = {}) {
  const g = gen;
  const speaker = opts.speaker ?? "boo";
  if (opts.subtitle !== false) setGame({ line: { id: ++lineId, en, ja: LINE_JA[en], speaker } });
  rt.boo.talking = speaker === "boo";
  try {
    await tts.speak(en, { pitch: opts.pitch ?? (speaker === "boo" ? 1.2 : 1.6) });
  } finally {
    rt.boo.talking = false;
  }
  alive(g);
  const id = lineId;
  window.setTimeout(() => {
    if (getGame().line?.id === id) setGame({ line: null });
  }, 1600 * pace);
}

/** Boo speaks the clue; the clue card pulses instead of a subtitle. */
async function sayClue() {
  const g = gen;
  const spot = currentSpot(hunt());
  setGame({ clueShown: true, clueSpeaking: true });
  rt.boo.talking = true;
  try {
    await tts.speak(clueSpoken(spot), { pitch: 1.2 });
  } finally {
    rt.boo.talking = false;
    setGame({ clueSpeaking: false });
  }
  alive(g);
}

function caption(text: string, tone: "empty" | "info" | "good" = "info", ms = 2200) {
  const id = ++captionId;
  setGame({ caption: { id, text, tone } });
  window.setTimeout(() => {
    if (getGame().caption?.id === id) setGame({ caption: null });
  }, ms * pace);
}

function touchActivity() {
  lastActivity = performance.now();
}

function applyHelp() {
  const s = hunt();
  const level = s.status === "hunting" ? searchHelpLevel(s) : 0;
  const tutorial = getGame().mode === "story" && currentEncounter(s).ghost === "sleepy";
  setGame({ helpLevel: tutorial ? Math.max(level, 2) : level });
  rt.helpObject = level >= 3 && s.status === "hunting" ? currentSpot(s).objectId : null;
  rt.helpSpot = level >= 4 && s.status === "hunting" ? s.spotId : null;
}

// ------------------------------------------------------------------ clues

async function giveClue(kind: "first" | "moved" | "next" | "repeat") {
  const s = hunt();
  const ghost = GHOSTS[currentEncounter(s).ghost];
  applyHelp();
  if (kind !== "repeat") {
    audio.play("giggle", { pitch: ghost.voice });
    await sleep(750);
    await say(QUESTION);
    await sleep(120);
  } else {
    await say("Listen!");
  }
  await sayClue();
  touchActivity();
}

function enterExplore() {
  rt.camera.mode = "follow";
  rt.camera.shot = null;
  rt.player.frozen = false;
  rt.player.stepTo = null;
  setGame({ phase: "explore", searchId: null, selectedSpot: null });
  touchActivity();
}

// ----------------------------------------------------------------- search

function canReach(objectId: string): boolean {
  const obj = WORLD.objectById.get(objectId);
  if (!obj) return false;
  const room = roomAt(rt.player.x, rt.player.z);
  if (room && obj.room !== room) return false;
  return rectDistance(obj.rect, rt.player.x, rt.player.z) <= INTERACT_RANGE + 0.05;
}

function enterSearch(objectId: string) {
  const g = getGame();
  if (g.phase !== "explore" || busy) return;
  const obj = WORLD.objectById.get(objectId);
  if (!obj?.searchable) return;
  const c = rectCenter(obj.rect);
  rt.player.yaw = Math.atan2(c.x - rt.player.x, c.z - rt.player.z);
  rt.player.walkTo = null;
  rt.camera.mode = "shot";
  rt.camera.shot = searchShot(obj, rt.player);
  const spots = WORLD.spots.filter((s) => s.objectId === objectId);
  // Step aside so the player does not stand between the camera and the object.
  const by = spots.find((s) => s.prep === "by");
  const stand = standPoint(obj, viewDir(obj, rt.player), rt.player, by ? by.pos : null);
  const safe = resolveCollisions(stand.x, stand.z, (id) => rt.doorsOpen.has(id));
  rt.player.stepTo = { x: safe.x, z: safe.z, face: c };
  setGame({ phase: "search", searchId: objectId, selectedSpot: spots[0]?.id ?? null, focusId: objectId });
  audio.play("tick");
  touchActivity();
}

function exitSearch() {
  enterExplore();
}

const GAG_ITEMS: Gag["item"][] = ["sock", "duck", "mouse", "cookie", "spider", "ball"];
let gagId = 0;

function searchSound(spot: HidingSpot): SfxName {
  const obj = WORLD.objectById.get(spot.objectId)!;
  if (spot.prep === "in") return "lid";
  if (spot.prep === "under") return "flashlight";
  if (spot.prep === "by") return "rustle";
  return obj.kind === "piano" ? "piano" : "knock";
}

async function doSearch(spotId: string) {
  const g0 = getGame();
  if (g0.phase !== "search" || busy || !g0.hunt) return;
  const spot = WORLD.spotById.get(spotId);
  if (!spot) return;
  busy = true;
  try {
    touchActivity();
    const before = g0.hunt;
    setGame({ phase: "busy", selectedSpot: spotId });
    rt.search = { spotId, t0: rt.time, open: true };
    audio.play(searchSound(spot));
    if (spot.prep !== "under") sparkle(spot.marker, "#d9c8ff", 14, { speed: 0.8, up: 0.6 });
    await sleep(spot.prep === "under" ? 950 : 750);

    const { state, result } = searchSpot(before, spotId, rng);
    setGame({ hunt: state });

    if (result.kind === "found") {
      await reveal(spot);
      return;
    }
    if (result.kind === "ignored") {
      setGame({ phase: "search" });
      return;
    }

    // Empty: a little surprise, and the place named in English.
    rt.gags.push({ id: ++gagId, spotId, item: pick(rng, GAG_ITEMS), t0: rt.time });
    audio.play("poof");
    caption(emptyCaption(spot), "empty", 2000);
    await sleep(1150);
    rt.search = { spotId, t0: rt.time, open: false };

    if (result.kind === "empty" && result.relocatedTo) {
      await relocate(before.spotId);
      return;
    }
    applyHelp();
    setGame({ phase: "search" });
    if (result.kind === "empty" && state.wrongSearchesThisClue === 2) {
      await giveClue("repeat");
    }
  } finally {
    busy = false;
  }
}

// ------------------------------------------------------------------ reveal

async function reveal(spot: HidingSpot) {
  const s = hunt();
  const ghost = GHOSTS[currentEncounter(s).ghost];
  rt.ghost.id = ghost.id;
  rt.ghost.anim = { mode: "found", spotId: spot.id, t0: rt.time };
  rt.helpObject = null;
  rt.helpSpot = null;
  const obj = WORLD.objectById.get(spot.objectId)!;
  rt.camera.mode = "shot";
  rt.camera.shot = revealShot(spot, obj, rt.camera.pos);
  setGame({ revealed: { spotId: spot.id, ghost: ghost.id }, clueShown: false, caption: null, helpLevel: 0 });
  audio.play("boo");
  window.setTimeout(() => audio.play("giggle", { pitch: ghost.voice }), 450 * pace);
  sparkle({ x: spot.pos.x, y: spot.pos.y + 0.4, z: spot.pos.z }, ghost.glow, 36, { speed: 1.8, up: 1.4 });
  await sleep(900);
  networkErrors = 0;
  setGame({ phase: "answer", answer: { ...EMPTY_ANSWER, spotId: spot.id, buttons: !micUsable() } });
  // The answer panel shows the question; no subtitle.
  await say(QUESTION, { subtitle: false });
}

// ------------------------------------------------------------------ answer

function startListening() {
  const g = getGame();
  if (g.phase !== "answer" || g.answer.listening || !micUsable()) return;
  tts.cancel();
  const target = currentSpot(g.hunt!).prep;
  let settled = false;
  let lastAlts: string[] = [];
  let error: string | null = null;
  const finish = () => {
    audio.setListening(false);
    stopListening = null;
    setAnswer({ listening: false });
  };
  audio.setListening(true);
  audio.play("micOn");
  setAnswer({ listening: true, status: "listening", heard: "", wrongWord: null });
  stopListening = recognition.listen({
    onResult(alts, isFinal) {
      if (settled) return;
      lastAlts = alts;
      setAnswer({ heard: alts[0] ?? "" });
      const j = judgeSpeech(alts, target);
      // Correct is accepted the moment it is heard; wrong only once the attempt is over.
      if (j.kind === "correct") {
        settled = true;
        stopListening?.();
        finish();
        resolveCorrect(target);
      } else if (isFinal) {
        settled = true;
        stopListening?.();
        finish();
        spokenMiss(j);
      }
    },
    onError(err) {
      error = err;
    },
    onEnd() {
      finish();
      if (settled) return;
      settled = true;
      audio.play("micOff");
      if (error && HARD_ERRORS.has(error)) {
        micBlocked();
        return;
      }
      if (error === "aborted") {
        setAnswer({ status: "idle" });
        return;
      }
      if (error === "network") {
        networkErrors++;
        if (networkErrors >= 2) {
          micBlocked();
          return;
        }
      }
      spokenMiss(lastAlts.length ? judgeSpeech(lastAlts, target) : { kind: "none", heard: "" });
    }
  });
}

function micBlocked() {
  setGame({ micState: "blocked", hint: "micBlocked" });
  setAnswer({ buttons: true, listening: false, status: "idle" });
  window.setTimeout(() => {
    if (getGame().hint === "micBlocked") setGame({ hint: null });
  }, 5000);
}

function ghostGiggle() {
  const s = hunt();
  const spotId = s.spotId;
  rt.ghost.anim = { mode: "giggle", spotId, t0: rt.time };
  audio.play("giggle", { pitch: GHOSTS[currentEncounter(s).ghost].voice });
}

function spokenMiss(j: Judgement) {
  const g = getGame();
  if (g.phase !== "answer") return;
  const misses = g.answer.misses + 1;
  if (j.kind === "wrong") {
    const { state } = answerPrep(g.hunt!, j.prep, rng);
    setGame({ hunt: state });
    audio.play("error");
    ghostGiggle();
    setAnswer({ status: "wrong", wrongWord: j.prep, misses });
  } else {
    setAnswer({ status: "none", wrongWord: null, misses });
  }
  answerLadder(misses);
}

/** Second miss: Boo models the sentence. Third: the word buttons open (rescue). */
function answerLadder(misses: number) {
  if (misses === 2) run(async () => {
    await sleep(500);
    if (getGame().phase === "answer") await say(`Listen! ${clueSpoken(currentSpot(hunt()))}`);
  });
  if (misses >= 3 && !getGame().answer.buttons) setAnswer({ buttons: true });
}

function answerButton(prep: Prep) {
  const g = getGame();
  if (g.phase !== "answer" || !g.answer.buttons || g.answer.disabled.includes(prep) || g.answer.listening) return;
  touchActivity();
  const target = currentSpot(g.hunt!).prep;
  if (prep === target) {
    resolveCorrect(prep);
    return;
  }
  const { state } = answerPrep(g.hunt!, prep, rng);
  setGame({ hunt: state });
  audio.play("error");
  ghostGiggle();
  const misses = g.answer.misses + 1;
  setAnswer({ status: "wrong", wrongWord: prep, misses, disabled: [...g.answer.disabled, prep] });
  if (misses === 2) answerLadder(2);
}

const PRAISE = ["Great job!", "Nice!", "Super!", "You got it!"];

function resolveCorrect(prep: Prep) {
  run(async () => {
    const g = getGame();
    if (g.phase !== "answer") return;
    stopListening?.();
    tts.cancel();
    const spot = currentSpot(g.hunt!);
    const { state, result } = answerPrep(g.hunt!, prep, rng);
    if (result.kind !== "correct") return;
    const ghost = GHOSTS[result.record.ghost];
    setGame({ hunt: state, phase: "busy", answer: { ...g.answer, filled: prep, status: "correct", listening: false } });
    audio.play("correct");
    await say(sentenceWith(prep, spot).replace(/\.$/, "!"));

    if (result.next === "escaped") {
      await escapeAfterRound(spot);
      return;
    }

    // Capture: surprised face, sparkles, sucked into the lantern (wider shot so the lantern is in view).
    rt.camera.shot = captureShot(rt.player, spot.pos);
    rt.ghost.anim = { mode: "capture", spotId: spot.id, t0: rt.time };
    sparkle({ x: spot.pos.x, y: spot.pos.y + 0.4, z: spot.pos.z }, ghost.glow, 40, { speed: 1.2, up: 1, swirl: 7, life: 1.2 });
    await sleep(500);
    audio.play("capture");
    await sleep(950);
    sparkle(rt.lantern, ghost.glow, 30, { speed: 1, up: 1.2 });
    setGame({ lantern: [...getGame().lantern, ghost.id], revealed: null });
    rt.search = null;
    await say(pick(rng, PRAISE));
    if (result.next === "done") {
      await finishGame();
      return;
    }
    rt.ghost.id = currentEncounter(state).ghost;
    rt.ghost.anim = { mode: "hidden" };
    enterExplore();
    setGame({ phase: "busy" });
    await giveClue("next");
    enterExplore();
  });
}

/** Correct answer, but the ghost has more rounds: it escapes to a new spot. */
async function escapeAfterRound(spot: HidingSpot) {
  const s = hunt();
  const ghost = GHOSTS[currentEncounter(s).ghost];
  rt.ghost.anim = { mode: "escape", spotId: spot.id, t0: rt.time - 0.45 };
  setGame({ revealed: null });
  rt.search = null;
  audio.play("giggle", { pitch: ghost.voice });
  await say("Catch me!", { speaker: "ghost", pitch: 1.7 });
  audio.play("whoosh");
  await sleep(1200);
  audio.play("poof");
  enterExplore();
  setGame({ phase: "busy" });
  await sleep(300);
  await say("Oh no! It ran away!");
  await giveClue("next");
  enterExplore();
}

/** After too many empty searches: the ghost pops out, laughs, zooms off and hides elsewhere. */
async function relocate(fromSpotId: string) {
  const s = hunt();
  const ghost = GHOSTS[currentEncounter(s).ghost];
  rt.camera.mode = "follow";
  rt.camera.shot = null;
  setGame({ searchId: null, selectedSpot: null, caption: null });
  rt.ghost.anim = { mode: "escape", spotId: fromSpotId, t0: rt.time };
  audio.play("giggle", { pitch: ghost.voice });
  await sleep(500);
  audio.play("whoosh");
  await sleep(1800);
  audio.play("poof");
  await sleep(300);
  await say("Oh no! It moved!");
  await giveClue("moved");
  enterExplore();
}

async function finishGame() {
  rt.ghost.anim = { mode: "hidden" };
  audio.stopMusic();
  audio.play("fanfare");
  await sleep(1200);
  audio.startMusic("victory");
  setGame({ screen: "results", phase: "outro", clueShown: false, line: null });
}

// ------------------------------------------------------------------ input

function moveSelection(dx: number, dy: number) {
  const g = getGame();
  if (g.phase !== "search" || !g.searchId) return;
  const spots = WORLD.spots.filter((s) => s.objectId === g.searchId);
  if (!spots.length) return;
  const cam = cameraRef.current;
  const cur = spots.find((s) => s.id === g.selectedSpot) ?? spots[0];
  if (!cam) {
    const i = spots.indexOf(cur);
    setGame({ selectedSpot: spots[(i + (dx + dy > 0 ? 1 : spots.length - 1)) % spots.length].id });
    return;
  }
  const project = (s: HidingSpot) => {
    const v = new THREE.Vector3(s.marker.x, s.marker.y, s.marker.z).project(cam);
    return { x: v.x, y: v.y };
  };
  const p0 = project(cur);
  let best: HidingSpot | null = null;
  let bestScore = Infinity;
  for (const s of spots) {
    if (s === cur) continue;
    const p = project(s);
    const vx = p.x - p0.x;
    const vy = p.y - p0.y;
    const dist = Math.hypot(vx, vy);
    if (dist < 1e-4) continue;
    const along = (vx * dx + vy * dy) / dist;
    if (along < 0.25) continue;
    const score = dist / along;
    if (score < bestScore) {
      bestScore = score;
      best = s;
    }
  }
  if (!best) {
    const i = spots.indexOf(cur);
    best = spots[(i + (dx + dy > 0 ? 1 : spots.length - 1)) % spots.length];
  }
  setGame({ selectedSpot: best.id });
  audio.play("tick");
}

function onKey(code: string) {
  const g = getGame();
  if (g.screen !== "game") return;
  if (g.settingsOpen) {
    if (code === "Escape") setGame({ settingsOpen: false });
    return;
  }
  switch (g.phase) {
    case "explore":
      if (code === "KeyE" || code === "Enter" || code === "NumpadEnter") director.interact();
      else if (code === "KeyR") director.replayClue();
      break;
    case "search":
      if (code === "KeyE" || code === "Enter" || code === "NumpadEnter") director.interact();
      else if (code === "Escape" || code === "KeyQ" || code === "Backspace") director.back();
      else if (code === "ArrowLeft" || code === "KeyA") moveSelection(-1, 0);
      else if (code === "ArrowRight" || code === "KeyD") moveSelection(1, 0);
      else if (code === "ArrowUp" || code === "KeyW") moveSelection(0, 1);
      else if (code === "ArrowDown" || code === "KeyS") moveSelection(0, -1);
      else if (code === "KeyR") director.replayClue();
      break;
    case "answer": {
      if (code === "Space") director.mic();
      const i = ["Digit1", "Digit2", "Digit3", "Digit4"].indexOf(code);
      if (i >= 0) answerButton(PREPS[i]);
      break;
    }
    default:
      break;
  }
}

// ------------------------------------------------------------------- API

export const director = {
  onKey,

  setPace(p: number) {
    pace = p;
  },

  setSeed(seed: number) {
    rng = mulberry32(seed);
  },

  /** Start from the title screen (must be called from a click: unlocks audio and asks for the mic once). */
  async startGame(mode: Mode = "practice") {
    audio.unlock();
    tts.setRate(getGame().settings.slowVoice ? 0.8 : 1);
    gen++;
    busy = false;
    stopListening?.();
    resetRuntime();
    const settings = getGame().settings;
    audio.setVolumes(settings.music, settings.sfx);
    setGame({ screen: "game", phase: "busy", mode, fade: 0 });

    let micState = getGame().micState;
    if (!recognition.supported) micState = "unsupported";
    else if (settings.mic && micState !== "ready") {
      const p = await requestMicPermission(8000);
      micState = p === "denied" || p === "unavailable" ? "blocked" : "ready";
    }

    const state = createHunt(practicePlan());
    rt.ghost.id = currentEncounter(state).ghost;
    rt.player.x = PRACTICE_START.x;
    rt.player.z = PRACTICE_START.z;
    rt.player.yaw = Math.PI;
    rt.player.vx = 0;
    rt.player.vz = 0;
    rt.camera.yaw = 0;
    rt.camera.mode = "follow";
    rt.camera.snap = true;
    setGame({
      hunt: state,
      micState,
      clueShown: false,
      clueSpeaking: false,
      helpLevel: 0,
      line: null,
      caption: null,
      focusId: null,
      searchId: null,
      selectedSpot: null,
      revealed: null,
      answer: EMPTY_ANSWER,
      lantern: [],
      hint: micState === "blocked" && settings.mic ? "micBlocked" : null
    });
    audio.startRain();
    audio.startMusic("night");
    window.clearInterval(idleTimer);
    idleTimer = window.setInterval(idleCheck, 1000);
    run(async () => {
      await sleep(600);
      rt.boo.visible = true;
      rt.boo.appearT0 = rt.time;
      audio.play("sparkle");
      await sleep(500);
      await say("Find the ghost!");
      await giveClue("first");
      enterExplore();
      setGame({ hint: "move" });
    });
  },

  toTitle() {
    gen++;
    busy = false;
    stopListening?.();
    tts.cancel();
    audio.setListening(false);
    audio.stopMusic();
    audio.stopRain(1);
    window.clearInterval(idleTimer);
    resetRuntime();
    setGame({ screen: "title", phase: "intro", hunt: null, line: null, caption: null, clueShown: false, settingsOpen: false });
  },

  /** E key / search button. */
  interact() {
    const g = getGame();
    if (g.settingsOpen) return;
    if (g.phase === "explore" && g.focusId) enterSearch(g.focusId);
    else if (g.phase === "search" && g.selectedSpot) run(() => doSearch(g.selectedSpot!));
  },

  /** A searchable object was tapped/clicked in 3D. */
  tapObject(objectId: string) {
    const g = getGame();
    if (g.phase !== "explore" || g.settingsOpen) return;
    if (canReach(objectId)) {
      enterSearch(objectId);
      return;
    }
    // Too far: walk over there, then search.
    const obj = WORLD.objectById.get(objectId);
    if (!obj) return;
    const c = rectCenter(obj.rect);
    rt.player.walkTo = { x: c.x, z: c.z, objectId, t0: rt.time };
  },

  chooseSpot(spotId: string) {
    run(() => doSearch(spotId));
  },

  back() {
    const g = getGame();
    if (g.settingsOpen) {
      setGame({ settingsOpen: false });
      return;
    }
    if (g.phase === "search" && !busy) exitSearch();
  },

  mic() {
    const g = getGame();
    if (g.phase !== "answer") return;
    if (g.answer.listening) {
      stopListening?.();
      return;
    }
    startListening();
  },

  answerButton,

  replayClue() {
    const g = getGame();
    if (!g.hunt || g.hunt.status !== "hunting" || tts.isSpeaking()) return;
    if (g.phase !== "explore" && g.phase !== "search") return;
    touchActivity();
    run(sayClue);
  },

  updateSettings(patch: Partial<Settings>) {
    const settings = { ...getGame().settings, ...patch };
    setGame({ settings });
    saveSettings(settings);
    audio.setVolumes(settings.music, settings.sfx);
    tts.setRate(settings.slowVoice ? 0.8 : 1);
    const g = getGame();
    if (g.phase === "answer") setAnswer({ buttons: g.answer.buttons || !micUsable() });
  },

  /** Read-only view for tests and the e2e hook. */
  debug() {
    const g = getGame();
    const s = g.hunt;
    return {
      screen: g.screen,
      phase: g.phase,
      spotId: s?.spotId ?? null,
      prep: s ? currentSpot(s).prep : null,
      status: s?.status ?? null,
      stats: s?.stats ?? null,
      busy
    };
  }
};

function idleCheck() {
  const g = getGame();
  if (g.screen !== "game" || busy || tts.isSpeaking()) return;
  if (g.phase !== "explore" && g.phase !== "search") return;
  if (performance.now() - lastActivity > 24000) {
    touchActivity();
    run(() => giveClue("repeat"));
  }
}

tts.onSpeakingChange((on) => audio.setSpeaking(on));
