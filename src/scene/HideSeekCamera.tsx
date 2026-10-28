import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { getHideSeek, hsPresentation } from "../game/hideSeek/session";
import { cameraMode, hidingViewFor, type HsCameraMode } from "../game/hideSeek/views";
import { getGame } from "../game/store";
import { rt } from "../game/runtime";
import { FLOOR_Y, ROOMS } from "../game/world/rooms";
import { WORLD } from "../game/world/world";
import { cameraRef } from "./CameraRig";

/** Live presentation state, read by the furniture, ghost, sound and test hooks (never by the simulation). */
export const hsCam = {
  mode: "overview" as HsCameraMode,
  /** The hiding place the first-person view belongs to. */
  spotId: null as string | null,
  /** False while the view is still travelling or held for a short shot. */
  settled: true,
  /** Smoothed look offsets from the spot's resting direction (radians). */
  lookYaw: 0,
  lookPitch: 0,
  /** Dev/e2e only: show the first-person view from any spot in the room. */
  preview: null as string | null
};

const BLEND_S = 0.7;
const START_HOLD_MS = 900;
const ABILITY_HOLD_MS = 1600;
const OVERVIEW_FOV = 50;

interface Pose { pos: THREE.Vector3; look: THREE.Vector3; fov: number; near: number }
const newPose = (): Pose => ({ pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: OVERVIEW_FOV, near: 0.1 });
const copyPose = (a: Pose, b: Pose) => { a.pos.copy(b.pos); a.look.copy(b.look); a.fov = b.fov; a.near = b.near; };

/** Same picture means no travel: these modes share the overhead room view. */
function shotKey(mode: HsCameraMode, spotId: string | null) {
  if (mode === "overview" || mode === "reveal" || mode === "destinationSelection") return "overhead";
  if (mode === "firstPerson") return `fp:${spotId}`;
  return mode;
}

const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const ease = (t: number) => t * t * (3 - 2 * t);

