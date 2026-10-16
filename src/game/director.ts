import { audio, type SfxName } from "../audio/audio";
import { tts } from "../audio/tts";
import { HARD_ERRORS, recognition, requestMicPermission } from "../audio/recognition";
import {
  EMPTY_ANSWER,
  getGame,
  saveCh2Unlocked,
  saveReplayUnlocked,
  saveSettings,
  setGame,
  type AnswerUi,
  type HintId,
  type Mode,
  type Scope,
  type Settings
} from "./store";
import { rattle, resetRuntime, rt, type Gag } from "./runtime";
import { answerPrep, createHunt, currentEncounter, currentSpot, searchHelpLevel, searchSpot, type Encounter, type HuntState } from "./logic/hunt";
import { chapterBreakAfter, practicePlan, storyPlan } from "./logic/plans";
import { replayPlan } from "./logic/replay";
import { clueSpoken, emptyCaption, QUESTION, sentenceWith } from "./logic/clues";
import { judgeSpeech, type Judgement } from "./logic/speechMatch";
import { mulberry32, pick, type Rng } from "./logic/rng";
import { turnDelta } from "./logic/startle";
import { WORLD, type HidingSpot, type WorldObject } from "./world/world";
import { INTERACT_RANGE, OUTSIDE, PRACTICE_START, STAIRS_FOOT, STORY_START, UPSTAIRS_START } from "./world/constants";
import { rectCenter, rectDistance } from "./world/geometry";
import { DOORS, FLOOR_Y, ROOMS, ROOM_DOOR, STAIRS, roomAt } from "./world/rooms";
import { CHAPTER_GHOSTS, GHOSTS } from "./ghosts";
import { PREPS, type Floor, type GhostId, type Prep, type RoomId } from "./types";
import { LINE_JA } from "../ui/i18n";
import { captureShot, revealShot, searchShot, standPoint, viewDir } from "../scene/framing";
import { collidersFor, resolveCollisions } from "./world/collision";
import { findPath, type NavPoint } from "./world/nav";
import { cameraRef } from "../scene/CameraRig";
import { bubbles, sparkle } from "../scene/Effects";
import * as THREE from "three";

/**
 * The director turns the pure hunt state machine into a game: it plays
 * Boo's lines, camera moves, search animations, the answer interaction, the
 * capture, the story's rooms, the Chapter 2 cinematic, the upstairs ghosts'
 * tricks and the opening and ending. Every async sequence is tied to a
 * generation number, so going back to the title (or skipping a cutscene)
 * cancels whatever was playing.
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
/** Which cutscene the Skip button skips. */
let cutscene: "intro" | "chapter2" | null = null;
/** Bubbles' bathroom: when the steam next rises, and whether the fan hint was shown. */
let nextSteam = 0;
let fanHinted = false;
let chapterCardKey = 0;

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
const playerRoom = (): RoomId | null => roomAt(rt.player.x, rt.player.z, rt.player.floor);
const isOpen = (id: string) => rt.doorsOpen.has(id);

function micUsable(): boolean {
  const g = getGame();
  return g.settings.mic && recognition.supported && g.micState !== "blocked" && g.micState !== "unsupported";
}

function canTapMove(): boolean {
  const g = getGame();
  return g.screen === "game" && g.phase === "explore" && !g.settingsOpen && !rt.player.frozen;
}

/** Shared by taps and keyboard bumps. */
function lockedFeedback() {
  lastLockedBump = performance.now();
  audio.play("locked");
  toast("locked", 1800);
}

function walkTo(destination: NavPoint, objectId: string | null = null) {
  const p = rt.player;
  p.walkTo = null;
  rt.destination.visible = false;
  const path = findPath(p, destination, isOpen, objectId);
  if (!path?.length) {
    const room = roomAt(destination.x, destination.z, destination.floor);
    const door = room && ROOM_DOOR[room];
    if ((door && !isOpen(door)) || (p.floor !== destination.floor && !isOpen("stairs"))) lockedFeedback();
    else toast("cantGo", 1800);
    return;
  }
  const end = path[path.length - 1];
  p.walkTo = { ...end, objectId, t0: rt.time, path, index: 0, replans: 0, checkT: rt.time, checkX: p.x, checkZ: p.z };
  Object.assign(rt.destination, end, { t0: rt.time, arrived: -1, visible: !objectId });
  touchActivity();
}

/** Put the player somewhere (a scene cut), on a floor, facing `yaw`. */
function placePlayer(x: number, z: number, floor: Floor, yaw: number) {
  rt.player.x = x;
  rt.player.z = z;
  rt.player.floor = floor;
  rt.player.y = FLOOR_Y[floor];
  rt.player.stairs = false;
  rt.player.vx = 0;
  rt.player.vz = 0;
  rt.player.yaw = yaw;
  rt.player.stepTo = null;
  rt.player.walkTo = null;
  rt.player.startle = null;
  rt.view.floor = floor;
}

