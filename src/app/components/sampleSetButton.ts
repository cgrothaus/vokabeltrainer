// Schaltfläche „Beispielset ausprobieren“ im Empty State (TDD 13.1, 13.2). Scheitert das Laden,
// erscheint der Hinweis in `problem`, und die Schaltfläche wird wieder bedienbar.
import { h } from "../dom";
import type { SampleOutcome } from "../sampleSet";

export function sampleSetButton(
  /** Speichert das Beispielset; bei Erfolg wechselt die App zur Set-Ansicht. */
  loadSampleSet: () => Promise<SampleOutcome>,
  problem: HTMLElement,
): HTMLButtonElement {
  const button = h(
    "button",
    {
      type: "button",
      class: "secondary",
      onclick: async () => {
        button.disabled = true;
        problem.textContent = "";
        const outcome = await loadSampleSet();
        if (outcome.ok) return;
        problem.textContent = outcome.error;
        button.disabled = false;
      },
    },
    "Beispielset ausprobieren",
  );
  return button;
}
