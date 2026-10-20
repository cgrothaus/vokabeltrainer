// Hash-Routing (TDD 3.2): funktioniert in einer einzelnen HTML-Datei unter jedem Pfad.

/** `signal` wird abgebrochen, sobald die Ansicht verlassen wird oder das Routing endet. */
export type View = (signal: AbortSignal) => Node;

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
    const view = routes[path] ?? notFound;
    root.replaceChildren(view(leave.signal));
  };
  window.addEventListener("hashchange", render);
  render();
  return () => {
    window.removeEventListener("hashchange", render);
    leave?.abort();
  };
}
