// „Lernen“ für die Set-Ansicht: führt zur Einrichtung der Sitzung (TDD 12.1, D-27). Mit Fälligem oder
// Neuem ist „Frei lernen“ der zweite Weg neben der Hauptaktion nach Plan (12.8, D-63).
import type { StoredSet } from "../../domain/model";
import type { PlanSummary } from "../../domain/plan";
import { type Child, h } from "../dom";

const setupHref = (set: StoredSet) => `#/learn/${encodeURIComponent(set.id)}`;

export function learnButton(set: StoredSet): HTMLAnchorElement {
  return h(
    "a",
    {
      href: setupHref(set),
      class: "action",
      // Der sichtbare Text steckt im Namen, damit auch Sprachsteuerung „Lernen“ findet.
      "aria-label": `${set.title} lernen`,
    },
    "Lernen",
  );
}

/**
 * Aktionsleiste der Set-Ansicht: „Wiederholen (12)“ bzw. „Neue Vokabeln lernen“ als Hauptaktion,
 * daneben zweitrangig „Frei lernen“; ohne Fälliges und Neues nur „Lernen“.
 */
export function learnActions(
  set: StoredSet,
  plan: PlanSummary,
  start: (button: HTMLButtonElement) => void,
): Child[] {
  if (plan.due === 0 && plan.fresh === 0) return [learnButton(set)];
  const button: HTMLButtonElement = h(
    "button",
    // Silbentrennung erlaubt: „Wiederholen“ passt bei 200 % Schrift sonst nicht in eine Zeile.
    { type: "button", class: "plan", onclick: () => start(button) },
    plan.due > 0 ? `Wiederholen (${plan.due})` : "Neue Vokabeln lernen",
  );
  return [
    h(
      "a",
      {
        href: setupHref(set),
        class: "action secondary",
        "aria-label": `${set.title} frei lernen`,
      },
      "Frei lernen",
    ),
    button,
  ];
}
