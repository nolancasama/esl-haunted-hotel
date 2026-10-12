import { audio, type SfxName } from "../audio/audio";
import { tts } from "../audio/tts";
import { HARD_ERRORS, recognition, requestMicPermission } from "../audio/recognition";
import { EMPTY_ANSWER, getGame, saveReplayUnlocked, saveSettings, setGame, type AnswerUi, type HintId, type Mode, type Settings } from "./store";
import { resetRuntime, rt, type Gag } from "./runtime";
import { answerPrep, createHunt, currentEncounter, currentSpot, searchHelpLevel, searchSpot, type Encounter, type HuntState } from "./logic/hunt";
import { practicePlan, storyPlan } from "./logic/plans";
import { replayPlan } from "./logic/replay";
import { clueSpoken, emptyCaption, QUESTION, sentenceWith } from "./logic/clues";
import { judgeSpeech, type Judgement } from "./logic/speechMatch";
import { mulberry32, pick, type Rng } from "./logic/rng";
import { WORLD, type HidingSpot } from "./world/world";
import { INTERACT_RANGE, OUTSIDE, PRACTICE_START, STORY_START } from "./world/constants";
import { rectCenter, rectDistance } from "./world/geometry";
import { DOORS, ROOMS, ROOM_DOOR, roomAt } from "./world/rooms";
import { GHOSTS } from "./ghosts";
import { PREPS, type GhostId, type Prep, type RoomId } from "./types";
import { LINE_JA } from "../ui/i18n";
import { captureShot, revealShot, searchShot, standPoint, viewDir } from "../scene/framing";
import { resolveCollisions } from "./world/collision";
import { cameraRef } from "../scene/CameraRig";
import { sparkle } from "../scene/Effects";
import * as THREE from "three";

/**
 * The director turns the pure hunt state machine into a game: it plays
 * Boo's lines, camera moves, search animations, the answer interaction, the
 * capture, the story's rooms and its opening and ending. Every async
 * sequence is tied to a generation number, so going back to the title (or
 * skipping the intro) cancels whatever was playing.
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
let tickTimer = 0;
/** Story: the clue for the current ghost starts when the player walks into its room. */
let awaitingEntry = false;
/** Ending: the player walks out of the open entrance. */
let outroWalk = false;
let outroWalkT0 = 0;
let nextAmbient = 0;
let lastLockedBump = 0;
let pendingNext: (() => void) | null = null;

const params = new URLSearchParams(typeof location !== "undefined" ? location.search : "");
const fixedSeed = params.has("seed") ? Number(params.get("seed")) || 1 : null;
if (fixedSeed !== null) rng = mulberry32(fixedSeed);
if (params.get("fast") === "1") pace = 0.25;

function alive(g: number) {
  if (g !== gen) throw new Cancelled();
}

function sleep(ms: number): Promise<void> {
  const g = gen;
  return new Promise((resolve, reject) => window.setTimeout(() => (g === gen ? resolve() : reject(new Cancelled())), ms * pace));
}

function run(fn: () => Promise<void>) {
  fn().catch((e) => {
    if (!(e instanceof Cancelled)) console.error(e);
  });
}

const hunt = (): HuntState => getGame().hunt!;
const setAnswer = (patch: Partial<AnswerUi>) => setGame({ answer: { ...getGame().answer, ...patch } });
const isStory = () => getGame().mode !== "practice";

function micUsable(): boolean {
  const g = getGame();
  return g.settings.mic && recognition.supported && g.micState !== "blocked" && g.micState !== "unsupported";
}

let toastKey = 0;

/** Set the standing hint. */
function showHint(hint: HintId | null) {
  setGame({ hint });
}

/** A short message over the standing hint; the standing hint comes back when it expires. */
function toast(id: HintId, ms: number) {
  const key = ++toastKey;
  setGame({ toast: { id, key }, lastToast: id });
  window.setTimeout(() => {
    if (getGame().toast?.key === key) setGame({ toast: null });
  }, ms);
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
    if (getGame().line?.id === id && !getGame().line?.wait) setGame({ line: null });
  }, 1600 * pace);
}

