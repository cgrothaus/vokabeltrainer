// Import per eingefügtem Text oder Datei (TDD 8.1, FR-13). In M0 ohne Vorschau: Ein gültiges Set wird
// sofort als neues Set gespeichert. Die Schaltfläche „Aus Zwischenablage einfügen“ folgt mit S-13.
import { MAX_IMPORT_SIZE } from "../../domain/importSet";
import { h } from "../dom";
import type { ImportOutcome } from "../importText";

export interface ImportContext {
  importText: (text: string) => Promise<ImportOutcome>;
  /** Nach jedem gespeicherten Set, z. B. um dauerhaften Speicher anzufordern (TDD 6.6). */
  onSaved: () => void;
}

/** So viele Fehler werden einzeln gezeigt; bei LLM-Ausgaben wiederholt sich derselbe Fehler oft. */
const SHOWN_ERRORS = 10;

const TOO_LARGE = "Die Datei ist zu groß. Ein Vokabelset darf höchstens 10 MB haben.";
const UNREADABLE = "Die Datei konnte nicht gelesen werden. Wähle sie noch einmal aus.";
const UNEXPECTED =
  "Beim Importieren ist ein Fehler aufgetreten. Lade die Seite neu und versuche es noch einmal.";

const entries = (count: number) => (count === 1 ? "1 Eintrag" : `${count} Einträgen`);

export function importView(context: ImportContext): Node {
  const text = h("textarea", {
    id: "import-text",
    rows: 8,
    spellcheck: "false",
    autocapitalize: "off",
    autocomplete: "off",
  });
  const submit = h("button", { type: "submit" }, "Importieren");
  const file = h("input", {
    id: "import-file",
    type: "file",
    // Ob iOS damit .json-Dateien auswählbar lässt, wird in S-11 auf dem Gerät geprüft.
    accept: ".json,application/json,text/plain",
  });
  const errors = h("div", { role: "alert" });
  const status = h("div", { "aria-live": "polite" });

  const setBusy = (busy: boolean) => {
    submit.disabled = busy;
    file.disabled = busy;
  };

  const show = (outcome: ImportOutcome) => {
    if (!outcome.ok) {
      status.replaceChildren();
      const hidden = outcome.errors.length - SHOWN_ERRORS;
      errors.replaceChildren(
        h(
          "div",
          null,
          h("p", null, "Das Set wurde nicht importiert:"),
          h(
            "ul",
            null,
            outcome.errors.slice(0, SHOWN_ERRORS).map((error) => h("li", null, error)),
          ),
          hidden > 0 && h("p", null, `… und ${hidden} weitere Fehler.`),
        ),
      );
      return;
    }
    errors.replaceChildren();
    status.replaceChildren(
      h(
        "div",
        null,
        h("p", null, `„${outcome.title}“ mit ${entries(outcome.entryCount)} gespeichert.`),
        outcome.warnings.length > 0 &&
          h(
            "ul",
            null,
            outcome.warnings.map((warning) => h("li", null, warning)),
          ),
      ),
    );
    context.onSaved();
  };

  const run = async (read: () => Promise<string>) => {
    setBusy(true);
    try {
      let input: string;
      try {
        input = await read();
      } catch (error) {
        console.error("Datei nicht lesbar", error);
        return show({ ok: false, errors: [UNREADABLE] });
      }
      const outcome = await context.importText(input);
      show(outcome);
      if (outcome.ok) text.value = "";
    } catch (error) {
      console.error("Import fehlgeschlagen", error);
      show({ ok: false, errors: [UNEXPECTED] });
    } finally {
      setBusy(false);
    }
  };

  const form = h(
    "form",
    {
      onsubmit: (event: Event) => {
        event.preventDefault();
        void run(async () => text.value);
      },
    },
    h("label", { for: "import-text" }, "Text einfügen"),
    text,
    submit,
  );

  file.addEventListener("change", () => {
    const chosen = file.files?.[0];
    // Zurücksetzen, damit dieselbe Datei nach einer Korrektur erneut auswählbar ist.
    file.value = "";
    if (!chosen) return;
    if (chosen.size > MAX_IMPORT_SIZE) return show({ ok: false, errors: [TOO_LARGE] });
    void run(() => chosen.text());
  });

  return h(
    "main",
    { class: "import" },
    h("h1", null, "Vokabelset importieren"),
    h(
      "p",
      null,
      "Füge die Antwort deines KI-Chats mit dem Vokabelset ein oder wähle eine Datei aus. Das Set wird sofort gespeichert.",
    ),
    form,
    h("p", null, h("label", { for: "import-file" }, "Oder eine Datei auswählen")),
    file,
    errors,
    status,
    h("p", null, h("a", { href: "#/" }, "Zurück zur Bibliothek")),
  );
}
