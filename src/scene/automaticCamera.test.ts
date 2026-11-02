import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { automaticView } from "./automaticCamera";

describe("automatic Story Mode camera", () => {
  it("keeps a stable view within a room; the player never supplies the camera angle", () => {
    expect(automaticView(-3, 0, 1, false)).toEqual(automaticView(-6, 1, 1, false));
    expect(automaticView(-3, 0, 1, false).zone).toBe("landing");
  });
  it("changes view between landing, Guest Wing vestibule, corridor and guest rooms", () => {
    const landing = automaticView(6, -2, 1, false);
    const vestibule = automaticView(10, -2, 1, false);
    const corridor = automaticView(14, 0, 1, false);
    const guest201 = automaticView(14, -4, 1, false);
    const guest202 = automaticView(14, 4, 1, false);
    expect([landing.zone, vestibule.zone, corridor.zone, guest201.zone, guest202.zone])
      .toEqual(["landing", "wingpassage", "guesthall", "g201", "g202"]);
    expect(landing.yaw).toBe(0);
    expect(vestibule.yaw).toBe(0);
    expect(corridor.yaw).toBe(0);
    expect(guest201.yaw).toBe(0);
    expect(guest202.yaw).toBe(Math.PI);
  });
  it("keeps the long hallway walls exactly parallel to the screen bottom", () => {
    for (const [x, z] of [[10, 0], [18, 0], [24, 0]] as const) {
      const view = automaticView(x, z, 1, false);
      // With yaw 0 the camera looks straight across the hall's z axis.
      // Two points on a wall running east-west (the x axis) must have
      // exactly the same screen-space y, with no diagonal vanishing line.
      const cam = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 100);
      const height = 1.0 + view.distance * Math.sin(view.pitch);
      cam.position.set(x, height, z + view.distance * Math.cos(view.pitch));
      cam.lookAt(x, 1.0, z);
      cam.updateMatrixWorld();
      cam.updateProjectionMatrix();
      const left = new THREE.Vector3(x - 2, 2, z - 1).project(cam);
      const right = new THREE.Vector3(x + 2, 2, z - 1).project(cam);
      expect(left.y).toBeCloseTo(right.y, 8);
      expect(left.x).toBeLessThan(right.x);
    }
  });

  it("uses an elevated side angle on the stairs then restores the landing shot", () => {
    expect(automaticView(6, 0, 1, true).zone).toBe("stairs");
    expect(automaticView(6, 0, 1, false).zone).toBe("landing");
  });
  it("preserves distinct ground-floor and upstairs room framing", () => {
    expect(automaticView(-4, -7, 0, false).zone).toBe("bedroom");
    expect(automaticView(-4, -7, 1, false).zone).toBe("playroom");
    expect(automaticView(4, 7, 1, false).zone).toBe("attic");
  });
});
