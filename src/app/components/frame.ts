// App-Rahmen (TDD 13.7, D-45): oben die App-Leiste mit „Zurück“, dem Titel der Ansicht als `h1` (D-34)
// und höchstens zwei Symbolknöpfen, darunter der Inhalt, unten fest die Aktionsleiste mit der
// Hauptaktion. Jede Ansicht baut ihren Rahmen selbst; der Router kennt ihn nicht.
import { type Child, h } from "../dom";
import { icon, type IconName } from "../icons";
import { goBack } from "../router";

/**
 * `parent`: „Zurück“ im Verlauf, ohne vorige Ansicht zur übergeordneten (z. B. `#/`). Sonst ein
 * eigener Knopf an derselben Stelle, z. B. „Beenden“ in der Lernsitzung.
 */
export type Back = { parent: string } | { label: string; icon: IconName; onclick: () => void };

export interface FrameOptions {
  /** Ohne Titel gibt es noch keine `h1`; Ansichten, die nachladen, setzen ihn mit `setTitle`. */
  title?: string;
  back?: Back;
  /** Symbolknöpfe rechts, höchstens zwei. */
  actions?: Child[];
  /** Hauptaktion unten, z. B. „Lernen“; eine zweitrangige davor. */
  dock?: Child[];
}

export interface Frame {
  element: HTMLElement;
  /** Setzt den Titel und liefert die `h1`, z. B. für `focusSoon`. */
  setTitle: (title: string) => HTMLHeadingElement;
  setBack: (back: Back | null) => void;
  /** Ohne Inhalt verschwindet die Aktionsleiste. */
  setDock: (...children: Child[]) => void;
}

export function frame(options: FrameOptions, main: HTMLElement): Frame {
  const backSlot = h("div", { class: "back" });
  const actions = h("div", { class: "tools" }, options.actions);
  const bar = h("div", { class: "bar" }, backSlot, actions);
  let heading: HTMLHeadingElement | null = null;
  const dockBar = h("div", { class: "bar" });
  const dock = h("div", { class: "dock", hidden: true }, dockBar);
  // Die Hinweisleisten (TDD 13.1) stehen über der Aktionsleiste; dafür braucht das CSS ihre Höhe.
  const observer = new ResizeObserver(() => {
    if (dock.isConnected && !dock.hidden)
      document.documentElement.style.setProperty("--dock-height", `${dock.offsetHeight}px`);
  });
  observer.observe(dock);

  const setTitle = (title: string) => {
    if (!heading) {
      heading = h("h1", null);
      backSlot.after(heading);
    }
    heading.textContent = title;
    return heading;
  };
  const setBack = (back: Back | null) => {
    if (!back) return backSlot.replaceChildren();
    const [label, symbol, onclick] =
      "parent" in back
        ? ["Zurück", "back" as const, () => goBack(back.parent)]
        : [back.label, back.icon, back.onclick];
    backSlot.replaceChildren(
      h("button", { type: "button", class: "iconbtn", "aria-label": label, onclick }, icon(symbol)),
    );
  };
  const setDock = (...children: Child[]) => {
    // Über `h()`, damit `false` und `null` wie sonst wegfallen.
    dockBar.replaceChildren(...h("div", null, children).childNodes);
    dock.hidden = dockBar.childElementCount === 0;
  };

  if (options.title !== undefined) setTitle(options.title);
  setBack(options.back ?? null);
  setDock(...(options.dock ?? []));
  const element = h("div", { class: "screen" }, h("header", { class: "appbar" }, bar), main, dock);
  return { element, setTitle, setBack, setDock };
}

/** Symbolknopf als Link in der App-Leiste, z. B. das Zahnrad zu den Einstellungen. */
export function iconLink(href: string, label: string, symbol: IconName): HTMLAnchorElement {
  return h("a", { href, class: "iconbtn", "aria-label": label }, icon(symbol));
}
