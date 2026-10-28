/** Position a question card outside the visible screen-space outline of its ghost. */
export interface QuestionPanelGeometry {
  ghostLeft: number;
  ghostRight: number;
  ghostY: number;
  panelWidth: number;
  panelHeight: number;
  width: number;
  height: number;
}
export interface QuestionPanelPlacement {
  x: number;
  /** Vertical centre for CSS translateY(-50%). */
  y: number;
  side: "left" | "right";
}
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** Prefer the right but flip when the ghost's complete silhouette would be covered.
 * The fallback picks the side with the most available room.
 */
export function placeQuestionPanel(g: QuestionPanelGeometry): QuestionPanelPlacement {
  const margin = 8;
  const gap = clamp(g.width * 0.022, 17, 26);
  const panelWidth = Math.min(Math.max(0, g.panelWidth), Math.max(0, g.width - 2 * margin));
  const panelHeight = Math.min(Math.max(0, g.panelHeight), Math.max(0, g.height - 2 * margin));
  const leftSpace = g.ghostLeft - gap - margin;
  const rightSpace = g.width - margin - g.ghostRight - gap;
  const rightFits = rightSpace >= panelWidth;
  const leftFits = leftSpace >= panelWidth;
  const side = rightFits || (!leftFits && rightSpace >= leftSpace) ? "right" : "left";
  const x = clamp(side === "right" ? g.ghostRight + gap : g.ghostLeft - gap - panelWidth,
    margin, Math.max(margin, g.width - panelWidth - margin));
  const y = clamp(g.ghostY, panelHeight / 2 + margin,
    Math.max(panelHeight / 2 + margin, g.height - panelHeight / 2 - margin));
  return { x, y, side };
}
