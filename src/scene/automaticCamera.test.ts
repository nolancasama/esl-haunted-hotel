import { describe, expect, it } from "vitest";
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
    expect(landing.yaw).not.toBe(vestibule.yaw);
    expect(vestibule.yaw).toBe(corridor.yaw);
    expect(guest201.yaw).toBe(0);
    expect(guest202.yaw).toBe(Math.PI);
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
