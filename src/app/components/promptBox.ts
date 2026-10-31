// Vorlage für den KI-Chat zum Kopieren (TDD 13.1): für ein neues Set in der Hilfe, zum Korrigieren in
// Hilfe und Export (D-44). Scheitert das Kopieren, ist die Vorlage markiert.
import { h } from "../dom";

export interface PromptBox {
  /** Eindeutig in der Ansicht; daraus entstehen die IDs von Überschrift und Vorlage. */
  id: string;
  heading: string;
  /** Mit eingesetztem Link auf die Formatspezifikation. */
  prompt: string;
  /** Beschriftung der Schaltfläche, z. B. „Vorlage kopieren“; die Meldung danach folgt ihr. */
  label: string;
  /** Muss direkt im Klick aufgerufen werden (Nutzergeste). */
  copyText: (text: string) => Promise<boolean>;
}

const NOT_COPIED =
  "Kopieren hat nicht geklappt. Die Vorlage ist jetzt markiert – kopiere sie über das Menü deines Geräts.";

export function promptBox(box: PromptBox, ...intro: Node[]): Node {
  const text = h("pre", { class: "prompt", id: `${box.id}-prompt` }, box.prompt);
  const status = h("p", { "aria-live": "polite" });
  const done = `${box.label.replace(/ kopieren$/, "")} kopiert.`;
  const copy = h(
    "button",
    {
      type: "button",
      onclick: async () => {
        // Ohne vorheriges `await` schreiben, sonst verfällt die Nutzergeste.
        const copied = await box.copyText(box.prompt);
        status.textContent = copied ? done : NOT_COPIED;
        if (!copied) getSelection()?.selectAllChildren(text);
      },
    },
    box.label,
  );
  return h(
    "section",
    { "aria-labelledby": `${box.id}-heading` },
    h("h2", { id: `${box.id}-heading` }, box.heading),
    intro,
    text,
    copy,
    status,
  );
}
