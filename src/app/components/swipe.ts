// Wischen auf einer Karte (TDD 12.3, FR-09): Eine Geste gilt als Wischen, wenn sie mindestens 80 px und
// überwiegend waagerecht verläuft; jede Geste löst höchstens einen Aufruf aus. Senkrechtes Scrollen
// bleibt dank `touch-action: pan-y` beim Browser, der die Geste dann mit `pointercancel` abbricht.

export type SwipeDirection = "left" | "right";

/** Mindestweg in CSS-Pixeln, wie im Prototyp. */
export const SWIPE_DISTANCE = 80;

/** Dauer des Wegschiebens in Millisekunden. */
const FLY_OUT = 260;

export const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Verschiebt und neigt leicht, wie eine Karte, die man mit dem Finger zur Seite zieht. */
const dragged = (dx: number) =>
  `translateX(${dx}px) rotate(${Math.max(-8, Math.min(8, dx / 25))}deg)`;

/**
 * Mit `follow` folgt `moved` dem Finger, außer bei reduzierter Bewegung; als Funktion entscheidet es je
 * Geste, z. B. erst nach dem Aufdecken. `moved` kann mehr umfassen als das Element, das den Zeiger
 * einfängt. Nach einer erkannten Geste bleibt es stehen, wo der Finger es ließ (für `flyOut`); eine zu
 * kurze federt zurück.
 */
export function onSwipe(
  element: HTMLElement,
  handler: (direction: SwipeDirection) => void,
  follow: boolean | (() => boolean) = false,
  moved: HTMLElement = element,
): void {
  let start: { x: number; y: number; pointerId: number } | null = null;
  const springBack = () => {
    const from = moved.style.transform;
    moved.style.transform = "";
    if (from && !reducedMotion()) {
      moved.animate([{ transform: from }, { transform: "none" }], {
        duration: 200,
        easing: "ease-out",
      });
    }
  };
  element.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    start = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    // Auch wenn der Finger die Karte verlässt, bleibt die Geste bei ihr.
    element.setPointerCapture(event.pointerId);
  });
  element.addEventListener("pointermove", (event) => {
    if (!start || event.pointerId !== start.pointerId || reducedMotion()) return;
    if (!(typeof follow === "function" ? follow() : follow)) return;
    moved.style.transform = dragged(event.clientX - start.x);
  });
  element.addEventListener("pointercancel", () => {
    start = null;
    springBack();
  });
  element.addEventListener("pointerup", (event) => {
    if (!start || event.pointerId !== start.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    start = null;
    if (Math.abs(dx) >= SWIPE_DISTANCE && Math.abs(dx) > Math.abs(dy)) {
      handler(dx > 0 ? "right" : "left");
    } else springBack();
  });
}

/**
 * Schiebt das Element zur Seite hinaus, vom Stand des Fingers aus; erfüllt, wenn es fort ist. Es bleibt
 * danach unsichtbar, bis es ersetzt wird. Über einen Timer statt `finished`, damit es auch in einem
 * Tab im Hintergrund weitergeht.
 */
export function flyOut(element: HTMLElement, direction: SwipeDirection): Promise<void> {
  if (reducedMotion()) return Promise.resolve();
  const sign = direction === "right" ? 1 : -1;
  element.animate(
    [
      { transform: element.style.transform || "none", opacity: 1 },
      { transform: `translateX(${sign * 110}%) rotate(${sign * 10}deg)`, opacity: 0 },
    ],
    { duration: FLY_OUT, easing: "ease-in", fill: "forwards" },
  );
  return new Promise((resolve) => setTimeout(resolve, FLY_OUT));
}
