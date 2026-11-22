// Karte eines Sets im Auswahlmodus von Bibliothek und Archiv (TDD 13.1, D-72): Die ganze Fläche ist
// das Häkchen; Titel und Angaben bilden seinen Namen.
import type { StoredSet } from "../../domain/model";
import { h } from "../dom";

export function pickCard(
  set: StoredSet,
  detail: string,
  checked: boolean,
  onToggle: (on: boolean) => void,
): Node {
  const box: HTMLInputElement = h("input", {
    type: "checkbox",
    "data-set": set.id,
    checked,
    onchange: () => onToggle(box.checked),
  });
  return h(
    "li",
    { class: "setcard pick" },
    h(
      "label",
      null,
      h(
        "span",
        { class: "text" },
        h("span", { class: "title" }, set.title),
        " ",
        h("span", { class: "count" }, detail),
      ),
      box,
    ),
  );
}

/** Nach dem Neuzeichnen: Fokus wieder auf das Häkchen dieses Sets. */
export function focusPick(within: Element, setId: string): void {
  within.querySelector<HTMLElement>(`input[data-set="${CSS.escape(setId)}"]`)?.focus();
}
