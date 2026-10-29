import * as THREE from "three";
import { director } from "./director";
import { getGame, setGame } from "./store";
import { rattle, rt } from "./runtime";
import { currentSpot } from "./logic/hunt";
import { clueText } from "./logic/clues";
import { WORLD } from "./world/world";
import { rectCenter, rotateXZ } from "./world/geometry";
import { collidersFor, floorState, resolveCollisions } from "./world/collision";
import { FLOOR_Y, roomAt } from "./world/rooms";
import type { Floor } from "./types";
import { cameraRef } from "../scene/CameraRig";
import { hsCam } from "../scene/HideSeekCamera";
import { rendererRef } from "../scene/GameScene";
import { audio } from "../audio/audio";
import { beaconSpot } from "./beacon";
import { command as hsCommand, hideSeekSnapshot, pickSpot, setHideSeekTimeScale, startHideSeek } from "./hideSeek/session";
import type { GhostId } from "./types";
import type { EnglishLevel, PlayRoom } from "./hideSeek/types";

/** Put the player at (x, z) on a floor, collision-resolved for wherever that is (the stairs included). */
function place(x: number, z: number, floor: Floor) {
  const st = floorState(x, z, floor);
  const p = resolveCollisions(x, z, (id) => rt.doorsOpen.has(id), collidersFor(st.floor, st.stairs));
  const fs = floorState(p.x, p.z, st.floor);
  rt.player.x = p.x;
  rt.player.z = p.z;
  rt.player.floor = fs.floor;
  rt.player.y = fs.y;
  rt.player.stairs = fs.stairs;
  rt.player.vx = 0;
  rt.player.vz = 0;
  rt.view.floor = fs.floor;
  return { ...p, floor: fs.floor };
}

/**
 * Test hook (only with ?e2e=1): read game state and put the player next to
 * an object, so Playwright drives the real UI (keys, clicks) without having
 * to steer around furniture.
 */
