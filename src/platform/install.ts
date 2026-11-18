// Installation anbieten (TDD 5.1, FR-35, D-47): Chromium meldet mit `beforeinstallprompt`, dass sich die
// App installieren lässt. Die App unterdrückt die eigene Leiste des Browsers, hebt das Ereignis auf und
// ruft `prompt()` erst auf, wenn jemand „Installieren“ tippt. Ohne Ereignis (Safari, Firefox, schon
// installiert) gibt es kein Angebot.

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let offered: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => {
  for (const listener of listeners) listener();
};

/** Früh beim Start aufrufen; das Ereignis kann kommen, bevor die erste Ansicht steht. */
export function watchInstall(): void {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    offered = event as InstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    offered = null;
    notify();
  });
}

export function canInstall(): boolean {
  return offered !== null;
}

/**
 * Zeigt die Rückfrage des Browsers; direkt im Klick aufrufen, `prompt()` braucht die Nutzergeste. Ein
 * Ereignis lässt sich nur einmal zeigen, danach bietet der Browser es gegebenenfalls neu an.
 */
export async function install(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const event = offered;
  if (!event) return "unavailable";
  offered = null;
  const shown = event.prompt();
  notify();
  await shown;
  return (await event.userChoice).outcome;
}

/** Meldet, wenn das Angebot kommt oder entfällt; endet mit `signal`. */
export function onInstallChange(listener: () => void, signal: AbortSignal): void {
  listeners.add(listener);
  signal.addEventListener("abort", () => listeners.delete(listener));
}
