// Eintragseditor (TDD 10, FR-04, FR-05, D-41): ein Formular für Wort und Bedeutungen mit Varianten,
// dazu aufklappbar Grammatik, Beispiele, Notiz und Prüfstatus. Ausdrücklich „Speichern“ oder
// „Verwerfen“; die Zurück-Taste fragt bei Änderungen nach (components/unsavedGuard.ts). Prüfen und
// Speichern liegen in app/editSet.ts und domain/entryForm.ts.
import { findEntry } from "../../domain/editSet";
import {
  type AnswerForm,
  emptyEntryForm,
  type EntryForm,
  entryToForm,
  type FormError,
  formChanged,
} from "../../domain/entryForm";
import type { StoredSet } from "../../domain/model";
import { GENDERS, PARTS_OF_SPEECH } from "../components/entryDetails";
import { frame } from "../components/frame";
import { leaveQuestion } from "../components/leaveQuestion";
import { openSheet, type Sheet } from "../components/sheet";
import { guardUnsaved, type UnsavedGuard } from "../components/unsavedGuard";
import type { EditOutcome, EntryOutcome, EntryTarget } from "../editSet";
import { type Child, focusSoon, h } from "../dom";
import { icon } from "../icons";

export interface EntryEditorContext {
  /** `undefined`, wenn es das Set nicht gibt. */
  loadSet: () => Promise<StoredSet | undefined>;
  saveEntry: (set: StoredSet, form: EntryForm, target: EntryTarget) => Promise<EntryOutcome>;
  removeEntry: (set: StoredSet, entryId: string) => Promise<EditOutcome>;
}

const NOT_LOADED = "Das Vokabelset konnte nicht geladen werden. Lade die Seite neu.";

