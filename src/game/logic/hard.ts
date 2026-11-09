import { PREPS, type Prep, type RoomId } from "../types";
import { spotsInRoom, WORLD, type HidingSpot, type World } from "../world/world";
import { ROOMS } from "../world/rooms";
import type { AnswerRecord, Encounter, HuntState } from "./hunt";
import { chapter1Plan, chapter2Plan } from "./plans";
import { pick, shuffle, type Rng } from "./rng";

/**
 * Hard Story: the student hears where the ghost is (by the window) but not
 * which room. Every ghost hides anywhere in its chapter's four rooms, so the
 * hunt is deduction: search, remember, listen to Boo's extra clues.
 *
 * Fairness rules this module guarantees (and tests check):
 *  - a clue names a real spot; within its own room that clue matches exactly one spot,
 *    so searching that spot settles the room;
 *  - starting clues prefer objects found in two or more of the chapter's rooms;
 *  - a "not in" clue only ever names a room the ghost is not in, and the room clue
 *    always names the real room.
 */

export const HARD_ROOMS: Record<1 | 2, RoomId[]> = {
  1: chapter1Plan().map((e) => e.room),
  2: chapter2Plan().map((e) => e.room)
};

type SpotLike = Pick<HidingSpot, "prep" | "noun">;
const sameClue = (a: SpotLike, b: SpotLike) => a.prep === b.prep && a.noun === b.noun;

/** The spot in `room` that the clue for `spot` describes (null: the room has no such place). */
export function matchIn(spot: SpotLike, room: RoomId, world: World = WORLD): HidingSpot | null {
  const all = spotsInRoom(room, world).filter((s) => sameClue(s, spot));
  return all.length === 1 ? all[0] : null;
}

/** The rooms where the clue for `spot` could be true. */
export function clueRooms(spot: SpotLike, rooms: readonly RoomId[], world: World = WORLD): RoomId[] {
  return rooms.filter((r) => matchIn(spot, r, world));
}

/** A spot can carry a Hard clue: searchable, and the only place in its room the clue describes. */
export function isFairSpot(spot: HidingSpot, world: World = WORLD): boolean {
  const obj = world.objectById.get(spot.objectId);
  return Boolean(obj?.searchable) && spotsInRoom(spot.room, world).filter((s) => sameClue(s, spot)).length === 1;
}

/**
 * A hiding place with preposition `prep` in `rooms`: first a random room (so ghosts really
 * move around the floor), then a spot whose clue fits two or more rooms. Falls back to a
 * clue that fits one room only when nothing ambiguous exists.
 */
export function pickHardSpot(rng: Rng, prep: Prep, rooms: readonly RoomId[], avoidRoom: RoomId | null, world: World = WORLD): HidingSpot {
  const fair = rooms.flatMap((r) => spotsInRoom(r, world)).filter((s) => s.prep === prep && isFairSpot(s, world));
  const ambiguous = fair.filter((s) => clueRooms(s, rooms, world).length >= 2);
  const pool = ambiguous.length ? ambiguous : fair;
  if (!pool.length) throw new Error(`no hard spot for ${prep}`);
  const poolRooms = [...new Set(pool.map((s) => s.room))];
  const roomChoices = poolRooms.filter((r) => r !== avoidRoom);
  const room = pick(rng, roomChoices.length ? roomChoices : poolRooms);
  return pick(rng, pool.filter((s) => s.room === room));
}

/**
 * The Hard Story plan: the same eight ghosts in the same order, Chapter 1 downstairs and
 * Chapter 2 upstairs. A ghost never moves while it is hidden; a finale ghost re-hides
 * anywhere in its chapter after each answer (pre-chosen here, so a seed repeats exactly).
 */
export function hardPlan(rng: Rng, world: World = WORLD): Encounter[] {
  const chapter = (template: Encounter[], rooms: RoomId[]) => {
    const starts = shuffle(rng, PREPS);
    let last: RoomId | null = null;
    return template.map((e, i): Encounter => {
      const preps = e.rounds > 1 ? shuffle(rng, PREPS).slice(0, e.rounds) : [starts[i % starts.length]];
      const spots = preps.map((p) => {
        const s = pickHardSpot(rng, p, rooms, last, world);
        last = s.room;
        return s;
      });
      return {
        ghost: e.ghost,
        room: spots[0].room,
        start: spots[0].id,
        rounds: e.rounds,
        relocateAfter: null,
        maxRelocations: 0,
        searchRooms: rooms,
        ...(spots.length > 1 ? { roundSpots: spots.slice(1).map((s) => s.id) } : {})
      };
    });
  };
  return [...chapter(chapter1Plan(), HARD_ROOMS[1]), ...chapter(chapter2Plan(), HARD_ROOMS[2])];
}

// ------------------------------------------------------------ clue ladder

