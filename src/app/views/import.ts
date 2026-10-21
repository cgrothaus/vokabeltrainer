// Import per eingefügtem Text, Zwischenablage oder Datei (TDD 8.1, FR-13). Zuerst zeigt eine Vorschau
// das neue Set mit Warnungen und möglichen Duplikaten (TDD 9.2, FR-16, FR-30); gespeichert wird erst nach
// Bestätigung. Bekannte Sets zu aktualisieren folgt mit M4.
import { MAX_IMPORT_SIZE } from "../../domain/importSet";
import type { StoredSet } from "../../domain/model";
import type { ClipboardResult } from "../../platform/clipboard";
import { h } from "../dom";
import type { ImportPreview, PreviewOutcome, SaveOutcome } from "../importText";
import { languageName } from "../languages";

export interface ImportContext {
  previewImport: (text: string) => Promise<PreviewOutcome>;
  saveImport: (set: StoredSet) => Promise<SaveOutcome>;
  /** `null`: Der Browser kann die Zwischenablage nicht lesen; die Schaltfläche entfällt. */
  readClipboard: (() => Promise<ClipboardResult>) | null;
  /** Nach dem Speichern, mit der Erfolgsmeldung für die Bibliothek. */
  onSaved: (message: string) => void;
}

/** So viele Fehler werden einzeln gezeigt; bei LLM-Ausgaben wiederholt sich derselbe Fehler oft. */
const SHOWN_ERRORS = 10;

/** Bis zu so vielen Sektionen ist die Liste in der Vorschau aufgeklappt. */
const OPEN_SECTIONS = 10;

const TOO_LARGE = "Die Datei ist zu groß. Ein Vokabelset darf höchstens 10 MB haben.";
const UNREADABLE = "Die Datei konnte nicht gelesen werden. Wähle sie noch einmal aus.";
const UNEXPECTED =
  "Beim Importieren ist ein Fehler aufgetreten. Lade die Seite neu und versuche es noch einmal.";
const CLIPBOARD = {
  denied:
    "Die Zwischenablage konnte nicht gelesen werden. Füge den Text stattdessen in das Feld ein.",
  empty: "In der Zwischenablage ist kein Text. Kopiere zuerst die Antwort aus deinem KI-Chat.",
} as const;

const entries = (count: number) => (count === 1 ? "1 Eintrag" : `${count} Einträge`);
const entriesDative = (count: number) => (count === 1 ? "1 Eintrag" : `${count} Einträgen`);
const sections = (count: number) => (count === 1 ? "1 Sektion" : `${count} Sektionen`);

/** Fokus auf die Vorschau oder eine Meldung, damit Screenreader sie vorlesen. */
function focus(element: HTMLElement): void {
  element.tabIndex = -1;
  element.focus();
}

