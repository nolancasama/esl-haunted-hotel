import { describe, expect, it } from "vitest";
import { DOORS, WALL_LINES, doorFit } from "./rooms";

const opening = (id: string) =>
  WALL_LINES.flatMap((line) => (line.openings ?? []).map((o) => ({ line, o }))).find(({ o }) => o.door === id);

describe("doors fit their openings", () => {
  const hinged = DOORS.filter((d) => d.style !== "gate");

  it("every hinged door sits in a wall opening of the same width and height", () => {
    expect(hinged.length).toBe(9);
    for (const d of hinged) {
      const hole = opening(d.id);
      expect(hole, d.id).toBeDefined();
      expect(hole!.line.floor, d.id).toBe(d.floor);
      expect(hole!.line.axis, d.id).toBe(d.axis);
      expect(hole!.line.at, d.id).toBe(d.at);
      expect([hole!.o.from, hole!.o.to], d.id).toEqual([d.from, d.to]);
      // The frame's head sits on the wall lintel: no hole above it, no frame inside the wall.
      expect(doorFit(d).head, d.id).toBe(hole!.o.top);
    }
  });

  it("a closed leaf reaches the frame head, leaving at most a hairline", () => {
    for (const d of hinged) {
      const { head, leaf } = doorFit(d);
      expect(leaf, d.id).toBeLessThan(head);
      expect(head - leaf, d.id).toBeLessThanOrEqual(0.005);
    }
  });

  it("the stairs gate is not in a wall and keeps its open bars", () => {
    const gate = DOORS.find((d) => d.id === "stairs")!;
    expect(opening("stairs")).toBeUndefined();
    expect(doorFit(gate).head - doorFit(gate).leaf).toBeCloseTo(0.04);
  });
});
