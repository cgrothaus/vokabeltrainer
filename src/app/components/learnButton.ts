// Schaltfläche „Lernen“ für Bibliothek und Set-Ansicht. Scheitert der Start, erscheint der Hinweis in
// `problem`, und die Schaltfläche wird wieder bedienbar.
import type { StoredSet } from "../../domain/model";
import { h } from "../dom";

const NOT_STARTED =
  "Die Lernsitzung konnte nicht gestartet werden. Lade die Seite neu und versuche es noch einmal.";

export function learnButton(
  set: StoredSet,
  /** Legt die Sitzung an und wechselt zu ihr; lehnt ab, wenn das Speichern scheitert. */
  startPractice: (set: StoredSet) => Promise<void>,
  problem: HTMLElement,
): HTMLButtonElement {
  const button = h(
    "button",
    {
      type: "button",
      // Der sichtbare Text steckt im Namen, damit auch Sprachsteuerung „Lernen“ findet.
      "aria-label": `${set.title} lernen`,
      onclick: async () => {
        button.disabled = true;
        problem.textContent = "";
        try {
          await startPractice(set);
        } catch (error) {
          console.error("Sitzung nicht gestartet", error);
          problem.textContent = NOT_STARTED;
          button.disabled = false;
        }
      },
    },
    "Lernen",
  );
  return button;
}
