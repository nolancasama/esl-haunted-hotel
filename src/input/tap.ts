/** Maximum pointer travel, including a drag that returns to its starting point. */
export const tapGesture = { x: 0, y: 0, started: 0, travel: 0, pointers: 0, cancelled: false };

export function isCanvasTap(delta: number): boolean {
  return delta <= 8 && tapGesture.travel <= 8 && !tapGesture.cancelled;
}