/**
 * A story line the student can read at their own pace: it waits for the
 * voice to finish plus a moment, or for Next (click / Space / Enter).
 */
async function sayWait(en: string) {
  const g = gen;
  const id = ++lineId;
  setGame({ line: { id, en, ja: LINE_JA[en], speaker: "boo", wait: true } });
  let resolveNext: () => void = () => {};
  const next = new Promise<void>((r) => (resolveNext = r));
  pendingNext = resolveNext;
  rt.boo.talking = true;
  const spoken = tts.speak(en, { pitch: 1.2 }).then(() => {
    rt.boo.talking = false;
  });
  await Promise.race([spoken.then(() => new Promise<void>((r) => window.setTimeout(r, 1300 * pace))), next]);
  rt.boo.talking = false;
  if (pendingNext === resolveNext) pendingNext = null;
  tts.cancel();
  alive(g);
  if (getGame().line?.id === id) setGame({ line: null });
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
  // Sleepy is the tutorial: the picture hint is there from the start.
  const tutorial = getGame().mode === "story" && currentEncounter(s).ghost === "sleepy";
  setGame({ helpLevel: tutorial ? Math.max(level, 2) : level });
  rt.helpObject = level >= 3 && s.status === "hunting" ? currentSpot(s).objectId : null;
  rt.helpSpot = level >= 4 && s.status === "hunting" ? s.spotId : null;
}

// ------------------------------------------------------------------ clues