export function HideSeekCamera() {
  const { camera, size, scene, gl } = useThree();
  const s = useMemo(() => ({
    cur: newPose(), from: newPose(), target: newPose(), ready: false,
    key: "", blendStart: 0, holdUntil: 0, lastStatus: "", lastFx: null as unknown,
    travel: new THREE.Vector3(0, 0, 1), wantYaw: 0, wantPitch: 0,
    drag: null as { id: number; x: number; y: number } | null, keys: new Set<string>(),
    offX: 0, offY: 0
  }), []);
  const tmp = useMemo(() => ({ v: new THREE.Vector3(), w: new THREE.Vector3() }), []);
  useEffect(() => { gl.setClearColor("#130d20"); scene.fog = null; return () => { scene.fog = new THREE.Fog("#120a22", 13, 30); }; }, [scene, gl]);

  // Look around while hiding: drag (mouse or touch) or the arrow keys. No pointer lock.
  useEffect(() => {
    const el = gl.domElement;
    const looking = () => hsCam.mode === "firstPerson" && getHideSeek().match?.status === "playing";
    const down = (e: PointerEvent) => { if (looking()) s.drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; };
    const move = (e: PointerEvent) => {
      if (!s.drag || s.drag.id !== e.pointerId || !looking()) return;
      const k = 0.0045 * getGame().settings.cameraSensitivity;
      s.wantYaw += (e.clientX - s.drag.x) * k;
      s.wantPitch += (e.clientY - s.drag.y) * k;
      s.drag.x = e.clientX; s.drag.y = e.clientY;
    };
    const up = (e: PointerEvent) => { if (s.drag?.id === e.pointerId) s.drag = null; };
    const typing = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      return Boolean(t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable));
    };
    const keyDown = (e: KeyboardEvent) => {
      if (typing(e) || !e.code.startsWith("Arrow") || !looking()) return;
      s.keys.add(e.code);
      e.preventDefault();
    };
    const keyUp = (e: KeyboardEvent) => s.keys.delete(e.code);
    const blur = () => { s.keys.clear(); s.drag = null; };
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    window.addEventListener("blur", blur);
    return () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("blur", blur);
    };
  }, [gl, s]);

  useFrame((_, rawDt) => {
    const session = getHideSeek();
    const m = session.match;
    if (!m) return;
    const dt = Math.min(rawDt, 0.1);
    const now = performance.now();
    const settings = getGame().settings;
    const room = ROOMS[m.config.room];
    rt.view.floor = room.floor;
    const b = room.bounds;
    const base = FLOOR_Y[room.floor];

    // Short holds in the room view: the first hide, and an ability going off while hidden.
    if (s.lastStatus === "setup" && m.status === "playing") s.holdUntil = now + START_HOLD_MS;
    s.lastStatus = m.status;
    if (session.fx !== s.lastFx) {
      if (session.fx && !m.ghost.transit && m.status === "playing" && !session.pickMode) s.holdUntil = Math.max(s.holdUntil, now + ABILITY_HOLD_MS);
      s.lastFx = session.fx;
    }
    let mode = cameraMode({
      enabled: settings.firstPerson, status: m.status, english: Boolean(m.english), pickMode: session.pickMode,
      decisionPhase: session.decision?.phase ?? null, transit: m.ghost.transit, holding: now < s.holdUntil,
      sinceEnd: session.endedAt === null ? 0 : (now - session.endedAt) / 1000, lossReason: session.lossReason
    });
    let spotId = m.ghost.spotId;
    if (hsCam.preview && WORLD.spotById.has(hsCam.preview)) { mode = "firstPerson"; spotId = hsCam.preview; }
    if (spotId !== hsCam.spotId) { s.wantYaw = 0; s.wantPitch = 0; hsCam.lookYaw = 0; hsCam.lookPitch = 0; }
    hsCam.mode = mode;
    hsCam.spotId = spotId;

    // ---- the wanted pose for this mode
    const t = s.target;
    const overhead = shotKey(mode, spotId) === "overhead";
    // The left dock (English, spot list) is open only in the room view; every other shot uses the full width.
    const dock = overhead && (m.english || session.pickMode) ? (size.height < 480 ? 250 : 300) : 0;
    let coveredBottom = 0;
    let coveredTop = 0;
    const view = mode === "firstPerson" && spotId ? hidingViewFor(spotId) : null;
    if (view) {
      // Look limits are per spot; the view stays anchored to the hiding place.
      const turn = 1.4 * dt;
      if (s.keys.has("ArrowLeft")) s.wantYaw += turn;
      if (s.keys.has("ArrowRight")) s.wantYaw -= turn;
      if (s.keys.has("ArrowUp")) s.wantPitch += turn * 0.6;
      if (s.keys.has("ArrowDown")) s.wantPitch -= turn * 0.6;
      s.wantYaw = THREE.MathUtils.clamp(s.wantYaw, -view.yawLimit, view.yawLimit);
      s.wantPitch = THREE.MathUtils.clamp(s.wantPitch, view.pitchMin - view.pitch, view.pitchMax - view.pitch);
      const k = 1 - Math.exp(-dt * 14);
      hsCam.lookYaw += (s.wantYaw - hsCam.lookYaw) * k;
      hsCam.lookPitch += (s.wantPitch - hsCam.lookPitch) * k;
      const yaw = view.yaw + hsCam.lookYaw;
      const pitch = view.pitch + hsCam.lookPitch;
      t.pos.set(view.eye.x, view.eye.y, view.eye.z);
      t.look.set(view.eye.x + Math.sin(yaw) * Math.cos(pitch), view.eye.y + Math.sin(pitch), view.eye.z + Math.cos(yaw) * Math.cos(pitch));
      t.fov = view.fov;
      t.near = view.near;
    } else if (mode === "relocating") {
      // Third person: behind and above the floating ghost, looking along its route.
      const g = m.ghost;
      const next = g.path[0];
      if (next) {
        tmp.v.set(next.x - g.x, 0, next.z - g.z);
        if (tmp.v.lengthSq() > 1e-6) s.travel.lerp(tmp.v.normalize(), 1 - Math.exp(-dt * 3)).normalize();
      }
      t.pos.set(g.x - s.travel.x * 2, base + 1.5, g.z - s.travel.z * 2);
      t.look.set(g.x + s.travel.x * 0.9, g.y + 0.35, g.z + s.travel.z * 0.9);
      t.fov = 58;
      t.near = 0.1;
    } else if (mode === "discovered" || mode === "victory") {
      // A short shot of the ghost: popped out where it was found, or celebrating where it hid.
      const spot = m.ghost.spotId ? WORLD.spotById.get(m.ghost.spotId) : null;
      const at = !m.ghost.transit && spot ? spot.pos : m.ghost;
      const toward = mode === "discovered" ? m.detective : { x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2 };
      const want = Math.atan2(toward.x - at.x, toward.z - at.z) + (mode === "discovered" ? 0.7 : 0);
      const camY = Math.max(at.y + 0.9, base + 1.2);
      // Of eight places around the ghost: inside the room, out of the furniture, not at the
      // detective's shoulder, and as close as possible to the wanted angle.
      let best = { score: -Infinity, x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2 };
      for (let i = 0; i < 8; i++) {
        const a = want + (i * Math.PI) / 4;
        const x = at.x + Math.sin(a) * 1.9, z = at.z + Math.cos(a) * 1.9;
        if (x < b.x0 + 0.45 || x > b.x1 - 0.45 || z < b.z0 + 0.45 || z > b.z1 - 0.45) continue;
        if (WORLD.objects.some((o) => o.room === m.config.room && o.spec.solid && o.y + o.spec.h > camY - 0.3 &&
          x > o.rect.x0 - 0.2 && x < o.rect.x1 + 0.2 && z > o.rect.z0 - 0.2 && z < o.rect.z1 + 0.2)) continue;
        const off = Math.abs(Math.atan2(Math.sin(a - want), Math.cos(a - want)));
        const score = -off - (Math.hypot(x - m.detective.x, z - m.detective.z) < 1.1 ? 3 : 0);
        if (score > best.score) best = { score, x, z };
      }
      t.pos.set(best.x, camY, best.z);
      // Frame the ghost, leaning a little toward the detective when it found us.
      const lean = mode === "discovered" ? 0.25 : 0;
      t.look.set(at.x + (m.detective.x - at.x) * lean, at.y + 0.45, at.z + (m.detective.z - at.z) * lean);
      t.fov = 55;
      t.near = 0.1;
    } else {
      const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
      const availableW = Math.max(200, size.width - dock - 24);
      const panel = dock ? document.querySelector('[data-testid="hs-english"]') : null;
      const panelRect = panel?.getBoundingClientRect();
      coveredBottom = panelRect && panelRect.left >= dock - 20 ? Math.max(0, size.height - panelRect.top) : 0;
      // The ten-second destination card sits at the top: frame the room (and its markers) below it.
      const card = session.decision?.phase === "destination" ? document.querySelector(".hs-decision-overlay.picking .hs-decision-card") : null;
      coveredTop = card ? Math.max(0, card.getBoundingClientRect().bottom - (size.height < 480 ? 50 : 60)) : 0;
      // The top bar is short now; keep a little headroom for it and the toast under it.
      const availableH = Math.max(200, size.height - coveredBottom - coveredTop - (size.height < 480 ? 64 : 76));
      const margin = coveredTop ? 1.25 : 1.5;
      const span = Math.max((b.x1 - b.x0) * margin * size.height / availableW, (b.z1 - b.z0) * margin * size.height / availableH);
      const distance = Math.max(12.2, span / (2 * Math.tan(25 * Math.PI / 180)));
      t.look.set(cx, base + 0.4, cz);
      t.pos.set(0.43, 0.93, 0.83).normalize().multiplyScalar(distance).add(t.look);
      t.fov = OVERVIEW_FOV;
      t.near = 0.1;
    }
    if (!overhead && !view) {
      // Third-person shots stay inside the room, clear of the walls.
      t.pos.x = THREE.MathUtils.clamp(t.pos.x, b.x0 + 0.4, b.x1 - 0.4);
      t.pos.z = THREE.MathUtils.clamp(t.pos.z, b.z0 + 0.4, b.z1 - 0.4);
    }

    // ---- travel between pictures: one timed, eased move; countdowns wait for it
    const key = shotKey(mode, spotId);
    if (!s.ready) {
      copyPose(s.cur, t);
      s.cur.pos.add(tmp.w.set(0, 1.2, 1.2));
      s.key = key;
      s.ready = true;
    } else if (key !== s.key) {
      copyPose(s.from, s.cur);
      s.blendStart = now;
      s.key = key;
    }
    const duration = reducedMotion() ? 0 : BLEND_S * 1000;
    const blend = duration ? Math.min(1, (now - s.blendStart) / duration) : 1;
    if (blend < 1) {
      const e = ease(blend);
      s.cur.pos.lerpVectors(s.from.pos, t.pos, e);
      s.cur.look.lerpVectors(s.from.look, t.look, e);
      s.cur.fov = THREE.MathUtils.lerp(s.from.fov, t.fov, e);
      // Near plane: the small value as soon as we head into a tight spot, so nothing clips on arrival.
      s.cur.near = Math.min(s.from.near, t.near);
    } else if (view) {
      copyPose(s.cur, t);
    } else {
      const k = 1 - Math.exp(-dt * (mode === "relocating" ? 6 : 5));
      s.cur.pos.lerp(t.pos, k);
      s.cur.look.lerp(t.look, k);
      s.cur.fov = t.fov;
      s.cur.near = t.near;
    }
    hsCam.settled = blend >= 1 && now >= s.holdUntil;
    hsPresentation.cameraSettling = !hsCam.settled && settings.firstPerson;

    const cam = camera as THREE.PerspectiveCamera;
    cam.position.copy(s.cur.pos);
    cam.lookAt(s.cur.look);
    if (Math.abs(cam.fov - s.cur.fov) > 0.01 || Math.abs(cam.near - s.cur.near) > 1e-4) {
      cam.fov = s.cur.fov;
      cam.near = s.cur.near;
      cam.updateProjectionMatrix();
    }
    // Room views sit in the clear area beside the dock and under the top bar; first-person and
    // third-person shots stay centred. The offset is eased so opening the dock slides, not jumps.
    const want = { x: -dock / 2, y: (coveredBottom - coveredTop) / 2 - (overhead ? (size.height < 480 ? 14 : 18) : 0) };
    const k = s.ready && duration ? 1 - Math.exp(-dt * 8) : 1;
    s.offX += (want.x - s.offX) * k;
    s.offY += (want.y - s.offY) * k;
    if (Math.abs(s.offX - want.x) < 0.5) s.offX = want.x;
    if (Math.abs(s.offY - want.y) < 0.5) s.offY = want.y;
    cam.setViewOffset(size.width, size.height, s.offX, s.offY, size.width, size.height);
    cameraRef.current = cam;
    Object.assign(rt.camera.pos, s.cur.pos);
    Object.assign(rt.camera.target, s.cur.look);
    rt.camera.mode = "shot";
  }, -5);

  useEffect(() => () => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.clearViewOffset();
    cam.fov = OVERVIEW_FOV;
    cam.near = 0.1;
    cam.updateProjectionMatrix();
    hsCam.mode = "overview";
    hsCam.spotId = null;
    hsCam.settled = true;
    hsPresentation.cameraSettling = false;
  }, [camera]);
  return null;
}
