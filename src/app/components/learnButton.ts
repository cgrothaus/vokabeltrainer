// „Lernen“ für Bibliothek und Set-Ansicht: führt zur Einrichtung der Sitzung (TDD 12.1, D-27).
import type { StoredSet } from "../../domain/model";
import { h } from "../dom";

export function learnButton(set: StoredSet): HTMLAnchorElement {
  return h(
    "a",
    {
      href: `#/learn/${encodeURIComponent(set.id)}`,
      class: "action",
      // Der sichtbare Text steckt im Namen, damit auch Sprachsteuerung „Lernen“ findet.
      "aria-label": `${set.title} lernen`,
    },
    "Lernen",
  );
}
