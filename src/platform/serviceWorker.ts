// Service Worker registrieren und neue Versionen melden (TDD 5.2, 5.3).
// Im Dev-Server bleibt er aus, damit Änderungen sofort sichtbar sind.

/** Aktiviert die wartende Version und lädt die App danach neu. */
export type ActivateUpdate = () => void;

export function registerServiceWorker(onUpdateReady: (activate: ActivateUpdate) => void): void {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  const container = navigator.serviceWorker;
  let reloadRequested = false;

  // Nur der Tab, in dem bestätigt wurde, lädt neu; andere Tabs könnten mitten in einer Sitzung sein.
  container.addEventListener("controllerchange", () => {
    if (reloadRequested) location.reload();
  });

  const offer = (worker: ServiceWorker) => {
    onUpdateReady(() => {
      reloadRequested = true;
      // Hat ein anderer Tab die Version schon aktiviert, genügt Neuladen.
      if (worker.state === "installed") worker.postMessage({ type: "SKIP_WAITING" });
      else location.reload();
    });
  };

  const register = async () => {
    // Relativ: Der Gültigkeitsbereich ist das Verzeichnis der App, auch unter einem Unterpfad.
    const registration = await container.register("./sw.js");
    // Ohne steuernden Service Worker ist es die erste Installation, kein Update.
    if (registration.waiting && container.controller) offer(registration.waiting);
    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      worker?.addEventListener("statechange", () => {
        if (worker.state === "installed" && container.controller) offer(worker);
      });
    });

    const checkForUpdate = () => registration.update().catch(() => {}); // offline: nächster Versuch später
    if (registration.active) void checkForUpdate();
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") void checkForUpdate();
    });
  };
  register().catch((error: unknown) => {
    console.warn("Service Worker konnte nicht registriert werden", error);
  });
}
