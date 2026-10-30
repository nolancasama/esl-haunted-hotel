import { describe, expect, it } from "vitest";
import { DOORS, FLOOR_Y, GUEST_ROOMS, PASSAGE_RECT, ROOMS, STAIRS, WALL_LINES, WING, WING_RECT, inGuestWing, roomAt } from "./rooms";
import { WORLD } from "./world";

const wingRoom = (r: string | null) => r === "wingpassage" || inGuestWing(r);

describe("the Guest Wing's place in the hotel", () => {
  it("only the wing's own walls carry the \"gw-\" prefix the renderer culls by (the front walls never do)", () => {
    for (const line of WALL_LINES) {
      const own = [line.neg, line.pos].some(wingRoom) && ![line.neg, line.pos].some((r) => r !== null && !wingRoom(r));
      expect(line.id.startsWith("gw-"), line.id).toBe(own);
    }
    // The ground floor's west walls, with the front door, are ordinary walls.
    for (const id of ["w-bed", "w-lob", "w-lib"]) expect(WALL_LINES.find((l) => l.id === id)?.floor).toBe(0);
  });

  it("is upstairs at the back: east of the landing, straight across from the top of the stairs", () => {
    expect(PASSAGE_RECT.x0).toBe(8);
    expect(WING_RECT.x0).toBe(PASSAGE_RECT.x1);
    expect(roomAt(STAIRS.walk.x1 + 0.5, 0, 1)).toBe("landing");
    expect(roomAt(10, 0, 1)).toBe("wingpassage");
    expect(roomAt(WING.x0 + 1, 0, 1)).toBe("guesthall");
    const doors = DOORS.find((d) => d.id === "guestwing")!;
    expect(doors.axis).toBe("z");
    expect(doors.at - STAIRS.rect.x1).toBeGreaterThan(5);
    // Nothing of the wing downstairs, and nothing west of the hotel.
    for (const id of ["wingpassage", "guesthall", ...GUEST_ROOMS] as const) {
      expect(ROOMS[id].floor).toBe(1);
      expect(ROOMS[id].bounds.x0).toBeGreaterThanOrEqual(8);
    }
    expect(WORLD.objects.filter((o) => o.floor === 0).every((o) => o.rect.x1 <= 8.2)).toBe(true);
  });

  it("the landing keeps its west window and gains an open archway (no door) in the east wall", () => {
    const west = WALL_LINES.find((l) => l.id === "u-w-lan")!;
    expect(west.openings?.some((o) => o.bottom !== undefined)).toBe(true);
    const east = WALL_LINES.find((l) => l.id === "u-e-lan")!;
    expect(east.openings).toEqual([{ from: WING.arch.from, to: WING.arch.to, top: WING.arch.top }]);
    expect(WORLD.objectById.get("landing.window")).toMatchObject({ x: -7.9, rot: 90 });
    expect(FLOOR_Y[1]).toBeGreaterThan(0);
  });
});