export function installE2eHook() {
  type MoveFrame = { x: number; z: number; y: number; floor: Floor; stairs: boolean; phase: string };
  let frames: MoveFrame[] = [];
  let traceFrame: number | null = null;
  const recordFrame = () => {
    const p = rt.player;
    frames.push({ x: p.x, z: p.z, y: p.y, floor: p.floor, stairs: p.stairs, phase: getGame().phase });
    traceFrame = requestAnimationFrame(recordFrame);
  };
  const api = {
    hs: hideSeekSnapshot,
    hsCommand(name: string, ...args: unknown[]) {
      if (name === "start") return startHideSeek(args[0] as GhostId, args[1] as PlayRoom, args[2] as number | undefined, args[3] as EnglishLevel | undefined);
      if (name === "pickSpot") return pickSpot(String(args[0]));
      return hsCommand(name, ...args);
    },
    hsTimeScale: setHideSeekTimeScale,
    /** Hide & Seek presentation: camera mode, settled flag, live pose, look offsets and the heartbeat scheduler. */
    hsCamera() {
      const c = rt.camera;
      return {
        mode: hsCam.mode, spotId: hsCam.spotId, settled: hsCam.settled, lookYaw: hsCam.lookYaw, lookPitch: hsCam.lookPitch,
        pos: { ...c.pos }, target: { ...c.target }, fov: cameraRef.current?.fov ?? 0, near: cameraRef.current?.near ?? 0,
        heartbeat: audio.heartbeatRunning
      };
    },
    /** Show the first-person view from any hiding place (null = back to the real one). Visual checks only. */
    hsPreview(spotId: string | null) {
      hsCam.preview = spotId;
    },
    state() {
      const g = getGame();
      const s = g.hunt;
      const spot = s && s.status !== "done" ? currentSpot(s) : null;
      return {
        screen: g.screen,
        phase: g.phase,
        mode: g.mode,
        micState: g.micState,
        clue: spot ? { spotId: spot.id, objectId: spot.objectId, prep: spot.prep, noun: spot.noun, text: clueText(spot) } : null,
        clueShown: g.clueShown,
        status: s?.status ?? null,
        round: s?.round ?? 0,
        index: s?.index ?? 0,
        stats: s?.stats ?? null,
        captured: s?.captured ?? [],
        answer: g.answer,
        focusId: g.focusId,
        searchId: g.searchId,
        selectedSpot: g.selectedSpot,
        helpLevel: g.helpLevel,
        player: {
          x: rt.player.x, z: rt.player.z, y: rt.player.y, yaw: rt.player.yaw, floor: rt.player.floor,
          stairs: rt.player.stairs, startle: Boolean(rt.player.startle), opacity: rt.player.opacity,
          frozen: rt.player.frozen,
          autoEntry: Boolean(rt.player.walkTo?.auto),
          stepping: Boolean(rt.player.stepTo),
          speed: rt.player.speed,
          pathLength: rt.player.walkTo?.path.length ?? 0,
          pathIndex: rt.player.walkTo?.index ?? 0,
          destination: rt.player.walkTo ? { x: rt.player.walkTo.x, z: rt.player.walkTo.z, floor: rt.player.walkTo.floor, objectId: rt.player.walkTo.objectId } : null
        },
        settingsOpen: g.settingsOpen,
        cameraYaw: rt.camera.yaw,
        viewFloor: rt.view.floor,
        scope: g.scope,
        chapter: g.chapter,
        chapterCard: g.chapterCard?.title ?? null,
        ch2Unlocked: g.ch2Unlocked,
        hideSeekUnlocked: g.hideSeekUnlocked,
        hideSeekLink: g.hideSeekLink,
        englishLevel: g.settings.englishLevel,
        steam: rt.steam.level,
        fanOn: rt.time < rt.steam.fanUntil,
        blackout: rt.time - rt.blackoutT0 < 2.2,
        rattles: rt.rattles.filter((r) => rt.time - r.t0 < r.dur).map((r) => r.objectId),
        startedAt: g.startedAt,
        finishedAt: g.finishedAt,
        ghostAnim: rt.ghost.anim.mode,
        ghost: rt.ghost.id,
        lantern: g.lantern,
        line: g.line ? { en: g.line.en, wait: Boolean(g.line.wait) } : null,
        hint: g.hint,
        toast: g.toast?.id ?? null,
        lastToast: g.lastToast,
        beaconDoor: rt.beaconDoor,
        exitActive: rt.exit.active,
        beaconStarts: rt.beaconEntry.starts,
        roomIntroductions: rt.beaconEntry.introductions,
        doorsOpen: [...rt.doorsOpen.keys()],
        sunrise: rt.sunriseT0 >= 0,
        sunriseT0: rt.sunriseT0,
        time: rt.time,
        replayUnlocked: g.replayUnlocked,
        ...director.debug()
      };
    },
    /** The Guest Wing in this playthrough: unlock, the 206 key, clues read, the clue card, the doors open. */
    wing() {
      const g = getGame();
      return {
        unlocked: g.guestWingUnlocked, key: rt.wing.key, read: [...rt.wing.read], solved: rt.wing.solved,
        mysterySolved: g.wingMysterySolved, note: g.wingNote, room: roomAt(rt.player.x, rt.player.z, rt.player.floor),
        doorsOpen: [...rt.doorsOpen.keys()].filter((id) => id === "guestwing" || id.startsWith("g2"))
      };
    },
    /** Test setup only: as if Chapter 2 had been finished on this device (not saved). */
    unlockWing(on = true) {
      setGame({ guestWingUnlocked: on });
    },
    /** Test setup only; movement still runs through the normal controller. */
    beaconSetup(id: string, open = true) {
      rt.beaconDoor = id;
      rt.beaconEntry.door = null;
      rt.beaconEntry.spent = false;
      if (open) rt.doorsOpen.set(id, rt.time);
      else rt.doorsOpen.delete(id);
      return beaconSpot(id);
    },
    joy(x: number, y: number) {
      rt.joy.x = x;
      rt.joy.y = y;
      rt.joy.active = x !== 0 || y !== 0;
    },
    /** Put the player somewhere (collision-resolved), on a floor (default: the one they are on), optionally facing `yaw`. */
    teleport(x: number, z: number, floor?: number, yaw?: number) {
      const f = (floor === 1 ? 1 : floor === 0 ? 0 : rt.player.floor) as Floor;
      if (yaw !== undefined) rt.player.yaw = yaw;
      return place(x, z, f);
    },
    /** Stand in front of an object, facing it (on its floor). */
    goTo(objectId: string) {
      const obj = WORLD.objectById.get(objectId);
      if (!obj) throw new Error(`no object ${objectId}`);
      const c = rectCenter(obj.rect);
      const front = rotateXZ(0, 1, obj.rot);
      const half = obj.spec.wallMounted ? obj.spec.d : Math.abs(front.x) > 0.5 ? (obj.rect.x1 - obj.rect.x0) / 2 : (obj.rect.z1 - obj.rect.z0) / 2;
      const p = place(c.x + front.x * (half + 0.55), c.z + front.z * (half + 0.55), obj.floor);
      rt.player.yaw = Math.atan2(c.x - p.x, c.z - p.z);
      return p;
    },
    /** Floor heights, for tests that check the player really went up the stairs. */
    floorY() {
      return FLOOR_Y;
    },
    /** Project a world point to real canvas pixels; tests still send ordinary pointer events. */
    project(x: number, y: number, z: number) {
      const cam = cameraRef.current;
      const canvas = document.querySelector("canvas");
      if (!cam || !canvas) return null;
      const v = new THREE.Vector3(x, y, z).project(cam);
      const r = canvas.getBoundingClientRect();
      return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
    },
    /** Geometry only: useful for clicking furniture and checking paths against its footprint. */
    objectInfo(objectId: string) {
      const obj = WORLD.objectById.get(objectId);
      if (!obj) throw new Error(`no object ${objectId}`);
      const c = rectCenter(obj.rect);
      return { ...c, y: obj.y + (obj.spec.on?.y ?? obj.spec.h * 0.65), floor: obj.floor, rect: { ...obj.rect } };
    },
    /** Capture every animation frame, including slow software-rendered frames, without Node polling gaps. */
    startTrace() {
      if (traceFrame !== null) cancelAnimationFrame(traceFrame);
      frames = [];
      recordFrame();
    },
    stopTrace() {
      if (traceFrame !== null) cancelAnimationFrame(traceFrame);
      traceFrame = null;
      return frames;
    },
    /** Screen position (CSS px) of a search marker or any world point. */
    screenOf(spotId: string) {
      const spot = WORLD.spotById.get(spotId);
      const cam = cameraRef.current;
      if (!spot || !cam) return null;
      const v = new THREE.Vector3(spot.marker.x, spot.marker.y, spot.marker.z).project(cam);
      const canvas = document.querySelector("canvas")!;
      const r = canvas.getBoundingClientRect();
      return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
    },
    spotsOf(objectId: string) {
      return WORLD.spots.filter((s) => s.objectId === objectId).map((s) => ({ id: s.id, prep: s.prep }));
    },
    allSpots() {
      return WORLD.spots.map((s) => ({ id: s.id, prep: s.prep, objectId: s.objectId, room: s.room }));
    },
    setMic(on: boolean) {
      director.updateSettings({ mic: on });
    },
    finish() {
      director.debugFinish();
    },
    /** Jump to encounter `index` (0-based), at round `round` of a finale ghost. */
    jump(index: number, round = 0) {
      director.debugJump(index, round);
    },
    /** Turn the follow camera. */
    setYaw(yaw: number, pitch?: number) {
      rt.camera.yaw = yaw;
      rt.camera.yawTarget = null;
      if (pitch !== undefined) rt.camera.pitch = pitch;
    },
    /** Visual checks: fill the bathroom with steam (or clear it). */
    steam(level: number) {
      rt.steam.target = level;
      rt.steam.level = level;
      rt.steam.silhouetteT0 = rt.time;
    },
    /** Exercise the reachable fan switch while keeping forced maximum steam within one frame. */
    fanSwitchTest() {
      rt.steam.target = 1;
      rt.steam.level = 1;
      const before = { steam: rt.steam.level, fanOn: rt.time < rt.steam.fanUntil };
      const play = audio.play;
      audio.play = () => {};
      try {
        director.tapObject("bathroom.switch");
      } finally {
        audio.play = play;
      }
      rt.steam.level = rt.steam.target;
      const after = { steam: rt.steam.level, fanOn: rt.time < rt.steam.fanUntil };
      rt.steam.fanUntil = -100;
      return { before, after };
    },
    /** Visual checks: make an object wobble. */
    wobble(objectId: string) {
      rattle(objectId, 2, 1);
    },
    /** Renderer workload for the last frame. */
    stats() {
      const gl = rendererRef.current;
      if (!gl) return null;
      return {
        calls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        lines: gl.info.render.lines,
        points: gl.info.render.points,
        geometries: gl.info.memory.geometries,
        textures: gl.info.memory.textures,
        programs: gl.info.programs?.length ?? 0,
        pixelRatio: gl.getPixelRatio()
      };
    },
    select(spotId: string) {
      setGame({ selectedSpot: spotId });
    },
    setPace(p: number) {
      director.setPace(p);
    },
    /** Test only: move the hidden ghost to a spot (keeps the round counter at 0 so the game never ends). */
    debugSetSpot(spotId: string) {
      const g = getGame();
      if (!g.hunt || !WORLD.spotById.has(spotId)) throw new Error(`bad spot ${spotId}`);
      setGame({ hunt: { ...g.hunt, spotId, round: 0, usedPreps: [], status: "hunting" } });
    },
    camera() {
      return { ...rt.camera.pos, mode: rt.camera.mode };
    },
    /** Visual checks: hold the camera on a fixed shot (null = back to following the player). */
    look(pos: { x: number; y: number; z: number } | null, target?: { x: number; y: number; z: number }, keepPlayer?: boolean) {
      rt.camera.mode = pos && target ? "shot" : "follow";
      rt.camera.shot = pos && target ? { pos, target, keepPlayer } : null;
      rt.camera.snap = true;
    },
    /** Visual checks: slow down (or speed up) game time, to film a quick animation. */
    timeScale(s: number) {
      rt.timeScale = s;
    }
  };
  (window as unknown as { __hh: typeof api }).__hh = api;
}
