// Was das Gerät über sich verrät (TDD 6.6, 11.2): installierte App und iOS bzw. iPadOS.

/** Vom Home-Bildschirm gestartet; `navigator.standalone` gibt es nur auf iOS. */
export function isInstalled(): boolean {
  return (
    matchMedia("(display-mode: standalone)").matches ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}

/** iPhone, iPad oder iPod in jedem Browser; iPadOS meldet sich als Mac, hat aber einen Touchscreen. */
export function isIos(): boolean {
  return (
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}
