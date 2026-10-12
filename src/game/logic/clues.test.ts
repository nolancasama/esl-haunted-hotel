import { describe, expect, it } from "vitest";
import { WORLD } from "../world/world";
import { answerFrame, clueSpoken, clueText, emptyCaption, sentenceWith } from "./clues";

describe("clue text always matches the spot it was made from", () => {
  for (const spot of WORLD.spots) {
    it(spot.id, () => {
      expect(clueText(spot)).toBe(`It's ${spot.prep} the ${spot.noun}.`);
      expect(clueText(spot)).toMatch(/^It's (in|on|under|by) the [a-z]+( [a-z]+)?\.$/);
      expect(clueSpoken(spot)).toBe(`It's ${spot.prep} the ${spot.noun}!`);
      const frame = answerFrame(spot);
      expect(`${frame.before} ${spot.prep} ${frame.after}`).toBe(clueText(spot));
      expect(sentenceWith(spot.prep, spot)).toBe(clueText(spot));
      expect(emptyCaption(spot)).toBe(`No ghost ${spot.prep} the ${spot.noun}.`);
    });
  }

  it("uses only the four target prepositions and short familiar nouns", () => {
    for (const spot of WORLD.spots) {
      expect(["in", "on", "under", "by"]).toContain(spot.prep);
      expect(spot.noun.split(" ").length).toBeLessThanOrEqual(2);
    }
  });
});
