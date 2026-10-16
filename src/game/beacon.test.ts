import { describe, expect, it } from "vitest";
import { BEACON_RADIUS, beaconSpot, cancelsAutoEntry, withinBeacon } from "./beacon";
import { DOORS } from "./world/rooms";

describe("beacon entry", () => {
  it("matches the ring's outer radius and floor", () => {
    const spot = beaconSpot("bedroom")!;
    expect(withinBeacon(spot.x + BEACON_RADIUS - 0.001, spot.z, 0, spot)).toBe(true);
    expect(withinBeacon(spot.x + BEACON_RADIUS + 0.001, spot.z, 0, spot)).toBe(false);
    expect(withinBeacon(spot.x, spot.z, 1, spot)).toBe(false);
    expect(beaconSpot("missing")).toBeNull();
  });

  it("points across every room threshold and up the stairs", () => {
    for (const d of DOORS.filter((d) => d.id !== "entrance" && d.id !== "stairs")) {
      const s = beaconSpot(d.id)!;
      const normal = d.axis === "x" ? s.z : s.x;
      const end = normal + (d.axis === "x" ? s.dirZ : s.dirX) * 1.7;
      expect(Math.abs(end - d.at)).toBeCloseTo(1);
      expect((normal - d.at) * (end - d.at)).toBeLessThan(0);
    }
    expect(beaconSpot("stairs")).toMatchObject({ dirX: 1, dirZ: 0, floor: 0 });
  });

  it("keeps held input toward the room or sideways (walking along the wall), cancels clearly away, ignores idle", () => {
    const auto = { dirX: 0, dirZ: -1 };
    expect(cancelsAutoEntry(0, -1, auto)).toBe(false);
    expect(cancelsAutoEntry(0.5, -0.1, auto)).toBe(false);
    expect(cancelsAutoEntry(0, 0, auto)).toBe(false);
    expect(cancelsAutoEntry(1, 0, auto)).toBe(false);
    expect(cancelsAutoEntry(-1, 0, auto)).toBe(false);
    expect(cancelsAutoEntry(0.8, 0.2, auto)).toBe(false);
    expect(cancelsAutoEntry(0, 1, auto)).toBe(true);
    expect(cancelsAutoEntry(0.5, 0.8, auto)).toBe(true);
  });
});
