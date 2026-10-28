import { FLOOR_Y, ROOMS } from "../world/rooms";
import { WORLD, type HidingSpot } from "../world/world";
import { chooseTarget, decaySuspicion, investigateClue } from "./detective";
import { accept, announceLine, emptyLine, foundLine } from "./english";
import { addClue, detectiveView } from "./evidence";
import { ghostRoute, pathBetween, pathLength, roomLayout } from "./navigation";
import { blurredClue, initialPerceptionTimers, perceive } from "./perception";
import { random } from "./random";
import type { CommandResult, MatchConfig, MatchEvent, MatchState, Point } from "./types";

export { abilityTargets, useAbility } from "./abilities";
const TICK = 0.05;
const ok: CommandResult = { ok: true };
const fail = (reason: string): CommandResult => ({ ok: false, reason });

export function createMatch(config: MatchConfig): MatchState {
  if (!Number.isFinite(config.seed)) throw new Error("Seed must be finite");
  if (!(["beginner", "standard", "advanced"] as const).includes(config.level)) throw new Error("Invalid English level");
  const layout = roomLayout(config.room);
  if (layout.spots.length < 5 || !layout.starts.length) throw new Error("Room cannot support a match");
  const cursor = { rng: config.seed >>> 0 };
  const start = layout.starts[Math.floor(random(cursor) * layout.starts.length)];
  const priorities = Object.fromEntries(layout.spots.map((s) => [s.id, 0.65 + random(cursor) * 0.7]));
  return {
    config: { ...config }, status: "setup", time: 0, remainder: 0, rng: cursor.rng,
    clueId: 0, detective: {
      ...start, yaw: random(cursor) * Math.PI * 2, anim: "think", phase: "observe", elapsed: 0,
      target: null, path: [], searched: {}, priorities, suspicion: 0, clues: [],
      lastEvidence: -100, focusClue: 0, handledClue: 0, rng: (config.seed ^ 0x9e3779b9) >>> 0
    },
    ghost: {
      x: start.x, y: FLOOR_Y[ROOMS[config.room].floor] + 0.1, z: start.z,
      spotId: null, destination: null, transit: false, hidden: false, path: [],
      speed: 1.15, silent: false, invisible: false, loudness: 1
    },
    english: null, pendingMove: null, searchesLeft: 5, relocationsLeft: 2, movedThisSearch: false,
    abilityUsed: false, effects: { sleepySearch: null, nextMove: null, decoy: null, bubbles: [], music: null },
    perception: initialPerceptionTimers(), seenAt: -100,
    stats: {
      completedSearches: 0, relocations: 0, questions: 0, acceptedAnswers: 0,
      firstTryAnswers: 0, wrongAnswers: 0, firstTryAccuracy: 0, clues: 0, elapsed: 0
    }, events: []
  };
}

function spotInMatch(s: MatchState, spotId: string): HidingSpot | undefined {
  return roomLayout(s.config.room).spots.find((spot) => spot.id === spotId);
}

export function chooseStart(s: MatchState, spotId: string): CommandResult {
  if (s.status !== "setup" || s.english) return fail("start-already-chosen");
  if (!spotInMatch(s, spotId)) return fail("invalid-spot");
  s.english = { spotId, starting: true, attempts: 0 };
  return ok;
}

function moveBlock(s: MatchState): string | null {
  if (s.status !== "playing") return "not-playing";
  if (s.ghost.transit) return "already-moving";
  if (!s.relocationsLeft) return "no-relocations";
  if (s.movedThisSearch) return "one-move-per-search";
  if (s.detective.phase === "search" && s.detective.target === s.ghost.spotId) return "inspection-locked";
  return null;
}

export function reachableSpots(s: MatchState): HidingSpot[] {
  if (s.status === "setup") return s.english ? [] : roomLayout(s.config.room).spots.slice();
  if (moveBlock(s) || s.english || !s.ghost.spotId) return [];
  const layout = roomLayout(s.config.room);
  return layout.spots.filter((spot) => {
    if (spot.id === s.ghost.spotId) return false;
    const route = ghostRoute(s.config.room, s.ghost.spotId!, spot.id);
    return route && (s.effects.nextMove === "bounce" || pathLength(s.ghost, route) <= layout.reach);
  });
}

export function requestMove(s: MatchState, spotId: string): CommandResult {
  const blocked = moveBlock(s);
  if (blocked) return fail(blocked);
  if (s.english) return fail("english-open");
  if (!reachableSpots(s).some((spot) => spot.id === spotId)) return fail("unreachable-spot");
  s.pendingMove = spotId;
  return ok;
}

export function beginEnglish(s: MatchState): CommandResult {
  const blocked = moveBlock(s);
  if (blocked) return fail(blocked);
  if (s.english) return fail("english-open");
  if (!s.pendingMove) return fail("no-pending-move");
  if (!reachableSpots(s).some((spot) => spot.id === s.pendingMove)) return fail("unreachable-spot");
  s.english = { spotId: s.pendingMove, starting: false, attempts: 0 };
  return ok;
}

