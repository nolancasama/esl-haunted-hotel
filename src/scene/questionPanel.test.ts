import { describe, expect, it } from "vitest";
import { placeQuestionPanel } from "./questionPanel";

describe("ghost silhouette-aware English question", () => {
  it.each([
    [1366, 768, 320, 525, 390, 370, 335],
    [1024, 600, 245, 410, 280, 370, 350],
    [844, 390, 215, 350, 195, 350, 350]
  ])("keeps a clear gap beyond the entire ghost outline at %ix%i", (width, height, ghostLeft, ghostRight, ghostY, panelWidth, panelHeight) => {
    const at = placeQuestionPanel({ width, height, ghostLeft, ghostRight, ghostY, panelWidth, panelHeight });
    expect(at.side).toBe("right");
    expect(at.x - ghostRight).toBeGreaterThanOrEqual(17);
    expect(at.x - ghostRight).toBeLessThanOrEqual(27);
    expect(at.x + panelWidth).toBeLessThanOrEqual(width - 8);
    expect(at.y - panelHeight / 2).toBeGreaterThanOrEqual(8);
    expect(at.y + panelHeight / 2).toBeLessThanOrEqual(height - 8);
  });

  it("flips to the left with room for the entire ghost when near the right edge", () => {
    const g = { width: 1024, height: 600, ghostLeft: 810, ghostRight: 955, ghostY: 265,
      panelWidth: 370, panelHeight: 380 };
    const at = placeQuestionPanel(g);
    expect(at.side).toBe("left");
    expect(g.ghostLeft - (at.x + g.panelWidth)).toBeGreaterThanOrEqual(17);
    expect(at.x).toBeGreaterThanOrEqual(8);
  });

  it("clamps vertically for a ghost near the top or bottom", () => {
    for (const ghostY of [-50, 900]) {
      const at = placeQuestionPanel({ width: 844, height: 390, ghostLeft: 200,
        ghostRight: 340, ghostY, panelWidth: 350, panelHeight: 365 });
      expect(at.y - 365 / 2).toBeGreaterThanOrEqual(8);
      expect(at.y + 365 / 2).toBeLessThanOrEqual(390 - 8);
    }
  });

  it("does not let the panel leave the screen on very narrow layouts", () => {
    const at = placeQuestionPanel({ width: 500, height: 400, ghostLeft: 200,
      ghostRight: 320, ghostY: 200, panelWidth: 310, panelHeight: 200 });
    expect(at.x).toBeGreaterThanOrEqual(8);
    expect(at.x + 310).toBeLessThanOrEqual(492);
  });
});
