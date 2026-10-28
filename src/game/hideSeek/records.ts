import { GHOST_ORDER } from "../ghosts";
import { ROOMS } from "../world/rooms";
import type { GhostId } from "../types";
import type { MatchState, PlayRoom } from "./types";

/** A challenge area may contain one or several visually similar rooms. */
export interface ChallengeArea { id: string; name: string; rooms: readonly PlayRoom[] }
export const CHALLENGE_AREAS: readonly ChallengeArea[] = [
  { id: "bedroom", name: ROOMS.bedroom.name, rooms: ["bedroom"] },
  { id: "dining", name: ROOMS.dining.name, rooms: ["dining"] },
  { id: "storage", name: ROOMS.storage.name, rooms: ["storage"] },
  { id: "library", name: ROOMS.library.name, rooms: ["library"] },
  { id: "playroom", name: ROOMS.playroom.name, rooms: ["playroom"] },
  { id: "bathroom", name: ROOMS.bathroom.name, rooms: ["bathroom"] },
  { id: "music", name: ROOMS.music.name, rooms: ["music"] },
  { id: "attic", name: ROOMS.attic.name, rooms: ["attic"] }
] as const;

export const RECORDS_STORAGE_KEY = "hh.hideseek.records.v1";
export const ACHIEVEMENTS = {
  escaped: { name: "Escaped", detail: "Survive five searches" },
  masterHider: { name: "Master Hider", detail: "Win without relocating" },
  naturalTalent: { name: "Natural Talent", detail: "Win without using your ability" },
  englishExpert: { name: "English Expert", detail: "Every English answer correct on the first try" }
} as const;
export type Achievement = keyof typeof ACHIEVEMENTS;
const AWARDS = Object.keys(ACHIEVEMENTS) as Achievement[];

export interface CompletionRecord {
  firstCompletedAt: string;
  wins: number;
  bestEnglishAccuracy: number;
  fewestMoves: number;
  achievements: Achievement[];
}
export interface CompletionBook {
  version: 1;
  entries: Record<string, CompletionRecord>;
  /** Historical milestone awards stay earned when more rooms are added. */
  milestones: string[];
}
export interface CollectionProgress { completed: number; total: number; percentage: number; fullGhosts: number; fullAreas: number }
export interface VictoryRecordResult {
  saved: boolean;
  firstCompletion: boolean;
  newAchievements: Achievement[];
  newMilestones: string[];
  personalBest: boolean;
  progress: CollectionProgress;
}
const processed = new WeakMap<MatchState, VictoryRecordResult>();

export const emptyBook = (): CompletionBook => ({ version: 1, entries: {}, milestones: [] });
export const recordKey = (ghost: GhostId, areaId: string) => `${ghost}:${areaId}`;
export const areaForRoom = (room: PlayRoom): ChallengeArea | undefined =>
  CHALLENGE_AREAS.find((area) => area.rooms.includes(room));

/** Read defensively: bad or unavailable browser storage must never break a match. */
export function loadCompletionBook(): CompletionBook {
  try {
    const storage = globalThis.localStorage;
    const raw = storage.getItem(RECORDS_STORAGE_KEY);
    if (!raw) return emptyBook();
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return emptyBook();
    const obj = parsed as Partial<CompletionBook>;
    if (obj.version !== 1 || !obj.entries || typeof obj.entries !== "object" || Array.isArray(obj.entries)) return emptyBook();
    const entries: Record<string, CompletionRecord> = {};
    for (const [key, value] of Object.entries(obj.entries)) {
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      const v = value as Partial<CompletionRecord>;
      if (typeof v.firstCompletedAt !== "string" || !Number.isFinite(Date.parse(v.firstCompletedAt)) ||
          !Number.isSafeInteger(v.wins ?? NaN) || (v.wins ?? 0) < 1 ||
          typeof v.bestEnglishAccuracy !== "number" || v.bestEnglishAccuracy < 0 || v.bestEnglishAccuracy > 1 ||
          !Number.isInteger(v.fewestMoves ?? NaN) || (v.fewestMoves ?? -1) < 0 || (v.fewestMoves ?? 3) > 2) continue;
      entries[key] = {
        firstCompletedAt: v.firstCompletedAt,
        wins: v.wins!,
        bestEnglishAccuracy: v.bestEnglishAccuracy,
        fewestMoves: v.fewestMoves!,
        achievements: AWARDS.filter((award) => Array.isArray(v.achievements) && v.achievements.includes(award))
      };
    }
    return {
      version: 1, entries,
      milestones: Array.isArray(obj.milestones) ? [...new Set(obj.milestones.filter((item): item is string => typeof item === "string"))] : []
    };
  } catch {
    return emptyBook();
  }
}

