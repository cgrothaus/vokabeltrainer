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
function resolve(
  path: string,
  routes: Record<string, View>,
): [pattern: string, View, string[]] | null {
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
    if (matches) return [pattern, view, params];
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
 * Beim Neuzeichnen (`redrawn`) bleibt die Scrollposition, und den Fokus bekommt die Überschrift nur,
 * wenn er vorher in der Ansicht lag.
 */
function announce(root: HTMLElement, signal: AbortSignal, home: boolean, redrawn?: Redrawn): void {
  const attempt = (): boolean => {
    const heading = root.querySelector("h1");
    if (!heading) return false;
    const name = heading.textContent?.trim();
    document.title = home || !name || name === APP_TITLE ? APP_TITLE : `${name} – ${APP_TITLE}`;
    if (!root.contains(document.activeElement) && (!redrawn || redrawn.hadFocus)) {
      if (!heading.hasAttribute("tabindex")) heading.tabIndex = -1;
      heading.focus({ preventScroll: redrawn !== undefined });
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

/** Was beim Neuzeichnen wiederhergestellt wird; aufklappbare Abschnitte nur, wenn sie eine `id` haben. */
interface Redrawn {
  scrollY: number;
  hadFocus: boolean;
  openDetails: string[];
}

/**
 * Die neu gezeichnete Ansicht lädt ihren Inhalt nach und ist anfangs kürzer: Aufgeklappte Abschnitte
 * werden wieder geöffnet und die alte Position wieder eingenommen, sobald die Seite lang genug ist,
 * längstens für zwei Sekunden.
 */
function restore(root: HTMLElement, signal: AbortSignal, redrawn: Redrawn): void {
  // Fertig erst, wenn alle Abschnitte wieder da sind; die Ansicht zeichnet ihren Inhalt oft später.
  const reached = () => {
    let found = 0;
    for (const id of redrawn.openDetails) {
      const details = document.getElementById(id);
      if (!(details instanceof HTMLDetailsElement) || !root.contains(details)) continue;
      details.open = true;
      found++;
    }
    scrollTo(0, redrawn.scrollY);
    return found === redrawn.openDetails.length && Math.abs(scrollY - redrawn.scrollY) < 1;
  };
  if (reached()) return;
  const observer = new MutationObserver(() => reached() && observer.disconnect());
  observer.observe(root, { childList: true, subtree: true });
  signal.addEventListener("abort", () => observer.disconnect());
  setTimeout(() => observer.disconnect(), 2000);
}

export interface Router {
  /** Beendet das Routing, z. B. wenn die Datenbank nicht mehr nutzbar ist. */
  stop: () => void;
  /**
   * Zeichnet die aktuelle Ansicht neu, wenn ihr Muster in `redrawable` steht, z. B. nach einer
   * Änderung in einem anderen Tab (TDD 3.4). Ein verborgener Tab zeichnet erst, wenn er sichtbar wird.
   */
  refresh: () => void;
}

/**
 * `redrawable`: Muster reiner Leseansichten. Formulare, Sitzung, Import und Backup zeichnen sich nie
 * von selbst neu, sonst gingen Eingaben verloren.
 */
export function startRouter(
  root: HTMLElement,
  routes: Record<string, View>,
  notFound: View,
  redrawable: string[] = [],
): Router {
  let leave: AbortController | null = null;
  let current: string | null = null;
  let stale = false;
  const render = (redraw = false) => {
    const redrawn = redraw
      ? {
          scrollY,
          hadFocus: root.contains(document.activeElement),
          openDetails: [...root.querySelectorAll("details[open][id]")].map((details) => details.id),
        }
      : undefined;
    stale = false;
    leave?.abort();
    leave = new AbortController();
    const path = location.hash.slice(1) || "/";
    const [pattern, view, params] = resolve(path, routes) ?? [null, notFound, []];
    current = pattern;
    if (!redraw) shownViews++;
    root.replaceChildren(view(leave.signal, ...params));
    announce(root, leave.signal, path === "/", redrawn);
    if (redrawn) restore(root, leave.signal, redrawn);
  };
  const navigate = () => render();
  const redrawIfStale = () => {
    if (stale && !document.hidden && current !== null && redrawable.includes(current)) render(true);
  };
  window.addEventListener("hashchange", navigate);
  document.addEventListener("visibilitychange", redrawIfStale);
  render();
  return {
    stop: () => {
      window.removeEventListener("hashchange", navigate);
      document.removeEventListener("visibilitychange", redrawIfStale);
      leave?.abort();
    },
    refresh: () => {
      stale = true;
      redrawIfStale();
    },
  };
}
