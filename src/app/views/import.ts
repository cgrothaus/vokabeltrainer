// „Vokabelset hinzufügen“ (TDD 8.1, 13.1, FR-13, FR-20, D-71): der Weg über einen KI-Chat in drei
// Schritten, mit der Vorlage zum Kopieren (D-65) und der Antwort aus der Zwischenablage, einer Datei
// oder selbst eingefügtem Text; zugeklappt ein Beispiel des Formats und der Weg zum Korrigieren über
// „Exportieren“ (D-44). Danach zeigt eine Vorschau das neue Set mit Warnungen und möglichen Duplikaten
// (TDD 9.2, FR-16, FR-30) bzw. bei einem vorhandenen Set, was sich ändert (TDD 9.7, `importChanges`);
// gespeichert wird erst nach Bestätigung. Die Vorschau liegt auf einem zusätzlichen Verlaufseintrag
// mit derselben Adresse wie die Lernsitzung (D-29, D-53): Zurück führt zur Eingabe, der Text bleibt.
import { FORMAT_EXAMPLE, NEW_SET_SHOWN, newSetPrompt } from "../../content/help";
import type { ImportMode } from "../../domain/diff";
import { MAX_IMPORT_SIZE } from "../../domain/importSet";
import { withLevel } from "../../domain/library";
import type { ImportDecisions } from "../../domain/merge";
import type { StoredSet } from "../../domain/model";
import type { ClipboardResult } from "../../platform/clipboard";
import { frame } from "../components/frame";
import { importChanges, type ShownChanges } from "../components/importChanges";
import { promptBox } from "../components/promptBox";
import { type Child, focusSoon, h } from "../dom";
import { icon, type IconName } from "../icons";
import type {
  ImportPreview,
  KnownPreview,
  KnownSaveOutcome,
  PreviewOutcome,
  SaveOutcome,
} from "../importText";
import { languageName } from "../languages";
import { hasMark, pushMark } from "../router";

export interface ImportContext {
  previewImport: (text: string) => Promise<PreviewOutcome>;
  saveImport: (set: StoredSet) => Promise<SaveOutcome>;
  saveKnownImport: (
    preview: KnownPreview,
    mode: ImportMode,
    decisions: ImportDecisions,
  ) => Promise<KnownSaveOutcome>;
  /** `null`: Der Browser kann die Zwischenablage nicht lesen; die Schaltfläche entfällt. */
  readClipboard: (() => Promise<ClipboardResult>) | null;
  /** Für „Vorlage kopieren“; muss direkt im Klick aufgerufen werden (Nutzergeste). */
  copyText: (text: string) => Promise<boolean>;
  /** Nach dem Speichern eines neuen Sets, mit der Meldung für seine Set-Ansicht (TDD 9.2). */
  onSaved: (setId: string, message: string) => void;
  /** Nach der Übernahme in ein vorhandenes Set, mit der Meldung für die Set-Ansicht. */
  onUpdated: (setId: string, message: string) => void;
}

const TITLE = "Vokabelset hinzufügen";
const PREVIEW = "import-preview";

/** So viele Fehler werden einzeln gezeigt; bei LLM-Ausgaben wiederholt sich derselbe Fehler oft. */
const SHOWN_ERRORS = 10;

const TOO_LARGE = "Die Datei ist zu groß. Ein Vokabelset darf höchstens 10 MB haben.";
const UNREADABLE = "Die Datei konnte nicht gelesen werden. Wähle sie noch einmal aus.";
const UNEXPECTED =
  "Beim Importieren ist ein Fehler aufgetreten. Lade die Seite neu und versuche es noch einmal.";
const CLIPBOARD = {
  denied:
    "Die Zwischenablage konnte nicht gelesen werden. Füge den Text stattdessen in das Feld ein.",
  empty: "In der Zwischenablage ist kein Text. Kopiere zuerst die Antwort aus deinem KI-Chat.",
} as const;

const entriesDative = (count: number) => (count === 1 ? "1 Eintrag" : `${count} Einträgen`);

