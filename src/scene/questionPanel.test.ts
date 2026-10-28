import { describe, expect, it } from "vitest";
import { placeQuestionPanel } from "./questionPanel";

describe("ghost-anchored English question", () => {
  it.each([
    [1366, 768, 445, 390, 370, 335],
    [1024, 600, 340, 280, 370, 350],
    [844, 390, 281, 195, 350, 350]
  ])("keeps the speech panel directly beside the ghost at %ix%i", (width, height, ghostX, ghostY, panelWidth, panelHeight) => {
    const at = placeQuestionPanel({ width, height, ghostX, ghostY, panelWidth, panelHeight });
    expect(at.side).toBe("right");
    expect(at.x - ghostX).toBeGreaterThanOrEqual(28);
    expect(at.x - ghostX).toBeLessThanOrEqual(48);
    expect(at.x + panelWidth).toBeLessThanOrEqual(width - 8);
    expect(at.y - panelHeight / 2).toBeGreaterThanOrEqual(8);
    expect(at.y + panelHeight / 2).toBeLessThanOrEqual(height - 8);
  });

  it("switches to the left rather than pinning the panel to the screen edge", () => {
    const at = placeQuestionPanel({
      width: 1024, height: 600, ghostX: 880, ghostY: 265,
      panelWidth: 370, panelHeight: 380
    });
    expect(at.side).toBe("left");
    expect(880 - (at.x + 370)).toBeGreaterThanOrEqual(28);
    expect(at.x).toBeGreaterThanOrEqual(8);
  });

  it("clamps the vertical position when the ghost is near the ceiling or floor", () => {
    for (const ghostY of [-50, 900]) {
      const at = placeQuestionPanel({ width: 844, height: 390, ghostX: 280, ghostY,
        panelWidth: 350, panelHeight: 365 });
      expect(at.y - 365 / 2).toBeGreaterThanOrEqual(8);
      expect(at.y + 365 / 2).toBeLessThanOrEqual(390 - 8);
    }
  });

  it("keeps the speech panel visible when neither side has enough room", () => {
    const at = placeQuestionPanel({ width: 500, height: 400, ghostX: 260, ghostY: 200,
      panelWidth: 310, panelHeight: 200 });
    expect(at.x).toBeGreaterThanOrEqual(8);
    expect(at.x + 310).toBeLessThanOrEqual(500 - 8);
  });
});
