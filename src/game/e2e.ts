import * as THREE from "three";
import { director } from "./director";
import { getGame, setGame } from "./store";
import { rt } from "./runtime";
import { currentSpot } from "./logic/hunt";
import { clueText } from "./logic/clues";
import { WORLD } from "./world/world";
import { rectCenter, rotateXZ } from "./world/geometry";
import { resolveCollisions } from "./world/collision";
import { cameraRef } from "../scene/CameraRig";

/**
 * Test hook (only with ?e2e=1): read game state and put the player next to
 * an object, so Playwright drives the real UI (keys, clicks) without having
 * to steer around furniture.
 */
export function installE2eHook() {
  const api = {
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
        player: { x: rt.player.x, z: rt.player.z },
        ghostAnim: rt.ghost.anim.mode
      };
    },
    /** Stand in front of an object, facing it. */
    goTo(objectId: string) {
      const obj = WORLD.objectById.get(objectId);
      if (!obj) throw new Error(`no object ${objectId}`);
      const c = rectCenter(obj.rect);
      const front = rotateXZ(0, 1, obj.rot);
      const half = obj.spec.wallMounted ? obj.spec.d : Math.abs(front.x) > 0.5 ? (obj.rect.x1 - obj.rect.x0) / 2 : (obj.rect.z1 - obj.rect.z0) / 2;
      const p = resolveCollisions(c.x + front.x * (half + 0.55), c.z + front.z * (half + 0.55), (id) => rt.doorsOpen.has(id));
      rt.player.x = p.x;
      rt.player.z = p.z;
      rt.player.vx = 0;
      rt.player.vz = 0;
      rt.player.yaw = Math.atan2(c.x - p.x, c.z - p.z);
      return p;
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
    }
  };
  (window as unknown as { __hh: typeof api }).__hh = api;
}