async function giveClue(kind: "first" | "entry" | "moved" | "next" | "repeat") {
  const s = hunt();
  const ghost = GHOSTS[currentEncounter(s).ghost];
  applyHelp();
  if (kind === "repeat") {
    await say("Listen!");
  } else {
    if (kind !== "entry") {
      audio.play("giggle", { pitch: ghost.voice });
      await sleep(750);
    }
    await say(QUESTION);
    await sleep(120);
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

/** Each ghost announces itself in its own way when you walk in. */
async function entryCue(ghost: GhostId) {
  switch (ghost) {
    case "sleepy":
      audio.play("snore");
      await sleep(1700);
      break;
    case "hungry":
      audio.play("munch");
      await sleep(500);
      await say("Yum yum!", { speaker: "ghost", pitch: 1.6 });
      break;
    case "sneaky":
      audio.play("rattle");
      await sleep(450);
      audio.play("giggle", { pitch: GHOSTS.sneaky.voice });
      await sleep(800);
      break;
    case "mischief":
      audio.play("giggle", { pitch: GHOSTS.mischief.voice });
      await sleep(400);
      await say("Catch me!", { speaker: "ghost", pitch: 1.75 });
      break;
  }
}

// ------------------------------------------------------------- encounters

/** The current ghost's turn begins: open its room and wait for the student to walk in. */
async function beginEncounter(first: boolean) {
  const s = hunt();
  const enc = currentEncounter(s);
  rt.ghost.id = enc.ghost;
  rt.ghost.anim = { mode: "hidden" };
  setGame({ clueShown: false });
  if (!isStory()) {
    awaitingEntry = false;
    await giveClue("first");
    return;
  }
  const door = ROOM_DOOR[enc.room];
  if (door && !rt.doorsOpen.has(door)) {
    audio.play("unlock");
    await sleep(350);
    rt.doorsOpen.set(door, rt.time);
    audio.play("creak");
  }
  if (roomAt(rt.player.x, rt.player.z) === enc.room) {
    await startEncounter();
  } else {
    awaitingEntry = true;
    rt.beaconDoor = door ?? null;
    if (!first) await say("Next room!");
    showHint("goDoor");
  }
}

/** Turn the camera (once, gently) so it looks into the room from its door. */
function faceIntoRoom(room: RoomId) {
  const id = ROOM_DOOR[room];
  const door = DOORS.find((d) => d.id === id);
  if (!door) return;
  const b = ROOMS[room].bounds;
  const doorX = door.axis === "x" ? (door.from + door.to) / 2 : door.at;
  const doorZ = door.axis === "x" ? door.at : (door.from + door.to) / 2;
  const target = Math.atan2(doorX - (b.x0 + b.x1) / 2, doorZ - (b.z0 + b.z1) / 2);
  rt.camera.inputLock = rt.camera.yaw;
  rt.camera.yawTarget = target;
}

async function startEncounter() {
  awaitingEntry = false;
  rt.beaconDoor = null;
  if (getGame().hint === "goDoor") showHint(null);
  const enc = currentEncounter(hunt());
  faceIntoRoom(enc.room);
  nextAmbient = rt.time + 10;
  await entryCue(enc.ghost);
  await giveClue("entry");
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

const GAG_ITEMS: Gag["item"][] = ["sock", "duck", "mouse", "cookie", "spider", "ball"];
let gagId = 0;

function searchSound(spot: HidingSpot): SfxName {
  const obj = WORLD.objectById.get(spot.objectId)!;
  if (spot.prep === "in") return obj.kind === "clock" ? "chime" : "lid";
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
  setGame({ micState: "blocked" });
  toast("micBlocked", 5000);
  setAnswer({ buttons: true, listening: false, status: "idle" });
}

function ghostGiggle() {
  const s = hunt();
  rt.ghost.anim = { mode: "giggle", spotId: s.spotId, t0: rt.time };
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
  if (misses === 2)
    run(async () => {
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
      if (isStory()) await outro();
      else await finishGame();
      return;
    }
    enterExplore();
    setGame({ phase: "busy" });
    await beginEncounter(false);
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

// ------------------------------------------------------------ intro/outro

const SHOT_ENTRANCE = { pos: { x: -3.4, y: 2.3, z: 3.1 }, target: { x: -7.4, y: 1.0, z: 0 } };
const SHOT_BOO = { pos: { x: -3.0, y: 1.9, z: 2.3 }, target: { x: -5.6, y: 1.05, z: -0.1 } };
const SHOT_BOARD = { pos: { x: 0.2, y: 1.85, z: 0.9 }, target: { x: 0, y: 1.85, z: -3.9 } };

async function intro() {
  const enc0 = currentEncounter(hunt());
  setGame({ phase: "intro", fade: 1 });
  rt.player.x = OUTSIDE.x;
  rt.player.z = OUTSIDE.z;
  rt.player.yaw = Math.PI / 2;
  rt.doorsOpen.set("entrance", rt.time - 5);
  rt.camera.mode = "shot";
  rt.camera.shot = SHOT_ENTRANCE;
  rt.camera.snap = true;
  await sleep(400);
  setGame({ fade: 0 });
  rt.flashT0 = rt.time + 0.3;
  window.setTimeout(() => audio.thunder(0.75), 900 * pace);
  await sleep(1000);
  // Walk in out of the rain...
  rt.player.stepTo = { x: STORY_START.x, z: STORY_START.z, face: { x: 0, z: 0 } };
  await sleep(2300);
  // ...and the door slams shut behind you (on a slow device, make sure you are inside first).
  if (rt.player.x < -7.6) {
    rt.player.x = STORY_START.x;
    rt.player.z = STORY_START.z;
  }
  rt.player.stepTo = { x: rt.player.x, z: rt.player.z, face: { x: -10, z: 0 } };
  rt.doorSlam.add("entrance");
  rt.doorsOpen.delete("entrance");
  audio.play("slam");
  rt.flickerT0 = rt.time;
  await sleep(1700);
  // Boo appears.
  rt.boo.visible = true;
  rt.boo.appearT0 = rt.time;
  rt.boo.target = { x: -5.4, y: 1.45, z: -0.7 };
  audio.play("whoosh");
  window.setTimeout(() => audio.play("sparkle"), 300 * pace);
  sparkle({ x: -5.4, y: 1.5, z: -0.7 }, "#bfe9ff", 30, { speed: 1.4 });
  rt.camera.shot = SHOT_BOO;
  await sleep(900);
  await sayWait("Oh no! Four ghosts are hiding!");
  rt.camera.shot = SHOT_BOARD;
  await sayWait("Find the four ghosts!");
  rt.camera.shot = SHOT_BOO;
  await sayWait("Then you can go home!");
  await afterIntro(enc0);
}

/** Shared by the intro's end and "Skip". */
async function afterIntro(enc0: Encounter) {
  rt.boo.visible = true;
  rt.boo.target = null;
  rt.camera.mode = "follow";
  rt.camera.shot = null;
  setGame({ line: null });
  rt.ghost.id = enc0.ghost;
  setGame({ phase: "busy" });
  await say("Let's go!");
  await beginEncounter(true);
  enterExplore();
}

async function outro() {
  rt.ghost.anim = { mode: "hidden" };
  setGame({ phase: "outro", clueShown: false, revealed: null });
  await sleep(500);
  setGame({ fade: 1 });
  await sleep(800);
  // Back in the lobby, facing the front door.
  rt.player.x = -4.6;
  rt.player.z = 0.3;
  rt.player.yaw = -Math.PI / 2;
  rt.player.stepTo = null;
  rt.boo.visible = true;
  rt.boo.target = { x: -5.7, y: 1.45, z: 1.2 };
  rt.boo.appearT0 = rt.time;
  rt.camera.mode = "shot";
  rt.camera.shot = { pos: { x: -1.2, y: 2.1, z: 2.6 }, target: { x: -6.6, y: 1.1, z: 0 } };
  rt.camera.snap = true;
  audio.stopMusic();
  await sleep(300);
  setGame({ fade: 0 });
  await sleep(800);
  await sayWait("Great job!");
  await sayWait("You found four ghosts!");
  // The front door unlocks and the sun comes up.
  audio.play("unlock");
  sparkle({ x: -7.8, y: 1.3, z: 0 }, "#ffe08a", 30, { speed: 1.2 });
  await sleep(700);
  rt.doorSlam.delete("entrance");
  rt.doorsOpen.set("entrance", rt.time);
  audio.play("creak");
  rt.sunriseT0 = rt.time;
  audio.stopRain(3);
  window.setTimeout(() => audio.play("birds"), 1500 * pace);
  window.setTimeout(() => audio.play("birds"), 3200 * pace);
  audio.startMusic("victory");
  await sleep(1800);
  await say("Go home!");
  rt.boo.target = null;
  outroWalk = true;
  outroWalkT0 = performance.now();
  rt.camera.mode = "follow";
  rt.camera.shot = null;
  rt.camera.yaw = Math.PI / 2;
  rt.player.frozen = false;
  setGame({ phase: "explore" });
  showHint("exit");
}

async function finishGame() {
  outroWalk = false;
  rt.ghost.anim = { mode: "hidden" };
  if (getGame().mode !== "practice") {
    saveReplayUnlocked();
    setGame({ replayUnlocked: true });
  }
  setGame({ fade: 1 });
  await sleep(700);
  audio.stopMusic();
  audio.play("fanfare");
  setGame({ screen: "results", phase: "outro", clueShown: false, line: null, hint: null, toast: null, fade: 0 });
  await sleep(1200);
  audio.startMusic("victory");
}

// ------------------------------------------------------------------- tick

/** Runs a few times a second: room entry, locked doors, ghost mischief, the ending walk. */
function tick() {
  const g = getGame();
  if (g.screen !== "game" || !g.hunt) return;
  const room = roomAt(rt.player.x, rt.player.z);

  if (outroWalk) {
    if (rt.player.x < -8.7) {
      outroWalk = false;
      run(finishGame);
    } else if (performance.now() - outroWalkT0 > 9000 && !rt.player.stepTo && rt.player.speed < 0.1) {
      rt.player.stepTo = { x: -9.6, z: 0, face: { x: -12, z: 0 } };
    }
    return;
  }

  if (g.phase !== "explore" && g.phase !== "search") return;

  if (awaitingEntry && !busy) {
    const enc = currentEncounter(g.hunt);
    if (room === enc.room) {
      // Not `busy`: the student may already walk and search while Boo reads the clue.
      awaitingEntry = false;
      run(startEncounter);
      return;
    }
  }

  // Bumping into a locked door.
  if (g.phase === "explore" && performance.now() - lastLockedBump > 2500 && rt.player.speed > 0.5) {
    for (const d of DOORS) {
      if (rt.doorsOpen.has(d.id)) continue;
      const r =
        d.axis === "x" ? { x0: d.from, x1: d.to, z0: d.at - 0.1, z1: d.at + 0.1 } : { x0: d.at - 0.1, x1: d.at + 0.1, z0: d.from, z1: d.to };
      if (rectDistance(r, rt.player.x, rt.player.z) < 0.42) {
        lastLockedBump = performance.now();
        audio.play("locked");
        toast("locked", 1800);
        break;
      }
    }
  }

  // Each ghost's harmless mischief while you hunt in its room.
  if (!awaitingEntry && g.hunt.status === "hunting" && rt.time > nextAmbient && !tts.isSpeaking() && !busy) {
    const enc = currentEncounter(g.hunt);
    if (room === enc.room) {
      nextAmbient = rt.time + 8 + Math.random() * 5;
      switch (enc.ghost) {
        case "sleepy":
          audio.play("snore");
          break;
        case "hungry":
          audio.play("munch");
          break;
        case "sneaky": {
          // Something else rattles: a distraction, never the ghost's own hiding place.
          const ghostObj = currentSpot(g.hunt).objectId;
          const others = WORLD.objects.filter((o) => o.room === "storage" && o.id !== ghostObj && !o.spec.flat && !o.spec.wallMounted);
          const o = pick(rng, others);
          rt.rattle.objectId = o.id;
          rt.rattle.t0 = rt.time;
          audio.play("rattle");
          nextAmbient = rt.time + 6 + Math.random() * 4;
          break;
        }
        case "mischief":
          audio.play("giggle", { pitch: GHOSTS.mischief.voice });
          break;
      }
    }
  }

  // A student who has been wandering for a while hears the clue again.
  if (!awaitingEntry && !busy && !tts.isSpeaking() && g.hunt.status === "hunting" && g.clueShown && performance.now() - lastActivity > 24000) {
    touchActivity();
    run(() => giveClue("repeat"));
  }
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
  if (g.line?.wait && ["Space", "Enter", "NumpadEnter", "KeyE"].includes(code)) {
    director.next();
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

function planFor(mode: Mode): Encounter[] {
  if (mode === "practice") return practicePlan();
  if (mode === "replay") return replayPlan(rng);
  return storyPlan();
}

// ------------------------------------------------------------------- API

export const director = {
  onKey,

  setPace(p: number) {
    pace = p;
  },

  /** Start from the title screen (must be called from a click: unlocks audio and asks for the mic once). */
  async startGame(mode: Mode = "story") {
    audio.unlock();
    tts.setRate(getGame().settings.slowVoice ? 0.8 : 1);
    gen++;
    busy = false;
    awaitingEntry = false;
    outroWalk = false;
    pendingNext = null;
    stopListening?.();
    resetRuntime();
    if (fixedSeed !== null) rng = mulberry32(fixedSeed);
    const settings = getGame().settings;
    audio.setVolumes(settings.music, settings.sfx);
    setGame({ screen: "game", phase: "busy", mode, fade: 0 });

    let micState = getGame().micState;
    if (!recognition.supported) micState = "unsupported";
    else if (settings.mic && micState !== "ready") {
      const p = await requestMicPermission(8000);
      micState = p === "denied" || p === "unavailable" ? "blocked" : "ready";
    }

    const state = createHunt(planFor(mode));
    const enc0 = currentEncounter(state);
    rt.ghost.id = enc0.ghost;
    const start = mode === "practice" ? PRACTICE_START : STORY_START;
    rt.player.x = start.x;
    rt.player.z = start.z;
    rt.player.yaw = mode === "practice" ? Math.PI : Math.PI / 2;
    rt.player.vx = 0;
    rt.player.vz = 0;
    rt.camera.yaw = mode === "practice" ? 0 : 0.35;
    rt.camera.pitch = 0.9;
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
      hint: null,
      toast: null
    });
    if (micState === "blocked" && settings.mic) toast("micBlocked", 6000);
    audio.startRain();
    audio.startMusic("night");
    window.clearInterval(tickTimer);
    tickTimer = window.setInterval(tick, 200);
    touchActivity();
    run(async () => {
      if (mode === "story" && params.get("intro") !== "0") {
        await intro();
        return;
      }
      if (mode !== "practice") {
        // Replay: straight in, the front door is already shut.
        await sleep(400);
        rt.boo.visible = true;
        rt.boo.appearT0 = rt.time;
        audio.play("sparkle");
        await sleep(400);
        await say("Find the four ghosts!");
        await afterIntro(enc0);
        return;
      }
      await sleep(600);
      rt.boo.visible = true;
      rt.boo.appearT0 = rt.time;
      audio.play("sparkle");
      await sleep(500);
      await say("Find the ghost!");
      await beginEncounter(true);
      enterExplore();
      showHint("move");
    });
  },

  /** Skip the opening cutscene. */
  skipIntro() {
    const g = getGame();
    if (g.phase !== "intro" || !g.hunt) return;
    gen++;
    tts.cancel();
    pendingNext = null;
    const enc0 = currentEncounter(g.hunt);
    rt.player.x = STORY_START.x;
    rt.player.z = STORY_START.z;
    rt.player.stepTo = null;
    rt.doorsOpen.delete("entrance");
    rt.doorSlam.add("entrance");
    rt.flickerT0 = -100;
    setGame({ fade: 0, line: null });
    run(() => afterIntro(enc0));
  },

  /** Advance a waiting story line. */
  next() {
    const p = pendingNext;
    pendingNext = null;
    p?.();
  },

  toTitle() {
    gen++;
    busy = false;
    awaitingEntry = false;
    outroWalk = false;
    pendingNext = null;
    stopListening?.();
    tts.cancel();
    audio.setListening(false);
    audio.stopMusic();
    audio.stopRain(1);
    window.clearInterval(tickTimer);
    resetRuntime();
    setGame({ screen: "title", phase: "intro", hunt: null, line: null, caption: null, clueShown: false, settingsOpen: false, hint: null, toast: null, fade: 0, lantern: [] });
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
    const obj = WORLD.objectById.get(objectId);
    if (!obj) return;
    // Only walk to things in the room you are in (no walking through walls).
    const room = roomAt(rt.player.x, rt.player.z);
    if (room && room !== obj.room) return;
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
    if (g.phase === "search" && !busy) enterExplore();
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
    if (!g.hunt || g.hunt.status !== "hunting" || !g.clueShown || tts.isSpeaking()) return;
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

  /** Read-only view for the e2e hook. */
  debug() {
    return { busy, awaitingEntry, outroWalk };
  },

  /** Test hook: catch every ghost at once and play the ending. */
  debugFinish() {
    const g = getGame();
    if (!g.hunt) return;
    const captured = g.hunt.encounters.map((e) => e.ghost);
    setGame({ hunt: { ...g.hunt, status: "done", index: g.hunt.encounters.length, captured }, lantern: captured });
    run(async () => (isStory() ? outro() : finishGame()));
  }
};

tts.onSpeakingChange((on) => audio.setSpeaking(on));