export function cancelMove(s: MatchState): CommandResult {
  if (s.status !== "setup" && s.status !== "playing") return fail("match-finished");
  s.english = null;
  s.pendingMove = null;
  return ok;
}

export function answerEnglish(s: MatchState, spokenAlternatives: readonly string[]): CommandResult {
  const panel = s.english;
  if (!panel) return fail("no-english-panel");
  const spot = spotInMatch(s, panel.spotId)!;
  panel.attempts++;
  if (!accept(spokenAlternatives, spot)) {
    s.stats.wrongAnswers++;
    return fail("answer-not-accepted");
  }
  // No strategic cost is paid until an accepted answer starts the relocation.
  s.stats.questions++;
  s.stats.acceptedAnswers++;
  if (panel.attempts === 1) s.stats.firstTryAnswers++;
  s.stats.firstTryAccuracy = s.stats.firstTryAnswers / s.stats.acceptedAnswers;
  if (panel.starting) {
    Object.assign(s.ghost, spot.hidePos, { spotId: spot.id, hidden: true });
    s.status = "playing";
  } else {
    const route = ghostRoute(s.config.room, s.ghost.spotId!, spot.id)!;
    const modifier = s.effects.nextMove;
    Object.assign(s.ghost, {
      destination: spot.id, transit: true, hidden: false, path: route,
      speed: modifier === "bounce" ? 2.3 : 1.15,
      silent: modifier === "silent", invisible: modifier === "invisible",
      loudness: modifier === "bounce" ? 1.6 : 1
    });
    s.effects.nextMove = null;
    s.relocationsLeft--;
    s.stats.relocations++;
    s.movedThisSearch = true;
    s.perception.seenClose = 0;
  }
  s.english = null;
  s.pendingMove = null;
  return ok;
}

function moveGhost(s: MatchState, dt: number): number {
  const g = s.ghost;
  if (!g.transit) return 0;
  let remaining = g.speed * dt;
  let travelled = 0;
  while (g.path.length && remaining > 1e-9) {
    const next = g.path[0];
    const length = Math.hypot(next.x - g.x, next.y - g.y, next.z - g.z);
    const fraction = length > 0 ? Math.min(1, remaining / length) : 1;
    const used = length * fraction;
    g.x += (next.x - g.x) * fraction;
    g.y += (next.y - g.y) * fraction;
    g.z += (next.z - g.z) * fraction;
    remaining -= used;
    travelled += used;
    if (fraction === 1) g.path.shift();
  }
  if (!g.path.length) {
    g.spotId = g.destination;
    g.destination = null;
    g.transit = false;
    g.hidden = true;
    g.silent = false;
    if (g.invisible || g.loudness !== 1) s.events.push({ type: "abilityFx", ghost: s.config.ghost, active: false });
    g.invisible = false;
    g.loudness = 1;
  }
  return travelled / dt;
}

function finish(s: MatchState, reason?: "found" | "caughtInOpen"): void {
  s.status = reason ? "lost" : "won";
  s.detective.phase = "finish";
  s.detective.anim = reason ? "celebrate" : "react";
  s.stats.elapsed = s.time;
  if (reason) s.events.push({ type: "lost", reason, stats: { ...s.stats } });
  else s.events.push({ type: "won", stats: { ...s.stats } });
}

function beginApproach(s: MatchState): void {
  const d = s.detective;
  const spot = chooseTarget(detectiveView(s));
  const stand = roomLayout(s.config.room).stands[spot.id];
  const path = pathBetween(s.config.room, d, stand);
  if (!path) throw new Error(`Unreachable detective stand: ${spot.id}`);
  d.target = spot.id;
  d.path = path;
  d.phase = "approach";
  d.anim = "think";
  d.elapsed = 0;
  s.events.push({ type: "announce", spotId: spot.id, line: announceLine(spot, () => random(d)), highlight: s.config.level === "beginner" });
  s.events.push({ type: "detectivePath", spotId: spot.id, path: path.map((p) => ({ ...p })) });
}

function walkDetective(s: MatchState, dt: number): void {
  const d = s.detective;
  d.anim = "walk";
  let remaining = 0.9 * dt;
  while (d.path.length && remaining > 1e-9) {
    const next: Point = d.path[0];
    const dx = next.x - d.x;
    const dz = next.z - d.z;
    const length = Math.hypot(dx, dz);
    if (length > 1e-9) d.yaw = Math.atan2(dx, dz);
    const fraction = length > 0 ? Math.min(1, remaining / length) : 1;
    d.x += dx * fraction;
    d.z += dz * fraction;
    remaining -= length * fraction;
    if (fraction === 1) d.path.shift();
  }
  if (!d.path.length) {
    const spot = WORLD.spotById.get(d.target!)!;
    d.yaw = Math.atan2(spot.hidePos.x - d.x, spot.hidePos.z - d.z);
    d.phase = "search";
    d.anim = "inspect";
    d.elapsed = 0;
    s.events.push({ type: "detectiveArrive", spotId: spot.id }, { type: "searchStart", spotId: spot.id });
  }
}

