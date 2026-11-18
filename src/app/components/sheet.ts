// Blatt von unten (TDD 13.7, 13.4) für Rückfragen, Menüs und Anleitungen: ein modales `dialog`. Escape,
// die Zurück-Geste unter Android und Tippen daneben schließen es; der Fokus geht danach zurück zu dem,
// was es geöffnet hat. Es hängt in der Ansicht und verschwindet mit ihr.
import { type Child, h } from "../dom";

export interface SheetOptions {
  title: string;
  content: Child[];
  /** Nach dem Schließen ohne Wahl, z. B. „Abbrechen“; nicht, wenn die Ansicht verlassen wurde. */
  onDismiss?: () => void;
  /** Bekommt danach den Fokus, sonst das, was beim Öffnen fokussiert war. */
  returnTo?: HTMLElement;
  /** Bekommt beim Öffnen den Fokus statt der Überschrift, z. B. der Satz, der die Folge nennt. */
  focus?: HTMLElement;
}

export interface Sheet {
  /** Schließt nach einer Wahl; `onDismiss` läuft dann nicht. */
  close: () => void;
  /** Schließt wie Escape, z. B. mit „Abbrechen“. */
  dismiss: () => void;
}

let sheets = 0;

/** `within`: ein Element der Ansicht, an das das Blatt angehängt wird. */
export function openSheet(within: Element, options: SheetOptions): Sheet {
  const opener =
    options.returnTo ??
    (document.activeElement instanceof HTMLElement ? document.activeElement : null);
  const id = `sheet-${++sheets}`;
  // Die Überschrift oder `focus` bekommt den Fokus, damit Screenreader die Frage ansagen; die Knöpfe
  // folgen mit Tab, und eine zerstörerische Aktion lässt sich nicht versehentlich mit Enter auslösen.
  const heading = h("h2", { id }, options.title);
  const first = options.focus ?? heading;
  first.tabIndex = -1;
  first.autofocus = true;
  const dialog = h(
    "dialog",
    { class: "sheet", "aria-labelledby": id },
    h("div", { class: "sheet-body" }, h("span", { class: "grip" }), heading, options.content),
  );
  let chosen = false;
  dialog.addEventListener("close", () => {
    dialog.remove();
    if (!chosen) options.onDismiss?.();
    if (opener?.isConnected && !(opener as HTMLButtonElement).disabled) opener.focus();
  });
  // Ein Klick auf das `dialog` selbst liegt außerhalb des Inhalts, also auf dem abgedunkelten Rand.
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  within.appendChild(dialog);
  dialog.showModal();
  return {
    close: () => {
      chosen = true;
      if (dialog.open) dialog.close();
    },
    dismiss: () => {
      if (dialog.open) dialog.close();
    },
  };
}
