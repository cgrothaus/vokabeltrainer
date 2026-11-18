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

/**
 * Jeder Verlaufseintrag der App trägt seine Tiefe: wie viele Einträge der App davor liegen (D-48).
 * „Zurück“ geht damit nur im Verlauf zurück, wenn es dort noch eine Ansicht der App gibt, auch nach
 * Zurück, Ersetzen und Neuladen. `mark` kennzeichnet einen zusätzlichen Eintrag mit derselben
 * Adresse, auf dem Lernsitzung oder Formular liegen (D-29).
 */
interface Entry {
  depth: number;
  mark?: string;
}

const isEntry = (state: unknown): state is Entry =>
  typeof state === "object" && state !== null && typeof (state as Entry).depth === "number";

/** Tiefe des Eintrags, auf dem die App zuletzt stand; ein neuer Eintrag liegt eins tiefer. */
let depth = 0;
/** Ein `replaceRoute` läuft: Der neue Eintrag ersetzt den alten und behält dessen Tiefe. */
let replacing = false;

/** Merkt sich die Tiefe des aktuellen Eintrags und versieht einen neuen damit. */
function track(first: boolean): void {
  const state: unknown = history.state;
  if (isEntry(state)) depth = state.depth;
  else {
    if (!first && !replacing) depth++;
    history.replaceState({ depth } satisfies Entry, "");
  }
  replacing = false;
}

/** Wie viele Einträge der App im Verlauf vor dem aktuellen liegen. */
export function historyDepth(): number {
  const state: unknown = history.state;
  return isEntry(state) ? state.depth : 0;
}

/** Legt einen zusätzlichen Eintrag mit derselben Adresse an (kein `hashchange`). */
export function pushMark(mark: string): void {
  depth = historyDepth() + 1;
  history.pushState({ depth, mark } satisfies Entry, "");
}

/** Ob der aktuelle Eintrag der zusätzliche mit dieser Marke ist. */
export function hasMark(mark: string): boolean {
  const state: unknown = history.state;
  return isEntry(state) && state.mark === mark;
}

/** Wechselt die Ansicht, ohne einen Eintrag anzulegen, z. B. nach dem Abschluss eines Ablaufs (D-48). */
export function replaceRoute(hash: string): void {
  if (hash === location.hash) return;
  replacing = true;
  location.replace(hash);
}

/**
 * „Zurück“ der App-Leiste (TDD 13.7): wie der Browser im Verlauf zurück; ohne vorige Ansicht der App
 * (Einstieg per Link) zur übergeordneten Ansicht `parent`, ohne die App zu verlassen.
 */
export function goBack(parent: string): void {
  if (historyDepth() > 0) history.back();
  else replaceRoute(parent);
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
    root.replaceChildren(view(leave.signal, ...params));
    announce(root, leave.signal, path === "/", redrawn);
    if (redrawn) restore(root, leave.signal, redrawn);
  };
  const navigate = () => {
    track(false);
    render();
  };
  // Zurück und Vorwärts zwischen Einträgen derselben Adresse lösen kein `hashchange` aus.
  const popped = () => {
    const state: unknown = history.state;
    if (isEntry(state)) depth = state.depth;
  };
  const redrawIfStale = () => {
    if (stale && !document.hidden && current !== null && redrawable.includes(current)) render(true);
  };
  window.addEventListener("hashchange", navigate);
  window.addEventListener("popstate", popped);
  document.addEventListener("visibilitychange", redrawIfStale);
  track(true);
  render();
  return {
    stop: () => {
      window.removeEventListener("hashchange", navigate);
      window.removeEventListener("popstate", popped);
      document.removeEventListener("visibilitychange", redrawIfStale);
      leave?.abort();
    },
    refresh: () => {
      stale = true;
      redrawIfStale();
    },
  };
}
