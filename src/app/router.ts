// Hash-Routing (TDD 3.2): funktioniert in einer einzelnen HTML-Datei unter jedem Pfad.

/**
 * `signal` wird abgebrochen, sobald die Ansicht verlassen wird oder das Routing endet. `param` ist
 * bei Routen mit abschließendem `/` (z. B. `/set/`) der Rest des Pfads, sonst leer.
 */
export type View = (signal: AbortSignal, param: string) => Node;

/**
 * Feste Pfade haben einen Teil (`/import`). Ein Schlüssel wie `/set/` nimmt genau einen weiteren,
 * nicht leeren Pfadteil als Parameter an; ohne ihn ist er nicht erreichbar.
 */
function resolve(path: string, routes: Record<string, View>): [View, string] | null {
  const slash = path.lastIndexOf("/");
  if (slash === 0) {
    const view = routes[path];
    return view ? [view, ""] : null;
  }
  const view = routes[path.slice(0, slash + 1)];
  const rest = path.slice(slash + 1);
  if (!view || rest === "") return null;
  try {
    return [view, decodeURIComponent(rest)];
  } catch {
    // Kaputte Prozentkodierung, z. B. von Hand eingetippt.
    return null;
  }
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
    const [view, param] = resolve(path, routes) ?? [notFound, ""];
    root.replaceChildren(view(leave.signal, param));
  };
  window.addEventListener("hashchange", render);
  render();
  return () => {
    window.removeEventListener("hashchange", render);
    leave?.abort();
  };
}
