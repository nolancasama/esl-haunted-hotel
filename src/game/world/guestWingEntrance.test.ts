import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getGame, setGame } from "../store";
import { doorAccess } from "../guestWing";
import { WORLD } from "./world";
import { PASSAGE_RECT, ROOMS, WALL_LINES, WING, roomAt } from "./rooms";

describe("Guest Wing entrance revision", () => {
  it("makes the hall entrance as wide as the upstairs landing", () => {
    expect(PASSAGE_RECT.z0).toBe(ROOMS.landing.bounds.z0);
    expect(PASSAGE_RECT.z1).toBe(ROOMS.landing.bounds.z1);
    expect(PASSAGE_RECT.x0).toBe(ROOMS.landing.bounds.x1);
    expect(PASSAGE_RECT.x1).toBe(WING.x0);
    expect(roomAt(8.5, -3.3, 1)).toBe("wingpassage");
    expect(roomAt(8.5, 3.3, 1)).toBe("wingpassage");
  });

  it("has no entrance arch, overhead header or invisible wall at the landing interface", () => {
    const walls = WALL_LINES.filter((line) => line.floor === 1 && line.axis === "z" && line.at === 8 &&
      line.to > -4 && line.from < 4);
    expect(walls).toHaveLength(0);
    expect(WALL_LINES.find((line) => line.id === "gw-pass-n")?.at).toBe(-4);
    expect(WALL_LINES.find((line) => line.id === "gw-pass-s")?.at).toBe(4);
  });

  it("removes the approach carpet and keeps the luggage trolley out of the walking lane", () => {
    expect(WORLD.objectById.has("wingpassage.runner")).toBe(false);
    const cart = WORLD.colliders.find((c) => c.id === "wingpassage.luggagecart");
    expect(cart?.floor).toBe(1);
    expect(cart!.rect.z0).toBeGreaterThan(2.5);
    expect(cart!.rect.z1).toBeLessThan(PASSAGE_RECT.z1);
    expect(cart!.rect.x0).toBeGreaterThan(PASSAGE_RECT.x0);
    expect(cart!.rect.x1).toBeLessThan(PASSAGE_RECT.x1);
  });
});

describe("Guest Wing Chapter 2 access", () => {
  const initial = { mode: getGame().mode, guestWingUnlocked: getGame().guestWingUnlocked };
  beforeEach(() => setGame({ mode: "story", guestWingUnlocked: false }));
  afterEach(() => setGame(initial));

  it("keeps the wing and guest-room doors locked until Chapter 2 is finished", () => {
    for (const id of ["guestwing", "g201", "g202", "g203", "g204", "g205", "g206"])
      expect(doorAccess(id), id).toBe("locked");
  });

  it("recognizes a completed Chapter 2 save without bypassing the Room 206 mystery key", () => {
    setGame({ guestWingUnlocked: true });
    expect(doorAccess("guestwing")).toBe("open");
    expect(doorAccess("g201")).toBe("open");
    expect(doorAccess("g206")).toBe("locked");
  });
});
