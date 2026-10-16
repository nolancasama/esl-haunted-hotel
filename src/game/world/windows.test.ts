import { describe, expect, it } from "vitest";
import { PLACEMENTS } from "./furniture";
import { ROUND_GLASS, WALL_LINES, WINDOW_GLASS } from "./rooms";
import { buildWorld } from "./world";

const windows = PLACEMENTS.filter((p) => p.kind === "window" || p.kind === "roundwindow");
const holes = WALL_LINES.flatMap((line) => (line.openings ?? []).filter((o) => o.bottom !== undefined).map((o) => ({ line, o })));

describe("real windows", () => {
  it("every window model sits in a hole in an outer wall, and every hole has a window", () => {
    expect(windows.length).toBeGreaterThan(0);
    expect(holes.length).toBe(windows.length);
    for (const w of windows) {
      const floor = w.room === "playroom" || w.room === "bathroom" || w.room === "music" || w.room === "attic" || w.room === "landing" ? 1 : 0;
      const match = holes.find(({ line, o }) => {
        const across = line.axis === "x" ? w.z : w.x;
        const along = line.axis === "x" ? w.x : w.z;
        // the model's origin is the inner wall face, 0.1 from the wall's middle
        return line.floor === floor && Math.abs(Math.abs(across - line.at) - 0.1) < 1e-6 && Math.abs(along - (o.from + o.to) / 2) < 1e-6;
      });
      expect(match, w.id).toBeTruthy();
      expect(match!.line.neg === null || match!.line.pos === null, `${w.id} is on an outer wall`).toBe(true);
      const glass = w.kind === "roundwindow" ? ROUND_GLASS : WINDOW_GLASS;
      expect(match!.o.top).toBe(glass.top);
      expect(match!.o.bottom).toBe(glass.bottom);
    }
  });

  it("a window is still a wall to walk into: the piece below it collides", () => {
    const world = buildWorld();
    for (const { line, o } of holes) {
      const mid = (o.from + o.to) / 2;
      const x = line.axis === "x" ? mid : line.at;
      const z = line.axis === "x" ? line.at : mid;
      const blocked = world.colliders.some(
        (c) => c.floor === line.floor && x > c.rect.x0 && x < c.rect.x1 && z > c.rect.z0 && z < c.rect.z1
      );
      expect(blocked, line.id).toBe(true);
    }
  });
});
