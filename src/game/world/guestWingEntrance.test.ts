import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getGame, setGame } from "../store";
import { doorAccess } from "../guestWing";
import { WORLD } from "./world";
import { ROOM_STYLE } from "../../scene/materials";
import { PASSAGE_RECT, ROOMS, WALL_LINES, WING, roomAt, wallPieces, WALL_T } from "./rooms";

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

  it("has exactly one wall face per x=12 entry segment (no z-fighting)", () => {
    const lines = WALL_LINES.filter((line) =>
      line.floor === 1 && line.axis === "z" && line.at === WING.x0 &&
      line.from < WING.hall.z1 + 5 && line.to > WING.hall.z0 - 5);
    const byStart = lines.sort((a, b) => a.from - b.from);
    expect(byStart.map((line) => line.id)).toEqual([
      "gw-g201-west-outer", "gw-g201-west-entry", "gw-pass-doors",
      "gw-g202-west-entry", "gw-g202-west-outer"
    ]);
    expect(byStart[0].from).toBe(-6.3);
    for (let i = 0; i < byStart.length - 1; i++)
      expect(byStart[i].to, byStart[i].id).toBeCloseTo(byStart[i + 1].from);
    expect(byStart.at(-1)!.to).toBe(6.3);
    expect(byStart.find((line) => line.id === "gw-g201-west-entry")?.neg).toBe("wingpassage");
    expect(byStart.find((line) => line.id === "gw-g202-west-entry")?.neg).toBe("wingpassage");
  });

  it("trims both passage side walls flush before the door partition", () => {
    for (const id of ["gw-pass-n", "gw-pass-s"]) {
      const line = WALL_LINES.find((item) => item.id === id)!;
      const pieces = wallPieces([line]);
      expect(pieces.length).toBeGreaterThan(0);
      expect(Math.max(...pieces.map((piece) => piece.rect.x1))).toBeCloseTo(WING.x0 - WALL_T / 2);
      for (const piece of pieces) {
        expect(piece.rect.x1, piece.id).toBeLessThanOrEqual(WING.x0 - WALL_T / 2 + 0.001);
        expect(piece.rect.x0, piece.id).toBeLessThan(piece.rect.x1);
      }
    }
    // The perpendicular entrance partition begins here; no passage wall ends
    // behind or sticks through the doorway into a guest-room wall.
    const partition = wallPieces(WALL_LINES.filter((item) => item.id === "gw-pass-doors"));
    expect(partition[0].rect.x0).toBeCloseTo(WING.x0 - WALL_T / 2);
  });

  it("matches the landing wallpaper, floor grain and ambient light", () => {
    expect(ROOM_STYLE.wingpassage.wall).toEqual(ROOM_STYLE.landing.wall);
    expect(ROOM_STYLE.wingpassage.floor).toEqual(ROOM_STYLE.landing.floor);
    expect(ROOMS.wingpassage.lamp.color).toBe(ROOMS.landing.lamp.color);
    expect(ROOMS.wingpassage.lamp.intensity).toBe(ROOMS.landing.lamp.intensity);
  });

  it("moves both pots to the actual new vestibule corners", () => {
    expect(WORLD.objectById.has("landing.plant3")).toBe(false);
    expect(WORLD.objectById.has("landing.plant4")).toBe(false);
    for (const [id, z] of [["wingpassage.plantN", -3.35], ["wingpassage.plantS", 3.35]] as const) {
      expect(WORLD.objectById.get(id), id).toMatchObject({ room: "wingpassage", x: 11.35, z });
    }
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
