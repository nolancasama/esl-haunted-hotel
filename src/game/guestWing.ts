import { rt } from "./runtime";
import { getGame } from "./store";
import { OPENABLE_DOORS, type DoorId } from "./world/rooms";
import type { WingNoteId } from "./world/furniture";

/**
 * The Forgotten Guest Wing in the story: which doors the student opens by hand, and the short
 * clue cards of the optional mystery "Who stayed in Room 206?". The mystery lives in `rt.wing`
 * (reset with every playthrough, so it can be solved again); solving it is also saved once.
 */

/** "story": the story opens it; "open": a tap, E or a bump opens it; "locked": not yet. */
export type DoorAccess = "story" | "open" | "locked";

export function doorAccess(id: string): DoorAccess {
  if (!OPENABLE_DOORS.has(id as DoorId)) return "story";
  if (!getGame().guestWingUnlocked || getGame().mode === "practice") return "locked";
  if (id === "g206" && !rt.wing.key) return "locked";
  return "open";
}

export interface NoteLine {
  en: string;
  ja?: string;
  /** Crossed out, half rubbed away (the register's Room 206). */
  struck?: boolean;
}
export interface WingNote {
  title: string;
  titleJa: string;
  lines: NoteLine[];
}

export const WING_NOTES: Record<WingNoteId, WingNote> = {
  register: {
    title: "Guest Register",
    titleJa: "しゅくはく めいぼ",
    lines: [
      { en: "201 · Mr. Brown" },
      { en: "202 · Ms. Green" },
      { en: "203 · The Lee family" },
      { en: "204 · Ms. Rose" },
      { en: "205 · Mr. Gray" },
      { en: "206 · P · p", struck: true },
      { en: "Who stayed in Room 206?", ja: "206ごうしつには だれが とまったの？" }
    ]
  },
  note201: {
    title: "A Note",
    titleJa: "メモ",
    lines: [{ en: "Shh! Our friend in 206 sleeps all day.", ja: "しーっ！ 206の ともだちは ひるま ねているよ。" }]
  },
  suitcase202: {
    title: "A Suitcase",
    titleJa: "スーツケース",
    lines: [
      { en: "Someone left this suitcase.", ja: "だれかが わすれた スーツケース。" },
      { en: "The tag says: ROOM 206.", ja: "タグには「206」と かいてある。" }
    ]
  },
  photo203: {
    title: "An Old Photo",
    titleJa: "ふるい しゃしん",
    lines: [
      { en: "An old photo of the hotel.", ja: "ホテルの ふるい しゃしん。" },
      { en: "Look! A little white ghost waves from a window.", ja: "まどから 小さな 白い おばけが 手を ふっている！" }
    ]
  },
  key204: {
    title: "A Room Key",
    titleJa: "へやの かぎ",
    lines: [
      { en: "A key! It says 206.", ja: "かぎだ！「206」と かいてある。" },
      { en: "Now you can open Room 206.", ja: "これで 206ごうしつが あけられるよ。" }
    ]
  },
  painting205: {
    title: "A Painting",
    titleJa: "え",
    lines: [
      { en: "A painting of Room 206.", ja: "206ごうしつの え。" },
      { en: "The door is open. Someone is smiling inside.", ja: "ドアが あいていて、なかで だれかが わらっている。" }
    ]
  },
  photo206: {
    title: "Mystery Solved!",
    titleJa: "なぞが とけた！",
    lines: [
      { en: "Pip, a friendly ghost, stayed in Room 206 long ago.", ja: "ずっと むかし、206ごうしつには やさしい おばけの ピップが とまっていたよ。" },
      { en: "Pip helped the guests find lost things.", ja: "ピップは おきゃくさんの わすれものを さがして くれたんだ。" },
      { en: "The hotel has more secrets…", ja: "ホテルには まだ ひみつが あるみたい…" }
    ]
  }
};