function completeSearch(s: MatchState): void {
  const d = s.detective;
  const spot = WORLD.spotById.get(d.target!)!;
  s.stats.completedSearches++;
  s.searchesLeft--;
  if ((!s.ghost.transit && s.ghost.spotId === spot.id) || (s.ghost.transit && s.ghost.destination === spot.id)) {
    s.events.push({ type: "found", spotId: spot.id, line: foundLine(spot, () => random(d)) });
    finish(s, "found");
    return;
  }
  const decoy = s.effects.decoy?.spotId === spot.id;
  if (decoy) {
    s.effects.decoy = null;
    s.events.push({ type: "abilityFx", ghost: s.config.ghost, active: false, targetSpotId: spot.id });
  }
  // Mark every clue seen so far as older than this completed inspection.
  d.searched[spot.id] = s.clueId;
  s.events.push({ type: "searchEmpty", spotId: spot.id, line: emptyLine(spot, () => random(d)), decoy });
  if (s.effects.sleepySearch !== null) {
    s.effects.sleepySearch = null;
    s.events.push({ type: "abilityFx", ghost: s.config.ghost, active: false });
  }
  s.movedThisSearch = false;
  if (!s.searchesLeft) { finish(s); return; }
  d.phase = "react";
  d.anim = "react";
  d.elapsed = 0;
}

function tickEffects(s: MatchState, dt: number): void {
  const activeBubbles = s.effects.bubbles.length;
  s.effects.bubbles = s.effects.bubbles.map((b) => ({ ...b, remaining: b.remaining - dt })).filter((b) => b.remaining > 1e-9);
  if (activeBubbles && !s.effects.bubbles.length) s.events.push({ type: "abilityFx", ghost: s.config.ghost, active: false });
  if (s.effects.music) {
    s.effects.music.remaining -= dt;
    if (s.effects.music.remaining <= 1e-9) {
      s.effects.music = null;
      s.events.push({ type: "abilityFx", ghost: s.config.ghost, active: false });
    }
  }
}

function tick(s: MatchState): void {
  s.time = Math.round((s.time + TICK) * 20) / 20;
  s.stats.elapsed = s.time;
  tickEffects(s, TICK);
  const speed = moveGhost(s, TICK);
  const sensed = perceive({
    room: s.config.room, detective: s.detective, ghost: { ...s.ghost, speed },
    bubbles: s.effects.bubbles, music: Boolean(s.effects.music),
    sleepy: s.effects.sleepySearch === s.stats.completedSearches, timers: s.perception
  }, TICK, () => random(s));
  s.perception = sensed.timers;
  if (sensed.visible) s.seenAt = s.time;
  for (const clue of sensed.clues) addClue(s, clue);
  if (sensed.caughtInOpen) {
    s.events.push({ type: "caughtInOpen", x: s.ghost.x, z: s.ghost.z });
    finish(s, "caughtInOpen");
    return;
  }
  const view = detectiveView(s);
  decaySuspicion(view, TICK);
  const d = s.detective;
  if (investigateClue(view)) { d.phase = "investigate-clue"; d.elapsed = 0; d.anim = "think"; }
  d.elapsed += TICK;
  switch (d.phase) {
    case "observe":
      d.anim = "think";
      if (d.elapsed >= 0.5 - 1e-9) { d.phase = "choose"; d.elapsed = 0; }
      break;
    case "choose": beginApproach(s); break;
    case "investigate-clue":
      if (d.elapsed >= 0.3 - 1e-9) { d.phase = "choose"; d.elapsed = 0; }
      break;
    case "approach":
      if (d.elapsed >= 1.5 - 1e-9) walkDetective(s, TICK);
      break;
    case "search":
      if (d.elapsed >= 2 - 1e-9) completeSearch(s);
      break;
    case "react":
      if (d.elapsed >= 0.8 - 1e-9) { d.phase = "continue"; d.elapsed = 0; }
      break;
    case "continue":
      // Seeded false leads use only public room spots, never the truth.
      if (random(d) < 0.12) {
        const spots = view.spots;
        const spot = spots[Math.floor(random(d) * spots.length)];
        addClue(s, blurredClue("sound", spot.hidePos, () => random(d)));
      }
      d.phase = "observe"; d.elapsed = 0;
      break;
    case "finish": break;
  }
}

/** Advance fixed simulation ticks. Returns only events emitted by this call;
 * all command/step events remain queued until takeEvents is called. */
export function step(s: MatchState, dtSeconds: number): MatchEvent[] {
  if (!Number.isFinite(dtSeconds) || dtSeconds < 0) throw new Error("dtSeconds must be finite and nonnegative");
  if (s.english || s.status !== "playing" || dtSeconds === 0) return [];
  const first = s.events.length;
  s.remainder += dtSeconds;
  while (s.remainder >= TICK - 1e-9 && s.status === "playing") {
    s.remainder = Math.max(0, s.remainder - TICK);
    tick(s);
  }
  return s.events.slice(first);
}

export function takeEvents(s: MatchState): MatchEvent[] {
  const events = s.events;
  s.events = [];
  return events;
}
