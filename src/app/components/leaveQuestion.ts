// Frage beim Verlassen eines Formulars mit ungespeicherten Änderungen (TDD 10): „Speichern“,
// „Verwerfen“ oder „Weiter bearbeiten“. Erscheint nach der Zurück-Taste (components/unsavedGuard.ts).
import { focusSoon, h } from "../dom";

export interface LeaveChoices {
  save: () => void;
  discard: () => void;
  stay: () => void;
}

/** Der Text bekommt den Fokus, damit Screenreader die Frage vorlesen. */
export function leaveQuestion(text: string, choices: LeaveChoices): HTMLElement {
  const question = h("p", null, text);
  const button = (label: string, onclick: () => void, secondary = true) =>
    h("button", { type: "button", class: secondary ? "secondary" : null, onclick }, label);
  focusSoon(question);
  return h(
    "div",
    { class: "confirm" },
    question,
    h(
      "div",
      { class: "actions" },
      button("Speichern", choices.save, false),
      button("Verwerfen", choices.discard),
      button("Weiter bearbeiten", choices.stay),
    ),
  );
}
