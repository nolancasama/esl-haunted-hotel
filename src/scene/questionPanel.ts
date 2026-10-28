/** Screen-space placement of an English speech panel beside a projected 3D ghost.
 * Coordinates are relative to the Hide & Seek overlay, not the browser window.
 */
export interface QuestionPanelPlacement {
  x: number;
  /** Vertical centre of the panel (CSS uses translateY(-50%)). */
  y: number;
  side: "left" | "right";
}
export interface QuestionPanelGeometry {
  ghostX: number;
  ghostY: number;
  panelWidth: number;
  panelHeight: number;
  width: number;
  height: number;
}
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** Prefer a panel to the right of the ghost, switch to the left if necessary.
 * Never put the panel outside the viewport; favour a visible ghost over perfect centering.
 */
export function placeQuestionPanel(g: QuestionPanelGeometry): QuestionPanelPlacement {
  const margin = 8;
  const gap = clamp(g.width * 0.035, 28, 48);
  const availableWidth = Math.max(0, g.width - margin * 2);
  const panelWidth = Math.min(Math.max(0, g.panelWidth), availableWidth);
  const panelHeight = Math.min(Math.max(0, g.panelHeight), Math.max(0, g.height - margin * 2));
  const rightX = g.ghostX + gap;
  const leftX = g.ghostX - gap - panelWidth;
  const rightFits = rightX + panelWidth <= g.width - margin;
  const leftFits = leftX >= margin;
  const side = rightFits || (!leftFits && (g.width - g.ghostX >= g.ghostX)) ? "right" : "left";
  const x = clamp(side === "right" ? rightX : leftX, margin, Math.max(margin, g.width - panelWidth - margin));
  const y = clamp(g.ghostY, panelHeight / 2 + margin, Math.max(panelHeight / 2 + margin, g.height - panelHeight / 2 - margin));
  return { x, y, side };
}
