// Hash-Routing (TDD 3.2): funktioniert in einer einzelnen HTML-Datei unter jedem Pfad.

export type View = () => Node;

export function startRouter(root: HTMLElement, routes: Record<string, View>, notFound: View): void {
  const render = () => {
    const path = location.hash.slice(1) || "/";
    const view = routes[path] ?? notFound;
    root.replaceChildren(view());
  };
  window.addEventListener("hashchange", render);
  render();
}
