import { describe, expect, it } from "vitest";
import { detectPreps, judgeSpeech } from "./speechMatch";

describe("detectPreps", () => {
  it("finds prepositions in order", () => {
    expect(detectPreps("It's under the bed")).toEqual(["under"]);
    expect(detectPreps("it's on the... no, in the box")).toEqual(["on", "in"]);
    expect(detectPreps("IT'S BY THE WINDOW!")).toEqual(["by"]);
  });

  it("knows common mishearings and equivalents", () => {
    expect(detectPreps("it's bye the window")).toEqual(["by"]);
    expect(detectPreps("its buy the window")).toEqual(["by"]);
    expect(detectPreps("it's next to the window")).toEqual(["by"]);
    expect(detectPreps("it's ander the bed")).toEqual(["under"]);
    expect(detectPreps("inside the box")).toEqual(["in"]);
  });

  it("does not see prepositions inside other words", () => {
    expect(detectPreps("window bed box desk table piano basket")).toEqual([]);
    expect(detectPreps("bookshelf clock chair shelf")).toEqual([]);
  });
});

describe("judgeSpeech", () => {
  it("accepts the right preposition without grammar or the noun", () => {
    expect(judgeSpeech(["it's under the bed"], "under").kind).toBe("correct");
    expect(judgeSpeech(["under"], "under").kind).toBe("correct");
    expect(judgeSpeech(["Under bed."], "under").kind).toBe("correct");
    expect(judgeSpeech(["it is in the box"], "in").kind).toBe("correct");
    expect(judgeSpeech(["it's bye the window"], "by").kind).toBe("correct");
  });

  it("accepts a self-correction that contains the right word", () => {
    expect(judgeSpeech(["on the... under the bed"], "under").kind).toBe("correct");
  });

  it("rejects a different preposition and reports it", () => {
    const j = judgeSpeech(["it's on the bed"], "under");
    expect(j.kind).toBe("wrong");
    if (j.kind === "wrong") expect(j.prep).toBe("on");
  });

  it("lets only the top hypothesis judge when it heard a preposition", () => {
    expect(judgeSpeech(["it's on the box", "it's in the box"], "in").kind).toBe("wrong");
  });

  it("uses later alternatives only to rescue a result with no preposition", () => {
    expect(judgeSpeech(["it's honda bed", "it's under bed"], "under").kind).toBe("correct");
    expect(judgeSpeech(["it's honda bed", "it's on the bed"], "under").kind).toBe("wrong");
  });

  it("does not accept saying every word", () => {
    expect(judgeSpeech(["in on under by"], "by").kind).toBe("unclear");
    expect(judgeSpeech(["in on under"], "in").kind).toBe("unclear");
  });

  it("reports silence or noise as none", () => {
    expect(judgeSpeech([""], "in").kind).toBe("none");
    expect(judgeSpeech([], "in").kind).toBe("none");
    expect(judgeSpeech(["the bed"], "in").kind).toBe("none");
  });
});
