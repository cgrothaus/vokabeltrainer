// Hash-Routing (TDD 3.2): funktioniert in einer einzelnen HTML-Datei unter jedem Pfad.

/**
 * `signal` wird abgebrochen, sobald die Ansicht verlassen wird oder das Routing endet. `params` sind
 * die Pfadteile an den Stellen mit `*` im Muster, dekodiert.
 */
export type View = (signal: AbortSignal, ...params: string[]) => Node;

/**
 * Muster sind Pfade wie `/import`; `*` steht für genau einen nicht leeren Pfadteil, z. B. `/set/*`,
 * auch mehrfach (Eintragseditor: Set und Eintrag). Passt die Zahl der Teile nicht, ist die Route nicht
 * erreichbar.
 */
function resolve(path: string, routes: Record<string, View>): [View, string[]] | null {
  const parts = path.split("/");
  for (const [pattern, view] of Object.entries(routes)) {
    const keys = pattern.split("/");
    if (keys.length !== parts.length) continue;
    const params: string[] = [];
    const matches = keys.every((key, index) => {
      const part = parts[index]!;
      if (key !== "*") return key === part;
      if (part === "") return false;
      try {
        params.push(decodeURIComponent(part));
        return true;
      } catch {
        // Kaputte Prozentkodierung, z. B. von Hand eingetippt.
        return false;
      }
    });
    if (matches) return [view, params];
  }
  return null;
}

/** Wie viele Ansichten seit dem Start gezeigt wurden; ab zwei liegt eine davon im Verlauf davor. */
let shownViews = 0;

/** Ob die aktuelle Ansicht nicht die erste seit dem Laden ist, z. B. für „Zurück“ statt eines Links. */
export function hasPreviousView(): boolean {
  return shownViews > 1;
}

const APP_TITLE = "Vokabeltrainer";

/**
 * Nach einem Wechsel (TDD 13.4): Sobald die Ansicht ihre `h1` hat – manche laden erst nach –, nennt
 * der Seitentitel sie, und die Überschrift bekommt den Fokus, damit Screenreader die neue Seite
 * ansagen. Hat die Ansicht schon selbst etwas in sich fokussiert (Karte, Meldung), bleibt es dabei.
 */
function announce(root: HTMLElement, signal: AbortSignal, home: boolean): void {
  const attempt = (): boolean => {
    const heading = root.querySelector("h1");
    if (!heading) return false;
    const name = heading.textContent?.trim();
    document.title = home || !name || name === APP_TITLE ? APP_TITLE : `${name} – ${APP_TITLE}`;
    if (!root.contains(document.activeElement)) {
      if (!heading.hasAttribute("tabindex")) heading.tabIndex = -1;
      heading.focus();
    }
    return true;
  };
  // Nach den Mikrotasks der Ansicht, die ihren eigenen Fokus erst nach dem Einhängen setzen.
  queueMicrotask(() => {
    if (signal.aborted || attempt()) return;
    const observer = new MutationObserver(() => attempt() && observer.disconnect());
    observer.observe(root, { childList: true, subtree: true });
    signal.addEventListener("abort", () => observer.disconnect());
  });
}

/** Liefert eine Funktion, die das Routing beendet, z. B. wenn die Datenbank nicht mehr nutzbar ist. */
export function startRouter(
  root: HTMLElement,
  routes: Record<string, View>,
  notFound: View,
): () => void {
  let leave: AbortController | null = null;
  const render = () => {
    leave?.abort();
    leave = new AbortController();
    const path = location.hash.slice(1) || "/";
    const [view, params] = resolve(path, routes) ?? [notFound, []];
    shownViews++;
    root.replaceChildren(view(leave.signal, ...params));
    announce(root, leave.signal, path === "/");
  };
  window.addEventListener("hashchange", render);
  render();
  return () => {
    window.removeEventListener("hashchange", render);
    leave?.abort();
  };
}
