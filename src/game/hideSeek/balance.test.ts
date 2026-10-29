import { writeFileSync } from "node:fs";
import { PLAY_ROOMS as PLAY_ROOM_LIST } from "./records";
import { describe, expect, it } from "vitest";
import { GHOST_ORDER } from "../ghosts";
import { mulberry32 } from "../logic/rng";
import { FLOOR_Y, ROOMS as ROOM_DEFS } from "../world/rooms";
import { spotsInRoom, type HidingSpot } from "../world/world";
import { sentenceFor } from "./english";
import {
  abilityTargets, answerEnglish, beginEnglish, chooseStart, createMatch,
  reachableSpots, requestMove, step, takeEvents, useAbility
} from "./match";
import type { MatchState, PlayRoom } from "./types";

const ROOMS: readonly PlayRoom[] = PLAY_ROOM_LIST;
type Policy = "stay" | "sensible";

function distance(a: { x: number; z: number }, b: { x: number; z: number }) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function distractionTarget(state: MatchState) {
  return abilityTargets(state)
    .filter((spot) => spot.id !== state.ghost.spotId)
    .sort((a, b) => {
      const score = (spot: HidingSpot) => distance(spot.hidePos, state.ghost) - (state.detective.searched[spot.id] === undefined ? 0 : 5);
      return score(b) - score(a);
    })[0];
}

/** Uses only the announced target, visible detective, own pose and search history. */
function sensibleTurn(state: MatchState, reachableCache: Map<string, HidingSpot[]>) {
  if (state.ghost.transit || state.english) return;
  const threatened = state.detective.target === state.ghost.spotId;
  if (!state.abilityUsed && (state.config.ghost === "hungry" || state.config.ghost === "mischief") && threatened) {
    const target = distractionTarget(state);
    if (target) useAbility(state, target.id);
  }
  if (!state.abilityUsed && state.config.ghost === "sleepy" && (state.detective.suspicion >= 30 || threatened)) useAbility(state);
  if (state.movedThisSearch || state.relocationsLeft === 0) return;
  const ownWasSearched = state.ghost.spotId !== null && state.detective.searched[state.ghost.spotId] !== undefined;
  if (!threatened && (ownWasSearched || Object.keys(state.detective.searched).length === 0 || distance(state.detective, state.ghost) < 3)) return;
  if (!state.abilityUsed && ["sneaky", "bouncy", "shadow", "bubbles", "melody"].includes(state.config.ghost)) useAbility(state);
  const reachKey = `${state.ghost.spotId}/${state.effects.nextMove ?? "normal"}`;
  let reachable = reachableCache.get(reachKey);
  if (!reachable) {
    reachable = reachableSpots(state);
    reachableCache.set(reachKey, reachable);
  }
  const options = reachable.filter((spot) => spot.id !== state.ghost.spotId && spot.id !== state.detective.target);
  const searched = options.filter((spot) => state.detective.searched[spot.id] !== undefined);
  // A quiet move into the detective's empty-search memory is the main strategy.
  if (!threatened && (ownWasSearched || searched.length === 0 || distance(state.detective, state.ghost) < 3)) return;
  const candidates = searched.length > 0 ? searched : options;
  candidates.sort((a, b) => {
    const score = (spot: HidingSpot) => {
      const concealed = spot.prep === "in" || spot.prep === "under" || spot.hidePos.y - FLOOR_Y[ROOM_DEFS[spot.room].floor] > 1.4;
      return (concealed ? 2 : 0) + distance(spot.hidePos, state.detective) - distance(spot.hidePos, state.ghost) * 0.7;
    };
    return score(b) - score(a);
  });
  const destination = candidates[0];
  if (!destination) return;
  if (!requestMove(state, destination.id).ok) return;
  if (!beginEnglish(state).ok) throw new Error("Reserved relocation did not open English");
  if (!answerEnglish(state, [sentenceFor(destination)]).ok) throw new Error("Correct relocation sentence was rejected");
}

function simulate(ghost: MatchState["config"]["ghost"], room: PlayRoom, seed: number, policy: Policy) {
  const state = createMatch({ ghost, room, seed, level: "standard" });
  const reachableCache = new Map<string, HidingSpot[]>();
  const rng = mulberry32(seed ^ 0x517cc1b7);
  const spots = spotsInRoom(room);
  const start = spots[Math.floor(rng() * spots.length)];
  if (!chooseStart(state, start.id).ok || !answerEnglish(state, [sentenceFor(start)]).ok) throw new Error(`Invalid start: ${room}/${ghost}/${seed}`);
  for (let tick = 0; tick < 1600 && state.status === "playing"; tick++) {
    if (policy === "sensible") sensibleTurn(state, reachableCache);
    step(state, 0.25);
    takeEvents(state);
  }
  if (state.status === "playing") throw new Error(`Match stalled: ${room}/${ghost}/${seed}/${policy}; phase=${state.detective.phase}; target=${state.detective.target}`);
  if (state.stats.completedSearches > 5 || state.stats.relocations > 2) throw new Error("Match exceeded its budget");
  return state;
}

describe("seeded room and ghost policies", () => {
  it("completes a match for all eight rooms and all eight ghosts under both policies", () => {
    for (const room of ROOMS) for (const ghost of GHOST_ORDER) for (const policy of ["stay", "sensible"] as const) {
      const state = simulate(ghost, room, 4001, policy);
      expect(["won", "lost"]).toContain(state.status);
      expect(state.stats.elapsed).toBeGreaterThan(0);
      expect(state.stats.acceptedAnswers).toBeGreaterThanOrEqual(1);
      expect(state.stats.acceptedAnswers).toBeLessThanOrEqual(3);
    }
  }, 120_000);

  it("rewards sensible play for every ghost in 200 seeded matches across all rooms", () => {
    const table: { ghost: string; matches: number; stay: number; sensible: number }[] = [];
    for (const ghost of GHOST_ORDER) {
      let stayWins = 0;
      let sensibleWins = 0;
      for (let match = 0; match < 200; match++) {
        const room = ROOMS[match % ROOMS.length];
        const seed = 101 + match * 7919;
        if (simulate(ghost, room, seed, "stay").status === "won") stayWins++;
        if (simulate(ghost, room, seed, "sensible").status === "won") sensibleWins++;
      }
      table.push({ ghost, matches: 200, stay: stayWins / 2, sensible: sensibleWins / 2 });
    }
    console.table(table);
    writeFileSync(new URL("./balance-results.json", import.meta.url), JSON.stringify({
      matchesPerGhostPerPolicy: 200,
      matchesPerRoomPerGhostPerPolicy: Number((200 / ROOMS.length).toFixed(1)),
      seed: `101 + matchIndex * 7919; room = rooms[matchIndex % ${ROOMS.length}]`,
      startingSpot: "Uniform seeded choice shared by both policies",
      units: "win percent",
      table
    }, null, 2) + "\n");
    for (const row of table) {
      expect(row.stay, `${row.ghost}: staying should win occasionally`).toBeGreaterThan(0);
      expect(row.stay, `${row.ghost}: staying should remain rare`).toBeLessThan(35);
      expect(row.sensible, `${row.ghost}: sensible play should win at least 40%`).toBeGreaterThanOrEqual(40);
      expect(row.sensible, `${row.ghost}: sensible play should retain risk`).toBeLessThanOrEqual(90);
      expect(row.sensible, `${row.ghost}: strategy should improve survival`).toBeGreaterThan(row.stay);
    }
  }, 120_000);
});
