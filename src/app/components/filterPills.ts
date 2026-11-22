// Filter als Pillen (TDD 13.1, D-72): Sprache in der Bibliothek, Lernstufe im Archiv. Optionsfelder
// statt Schaltflächen, damit Pfeiltasten wechseln und Screenreader die Wahl ansagen.
import { h } from "../dom";

export interface FilterOption {
  /** `null` steht für „Alle“. */
  value: string | null;
  label: string;
  count: number;
}

let counter = 0;

/** Nach einer Wahl zeichnet die Ansicht neu; `focusChosen` setzt den Fokus wieder auf die Wahl. */
export function filterPills(
  label: string,
  options: readonly FilterOption[],
  current: string | null,
  onChoose: (value: string | null) => void,
): HTMLElement {
  const name = `filter-${++counter}`;
  return h(
    "div",
    { class: "filters", role: "radiogroup", "aria-label": label },
    options.map((option) =>
      h(
        "label",
        { class: "filter" },
        h("input", {
          type: "radio",
          name,
          value: option.value ?? "",
          checked: option.value === current,
          onchange: () => onChoose(option.value),
        }),
        // Ohne Flex: Ein Flex-Container verschluckte das Leerzeichen vor der Zahl (auch im Namen).
        h("span", null, option.label, " ", h("small", null, String(option.count))),
      ),
    ),
  );
}

/** Fokus auf die gewählte Pille nach dem Neuzeichnen. */
export function focusChosen(within: Element): void {
  within.querySelector<HTMLInputElement>(".filters input:checked")?.focus();
}