export function importView(context: ImportContext): Node {
  const text = h("textarea", {
    id: "import-text",
    rows: 8,
    spellcheck: "false",
    autocapitalize: "off",
    autocomplete: "off",
  });
  const submit = h("button", { type: "submit" }, "Prüfen");
  const paste =
    context.readClipboard &&
    h(
      "button",
      { type: "button", class: "secondary", onclick: () => void pasteAndCheck() },
      "Aus Zwischenablage einfügen",
    );
  const file = h("input", {
    id: "import-file",
    type: "file",
    // Ob iOS damit .json-Dateien auswählbar lässt, wird in S-11 auf dem Gerät geprüft.
    accept: ".json,application/json,text/plain",
  });
  const errors = h("div", { role: "alert" });
  const preview = h("div");

  const setBusy = (busy: boolean) => {
    submit.disabled = busy;
    file.disabled = busy;
    if (paste) paste.disabled = busy;
  };

  const showErrors = (messages: string[]) => {
    const hidden = messages.length - SHOWN_ERRORS;
    errors.replaceChildren(
      h(
        "div",
        null,
        h("p", null, "Das Set wurde nicht importiert:"),
        h(
          "ul",
          null,
          messages.slice(0, SHOWN_ERRORS).map((message) => h("li", null, message)),
        ),
        hidden > 0 && h("p", null, `… und ${hidden} weitere Fehler.`),
      ),
    );
  };

  const closePreview = () => {
    preview.replaceChildren();
    input.hidden = false;
  };

  const showPreview = (result: ImportPreview) => {
    const { set } = result;
    const duplicate = result.duplicates.length > 0;
    const confirm = h(
      "button",
      {
        type: "button",
        onclick: async () => {
          confirm.disabled = true;
          cancel.disabled = true;
          errors.replaceChildren();
          let outcome: SaveOutcome;
          try {
            outcome = await context.saveImport(set);
          } catch (error) {
            console.error("Set nicht gespeichert", error);
            outcome = { ok: false, error: UNEXPECTED };
          }
          if (!outcome.ok) {
            confirm.disabled = false;
            cancel.disabled = false;
            showErrors([outcome.error]);
            return;
          }
          text.value = "";
          context.onSaved(
            `„${outcome.title}“ mit ${entriesDative(outcome.entryCount)} gespeichert.`,
          );
        },
      },
      duplicate ? "Trotzdem als neues Set importieren" : "Importieren",
    );
    const cancel = h(
      "button",
      {
        type: "button",
        class: "secondary",
        onclick: () => {
          closePreview();
          errors.replaceChildren();
          text.focus();
        },
      },
      "Abbrechen",
    );
    const heading = h("h2", { id: "import-preview" }, "Vorschau");
    const sectionList = h(
      "ul",
      null,
      result.sections.map((section) =>
        h(
          "li",
          null,
          h("span", { class: "title" }, section.title),
          " ",
          h("span", { class: "count" }, entries(section.entryCount)),
        ),
      ),
    );
    preview.replaceChildren(
      h(
        "section",
        { class: "confirm", "aria-labelledby": "import-preview" },
        heading,
        duplicate &&
          h(
            "div",
            { class: "duplicate" },
            result.duplicates.map((message) => h("p", null, message)),
          ),
        h("p", { class: "preview-title" }, set.title),
        h(
          "p",
          null,
          `${languageName(set.termLanguage)} → ${languageName(set.meaningLanguage)}`,
          h("br"),
          `${sections(result.sections.length)} mit ${entriesDative(result.entryCount)}`,
        ),
        h(
          "details",
          { open: result.sections.length <= OPEN_SECTIONS },
          h("summary", null, "Sektionen"),
          sectionList,
        ),
        result.trimmed && h("p", null, "Text vor und nach dem Vokabelset wurde weggelassen."),
        result.warnings.length > 0 &&
          h(
            "div",
            null,
            h("p", null, "Hinweise:"),
            h(
              "ul",
              null,
              result.warnings.map((warning) => h("li", null, warning)),
            ),
          ),
        h("div", { class: "actions" }, confirm, cancel),
      ),
    );
    input.hidden = true;
    focus(heading);
  };

  const check = async (read: () => Promise<string>) => {
    setBusy(true);
    errors.replaceChildren();
    try {
      let value: string;
      try {
        value = await read();
      } catch (error) {
        console.error("Datei nicht lesbar", error);
        return showErrors([UNREADABLE]);
      }
      const outcome = await context.previewImport(value);
      if (!outcome.ok) return showErrors(outcome.errors);
      showPreview(outcome);
    } catch (error) {
      console.error("Import fehlgeschlagen", error);
      showErrors([UNEXPECTED]);
    } finally {
      setBusy(false);
    }
  };

  // Gleich prüfen (Nutzerentscheidung in S-13): Gespeichert wird ohnehin erst nach der Vorschau.
  const pasteAndCheck = async () => {
    // Ohne vorheriges `await` lesen, sonst verfällt die Nutzergeste.
    const reading = context.readClipboard!();
    setBusy(true);
    errors.replaceChildren();
    let result: ClipboardResult;
    try {
      result = await reading;
    } catch (error) {
      console.error("Zwischenablage nicht lesbar", error);
      result = { ok: false, reason: "denied" };
    }
    if (!result.ok) {
      setBusy(false);
      errors.replaceChildren(h("p", null, CLIPBOARD[result.reason]));
      return;
    }
    text.value = result.text;
    await check(async () => result.text);
  };

  const form = h(
    "form",
    {
      onsubmit: (event: Event) => {
        event.preventDefault();
        void check(async () => text.value);
      },
    },
    h("label", { for: "import-text" }, "Text einfügen"),
    text,
    h("div", { class: "actions" }, submit, paste),
  );

  file.addEventListener("change", () => {
    const chosen = file.files?.[0];
    // Zurücksetzen, damit dieselbe Datei nach einer Korrektur erneut auswählbar ist.
    file.value = "";
    if (!chosen) return;
    if (chosen.size > MAX_IMPORT_SIZE) return showErrors([TOO_LARGE]);
    void check(() => chosen.text());
  });

  const input = h(
    "div",
    null,
    h(
      "p",
      null,
      "Füge die Antwort deines KI-Chats mit dem Vokabelset ein oder wähle eine Datei aus. Du siehst vor dem Speichern, was übernommen wird.",
    ),
    form,
    h("p", null, h("label", { for: "import-file" }, "Oder eine Datei auswählen")),
    file,
  );

  return h(
    "main",
    { class: "import" },
    h("h1", null, "Vokabelset importieren"),
    input,
    preview,
    errors,
    h("p", null, h("a", { href: "#/" }, "Zurück zur Bibliothek")),
  );
}