/** Resolve once `done()` is true (checked every 50 ms), or false after `maxMs` of real time. */
async function waitUntil(done: () => boolean, maxMs: number): Promise<boolean> {
  const t0 = performance.now();
  while (!done()) {
    if (performance.now() - t0 > maxMs) return false;
    await sleep(50);
  }
  return true;
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

/** The chapter title card ("CHAPTER 2 — UPSTAIRS"). */
function chapterCard(chapter: 1 | 2, ms: number) {
  const key = ++chapterCardKey;
  const card =
    chapter === 1
      ? { key, title: "CHAPTER 1", sub: "THE GROUND FLOOR", ja: "だい1しょう ・ 1かい" }
      : { key, title: "CHAPTER 2", sub: "UPSTAIRS", ja: "だい2しょう ・ 2かい" };
  setGame({ chapterCard: card });
  audio.play("chapter");
  window.setTimeout(() => {
    if (getGame().chapterCard?.key === key) setGame({ chapterCard: null });
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

/** Stereo position and loudness of a sound coming from a point in the room. */
function placeSound(p: { x: number; z: number }): { pan: number; gain: number } {
  const cam = rt.camera.pos;
  const yaw = rt.camera.yaw;
  const dx = p.x - cam.x;
  const dz = p.z - cam.z;
  const d = Math.hypot(dx, dz) || 1;
  return { pan: Math.max(-0.9, Math.min(0.9, (dx * Math.cos(yaw) - dz * Math.sin(yaw)) / d)), gain: Math.max(0.45, Math.min(1, 1.25 - d / 14)) };
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
    case "bouncy":
      // the toys hop to say hello
      for (const id of PLAYROOM_TOYS) rattle(id, 1.2, 1);
      audio.play("boing", { pitch: 1.2 });
      await sleep(450);
      await say("Play with me!", { speaker: "ghost", pitch: 1.8 });
      break;
    case "bubbles":
      audio.play("bubbles");
      await sleep(400);
      await say("Splish splash!", { speaker: "ghost", pitch: 1.6 });
      nextSteam = rt.time + 7;
      break;
    case "melody":
      audio.play("flourish");
      await sleep(500);
      await say("La la la!", { speaker: "ghost", pitch: 1.7 });
      break;
    case "shadow":
      rt.flickerT0 = rt.time;
      audio.play("laugh", { pitch: 0.85 });
      await sleep(1100);
      await say("Find me!", { speaker: "ghost", pitch: 1.3 });
      break;
  }
}

// --------------------------------------------------- upstairs ghost tricks

/** Playroom toys that move by themselves (never a clue to where Bouncy is). */
const PLAYROOM_TOYS = ["playroom.horse", "playroom.train", "playroom.teddy", "playroom.blocks", "playroom.box", "playroom.chair1", "playroom.chair2"];
/** Instruments that play by themselves in the music room, and their sounds. */
const INSTRUMENTS: Array<[string, SfxName]> = [
  ["music.piano", "piano"],
  ["music.drum", "drum"],
  ["music.gramophone", "gramophone"],
  ["music.guitar", "strum"],
  ["music.cello", "cello"],
  ["music.box", "musicbox"]
];
const NOTE_COLORS = ["#ffbfe4", "#ffe98a", "#a8f4fa", "#c9b8ff"];
let noteId = 0;

function toySound(obj: WorldObject) {
  const where = placeSound(obj);
  switch (obj.kind) {
    case "rockinghorse":
      audio.play("creak", { pitch: 1.7, ...where });
      break;
    case "toytrain":
      audio.play("toot", where);
      break;
    case "teddy":
      audio.play("boing", { pitch: 0.7, ...where });
      break;
    default:
      audio.play("knock", where);
  }
}

/** One toy wiggles (Bouncy): `near` prefers the toy closest to a searched spot. Never Bouncy's own hiding place. */
function wiggleToy(near?: HidingSpot) {
  const s = hunt();
  const ghostObj = currentSpot(s).objectId;
  const toys = PLAYROOM_TOYS.filter((id) => id !== ghostObj && id !== near?.objectId).map((id) => WORLD.objectById.get(id)!);
  if (!toys.length) return;
  let toy = pick(rng, toys);
  if (near) {
    toy = toys.reduce((a, b) => (rectDistance(a.rect, near.pos.x, near.pos.z) <= rectDistance(b.rect, near.pos.x, near.pos.z) ? a : b));
  }
  rattle(toy.id, toy.kind === "rockinghorse" ? 2.2 : 1.4, 1);
  toySound(toy);
}

/** An instrument plays by itself (Melody). Any of them - sometimes even the one she hides by. */
function playInstrument() {
  const [id, sfx] = pick(rng, INSTRUMENTS);
  const obj = WORLD.objectById.get(id)!;
  rattle(id, 1.6, 1);
  audio.play(sfx, placeSound(obj));
  const c = rectCenter(obj.rect);
  for (let i = 0; i < 3; i++) {
    rt.notes.push({ id: ++noteId, x: c.x + (i - 1) * 0.2, y: obj.y + obj.spec.h + 0.1, z: c.z, t0: rt.time + i * 0.25, color: pick(rng, NOTE_COLORS) });
  }
}

/** Shadow makes the attic's furniture rattle. */
function atticRattles(count: number) {
  const ghostObj = currentSpot(hunt()).objectId;
  const things = WORLD.objects.filter((o) => o.room === "attic" && o.id !== ghostObj && !o.spec.flat && !o.spec.wallMounted);
  for (let i = 0; i < count; i++) {
    window.setTimeout(() => {
      const o = pick(rng, things);
      rattle(o.id, o.kind === "rockingchair" ? 2.4 : 0.9, 1.2);
      audio.play(o.kind === "rockingchair" ? "creak" : "rattle", { pitch: 0.8, ...placeSound(o) });
    }, i * 380 * pace);
  }
}

/** The fan switch in the bathroom: the fan runs for a while and blows the steam away. */
function useFan() {
  const sw = WORLD.objectById.get("bathroom.switch")!;
  audio.play("click", placeSound(sw));
  audio.play("fan", placeSound(WORLD.objectById.get("bathroom.fan")!));
  rt.steam.fanOnT0 = rt.time;
  rt.steam.fanUntil = rt.time + 25;
  rt.steam.target = 0;
  rt.attention = null;
  nextSteam = Math.max(nextSteam, rt.steam.fanUntil + 6);
  touchActivity();
}

// ------------------------------------------------------------- encounters

/** Beacon and standing hint: the door of the next room - or the stairs, if it is on the other floor. */
function pointTheWay() {
  const enc = currentEncounter(hunt());
  const upstairs = ROOMS[enc.room].floor === 1;
  if (upstairs && rt.player.floor === 0) {
    rt.beaconDoor = "stairs";
    showHint("goStairs");
  } else {
    rt.beaconDoor = ROOM_DOOR[enc.room] ?? null;
    showHint("goDoor");
  }
}

/** The current ghost's turn begins: open its room and wait for the student to walk in. */
async function beginEncounter(first: boolean) {
  const s = hunt();
  const enc = currentEncounter(s);
  rt.ghost.id = enc.ghost;
  rt.ghost.anim = { mode: "hidden" };
  rt.steam.target = 0;
  rt.attention = null;
  setGame({ clueShown: false });
  if (getGame().startedAt === null) setGame({ startedAt: performance.now() });
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
  if (playerRoom() === enc.room) {
    await startEncounter();
  } else {
    awaitingEntry = true;
    pointTheWay();
    if (!first) await say("Next room!");
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
  const hint = getGame().hint;
  if (hint === "goDoor" || hint === "goStairs") showHint(null);
  const enc = currentEncounter(hunt());
  faceIntoRoom(enc.room);
  nextAmbient = rt.time + 10;
  await entryCue(enc.ghost);
  await giveClue("entry");
}

// ----------------------------------------------------------------- search

function canReach(objectId: string): boolean {
  const obj = WORLD.objectById.get(objectId);
  if (!obj || obj.floor !== rt.player.floor || rt.player.stairs) return false;
  const room = playerRoom();
  if (room && obj.room !== room) return false;
  return rectDistance(obj.rect, rt.player.x, rt.player.z) <= INTERACT_RANGE + 0.05;
}

function enterSearch(objectId: string) {
  const g = getGame();
  if (g.phase !== "explore" || busy) return;
  const obj = WORLD.objectById.get(objectId);
  if (!obj) return;
  if (obj.action === "fan") {
    useFan();
    return;
  }
  if (!obj.searchable) return;
  const c = rectCenter(obj.rect);
  rt.player.yaw = Math.atan2(c.x - rt.player.x, c.z - rt.player.z);
  rt.player.walkTo = null;
  rt.camera.mode = "shot";
  rt.camera.shot = searchShot(obj, rt.player);
  const spots = WORLD.spots.filter((s) => s.objectId === objectId);
  // Step aside so the player does not stand between the camera and the object.
  const by = spots.find((s) => s.prep === "by");
  const stand = standPoint(obj, viewDir(obj, rt.player), rt.player, by ? by.pos : null);
  const safe = resolveCollisions(stand.x, stand.z, isOpen, collidersFor(obj.floor, false));
  rt.player.stepTo = { x: safe.x, z: safe.z, face: c };
  setGame({ phase: "search", searchId: objectId, selectedSpot: spots[0]?.id ?? null, focusId: objectId });
  audio.play("tick");
  touchActivity();
}

const GAG_ITEMS: Gag["item"][] = ["sock", "duck", "mouse", "cookie", "spider", "ball"];
let gagId = 0;

function searchSound(spot: HidingSpot): SfxName {
  const obj = WORLD.objectById.get(spot.objectId)!;
  if (spot.prep === "in") return obj.kind === "clock" ? "chime" : obj.kind === "bathtub" ? "bubbles" : "lid";
  if (spot.prep === "under") return "flashlight";
  if (spot.prep === "by") return "rustle";
  if (obj.kind === "piano") return "piano";
  if (obj.kind === "drum") return "drum";
  return "knock";
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
    // Bouncy makes a toy nearby move - atmosphere, never the answer.
    if (result.kind === "empty" && currentEncounter(before).ghost === "bouncy" && rng() < 0.6) {
      window.setTimeout(() => wiggleToy(spot), 450 * pace);
    }
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
  switch (ghost.id) {
    case "bubbles":
      bubbles({ x: spot.pos.x, y: spot.pos.y + 0.3, z: spot.pos.z }, 34);
      audio.play("bubbles");
      break;
    case "bouncy":
      audio.play("boing", { pitch: 1.3 });
      break;
    case "shadow":
      audio.play("laugh", { pitch: 1.2 });
      break;
  }
  await sleep(900);
  if (ghost.id === "melody") {
    // A little musical flourish before the answer.
    audio.play("flourish");
    for (let i = 0; i < 5; i++) {
      rt.notes.push({ id: ++noteId, x: spot.pos.x + (i - 2) * 0.18, y: spot.pos.y + 0.7, z: spot.pos.z, t0: rt.time + i * 0.12, color: NOTE_COLORS[i % 4] });
    }
    await sleep(900);
  }
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
    const capturedIndex = g.hunt!.index;
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
    // The last ghost of the game gets a grander flight.
    const last = result.next === "done";
    const big = last && ghost.id === "shadow";
    if (last) setGame({ finishedAt: performance.now() });
    rt.camera.shot = captureShot(rt.player, spot.pos);
    rt.ghost.anim = { mode: "capture", spotId: spot.id, t0: rt.time, big };
    sparkle({ x: spot.pos.x, y: spot.pos.y + 0.4, z: spot.pos.z }, ghost.glow, big ? 70 : 40, { speed: 1.2, up: 1, swirl: 7, life: 1.2 });
    await sleep(500);
    audio.play(big ? "bigcapture" : "capture");
    if (big) {
      rt.camera.shake = { t0: rt.time, amp: 0.05 };
      for (const id of CHAPTER_GHOSTS[2]) sparkle(spot.pos, GHOSTS[id].glow, 14, { speed: 2, up: 1.8, swirl: 4, life: 1.4 });
    }
    await sleep(big ? 1600 : 950);
    sparkle(rt.lantern, ghost.glow, 30, { speed: 1, up: 1.2 });
    setGame({ lantern: [...getGame().lantern, ghost.id], revealed: null });
    rt.search = null;
    await say(pick(rng, PRAISE));
    if (last) {
      if (isStory()) await outro();
      else await finishGame();
      return;
    }
    const plan = state.encounters;
    if (isStory() && chapterBreakAfter(plan, capturedIndex)) {
      // Chapter 1 is done: the stairs open.
      await chapterTwo();
      enterExplore();
      setGame({ phase: "busy" });
      await beginEncounter(true);
      enterExplore();
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
  if (ghost.id === "shadow") {
    // The great hide-and-seek: a laugh, the lights go out, Shadow flies off, the attic rattles.
    audio.play("laugh", { pitch: 1.05 });
    await say("Find me!", { speaker: "ghost", pitch: 1.3 });
    // Pull back so the glowing eyes can be seen zooming round the dark attic.
    rt.camera.mode = "follow";
    rt.camera.shot = null;
    rt.blackoutT0 = rt.time;
    audio.play("blackout");
    audio.play("whoosh");
    atticRattles(4);
    await sleep(1700);
    audio.play("poof");
    enterExplore();
    setGame({ phase: "busy" });
    await sleep(500);
    await say("Oh no! It ran away!");
    await giveClue("next");
    enterExplore();
    return;
  }
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

// The walk-in and the startle in one held shot: the doorway (and the rain outside) on the left, the
// player clear of it on the right. Off the door's axis, so the player never stands in front of the
// door; keepPlayer stops the "in the camera's way" fade, which used to hide the whole reaction.
const SHOT_ENTRANCE = { pos: { x: -4.3, y: 1.75, z: 3.0 }, target: { x: -7.2, y: 0.95, z: -0.3 }, keepPlayer: true };
const SHOT_BOO = { pos: { x: -3.0, y: 1.9, z: 2.3 }, target: { x: -5.6, y: 1.05, z: -0.1 }, keepPlayer: true };
const SHOT_BOARD = { pos: { x: 0.2, y: 1.85, z: 0.9 }, target: { x: 0, y: 1.85, z: -3.9 } };
// Chapter 2: the lobby, the chandelier, the gate at the foot of the stairs.
const SHOT_STAIRS = { pos: { x: -1.4, y: 2.7, z: 3.4 }, target: { x: 4.4, y: 1.5, z: -0.2 } };
const SHOT_CHANDELIER = { pos: { x: 2.6, y: 1.35, z: 2.7 }, target: { x: 0, y: 2.35, z: 0 } };
const SHOT_GATE = { pos: { x: 0.6, y: 1.7, z: 2.3 }, target: { x: 3.7, y: 0.9, z: 0 } };
const SHOT_BOO_STAIRS = { pos: { x: -0.5, y: 1.95, z: 3.0 }, target: { x: 2.4, y: 1.35, z: 0.2 } };
const BOO_BY_STAIRS = { x: 2.3, y: 1.5, z: -0.5 };

/** Past this, the player is clear of the front door. */
const INTRO_INSIDE_X = -7.6;
const INTRO_DOOR = { x: -10, z: 0 };

/**
 * Hop and turn round to face `look` (logic/startle.ts, played by Player). A
 * near half-turn goes round the side that faces the camera, so the face shows.
 */
function startleTowards(look: { x: number; z: number }) {
  const p = rt.player;
  p.stepTo = null;
  p.walkTo = null;
  p.vx = 0;
  p.vz = 0;
  const to = Math.atan2(look.x - p.x, look.z - p.z);
  const cx = rt.camera.pos.x - p.x;
  const cz = rt.camera.pos.z - p.z;
  const towardsCamera = (s: number) => Math.sin(p.yaw + (s * Math.PI) / 2) * cx + Math.cos(p.yaw + (s * Math.PI) / 2) * cz;
  const prefer = towardsCamera(1) >= towardsCamera(-1) ? 1 : -1;
  p.startle = { t0: rt.time + 0.04, from: p.yaw, delta: turnDelta(p.yaw, to, prefer) };
}

async function intro() {
  const enc0 = currentEncounter(hunt());
  cutscene = "intro";
  setGame({ phase: "intro", fade: 1 });
  placePlayer(OUTSIDE.x, OUTSIDE.z, 0, Math.PI / 2);
  rt.doorsOpen.set("entrance", rt.time - 5);
  rt.camera.mode = "shot";
  rt.camera.shot = SHOT_ENTRANCE;
  rt.camera.snap = true;
  await sleep(400);
  setGame({ fade: 0 });
  rt.flashT0 = rt.time + 0.3;
  window.setTimeout(() => audio.thunder(0.75), 900 * pace);
  await sleep(1000);
  // Walk in out of the rain (however long that takes on this device)...
  rt.player.stepTo = { x: STORY_START.x, z: STORY_START.z, face: { x: 0, z: 0 } };
  const arrived = await waitUntil(() => !rt.player.stepTo, 15000);
  if (!arrived) {
    rt.player.stepTo = null;
    if (rt.player.x < INTRO_INSIDE_X) {
      // Still in the doorway after all that time: move them in behind a quick fade, never a visible jump.
      setGame({ fade: 1 });
      await sleep(400);
      placePlayer(STORY_START.x, STORY_START.z, 0, Math.PI / 2);
      setGame({ fade: 0 });
      await sleep(300);
    }
  }
  // ...the door slams shut behind you: a startled hop, and a turn to look at it.
  rt.doorSlam.add("entrance");
  rt.doorsOpen.delete("entrance");
  audio.play("slam");
  rt.flickerT0 = rt.time;
  startleTowards(INTRO_DOOR);
  if (!(await waitUntil(() => !rt.player.startle, 15000)) && rt.player.startle) {
    // frames have all but stopped (a hidden tab): just end up facing the door
    rt.player.yaw = rt.player.startle.from + rt.player.startle.delta;
    rt.player.startle = null;
  }
  // A beat staring at the shut door before Boo shows up.
  await sleep(1200);
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
  cutscene = null;
  rt.boo.visible = true;
  rt.boo.target = null;
  rt.camera.mode = "follow";
  rt.camera.shot = null;
  setGame({ line: null });
  rt.ghost.id = enc0.ghost;
  setGame({ phase: "busy" });
  if (getGame().mode !== "practice") chapterCard(1, 2600);
  await say("Let's go!");
  await beginEncounter(true);
  enterExplore();
}

/**
 * The fourth ghost is in the lantern... and then a bang upstairs. The lights
 * flicker, the chandelier swings, the gate at the foot of the stairs swings
 * open and Boo looks surprised. Chapter 2 begins in the lobby, by the stairs:
 * the student walks up and finds the landing themselves.
 */
async function chapterTwo() {
  cutscene = "chapter2";
  saveCh2Unlocked();
  setGame({ ch2Unlocked: true, phase: "intro", clueShown: false, hint: null });
  rt.beaconDoor = null;
  rt.player.frozen = true;
  // The hotel goes quiet...
  audio.stopMusic();
  await sleep(1300);
  setGame({ fade: 1 });
  await sleep(700);
  placePlayer(STAIRS_FOOT.x, STAIRS_FOOT.z, 0, Math.PI / 2);
  rt.boo.visible = true;
  rt.boo.appearT0 = rt.time;
  rt.boo.target = BOO_BY_STAIRS;
  rt.camera.mode = "shot";
  rt.camera.shot = SHOT_STAIRS;
  rt.camera.snap = true;
  await sleep(300);
  setGame({ fade: 0 });
  await sleep(1100);
  // ...a loud noise from upstairs.
  audio.play("thud");
  rt.camera.shake = { t0: rt.time, amp: 0.07 };
  rt.boo.surprisedT0 = rt.time;
  rattle("lobby.chandelier", 3.2, 1.5);
  rt.flickerT0 = rt.time + 0.15;
  await sleep(700);
  rt.camera.shot = SHOT_CHANDELIER;
  audio.play("rattle");
  await sleep(1700);
  // The gate swings open.
  rt.camera.shot = SHOT_GATE;
  await sleep(700);
  audio.play("unlock");
  await sleep(350);
  rt.doorsOpen.set("stairs", rt.time);
  audio.play("creak", { pitch: 0.75 });
  sparkle({ x: STAIRS.gateX, y: 1.0, z: 0 }, "#ffd36b", 34, { speed: 1.3 });
  await sleep(1200);
  // Boo is surprised; a ghostly laugh from upstairs.
  rt.camera.shot = SHOT_BOO_STAIRS;
  rt.boo.surprisedT0 = rt.time;
  await sayWait("Wait! What's that?");
  audio.play("laugh", { pitch: 0.9, gain: 0.8 });
  await sleep(1800);
  await sayWait("Four more ghosts!");
  await sayWait("Let's go upstairs!");
  await afterChapterTwo();
}

/** The end of the Chapter 2 cutscene (also what "Skip" jumps to). */
async function afterChapterTwo() {
  cutscene = null;
  rt.doorsOpen.set("stairs", rt.doorsOpen.get("stairs") ?? rt.time);
  rt.boo.visible = true;
  rt.boo.target = null;
  rt.boo.surprisedT0 = -10;
  rt.flickerT0 = -100;
  setGame({ line: null, fade: 0, phase: "busy", chapter: 2 });
  chapterCard(2, 2800);
  audio.startMusic("upstairs");
  rt.camera.mode = "follow";
  rt.camera.shot = null;
  // Looking along the stairs from behind and to the side.
  rt.camera.yaw = -1.15;
  rt.camera.yawTarget = null;
  rt.player.frozen = false;
  await sleep(600);
}

/** Chapter 2 on its own: start at the top of the stairs. */
async function chapterTwoStart(enc0: Encounter) {
  await sleep(500);
  rt.boo.visible = true;
  rt.boo.appearT0 = rt.time;
  audio.play("sparkle");
  chapterCard(2, 2800);
  await sleep(600);
  await say("Four more ghosts!");
  rt.ghost.id = enc0.ghost;
  await say("Let's go!");
  await beginEncounter(true);
  enterExplore();
}

/** The lantern blazes with every ghost inside (after the last capture upstairs). */
async function lanternFinale() {
  rt.lanternBurstT0 = rt.time;
  audio.play("sparkle");
  audio.play("fanfare");
  const caught = getGame().lantern;
  caught.forEach((g, i) => window.setTimeout(() => sparkle(rt.lantern, GHOSTS[g].glow, 16, { speed: 1.5, up: 1.5, swirl: 6, life: 1.3 }), i * 170 * pace));
  rt.camera.mode = "shot";
  const yaw = rt.camera.yaw;
  rt.camera.shot = {
    pos: { x: rt.player.x + Math.sin(yaw) * 2.2, y: rt.player.y + 1.6, z: rt.player.z + Math.cos(yaw) * 2.2 },
    target: { x: rt.player.x, y: rt.player.y + 0.8, z: rt.player.z }
  };
  rt.boo.visible = true;
  rt.boo.appearT0 = rt.time;
  rt.boo.target = { x: rt.player.x + Math.cos(yaw) * 0.9, y: rt.player.y + 1.4, z: rt.player.z - Math.sin(yaw) * 0.9 };
  await sleep(1500);
  await say("Look!");
  await sleep(1400);
}

async function outro() {
  rt.ghost.anim = { mode: "hidden" };
  setGame({ phase: "outro", clueShown: false, revealed: null });
  const scope = getGame().scope;
  if (scope !== "ch1") await lanternFinale();
  await sleep(500);
  setGame({ fade: 1 });
  await sleep(800);
  // Back in the lobby, facing the front door.
  placePlayer(-4.6, 0.3, 0, -Math.PI / 2);
  rt.steam.target = 0;
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
  await sayWait(scope === "all" ? "You found eight ghosts!" : scope === "ch2" ? "You found all the ghosts!" : "You found four ghosts!");
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
  const g = getGame();
  if (g.mode !== "practice") {
    saveReplayUnlocked();
    setGame({ replayUnlocked: true });
    if (g.scope !== "ch2") {
      saveCh2Unlocked();
      setGame({ ch2Unlocked: true });
    }
  }
  if (getGame().finishedAt === null) setGame({ finishedAt: performance.now() });
  setGame({ fade: 1 });
  await sleep(700);
  audio.stopMusic();
  audio.play("fanfare");
  setGame({ screen: "results", phase: "outro", clueShown: false, line: null, hint: null, toast: null, fade: 0, chapterCard: null });
  await sleep(1200);
  audio.startMusic("victory");
}

// ------------------------------------------------------------------- tick

/** Runs a few times a second: room entry, locked doors, ghost mischief, the ending walk. */
function tick() {
  const g = getGame();
  if (g.screen !== "game" || !g.hunt) return;
  const room = playerRoom();

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
    // Up (or back down) the stairs: the beacon moves between the stairs and the door.
    const wantStairs = ROOMS[enc.room].floor === 1 && rt.player.floor === 0;
    if (wantStairs !== (rt.beaconDoor === "stairs")) pointTheWay();
  }

  // Bumping into a locked door (or the stairs gate) on this floor.
  if (g.phase === "explore" && performance.now() - lastLockedBump > 2500 && rt.player.speed > 0.5) {
    for (const d of DOORS) {
      if (rt.doorsOpen.has(d.id) || d.floor !== rt.player.floor) continue;
      const r =
        d.axis === "x" ? { x0: d.from, x1: d.to, z0: d.at - 0.1, z1: d.at + 0.1 } : { x0: d.at - 0.1, x1: d.at + 0.1, z0: d.from, z1: d.to };
      if (rectDistance(r, rt.player.x, rt.player.z) < 0.42) {
        lockedFeedback();
        break;
      }
    }
  }

  const enc = currentEncounter(g.hunt);
  const hunting = !awaitingEntry && g.hunt.status === "hunting" && room === enc.room;

  // Bubbles' steam rises now and then (unless the fan is running); a shape drifts through it.
  if (hunting && enc.ghost === "bubbles") {
    const st = rt.steam;
    if (rt.time > nextSteam && st.target === 0 && rt.time > st.fanUntil) {
      st.target = 1;
      audio.play("steam", placeSound(WORLD.objectById.get("bathroom.tub")!));
      nextSteam = rt.time + 24 + Math.random() * 8;
    }
    if (st.target > 0 && st.level > 0.6) {
      rt.attention = "bathroom.switch";
      if (!fanHinted) {
        fanHinted = true;
        toast("fan", 5000);
      }
      if (rt.time - st.silhouetteT0 > 9 && Math.random() < 0.15) st.silhouetteT0 = rt.time;
    }
    if (rt.time > st.fanUntil && st.target === 0) rt.attention = null;
  }

  // Each ghost's harmless mischief while you hunt in its room.
  if (hunting && rt.time > nextAmbient && !tts.isSpeaking() && !busy) {
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
        rattle(o.id);
        audio.play("rattle");
        nextAmbient = rt.time + 6 + Math.random() * 4;
        break;
      }
      case "mischief":
        audio.play("giggle", { pitch: GHOSTS.mischief.voice });
        break;
      case "bouncy":
        wiggleToy();
        nextAmbient = rt.time + 6 + Math.random() * 3;
        break;
      case "bubbles": {
        const where = placeSound(WORLD.objectById.get("bathroom.tub")!);
        audio.play("bubbles", { pan: where.pan, gain: where.gain * 0.6 });
        break;
      }
      case "melody":
        playInstrument();
        nextAmbient = rt.time + 7 + Math.random() * 3;
        break;
      case "shadow":
        atticRattles(1);
        if (rng() < 0.5) audio.play("laugh", { pitch: 1.2, gain: 0.5 });
        break;
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

function planFor(mode: Mode, scope: Scope): Encounter[] {
  if (mode === "practice") return practicePlan();
  if (mode === "replay") return replayPlan(rng, WORLD, scope);
  return storyPlan(scope);
}

// ------------------------------------------------------------------- API

export const director = {
  onKey,

  setPace(p: number) {
    pace = p;
  },

  /**
   * Start from the title screen (must be called from a click: unlocks audio and asks for the mic once).
   * `scope` picks the full adventure, Chapter 1 or Chapter 2 on its own.
   */
  async startGame(mode: Mode = "story", scope: Scope = "all") {
    audio.unlock();
    tts.setRate(getGame().settings.slowVoice ? 0.8 : 1);
    gen++;
    busy = false;
    awaitingEntry = false;
    outroWalk = false;
    pendingNext = null;
    cutscene = null;
    nextSteam = 0;
    fanHinted = false;
    stopListening?.();
    resetRuntime();
    if (fixedSeed !== null) rng = mulberry32(fixedSeed);
    if (mode === "practice") scope = "ch1";
    const settings = getGame().settings;
    audio.setVolumes(settings.music, settings.sfx);
    setGame({ screen: "game", phase: "busy", mode, scope, fade: 0 });

    let micState = getGame().micState;
    if (!recognition.supported) micState = "unsupported";
    else if (settings.mic && micState !== "ready") {
      const p = await requestMicPermission(8000);
      micState = p === "denied" || p === "unavailable" ? "blocked" : "ready";
    }

    const state = createHunt(planFor(mode, scope));
    const enc0 = currentEncounter(state);
    rt.ghost.id = enc0.ghost;
    if (mode === "practice") placePlayer(PRACTICE_START.x, PRACTICE_START.z, 0, Math.PI);
    else if (scope === "ch2") placePlayer(UPSTAIRS_START.x, UPSTAIRS_START.z, 1, -Math.PI / 2);
    else placePlayer(STORY_START.x, STORY_START.z, 0, Math.PI / 2);
    if (scope === "ch2") {
      // Chapter 1 is done: its rooms and the stairs gate are open; the front door is shut.
      for (const id of ["bedroom", "dining", "storage", "library", "stairs"]) rt.doorsOpen.set(id, rt.time - 5);
      rt.doorSlam.add("entrance");
    }
    // Chapter 2 alone starts at the top of the stairs, looking west down the landing.
    rt.camera.yaw = mode === "practice" ? 0 : scope === "ch2" ? Math.PI / 2 - 0.45 : 0.35;
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
      toast: null,
      chapter: scope === "ch2" ? 2 : 1,
      chapterCard: null,
      startedAt: null,
      finishedAt: null
    });
    if (micState === "blocked" && settings.mic) toast("micBlocked", 6000);
    audio.startRain();
    audio.startMusic(scope === "ch2" ? "upstairs" : "night");
    window.clearInterval(tickTimer);
    tickTimer = window.setInterval(tick, 200);
    touchActivity();
    run(async () => {
      if (mode === "story" && scope !== "ch2" && params.get("intro") !== "0") {
        await intro();
        return;
      }
      if (scope === "ch2") {
        await chapterTwoStart(enc0);
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

  /** Skip the opening cutscene (or the Chapter 2 one). */
  skipIntro() {
    const g = getGame();
    if (g.phase !== "intro" || !g.hunt) return;
    gen++;
    tts.cancel();
    pendingNext = null;
    if (cutscene === "chapter2") {
      placePlayer(STAIRS_FOOT.x, STAIRS_FOOT.z, 0, Math.PI / 2);
      run(async () => {
        await afterChapterTwo();
        await beginEncounter(true);
        enterExplore();
      });
      return;
    }
    const enc0 = currentEncounter(g.hunt);
    placePlayer(STORY_START.x, STORY_START.z, 0, Math.PI / 2);
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
    cutscene = null;
    stopListening?.();
    tts.cancel();
    audio.setListening(false);
    audio.stopMusic();
    audio.stopRain(1);
    window.clearInterval(tickTimer);
    resetRuntime();
    setGame({
      screen: "title",
      phase: "intro",
      hunt: null,
      line: null,
      caption: null,
      clueShown: false,
      settingsOpen: false,
      hint: null,
      toast: null,
      fade: 0,
      lantern: [],
      chapterCard: null
    });
  },

  /** E key / search button. */
  interact() {
    const g = getGame();
    if (g.settingsOpen) return;
    if (g.phase === "explore" && g.focusId) enterSearch(g.focusId);
    else if (g.phase === "search" && g.selectedSpot) run(() => doSearch(g.selectedSpot!));
  },

  /** A searchable object (or the fan switch) was tapped/clicked in 3D. */
  tapObject(objectId: string) {
    if (!canTapMove()) return;
    rt.player.walkTo = null;
    rt.destination.visible = false;
    const obj = WORLD.objectById.get(objectId);
    if (!obj?.interactive) return;
    if (canReach(objectId)) {
      enterSearch(objectId);
      return;
    }
    const c = rectCenter(obj.rect);
    walkTo({ ...c, floor: obj.floor }, objectId);
  },

  /** Only the drawn floor (or the always-visible stair geometry) emits these taps. */
  tapFloor(x: number, z: number, floor: Floor) {
    if (!canTapMove()) return;
    // A tap in an open threshold should carry the student through the opening.
    const door = DOORS.find((d) => d.floor === floor && d.id !== "entrance" && d.id !== "stairs" &&
      Math.abs((d.axis === "x" ? z : x) - d.at) < 0.45 &&
      (d.axis === "x" ? x : z) > d.from && (d.axis === "x" ? x : z) < d.to);
    if (door) {
      director.tapDoor(door.id);
      return;
    }
    walkTo({ x, z, floor });
  },

  tapStairs() {
    if (!canTapMove()) return;
    if (!isOpen("stairs")) {
      rt.player.walkTo = null;
      rt.destination.visible = false;
      lockedFeedback();
      return;
    }
    const up = rt.player.floor === 0;
    walkTo({ x: up ? STAIRS.walk.x1 + 0.6 : STAIRS.walk.x0 - 0.7, z: 0, floor: up ? 1 : 0 });
  },

  tapDoor(id: string) {
    if (!canTapMove()) return;
    rt.player.walkTo = null;
    rt.destination.visible = false;
    if (!isOpen(id)) {
      lockedFeedback();
      return;
    }
    if (id === "stairs") {
      director.tapStairs();
      return;
    }
    const d = DOORS.find((door) => door.id === id);
    if (!d) return;
    const bounds = ROOMS[d.room].bounds;
    const intoRoom = Math.sign((d.axis === "x" ? (bounds.z0 + bounds.z1) / 2 : (bounds.x0 + bounds.x1) / 2) - d.at);
    const side = playerRoom() === d.room ? -intoRoom : intoRoom;
    const mid = (d.from + d.to) / 2;
    walkTo({ x: d.axis === "x" ? mid : d.at + side * 0.9, z: d.axis === "x" ? d.at + side * 0.9 : mid, floor: d.floor });
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
    return { busy, awaitingEntry, outroWalk, cutscene };
  },

  /**
   * Test hook: jump straight to encounter `index` (earlier ghosts already caught, their rooms
   * and - for an upstairs ghost - the stairs gate open), at round `round` of a finale ghost.
   */
  debugJump(index: number, round = 0) {
    const g = getGame();
    if (!g.hunt) return;
    gen++;
    busy = false;
    pendingNext = null;
    cutscene = null;
    awaitingEntry = false;
    const encs = g.hunt.encounters;
    const enc = encs[Math.min(index, encs.length - 1)];
    const captured = encs.slice(0, index).map((e) => e.ghost);
    const path = [enc.start, ...(enc.roundSpots ?? [])];
    const usedPreps = path.slice(0, round).map((id) => WORLD.spotById.get(id)!.prep);
    for (const e of encs.slice(0, index)) {
      const door = ROOM_DOOR[e.room];
      if (door) rt.doorsOpen.set(door, rt.time - 5);
    }
    const upstairs = ROOMS[enc.room].floor === 1;
    if (upstairs) rt.doorsOpen.set("stairs", rt.time - 5);
    setGame({
      hunt: {
        ...g.hunt,
        index,
        round,
        usedPreps,
        spotId: path[Math.min(round, path.length - 1)],
        status: "hunting",
        captured,
        clueId: g.hunt.clueId + 1,
        wrongSearchesThisClue: 0,
        relocationsThisRound: 0,
        searchedThisClue: [],
        answerMisses: 0
      },
      lantern: captured,
      chapter: upstairs ? 2 : 1,
      line: null,
      fade: 0
    });
    run(async () => {
      enterExplore();
      setGame({ phase: "busy" });
      await beginEncounter(true);
      enterExplore();
    });
  },

  /** Test hook: catch every ghost at once and play the ending. */
  debugFinish() {
    const g = getGame();
    if (!g.hunt) return;
    const captured = g.hunt.encounters.map((e) => e.ghost);
    setGame({ hunt: { ...g.hunt, status: "done", index: g.hunt.encounters.length, captured }, lantern: captured, finishedAt: performance.now() });
    run(async () => (isStory() ? outro() : finishGame()));
  }
};

tts.onSpeakingChange((on) => audio.setSpeaking(on));