/** What Boo has added to the clue for the current hiding place. */
export interface HardClue {
  /** Rooms Boo has said the ghost is not in. */
  notIn: RoomId[];
  /** Boo has said which room it is in. */
  roomTold: boolean;
}

export const NO_HARD_CLUE: HardClue = { notIn: [], roomTold: false };

export type HardHint = { kind: "notIn"; room: RoomId } | { kind: "in"; room: RoomId };

/** Rooms that could still hold the ghost, from what the student has heard and searched. */
export function candidateRooms(s: HuntState, world: World = WORLD): RoomId[] {
  const enc = s.encounters[Math.min(s.index, s.encounters.length - 1)];
  const spot = world.spotById.get(s.spotId)!;
  const rooms = enc.searchRooms ?? [enc.room];
  if (s.hardClue?.roomTold) return [spot.room];
  return clueRooms(spot, rooms, world).filter((r) => {
    if (s.hardClue?.notIn.includes(r)) return false;
    const m = matchIn(spot, r, world)!;
    return !s.searchedThisClue.includes(m.id);
  });
}

/**
 * Boo's next extra clue after an empty search, or null.
 * Two empty searches: one room the ghost is not in. Four: the room.
 * Whenever only one room is left, Boo says it straight away.
 */
export function nextHardHint(s: HuntState, rng: Rng, world: World = WORLD): HardHint | null {
  if (!s.hardClue || s.hardClue.roomTold || s.status !== "hunting") return null;
  const room = world.spotById.get(s.spotId)!.room;
  const cands = candidateRooms(s, world);
  const n = s.wrongSearchesThisClue;
  if (cands.length <= 1 || n >= 4) return { kind: "in", room };
  if (n >= 2 && s.hardClue.notIn.length === 0) {
    const wrong = cands.filter((r) => r !== room);
    if (wrong.length <= 1) return { kind: "in", room };
    return { kind: "notIn", room: pick(rng, wrong) };
  }
  return null;
}

export function applyHardHint(s: HuntState, hint: HardHint): HuntState {
  const c = s.hardClue ?? NO_HARD_CLUE;
  return { ...s, hardClue: hint.kind === "in" ? { ...c, roomTold: true } : { ...c, notIn: [...c.notIn, hint.room] } };
}

const roomName = (r: RoomId) => ROOMS[r].name.toLowerCase();

export function hintText(hint: HardHint): string {
  return hint.kind === "in" ? `It's in the ${roomName(hint.room)}.` : `It's not in the ${roomName(hint.room)}.`;
}

/** Everything Boo has said about rooms so far for this hiding place, in order. */
export function hardHintLines(s: HuntState, world: World = WORLD): string[] {
  if (!s.hardClue) return [];
  const lines = s.hardClue.notIn.map((room) => hintText({ kind: "notIn", room }));
  if (s.hardClue.roomTold) lines.push(hintText({ kind: "in", room: world.spotById.get(s.spotId)!.room }));
  return lines;
}

// --------------------------------------------------------------- notebook

export type NoteStatus = "unchecked" | "checked" | "clear" | "here";

export interface NoteRow {
  room: RoomId;
  status: NoteStatus;
  /** Empty searches in this room for the current hiding place. */
  searched: string[];
}

/**
 * The detective notebook. A room is "clear" only when that is certain: Boo said so,
 * Boo named another room, or the one place in it the clue describes was searched.
 */
export function notebook(s: HuntState, world: World = WORLD): NoteRow[] {
  const enc = s.encounters[Math.min(s.index, s.encounters.length - 1)];
  const rooms = enc.searchRooms ?? [enc.room];
  const spot = world.spotById.get(s.spotId)!;
  const told = Boolean(s.hardClue?.roomTold);
  return rooms.map((room) => {
    const searched = s.searchedThisClue.filter((id) => world.spotById.get(id)?.room === room);
    const m = matchIn(spot, room, world);
    let status: NoteStatus = searched.length ? "checked" : "unchecked";
    if (told) status = room === spot.room ? "here" : "clear";
    else if (s.hardClue?.notIn.includes(room) || (m && searched.includes(m.id))) status = "clear";
    return { room, status, searched };
  });
}

// ----------------------------------------------------------------- medals

export type Medal = "gold" | "silver" | "bronze";

/** Gold: 0-1 empty searches, silver: 2-3, bronze: 4 or more (a finale ghost: per find, on average). */
export function medalFor(answers: readonly AnswerRecord[]): Medal {
  if (!answers.length) return "bronze";
  const avg = answers.reduce((n, a) => n + (a.searchMisses ?? 0), 0) / answers.length;
  return avg <= 1 ? "gold" : avg <= 3 ? "silver" : "bronze";
}

export const MEDAL_NAME: Record<Medal, string> = { gold: "Gold", silver: "Silver", bronze: "Bronze" };
