// Lernstufe für mehrere Sets (TDD 13.1, FR-43, D-72): erreichbar aus dem Auswahlmodus von Bibliothek
// und Archiv. Eigene Ansicht statt Blatt, weil das Feld für eine neue Lernstufe die Tastatur braucht
// (wie Felder am Ort, D-54); als Formular mit Textfeld ohne Aktionsleiste (D-49).
import { knownLevels, levelFromInput } from "../../domain/library";
import type { StoredSet } from "../../domain/model";
import type { ArrangeOutcome } from "../archive";
import { frame } from "../components/frame";
import { focusSoon, h } from "../dom";
import { failureMessage } from "../storageMessages";

export interface LevelContext {
  /** Bibliothek oder Archiv, falls es im Verlauf nichts davor gibt. */
  parent: string;
  loadSets: () => Promise<StoredSet[]>;
  setLevel: (setIds: string[], level: string | undefined) => Promise<ArrangeOutcome>;
  /** Mit der Meldung zurück in die Ansicht, aus der die Auswahl kam. */
  onDone: (message: string) => void;
  /** Ohne Änderung zurück. */
  onCancel: () => void;
}

const NEW = "new";
const NONE = "none";
const UNEXPECTED = "Die Lernstufe wurde bei keinem Set geändert.";

export function levelView(context: LevelContext, setIds: string[]): Node {
  const main = h("main", { class: "editor level" });
  const page = frame({ title: "Lernstufe setzen", back: { parent: context.parent } }, main);
  void context.loadSets().then(
    (all) => {
      const chosen = setIds
        .map((id) => all.find((set) => set.id === id))
        .filter((set): set is StoredSet => set !== undefined);
      if (chosen.length === 0) {
        main.replaceChildren(h("p", null, "Die gewählten Sets gibt es nicht mehr."));
        return;
      }
      main.replaceChildren(...form(chosen, knownLevels(all), context));
    },
    (error: unknown) => {
      console.error("Sets nicht lesbar", error);
      main.replaceChildren(
        h("p", { role: "alert" }, failureMessage(error, "Die Sets konnten nicht geladen werden.")),
      );
    },
  );
  return page.element;
}

function form(chosen: StoredSet[], levels: string[], context: LevelContext): Node[] {
  // Haben alle dieselbe Lernstufe, ist sie vorgewählt.
  const [first] = chosen;
  const same = chosen.every((set) => set.level === first!.level) ? first!.level : undefined;
  const radio = (value: string, text: string, checked = false) =>
    h(
      "label",
      { class: "check" },
      h("input", { type: "radio", name: "level", value, checked }),
      h("span", null, text),
    );
  const error = h("p", { id: "level-error", class: "field-error", hidden: true });
  const newLevel: HTMLInputElement = h("input", {
    type: "text",
    id: "new-level",
    autocomplete: "off",
    enterkeyhint: "done",
    placeholder: "z. B. Klasse 12 oder B1",
    // Wer tippt, meint die neue Lernstufe.
    onfocus: () => {
      newChoice.checked = true;
    },
  });
  const newOption = radio(NEW, "Neue Lernstufe");
  const newChoice = newOption.querySelector("input")!;
  const submit: HTMLButtonElement = h("button", { type: "submit" }, "Übernehmen");
  const cancel = h(
    "button",
    { type: "button", class: "textbtn", onclick: context.onCancel },
    "Verwerfen",
  );
  const showError = (text: string, field?: HTMLElement) => {
    error.textContent = text;
    error.hidden = false;
    newLevel.toggleAttribute("aria-invalid", field === newLevel);
    if (field === newLevel) newLevel.setAttribute("aria-describedby", "level-error");
    focusSoon(field ?? error);
  };
  const element: HTMLFormElement = h(
    "form",
    {
      novalidate: true,
      onsubmit: async (event: Event) => {
        event.preventDefault();
        const choice = element.querySelector<HTMLInputElement>("input[name=level]:checked");
        if (!choice) return showError("Wähle eine Lernstufe.");
        let level: string | undefined;
        if (choice.value === NEW) {
          const input = levelFromInput(newLevel.value);
          if (!input.ok) return showError(input.error, newLevel);
          level = input.level;
        } else if (choice.value !== NONE) level = choice.value;
        submit.disabled = true;
        const outcome = await context
          .setLevel(
            chosen.map((set) => set.id),
            level,
          )
          .catch((failure: unknown): ArrangeOutcome => {
            console.error("Lernstufe nicht gespeichert", failure);
            return { ok: false, error: failureMessage(failure, UNEXPECTED) };
          });
        submit.disabled = false;
        if (!outcome.ok) return showError(outcome.error);
        context.onDone(outcome.message);
      },
    },
    h(
      "fieldset",
      { class: "form-group" },
      h("legend", { class: "field-title" }, "Lernstufe"),
      levels.map((level) => radio(level, level, level === same)),
      newOption,
      h(
        "div",
        { class: "field indent" },
        h("label", { for: "new-level", class: "visually-hidden" }, "Name der neuen Lernstufe"),
        newLevel,
      ),
      radio(NONE, "Keine Lernstufe"),
    ),
    h(
      "p",
      { class: "hint-text" },
      "Die Lernstufe ordnet deine Sets in Bibliothek und Archiv. Sie gehört zum Set und steht auch in exportierten Dateien.",
    ),
    error,
    h("div", { class: "form-end" }, h("div", { class: "form-buttons" }, submit), cancel),
  );
  return [
    h("p", { class: "lead" }, chosen.length === 1 ? "Für 1 Set:" : `Für ${chosen.length} Sets:`),
    h(
      "ul",
      { class: "picked" },
      chosen.map((set) => h("li", null, set.title)),
    ),
    element,
  ];
}
