import { describe, expect, it } from "vitest";
import { mulberry32 } from "../logic/rng";
import { WORLD } from "../world/world";
import { accept, announceLine, emptyLine, foundLine, placePhrase, sentenceFor } from "./english";

describe("Hide & Seek English", () => {
  const spot = { prep: "under" as const, noun: "table" };

  it("generates natural sentences for every existing noun", () => {
    expect(sentenceFor(spot)).toBe("I'm under the table.");
    for (const place of WORLD.spots) {
      expect(sentenceFor(place)).toBe(`I'm ${place.prep} the ${place.noun}.`);
    }
    expect(placePhrase({ prep: "in", noun: "the toy box" })).toBe("in the toy box");
  });

  it("accepts both first-person forms and bare preposition phrases", () => {
    for (const phrase of ["I'm under the table.", "I am under the table", "under the table", "under", "anda"]) {
      expect(accept([phrase], spot)).toBe(true);
    }
    expect(accept(["on"], spot)).toBe(false);
    expect(accept([""], spot)).toBe(false);
  });

  it("preserves top-hypothesis priority and rejects guessing every preposition", () => {
    expect(accept(["on", "under"], spot)).toBe(false);
    expect(accept(["hello", "under"], spot)).toBe(true);
    expect(accept(["in on under by"], spot)).toBe(false);
  });

  it("varies seeded detective lines while naming the actual place", () => {
    for (const lineFor of [announceLine, emptyLine, foundLine]) {
      const a = mulberry32(7);
      const b = mulberry32(7);
      const lines = Array.from({ length: 30 }, () => lineFor(spot, a));
      expect(lines).toEqual(Array.from({ length: 30 }, () => lineFor(spot, b)));
      expect(new Set(lines).size).toBeGreaterThan(1);
      expect(lines.every((line) => line.includes("under the table"))).toBe(true);
    }
  });
});