export function importView(context: ImportContext, signal: AbortSignal): Node {
  const hash = location.hash;
  const main = h("main", { class: "import" });
  const page = frame({ title: TITLE, back: { parent: "#/" } }, main);

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
      { type: "button", class: "big", onclick: () => void pasteAndCheck() },
      icon("clipboard"),
      h("span", null, "Antwort einfügen"),
    );
  const file = h("input", {
    id: "import-file",
    type: "file",
    class: "file-input",
    // iOS und iPadOS lassen .json-Dateien damit auswählbar (S-11, O-08).
    accept: ".json,application/json,text/plain",
  });
  const errors = h("div", { role: "alert" });
  const preview = h("div", { class: "preview", hidden: true });

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

  // Die zuletzt gezeigte Vorschau: Vorwärts nach Zurück zeigt sie wieder.
  let current: ShownChanges | null = null;
  let leaving = false;

  const openPreview = (shown: ShownChanges) => {
    current = shown;
    errors.replaceChildren();
    input.hidden = true;
    preview.replaceChildren(shown.element);
    preview.hidden = false;
    const heading = page.setTitle("Vorschau");
    shown.showDock(page.setDock);
    if (!hasMark(PREVIEW)) pushMark(PREVIEW);
    focusSoon(shown.focus ?? heading);
  };

  const closePreview = () => {
    preview.hidden = true;
    preview.replaceChildren();
    errors.replaceChildren();
    input.hidden = false;
    page.setDock();
    focusSoon(page.setTitle(TITLE));
  };

  /** „Abbrechen“ und „Zurück“ in der Vorschau: wie die Zurück-Taste. */
  const cancel = () => (hasMark(PREVIEW) ? history.back() : closePreview());

  /** Nach dem Speichern: erst vom zusätzlichen Eintrag zurück, dann ersetzt `then` die Ansicht. */
  const leave = (then: () => void) => {
    leaving = true;
    if (!hasMark(PREVIEW)) return then();
    window.addEventListener("popstate", then, { once: true, signal });
    history.back();
  };

  window.addEventListener(
    "popstate",
    () => {
      // Auf eine andere Seite: Der Router verlässt die Ansicht.
      if (leaving || location.hash !== hash) return;
      if (hasMark(PREVIEW)) {
        if (current && preview.hidden) openPreview(current);
      } else if (!preview.hidden) closePreview();
    },
    { signal },
  );

  const known = (result: KnownPreview) =>
    importChanges(result, {
      save: context.saveKnownImport,
      onSaved: (setId, message) => {
        text.value = "";
        leave(() => context.onUpdated(setId, message));
      },
      onCancel: cancel,
      // Eine neu berechnete Vorschau ersetzt die alte, auch für Vorwärts.
      onReplaced: openPreview,
    });

  const added = (result: ImportPreview): ShownChanges => {
    const { set } = result;
    const duplicate = result.duplicates.length > 0;
    // Nennt die Datei keine Lernstufe, schlägt die Vorschau eine vorhandene vor (D-72). Eine Auswahl
    // statt eines Textfelds: Eine neue Lernstufe gibt man in „Angaben bearbeiten“ ein.
    const levelChoice =
      result.levels.length > 0
        ? h(
            "select",
            {
              id: "preview-level",
              class: "level-select",
              "aria-describedby": "preview-level-hint",
            },
            result.levels.map((level) =>
              h("option", { value: level, selected: level === result.suggestedLevel }, level),
            ),
            h(
              "option",
              { value: "", selected: result.suggestedLevel === undefined },
              "Keine Lernstufe",
            ),
          )
        : null;
    const save = h(
      "button",
      {
        type: "button",
        onclick: async () => {
          save.disabled = true;
          back.disabled = true;
          errors.replaceChildren();
          let outcome: SaveOutcome;
          try {
            outcome = await context.saveImport(
              levelChoice?.value ? withLevel(set, levelChoice.value) : set,
            );
          } catch (error) {
            console.error("Set nicht gespeichert", error);
            outcome = { ok: false, error: UNEXPECTED };
          }
          if (!outcome.ok) {
            save.disabled = false;
            back.disabled = false;
            showErrors([outcome.error]);
            return;
          }
          text.value = "";
          const message = `„${outcome.title}“ mit ${entriesDative(outcome.entryCount)} gespeichert.`;
          leave(() => context.onSaved(outcome.setId, message));
        },
      },
      duplicate ? "Trotzdem als neues Set speichern" : "Speichern",
    );
    const back = h("button", { type: "button", class: "secondary", onclick: cancel }, "Abbrechen");
    const tile = (label: string, value: number) =>
      h("div", null, h("dt", null, label), h("dd", null, String(value)));
    const details = [
      `${languageName(set.termLanguage)} → ${languageName(set.meaningLanguage)}`,
      set.level,
    ].filter((part) => part);
    const element = h(
      "div",
      { class: "preview-content" },
      duplicate &&
        h(
          "div",
          { class: "duplicate" },
          result.duplicates.map((message) => h("p", null, message)),
        ),
      h(
        "section",
        { class: "panel raised", "aria-labelledby": "preview-set" },
        h("p", { class: "label" }, "Neues Vokabelset"),
        h("h2", { class: "display", id: "preview-set" }, set.title),
        h("p", { class: "muted" }, details.join(" · ")),
        h(
          "dl",
          { class: "tiles" },
          tile(result.sections.length === 1 ? "Sektion" : "Sektionen", result.sections.length),
          tile(result.entryCount === 1 ? "Eintrag" : "Einträge", result.entryCount),
          tile(result.warnings.length === 1 ? "Hinweis" : "Hinweise", result.warnings.length),
        ),
        h(
          "ul",
          { class: "pills", "aria-label": "Sektionen" },
          result.sections.map((section) =>
            h("li", null, `${section.title} · ${section.entryCount}`),
          ),
        ),
        levelChoice &&
          h(
            "div",
            { class: "field" },
            h("label", { for: "preview-level", class: "field-title" }, "Lernstufe"),
            levelChoice,
            h(
              "p",
              { id: "preview-level-hint", class: "hint-text" },
              "Die Datei nennt keine Lernstufe. Vorgeschlagen ist die deines zuletzt hinzugefügten Sets.",
            ),
          ),
      ),
      result.trimmed && h("p", null, "Text vor und nach dem Vokabelset wurde weggelassen."),
      result.warnings.length > 0 &&
        h(
          "section",
          { class: "panel", "aria-labelledby": "preview-hints" },
          h("h2", { class: "label", id: "preview-hints" }, "Hinweise"),
          h(
            "ul",
            null,
            result.warnings.map((warning) => h("li", null, warning)),
          ),
        ),
      h(
        "p",
        { class: "muted" },
        `Gespeichert wird erst, wenn du auf „${save.textContent}“ tippst.`,
      ),
    );
    return { element, showDock: (setDock) => setDock(back, save) };
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
      openPreview(outcome.kind === "known" ? known(outcome) : added(outcome));
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
      // Der Weg über das Textfeld geht immer (TDD 8.1): aufklappen, Hinweis dort.
      own.open = true;
      ownProblem.replaceChildren(h("p", null, CLIPBOARD[result.reason]));
      focusSoon(text);
      return;
    }
    text.value = result.text;
    await check(async () => result.text);
  };

  file.addEventListener("change", () => {
    const chosen = file.files?.[0];
    // Zurücksetzen, damit dieselbe Datei nach einer Korrektur erneut auswählbar ist.
    file.value = "";
    if (!chosen) return;
    if (chosen.size > MAX_IMPORT_SIZE) return showErrors([TOO_LARGE]);
    void check(() => chosen.text());
  });

  // Live-Bereich statt zweitem `role="alert"`: Der Fokus springt ohnehin ins Feld darunter.
  const ownProblem = h("div", { class: "problem", "aria-live": "assertive" });
  const own = h(
    "details",
    { class: "about own", id: "import-own", open: !paste },
    h("summary", null, "Text lieber selbst einfügen"),
    h(
      "form",
      {
        onsubmit: (event: Event) => {
          event.preventDefault();
          ownProblem.replaceChildren();
          void check(async () => text.value);
        },
      },
      ownProblem,
      h("label", { for: "import-text" }, "Text einfügen"),
      text,
      submit,
    ),
  );

  const row = (href: string, symbol: IconName, label: string): Child =>
    h("li", null, h("a", { href }, icon(symbol), h("span", null, label), icon("chevron")));

  const step = (title: string, rest: string, ...below: Child[]): Child =>
    h("li", null, h("span", null, h("b", null, title), rest), below);

  // Die Schritte in der Reihenfolge, in der man sie geht: Die Vorlage braucht man immer zuerst, die
  // Antwort erst nach dem Chat (D-71).
  const input = h(
    "div",
    { class: "add" },
    h(
      "ol",
      { class: "steps" },
      // Kostenlose KI-Chats erlauben nur wenige Uploads am Tag; ein PDF zählt als einer.
      step(
        "Fotografiere",
        " deine Vokabelliste.",
        h(
          "p",
          { class: "step-tip" },
          "Mehrere Seiten scannst du am besten als ein PDF, dann ist es nur ein Upload – kostenlose KI-Chats erlauben oft nur wenige am Tag. Auf dem iPhone geht das in Notizen oder Dateien mit „Dokumente scannen“, auf Android in Google Drive mit „Scannen“.",
        ),
      ),
      step(
        "Kopiere die Vorlage",
        ", füge sie in einen KI-Chat wie ChatGPT, Claude oder Gemini ein und hänge die Fotos oder das PDF an.",
        promptBox({
          id: "import",
          shown: NEW_SET_SHOWN,
          collapsed: "Was wird kopiert?",
          text: newSetPrompt,
          label: "Vorlage kopieren",
          copyText: context.copyText,
        }).element,
      ),
      step(
        "Kopiere die Antwort",
        " und füge sie hier ein. Du siehst vor dem Speichern, was übernommen wird.",
        h(
          "section",
          { class: "paste", "aria-label": "Antwort oder Datei" },
          paste,
          paste && h("p", { class: "or" }, "oder"),
          // Die Beschriftung sieht aus wie eine Schaltfläche, das Feld liegt unsichtbar darüber (TDD 13.4).
          h(
            "div",
            { class: "file-pick" },
            file,
            h(
              "label",
              { for: "import-file", class: "file-button" },
              icon("file"),
              h("span", null, "Datei auswählen"),
            ),
          ),
        ),
        own,
      ),
    ),
    h(
      "details",
      { class: "about", id: "import-example" },
      h("summary", null, "So sieht ein Vokabelset aus"),
      h(
        "div",
        { class: "inside" },
        h(
          "p",
          null,
          "Der Chat schreibt die Vokabeln in diesem Format. Du musst es nicht verstehen – die App prüft es beim Import.",
        ),
        h("pre", null, FORMAT_EXAMPLE),
      ),
    ),
    h(
      "details",
      { class: "about", id: "import-correction" },
      h("summary", null, "Ein Set korrigieren"),
      h(
        "div",
        { class: "inside" },
        h(
          "p",
          null,
          "Ein KI-Chat kann ein Set auch prüfen und korrigieren. Öffne dazu das Set und wähle im Menü „Exportieren“: Dort kopiert „Korrekturvorlage kopieren“ die Vorlage zusammen mit deinem Set. Füge sie in den Chat ein. Die Antwort fügst du hier ein – die App erkennt das Set und zeigt, was sich ändert.",
        ),
      ),
    ),
    h("ul", { class: "rows" }, row("#/new-set", "edit", "Leeres Set anlegen und selbst tippen")),
  );

  // Meldungen oben, damit sie bei Eingabe und Vorschau sichtbar sind.
  main.append(errors, input, preview);
  return page.element;
}
