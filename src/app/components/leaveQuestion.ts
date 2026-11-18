// Frage beim Verlassen eines Formulars mit ungespeicherten Änderungen (TDD 10, 13.7) als Blatt:
// „Speichern“, „Verwerfen“ oder „Weiter bearbeiten“. Erscheint nach der Zurück-Taste
// (components/unsavedGuard.ts). Escape und Tippen daneben bedeuten „Weiter bearbeiten“.
import { h } from "../dom";
import { openSheet, type Sheet } from "./sheet";

export interface LeaveChoices {
  save: () => void;
  discard: () => void;
  stay: () => void;
}

/** Die Frage ist die Überschrift des Blatts und bekommt den Fokus, damit Screenreader sie vorlesen. */
export function leaveQuestion(within: Element, text: string, choices: LeaveChoices): Sheet {
  const button = (label: string, choice: () => void, secondary = true) =>
    h(
      "button",
      {
        type: "button",
        class: secondary ? "secondary" : null,
        onclick: () => {
          sheet.close();
          choice();
        },
      },
      label,
    );
  const sheet = openSheet(within, {
    title: text,
    content: [
      h(
        "div",
        { class: "actions" },
        button("Speichern", choices.save, false),
        button("Verwerfen", choices.discard),
        button("Weiter bearbeiten", choices.stay),
      ),
    ],
    onDismiss: choices.stay,
  });
  return sheet;
}
