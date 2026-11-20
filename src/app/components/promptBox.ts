// Vorlage für den KI-Chat zum Kopieren (TDD 13.1): für ein neues Set in der Hilfe, zum Korrigieren im
// Export (D-44, D-65). Sie zeigt nur Begleittext und Auftrag; kopiert wird der volle Text mit der
// Formatspezifikation. Scheitert das Kopieren, steht der volle Text markiert in einem Feld.
import { focusSoon, h } from "../dom";

export interface PromptBox {
  /** Eindeutig in der Ansicht; daraus entstehen die IDs von Überschrift und Vorlage. */
  id: string;
  heading: string;
  /** Was die Vorlage zeigt; Spezifikation und Set stehen darin nur als Hinweis. */
  shown: string;
  /** Der volle Text, synchron im Klick gebaut, damit die Nutzergeste frisch bleibt. */
  text: () => string;
  /** Beschriftung der Schaltfläche, z. B. „Vorlage kopieren“; die Meldung danach folgt ihr. */
  label: string;
  /** Muss direkt im Klick aufgerufen werden (Nutzergeste). */
  copyText: (text: string) => Promise<boolean>;
}

const NOT_COPIED =
  "Kopieren hat nicht geklappt. Die Vorlage steht jetzt unten markiert – kopiere sie über das Menü deines Geräts.";

export function promptBox(
  box: PromptBox,
  ...intro: Node[]
): { element: HTMLElement; button: HTMLButtonElement } {
  const status = h("p", { "aria-live": "polite" });
  const fallback = h("div");
  const done = `${box.label.replace(/ kopieren$/, "")} kopiert.`;
  const copy = h(
    "button",
    {
      type: "button",
      onclick: async () => {
        fallback.replaceChildren();
        const text = box.text();
        // Ohne vorheriges `await` schreiben, sonst verfällt die Nutzergeste.
        if (await box.copyText(text)) {
          status.textContent = done;
          return;
        }
        status.textContent = NOT_COPIED;
        const area = h("textarea", {
          readonly: true,
          rows: 8,
          "aria-label": "Vorlage zum Kopieren",
        });
        area.value = text;
        fallback.replaceChildren(area);
        focusSoon(area);
        area.select();
      },
    },
    box.label,
  );
  const element = h(
    "section",
    { "aria-labelledby": `${box.id}-heading` },
    h("h2", { id: `${box.id}-heading` }, box.heading),
    intro,
    h("pre", { class: "prompt", id: `${box.id}-prompt` }, box.shown),
    copy,
    status,
    fallback,
  );
  return { element, button: copy };
}
