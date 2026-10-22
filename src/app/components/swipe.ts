// Wischen auf einer Karte (TDD 12.3, FR-09): Eine Geste gilt als Wischen, wenn sie mindestens 80 px und
// überwiegend waagerecht verläuft; jede Geste löst höchstens einen Aufruf aus. Senkrechtes Scrollen
// bleibt dank `touch-action: pan-y` beim Browser, der die Geste dann mit `pointercancel` abbricht.

export type SwipeDirection = "left" | "right";

/** Mindestweg in CSS-Pixeln, wie im Prototyp. */
export const SWIPE_DISTANCE = 80;

const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Mit `follow` folgt das Element dem Finger, außer bei reduzierter Bewegung. */
export function onSwipe(
  element: HTMLElement,
  handler: (direction: SwipeDirection) => void,
  follow = false,
): void {
  let start: { x: number; y: number; pointerId: number } | null = null;
  const reset = () => {
    start = null;
    element.style.transform = "";
  };
  element.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    start = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    // Auch wenn der Finger die Karte verlässt, bleibt die Geste bei ihr.
    element.setPointerCapture(event.pointerId);
  });
  element.addEventListener("pointermove", (event) => {
    if (!start || event.pointerId !== start.pointerId || !follow || reducedMotion()) return;
    element.style.transform = `translateX(${event.clientX - start.x}px)`;
  });
  element.addEventListener("pointercancel", reset);
  element.addEventListener("pointerup", (event) => {
    if (!start || event.pointerId !== start.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    reset();
    if (Math.abs(dx) >= SWIPE_DISTANCE && Math.abs(dx) > Math.abs(dy)) {
      handler(dx > 0 ? "right" : "left");
    }
  });
}
