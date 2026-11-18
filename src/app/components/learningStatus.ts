// Lernstand als kurze Zeile mit Balken (TDD 12.6, 13.7): in der Bibliothek je Set, in der Set-Ansicht
// je Sektion. Der Balken ist Schmuck; die Quote steht immer auch als Text daneben (13.4).
import { describeDay, firstAttemptRate, type Overview } from "../../domain/stats";
import { type Child, h } from "../dom";

/** Balken für eine Quote in Prozent. */
export function track(percent: number): HTMLElement {
  const fill = h("span", null);
  fill.style.width = `${percent}%`;
  return h("span", { class: "track", "aria-hidden": "true" }, fill);
}

/** Inhalt der Zeile in der Bibliothek: „zuletzt gestern“, Balken, „63 %“ bzw. „Neu“. */
export function libraryStatus(overview: Overview, now: Date): Child[] {
  if (overview.sessions === 0 || !overview.lastAt)
    return [h("span", { class: "new" }, "Neu"), " ", h("span", null, "· noch nicht gelernt")];
  const percent = firstAttemptRate(overview);
  return [
    h("span", null, `zuletzt ${describeDay(overview.lastAt, now)}`),
    // Leerzeichen trennen die Teile im vorgelesenen Text; im Flex-Container fallen sie optisch weg.
    percent !== null && [
      " ",
      track(percent),
      " ",
      // Vorgelesen als „63 % beim ersten Mal gewusst“; sichtbar reicht die Zahl neben dem Balken.
      h(
        "span",
        null,
        `${percent} %`,
        h("span", { class: "visually-hidden" }, " beim ersten Mal gewusst"),
      ),
    ],
  ];
}