function writeBook(book: CompletionBook): boolean {
  try {
    globalThis.localStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify(book));
    return true;
  } catch { return false; }
}

export function completionFor(book: CompletionBook, ghost: GhostId, roomOrArea: string): CompletionRecord | undefined {
  const areaId = CHALLENGE_AREAS.find((a) => a.id === roomOrArea || a.rooms.some((room) => room === roomOrArea))?.id;
  return areaId ? book.entries[recordKey(ghost, areaId)] : undefined;
}
export function ghostCompleted(book: CompletionBook, ghost: GhostId): number {
  return CHALLENGE_AREAS.filter((area) => Boolean(book.entries[recordKey(ghost, area.id)])).length;
}
export function collectionProgress(book: CompletionBook): CollectionProgress {
  const total = GHOST_ORDER.length * CHALLENGE_AREAS.length;
  const completed = GHOST_ORDER.reduce((n, ghost) => n + ghostCompleted(book, ghost), 0);
  const fullGhosts = GHOST_ORDER.filter((ghost) => ghostCompleted(book, ghost) === CHALLENGE_AREAS.length).length;
  const fullAreas = CHALLENGE_AREAS.filter((area) => GHOST_ORDER.every((ghost) => Boolean(book.entries[recordKey(ghost, area.id)]))).length;
  return { completed, total, percentage: total ? Math.round((completed / total) * 100) : 0, fullGhosts, fullAreas };
}
export function collectionMilestones(book: CompletionBook): string[] {
  const progress = collectionProgress(book);
  const found: string[] = [];
  for (const ghost of GHOST_ORDER)
    if (CHALLENGE_AREAS.length && ghostCompleted(book, ghost) === CHALLENGE_AREAS.length) found.push(`specialist:${ghost}`);
  if (GHOST_ORDER.every((ghost) => ghostCompleted(book, ghost) > 0)) found.push("ghostMaster");
  // Exploring means visiting each area with at least one ghost, not mastering all 64 combinations.
  if (CHALLENGE_AREAS.length && CHALLENGE_AREAS.every((area) => GHOST_ORDER.some((ghost) => Boolean(book.entries[recordKey(ghost, area.id)])))) found.push("hotelExplorer");
  if (progress.total && progress.completed === progress.total) found.push("hotelMaster");
  return found;
}

export function recordVictory(match: MatchState): VictoryRecordResult | null {
  if (match.status !== "won" || match.stats.completedSearches !== 5 || match.searchesLeft !== 0 || match.english) return null;
  const priorResult = processed.get(match);
  if (priorResult) return priorResult;
  const area = areaForRoom(match.config.room);
  if (!area) return null;
  const book = loadCompletionBook();
  const key = recordKey(match.config.ghost, area.id);
  const previous = book.entries[key];
  const firstCompletion = !previous;
  const awards: Achievement[] = ["escaped"];
  if (match.stats.relocations === 0) awards.push("masterHider");
  if (!match.abilityUsed) awards.push("naturalTalent");
  if (match.stats.questions > 0 && match.stats.acceptedAnswers === match.stats.questions &&
      match.stats.firstTryAnswers === match.stats.questions) awards.push("englishExpert");

  const accuracy = Math.max(0, Math.min(1, match.stats.firstTryAccuracy));
  const newAchievements = awards.filter((award) => !previous?.achievements.includes(award));
  const personalBest = !!previous && (accuracy > previous.bestEnglishAccuracy || match.stats.relocations < previous.fewestMoves);
  book.entries[key] = {
    firstCompletedAt: previous?.firstCompletedAt ?? new Date().toISOString(),
    wins: (previous?.wins ?? 0) + 1,
    bestEnglishAccuracy: Math.max(previous?.bestEnglishAccuracy ?? 0, accuracy),
    fewestMoves: Math.min(previous?.fewestMoves ?? 2, match.stats.relocations),
    achievements: [...new Set([...(previous?.achievements ?? []), ...awards])]
  };
  const newMilestones = collectionMilestones(book).filter((id) => !book.milestones.includes(id));
  book.milestones.push(...newMilestones);
  const saved = writeBook(book);
  const result = { saved, firstCompletion, newAchievements, newMilestones, personalBest,
    progress: collectionProgress(book) };
  processed.set(match, result);
  return result;
}

/** Clears only Hide & Seek records. Story unlocks and settings are untouched. */
export function resetCompletionBook(): boolean {
  try {
    globalThis.localStorage.removeItem(RECORDS_STORAGE_KEY);
    return true;
  } catch { return false; }
}
