import { describe, expect, it } from "vitest";
import { FLOOR_Y, ROOMS, WALL_T } from "../world/rooms";
import { WORLD } from "../world/world";
import type { PlayRoom } from "./types";
import { cameraMode, heartbeatBpm, heartbeatGain, heartbeatLevel, hidingView, type CameraInput } from "./views";

const PLAY_ROOMS: PlayRoom[] = ["bedroom", "dining", "storage", "library", "playroom", "bathroom", "music", "attic"];
const ahead = (eye: { x: number; z: number }, yaw: number, d: number) => ({ x: eye.x + Math.sin(yaw) * d, z: eye.z + Math.cos(yaw) * d });

/** Within an object's footprint (with a margin). */
function overObject(id: string, p: { x: number; z: number }, margin = 0.02) {
  const r = WORLD.objectById.get(id)!.rect;
  return p.x > r.x0 - margin && p.x < r.x1 + margin && p.z > r.z0 - margin && p.z < r.z1 + margin;
}
/** Within an object's footprint and below its top. */
function insideObject(id: string, p: { x: number; y: number; z: number }, margin = 0.02) {
  const obj = WORLD.objectById.get(id)!;
  return overObject(id, p, margin) && p.y < obj.y + obj.spec.h;
}

describe("first-person hiding views", () => {
  for (const room of PLAY_ROOMS) {
    const spots = WORLD.spots.filter((s) => s.room === room);
    it(`${room}: every hiding place has a view that sits in open space and looks into the room`, () => {
      expect(spots.length).toBeGreaterThanOrEqual(5);
      const b = ROOMS[room].bounds;
      const floor = FLOOR_Y[ROOMS[room].floor];
      for (const spot of spots) {
        const v = hidingView(spot);
        const where = `${spot.id} eye (${v.eye.x.toFixed(2)}, ${v.eye.y.toFixed(2)}, ${v.eye.z.toFixed(2)})`;
        // Inside the room, clear of the wall thickness.
        expect(v.eye.x, where).toBeGreaterThan(b.x0 + WALL_T / 2 + 0.08);
        expect(v.eye.x, where).toBeLessThan(b.x1 - WALL_T / 2 - 0.08);
        expect(v.eye.z, where).toBeGreaterThan(b.z0 + WALL_T / 2 + 0.08);
        expect(v.eye.z, where).toBeLessThan(b.z1 - WALL_T / 2 - 0.08);
        expect(v.eye.y, where).toBeGreaterThan(floor + 0.1);
        // Never buried in another piece of furniture.
        for (const obj of WORLD.objects.filter((o) => o.room === room && o.spec.solid && !o.spec.flat)) {
          if (obj.id === spot.objectId) continue;
          expect(insideObject(obj.id, v.eye), `${where} is inside ${obj.id}`).toBe(false);
        }
        const own = WORLD.objectById.get(spot.objectId)!;
        if (spot.prep === "under") {
          expect(v.eye.y - floor, `${where} under the clearance`).toBeLessThan(own.spec.under!.clearance - 0.05);
          // A wall-mounted window's "under" space is in front of its thin frame.
          if (!own.spec.wallMounted) expect(insideObject(own.id, v.eye, 0), `${where} under its object`).toBe(true);
        }
        if (spot.prep === "in") {
          // Clock: inside the cavity. Containers: just over the inner front wall, under the lifted lid.
          const inn = own.spec.in!;
          const top = floor + inn.box.y1;
          if (own.kind === "clock") expect(v.eye.y, where).toBeLessThan(top - 0.2);
          else expect(v.eye.y - top, where).toBeLessThan(0.08);
          expect(overObject(own.id, v.eye, -0.03), `${where} within its container's walls`).toBe(true);
        }
        if (spot.prep === "on") expect(v.eye.y, where).toBeGreaterThan(own.y + own.spec.h * 0.5);
        if (spot.prep === "by") expect(insideObject(own.id, v.eye), `${where} beside, not inside`).toBe(false);
        // Looking into the room: at least two metres of open room straight ahead.
        const far = ahead(v.eye, v.yaw, 2);
        expect(far.x > b.x0 && far.x < b.x1 && far.z > b.z0 && far.z < b.z1, `${where} stares at a wall`).toBe(true);
        // Comfortable, bounded look limits.
        expect(v.yawLimit).toBeLessThanOrEqual(Math.PI / 4 + 1e-9);
        expect(v.pitchMin).toBeLessThan(v.pitch);
        expect(v.pitchMax).toBeGreaterThan(v.pitch);
        expect(v.near).toBeLessThanOrEqual(0.05);
      }
    });
  }
});

describe("hide-and-seek camera modes", () => {
  const base: CameraInput = {
    enabled: true, status: "playing", english: false, pickMode: null, decisionPhase: null,
    transit: false, holding: false, sinceEnd: 0, lossReason: null
  };
  it("hides in first person and decides Stay or Move there", () => {
    expect(cameraMode(base)).toBe("firstPerson");
    expect(cameraMode({ ...base, decisionPhase: "decision" })).toBe("firstPerson");
  });
  it("chooses the first spot, destinations and English in the overhead view", () => {
    expect(cameraMode({ ...base, status: "setup" })).toBe("overview");
    expect(cameraMode({ ...base, decisionPhase: "destination", pickMode: "move" })).toBe("destinationSelection");
    expect(cameraMode({ ...base, english: true })).toBe("destinationSelection");
    expect(cameraMode({ ...base, pickMode: "ability" })).toBe("destinationSelection");
  });
  it("follows a relocation in third person and holds the room view briefly", () => {
    expect(cameraMode({ ...base, transit: true })).toBe("relocating");
    expect(cameraMode({ ...base, holding: true })).toBe("reveal");
  });
  it("holds first person when found, then shows the ghost", () => {
    expect(cameraMode({ ...base, status: "lost", lossReason: "found", sinceEnd: 0.3 })).toBe("firstPerson");
    expect(cameraMode({ ...base, status: "lost", lossReason: "found", sinceEnd: 2 })).toBe("discovered");
    expect(cameraMode({ ...base, status: "lost", lossReason: "caughtInOpen", sinceEnd: 0 })).toBe("discovered");
    expect(cameraMode({ ...base, status: "won" })).toBe("victory");
  });
  it("keeps the original overhead view everywhere when first person is off", () => {
    for (const input of [base, { ...base, transit: true }, { ...base, status: "lost" as const, lossReason: "found" as const }]) {
      expect(cameraMode({ ...input, enabled: false })).toBe("overview");
    }
  });
});

describe("heartbeat", () => {
  it("is silent far away and rises smoothly as the detective approaches", () => {
    expect(heartbeatLevel(7)).toBe(0);
    expect(heartbeatGain(heartbeatLevel(7))).toBe(0);
    let last = -1;
    for (let d = 7; d >= 0; d -= 0.05) {
      const level = heartbeatLevel(d);
      expect(level).toBeGreaterThanOrEqual(last);
      expect(level - Math.max(0, last)).toBeLessThan(0.02);
      last = level;
    }
    expect(heartbeatGain(heartbeatLevel(6))).toBeLessThan(0.2);
    expect(heartbeatBpm(heartbeatLevel(6))).toBeLessThan(72);
    expect(heartbeatBpm(heartbeatLevel(3))).toBeGreaterThan(85);
    expect(heartbeatBpm(heartbeatLevel(3))).toBeLessThan(110);
    expect(heartbeatBpm(heartbeatLevel(0.5))).toBeGreaterThan(125);
    expect(heartbeatBpm(heartbeatLevel(0))).toBeLessThanOrEqual(130);
  });
});