export function entryEditorView(
  context: EntryEditorContext,
  signal: AbortSignal,
  setId: string,
  target: EntryTarget,
): Node {
  const main = h("main", { class: "editor" });
  const page = frame({ back: { parent: `#/edit/${encodeURIComponent(setId)}` } }, main);
  const missing = (title: string, text: string) => {
    page.setTitle(title);
    main.replaceChildren(h("p", null, text));
  };
  void context.loadSet().then(
    (set) => {
      if (signal.aborted) return;
      if (!set) return missing("Set nicht gefunden", "Dieses Vokabelset gibt es nicht (mehr).");
      if ("entryId" in target) {
        const found = findEntry(set, target.entryId);
        if (!found)
          return missing("Eintrag nicht gefunden", "Diesen Eintrag gibt es nicht (mehr).");
        return editor(main, set, entryToForm(found.entry), target);
      }
      if (!set.sections.some((section) => section.id === target.sectionId))
        return missing("Sektion nicht gefunden", "Diese Sektion gibt es nicht (mehr).");
      editor(main, set, emptyEntryForm(), target);
    },
    (error: unknown) => {
      console.error("Set nicht lesbar", error);
      page.setTitle("Eintrag bearbeiten");
      main.replaceChildren(h("p", { role: "alert" }, NOT_LOADED));
    },
  );

  /**
   * Baut das Formular. Bei einem neuen Eintrag nennt `target` die Sektion; nach „Speichern und
   * nächster Eintrag“ bleibt es so, und das Formular beginnt leer in derselben Sektion.
   */
  function editor(main: HTMLElement, loaded: StoredSet, initial: EntryForm, target: EntryTarget) {
    const entryId = "entryId" in target ? target.entryId : undefined;
    let set = loaded;
    let form = structuredClone(initial);
    let original = structuredClone(initial);
    let errors: FormError[] = [];
    let busy = false;

    const guard: UnsavedGuard = guardUnsaved({
      signal,
      fallback: `#/edit/${encodeURIComponent(set.id)}`,
      changed: () => formChanged(form, original),
      ask: () => showQuestion(),
      resume: () => hideQuestion(),
    });

    let question: Sheet | null = null;
    const summary = h("div", { role: "alert" });
    const status = h("p", { "aria-live": "polite", class: "selection" });
    const fields = h("div");
    const buttons: HTMLButtonElement[] = [];
    const setBusy = (value: boolean) => {
      busy = value;
      for (const button of buttons) button.disabled = value;
    };
    const button = (text: string, onclick: () => void, secondary = true) => {
      const element = h(
        "button",
        { type: "button", class: secondary ? "secondary" : null, onclick },
        text,
      );
      buttons.push(element);
      return element;
    };

    const fieldErrors = (field: string) =>
      errors.filter((error) => error.field === field).map((error) => error.message);

    /**
     * Feld mit Beschriftung; Fehler dazu stehen darunter und werden mit vorgelesen. `hidden`: Die
     * Beschriftung ist nur für Screenreader da, sichtbar benennt sie die Gruppe (Wort, Varianten).
     */
    const textField = (
      id: string,
      label: string,
      value: string,
      update: (value: string) => void,
      options: {
        lang?: string;
        field?: string;
        multiline?: boolean;
        hidden?: boolean;
        big?: boolean;
      } = {},
    ): Child[] => {
      const messages = options.field ? fieldErrors(options.field) : [];
      const props = {
        id,
        lang: options.lang,
        class: options.big ? "big" : null,
        "aria-invalid": messages.length > 0 ? "true" : null,
        "aria-describedby": messages.length > 0 ? `${id}-error` : null,
        oninput: (event: Event) => {
          update((event.target as HTMLInputElement).value);
          refreshSummary();
        },
      };
      const input = options.multiline
        ? h("textarea", { ...props, rows: 3, class: "plain" }, value)
        : h("input", { ...props, type: "text", value, autocomplete: "off" });
      return [
        h("label", { for: id, class: options.hidden ? "visually-hidden" : null }, label),
        input,
        messages.length > 0 &&
          h("p", { id: `${id}-error`, class: "field-error" }, messages.join(" ")),
      ];
    };

    /** Symbolknopf zum Entfernen, z. B. einer Variante; danach bekommt `focus` den Fokus. */
    const removeButton = (label: string, symbol: "close" | "trash", remove: () => void) =>
      h(
        "button",
        { type: "button", class: "iconbtn", "aria-label": label, onclick: remove },
        icon(symbol),
      );

    const addButton = (id: string, text: string, onclick: () => void) =>
      h(
        "button",
        { type: "button", class: "textbtn add", id, onclick },
        icon("plus"),
        h("span", null, text),
      );

    /** Liste einzelner Texte mit „hinzufügen“ und „entfernen“, z. B. Varianten oder Wortformen. */
    const textList = (
      id: string,
      values: string[],
      names: { one: (n: number) => string; add: string },
      lang: string,
    ): Child[] => [
      values.map((value, index) =>
        h(
          "div",
          { class: "row" },
          textField(
            `${id}-${index}`,
            names.one(index + 1),
            value,
            (text) => (values[index] = text),
            {
              lang,
              hidden: true,
            },
          ),
          removeButton(`${names.one(index + 1)} entfernen`, "close", () => {
            values.splice(index, 1);
            render(values.length > index ? `${id}-${index}` : `${id}-add`);
          }),
        ),
      ),
      addButton(`${id}-add`, names.add, () => {
        values.push("");
        render(`${id}-${values.length - 1}`);
      }),
    ];

    /** Wort oder Bedeutung als Gruppe mit Sprachkürzel, großem Feld und Varianten (D-54). */
    const answerGroup = (
      id: string,
      legend: string,
      answer: AnswerForm,
      lang: string,
      field: string,
      remove?: () => void,
    ): Node =>
      h(
        "div",
        {
          role: "group",
          class: id === "term" ? "form-group front" : "form-group",
          "aria-labelledby": `${id}-legend`,
        },
        h(
          "div",
          { class: "group-head" },
          h("span", { class: "lang-badge", "aria-hidden": "true" }, languageBadge(lang)),
          h("span", { class: "label", id: `${id}-legend` }, legend),
          remove && removeButton(`${legend} entfernen`, "trash", remove),
        ),
        textField(id, "Text", answer.text, (text) => (answer.text = text), {
          lang,
          field,
          hidden: true,
          big: true,
        }),
        answer.variants.length > 0 && h("p", { class: "sublabel" }, "Gilt auch als richtig"),
        textList(
          `${id}-variant`,
          answer.variants,
          { one: (n) => `Variante ${n} von „${legend}“`, add: "Variante hinzufügen" },
          lang,
        ),
      );

    /** Auswahl mit bekannten Werten auf Deutsch; ein anderer Wert aus dem Set bleibt wählbar. */
    const choice = (
      id: string,
      label: string,
      known: Record<string, string>,
      value: string,
      update: (value: string) => void,
    ): Node => {
      const options: [string, string][] = [["", "keine Angabe"], ...Object.entries(known)];
      if (value !== "" && !(value in known)) options.push([value, value]);
      return h(
        "div",
        { class: "field" },
        h("label", { for: id }, label),
        h(
          "select",
          {
            id,
            onchange: (event: Event) => {
              update((event.target as HTMLSelectElement).value);
              refreshSummary();
            },
          },
          options.map(([optionValue, text]) =>
            h("option", { value: optionValue, selected: optionValue === value }, text),
          ),
        ),
      );
    };

    /** Was unter „Weitere Angaben“ gefüllt ist, damit man es auch zugeklappt sieht. */
    const filled = () =>
      [
        form.partOfSpeech.trim() && "Wortart",
        form.gender.trim() && "Genus",
        form.plural.trim() && "Plural",
        form.forms.some((value) => value.trim()) && "Wortformen",
        form.examples.length === 1 && "1 Beispiel",
        form.examples.length > 1 && `${form.examples.length} Beispiele`,
        form.notes.trim() && "Notiz",
        form.checked && "geprüft",
      ].filter((part): part is string => !!part);

    const moreSummary = h("span", { class: "muted" });
    const refreshSummary = () => {
      const parts = filled();
      moreSummary.textContent = parts.length > 0 ? ` · ${parts.join(", ")}` : "";
    };

    const errorInMore = () =>
      errors.some(
        (error) => !error.field.startsWith("term") && !error.field.startsWith("meanings"),
      );

    let moreOpen = false;

    const render = (focusId?: string) => {
      const more = h(
        "details",
        {
          class: "about more-details",
          id: "entry-more",
          open: moreOpen || errorInMore(),
          ontoggle: () => (moreOpen = more.open),
        },
        h("summary", null, "Weitere Angaben", moreSummary),
        h(
          "div",
          { class: "more-body" },
          h(
            "div",
            { class: "pair-fields" },
            choice("part-of-speech", "Wortart", PARTS_OF_SPEECH, form.partOfSpeech, (value) => {
              form.partOfSpeech = value;
            }),
            choice("gender", "Genus", GENDERS, form.gender, (value) => (form.gender = value)),
          ),
          h(
            "div",
            { class: "field" },
            textField("plural", "Plural", form.plural, (value) => (form.plural = value), {
              lang: set.termLanguage,
              field: "plural",
            }),
          ),
          h(
            "div",
            { role: "group", class: "field", "aria-labelledby": "word-forms" },
            h("p", { class: "field-title", id: "word-forms" }, "Wortformen"),
            fieldErrors("forms").length > 0 &&
              h("p", { class: "field-error" }, fieldErrors("forms").join(" ")),
            textList(
              "word-form",
              form.forms,
              { one: (n) => `Wortform ${n}`, add: "Wortform hinzufügen" },
              set.termLanguage,
            ),
          ),
          h(
            "div",
            { role: "group", class: "field", "aria-labelledby": "examples" },
            h("p", { class: "field-title", id: "examples" }, "Beispiele"),
            form.examples.map((example, index) =>
              h(
                "div",
                {
                  role: "group",
                  class: "example",
                  "aria-labelledby": `example-${index}-legend`,
                },
                h(
                  "div",
                  { class: "group-head" },
                  h(
                    "span",
                    { class: "label", id: `example-${index}-legend` },
                    `Beispiel ${index + 1}`,
                  ),
                  removeButton(`Beispiel ${index + 1} entfernen`, "trash", () => {
                    form.examples.splice(index, 1);
                    render("example-add");
                  }),
                ),
                textField(
                  `example-${index}`,
                  "Satz",
                  example.text,
                  (value) => (example.text = value),
                  { lang: set.termLanguage, field: `examples.${index}` },
                ),
                textField(
                  `example-${index}-translation`,
                  "Übersetzung",
                  example.translation,
                  (value) => (example.translation = value),
                  { lang: set.meaningLanguage },
                ),
              ),
            ),
            addButton("example-add", "Beispiel hinzufügen", () => {
              form.examples.push({ text: "", translation: "" });
              render(`example-${form.examples.length - 1}`);
            }),
          ),
          h(
            "div",
            { class: "field" },
            textField("notes", "Notiz", form.notes, (value) => (form.notes = value), {
              field: "notes",
              multiline: true,
            }),
          ),
          h(
            "label",
            { class: "check" },
            h("input", {
              type: "checkbox",
              id: "checked",
              checked: form.checked,
              "aria-describedby": "checked-hint",
              onchange: (event: Event) => {
                form.checked = (event.target as HTMLInputElement).checked;
                refreshSummary();
              },
            }),
            h(
              "span",
              null,
              "Geprüft",
              h(
                "span",
                { class: "hint-text", id: "checked-hint" },
                "Du hast den Eintrag mit deiner Vokabelliste verglichen.",
              ),
            ),
          ),
        ),
      );
      const meaningName = (index: number) =>
        form.meanings.length > 1 ? `Bedeutung ${index + 1}` : "Bedeutung";
      fields.replaceChildren(
        h(
          "div",
          { class: "fields" },
          answerGroup("term", "Wort", form.term, set.termLanguage, "term"),
          form.meanings.map((meaning, index) =>
            answerGroup(
              `meaning-${index}`,
              meaningName(index),
              meaning,
              set.meaningLanguage,
              `meanings.${index}`,
              form.meanings.length > 1
                ? () => {
                    form.meanings.splice(index, 1);
                    render("meaning-add");
                  }
                : undefined,
            ),
          ),
          h(
            "button",
            {
              type: "button",
              class: "addcard",
              id: "meaning-add",
              onclick: () => {
                form.meanings.push({ text: "", variants: [] });
                render(`meaning-${form.meanings.length - 1}`);
              },
            },
            icon("plus"),
            h("span", null, "Weitere Bedeutung hinzufügen"),
          ),
          more,
        ),
      );
      refreshSummary();
      if (focusId) document.getElementById(focusId)?.focus();
    };

    const showErrors = (found: FormError[]) => {
      errors = found;
      render();
      summary.replaceChildren(
        h("p", null, "Der Eintrag ist noch nicht gespeichert:"),
        h(
          "ul",
          null,
          found.map((error) => h("li", null, error.message)),
        ),
      );
      focusSoon(summary);
    };

    /** Speichert; liefert `true`, wenn gespeichert ist. */
    const save = async (): Promise<boolean> => {
      if (busy) return false;
      setBusy(true);
      summary.replaceChildren();
      status.textContent = "";
      const outcome = await context.saveEntry(set, form, target);
      if (signal.aborted) return false;
      setBusy(false);
      if (outcome.ok) {
        set = outcome.set;
        errors = [];
        return true;
      }
      if ("errors" in outcome) showErrors(outcome.errors);
      else {
        summary.textContent = outcome.error;
        focusSoon(summary);
      }
      return false;
    };

    const saveAndLeave = async () => {
      if (!(await save())) return;
      original = structuredClone(form);
      guard.leave();
    };

    const saveAndNext = async () => {
      const saved = form.term.text.trim();
      if (!(await save())) return;
      form = emptyEntryForm();
      original = structuredClone(form);
      moreOpen = false;
      render("term");
      status.textContent = `„${saved}“ gespeichert. Jetzt der nächste Eintrag.`;
    };

    const discard = () => {
      original = structuredClone(form);
      guard.leave();
    };

    // Frage beim Verlassen mit Änderungen (Zurück-Taste).
    function showQuestion() {
      question = leaveQuestion(
        page.element,
        "Deine Änderungen an diesem Eintrag sind noch nicht gespeichert.",
        {
          save: async () => {
            if (await save()) {
              original = structuredClone(form);
              guard.leave();
            } else guard.stay();
          },
          discard,
          stay: () => {
            guard.stay();
            document.getElementById("term")?.focus();
          },
        },
      );
    }

    /** Vorwärts nach der Frage: Das Blatt geht zu, ohne dass noch etwas geschieht. */
    function hideQuestion() {
      question?.close();
      question = null;
    }

    const submit = h("button", { type: "submit" }, icon("check"), h("span", null, "Speichern"));
    buttons.push(submit);
    const discardButton = h(
      "button",
      { type: "button", class: "textbtn", onclick: discard },
      "Verwerfen",
    );
    buttons.push(discardButton);
    const actions = h(
      "div",
      { class: "form-end" },
      h(
        "div",
        { class: "form-buttons" },
        submit,
        entryId === undefined && button("Speichern und nächster Eintrag", () => void saveAndNext()),
      ),
      discardButton,
    );

    const sectionTitle = () => {
      const id =
        "sectionId" in target ? target.sectionId : findEntry(set, target.entryId)?.section.id;
      return set.sections.find((section) => section.id === id)?.title;
    };
    page.setTitle(entryId === undefined ? "Neuer Eintrag" : "Eintrag bearbeiten");
    main.replaceChildren(
      h("p", { class: "lead" }, [set.title, sectionTitle()].filter(Boolean).join(" · ")),
      summary,
      h(
        "form",
        {
          novalidate: true,
          onsubmit: (event: Event) => {
            event.preventDefault();
            void saveAndLeave();
          },
        },
        fields,
        status,
        actions,
      ),
      ...(entryId === undefined ? [] : [deletion(entryId)]),
    );
    render();

    /**
     * Löschen mit Rückfrage im Blatt (TDD 10, 13.7); die Antworten zum Eintrag bleiben, zählen aber
     * nicht mehr.
     */
    function deletion(id: string): Node {
      const start = h(
        "button",
        { type: "button", class: "destructive", onclick: () => ask() },
        icon("trash"),
        h("span", null, "Eintrag löschen"),
      );
      buttons.push(start);
      const ask = () => {
        start.disabled = true;
        const remove = h(
          "button",
          {
            type: "button",
            class: "danger",
            onclick: async () => {
              remove.disabled = abort.disabled = true;
              const outcome = await context.removeEntry(set, id);
              if (signal.aborted) return;
              if (outcome.ok) return discard();
              sheet.close();
              start.disabled = false;
              summary.textContent = outcome.error;
              focusSoon(summary);
            },
          },
          "Eintrag löschen",
        );
        const abort = h(
          "button",
          { type: "button", class: "secondary", onclick: () => sheet.dismiss() },
          "Abbrechen",
        );
        const text = h(
          "p",
          null,
          `„${original.term.text}“ wird gelöscht. Dein Lernstand zu diesem Eintrag zählt danach nicht mehr.`,
        );
        const sheet = openSheet(page.element, {
          title: "Eintrag löschen?",
          focus: text,
          content: [text, h("div", { class: "actions" }, abort, remove)],
          returnTo: start,
          onDismiss: () => (start.disabled = false),
        });
      };
      return h("ul", { class: "rows delete" }, h("li", null, start));
    }
  }

  return page.element;
}

/** Kürzel der Sprache für die Gruppe, z. B. „EN“ für `en` oder „EN-GB“ für `en-GB`. */
function languageBadge(code: string): string {
  return code.toUpperCase();
}
