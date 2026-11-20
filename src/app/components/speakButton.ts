// Lautsprecher-Knopf an einem Wort der Lernsprache (TDD 12.11, FR-40): in der Lernsitzung und in der
// Set-Ansicht. Er erscheint nur, wenn das Gerät eine passende Stimme hat.
import type { Say } from "../../platform/speech";
import { h } from "../dom";
import { icon } from "../icons";

export function speakButton(text: string, say: Say): HTMLButtonElement {
  return h(
    "button",
    {
      type: "button",
      class: "iconbtn speak",
      "aria-label": `„${text}“ vorlesen`,
      onclick: (event: Event) => {
        // Auf der Karteikarte deckte der Klick sonst auch auf.
        event.stopPropagation();
        say(text);
      },
    },
    icon("speaker"),
  );
}
