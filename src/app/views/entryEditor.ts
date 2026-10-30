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
import { guardUnsaved, type UnsavedGuard } from "../components/unsavedGuard";
import type { EditOutcome, EntryOutcome } from "../editSet";
import { type Child, focusSoon, h } from "../dom";

export interface EntryEditorContext {
  /** `undefined`, wenn es das Set nicht gibt. */
  loadSet: () => Promise<StoredSet | undefined>;
  saveEntry: (set: StoredSet, form: EntryForm, entryId?: string) => Promise<EntryOutcome>;
  removeEntry: (set: StoredSet, entryId: string) => Promise<EditOutcome>;
}

/** Entweder ein vorhandener Eintrag oder ein neuer in einer Sektion. */
export type EditorTarget = { entryId: string } | { sectionId: string };

const NOT_LOADED = "Das Vokabelset konnte nicht geladen werden. Lade die Seite neu.";

export function entryEditorView(
  context: EntryEditorContext,
  signal: AbortSignal,
  setId: string,
  target: EditorTarget,
): Node {
  const main = h("main", { class: "editor" });
  const missing = (title: string, text: string, href: string, link: string) =>
    main.replaceChildren(
      h("h1", null, title),
      h("p", null, text),
      h("p", null, h("a", { href }, link)),
    );
  void context.loadSet().then(
    (set) => {
      if (signal.aborted) return;
      if (!set)
        return missing(
          "Set nicht gefunden",
          "Dieses Vokabelset gibt es nicht (mehr).",
          "#/",
          "Zurück zur Bibliothek",
        );
      const editPath = `#/edit/${encodeURIComponent(set.id)}`;
      if ("entryId" in target) {
        const found = findEntry(set, target.entryId);
        if (!found)
          return missing(
            "Eintrag nicht gefunden",
            "Diesen Eintrag gibt es nicht (mehr).",
            editPath,
            "Zurück zum Bearbeiten",
          );
        return editor(main, set, entryToForm(found.entry, found.section.id), target.entryId);
      }
      if (!set.sections.some((section) => section.id === target.sectionId))
        return missing(
          "Sektion nicht gefunden",
          "Diese Sektion gibt es nicht (mehr).",
          editPath,
          "Zurück zum Bearbeiten",
        );
      editor(main, set, emptyEntryForm(target.sectionId));
    },
    (error: unknown) => {
      console.error("Set nicht lesbar", error);
      main.replaceChildren(
        h("h1", null, "Eintrag bearbeiten"),
        h("p", { role: "alert" }, NOT_LOADED),
        h("p", null, h("a", { href: `#/edit/${encodeURIComponent(setId)}` }, "Zurück")),
      );
    },
  );

  /**
   * Baut das Formular. `entryId` fehlt bei einem neuen Eintrag; nach „Speichern und nächster Eintrag“
   * bleibt es so, und das Formular beginnt leer in derselben Sektion.
   */
  function editor(main: HTMLElement, loaded: StoredSet, initial: EntryForm, entryId?: string) {
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

    const question = h("div");
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

    /** Feld mit sichtbarer Beschriftung; Fehler dazu stehen darunter und werden mit vorgelesen. */
    const textField = (
      id: string,
      label: string,
      value: string,
      update: (value: string) => void,
      options: { lang?: string; field?: string; multiline?: boolean } = {},
    ): Child[] => {
      const messages = options.field ? fieldErrors(options.field) : [];
      const props = {
        id,
        lang: options.lang,
        "aria-invalid": messages.length > 0 ? "true" : null,
        "aria-describedby": messages.length > 0 ? `${id}-error` : null,
        oninput: (event: Event) => update((event.target as HTMLInputElement).value),
      };
      const input = options.multiline
        ? h("textarea", { ...props, rows: 3, class: "plain" }, value)
        : h("input", { ...props, type: "text", value, autocomplete: "off" });
      return [
        h("label", { for: id }, label),
        input,
        messages.length > 0 &&
          h("p", { id: `${id}-error`, class: "field-error" }, messages.join(" ")),
      ];
    };

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
          h(
            "div",
            { class: "grow" },
            textField(
              `${id}-${index}`,
              names.one(index + 1),
              value,
              (text) => (values[index] = text),
              {
                lang,
              },
            ),
          ),
          h(
            "button",
            {
              type: "button",
              class: "secondary",
              "aria-label": `${names.one(index + 1)} entfernen`,
              onclick: () => {
                values.splice(index, 1);
                render(values.length > index ? `${id}-${index}` : `${id}-add`);
              },
            },
            "Entfernen",
          ),
        ),
      ),
      h(
        "button",
        {
          type: "button",
          class: "secondary",
          id: `${id}-add`,
          onclick: () => {
            values.push("");
            render(`${id}-${values.length - 1}`);
          },
        },
        names.add,
      ),
    ];

    const answerGroup = (
      id: string,
      legend: string,
      answer: AnswerForm,
      lang: string,
      field: string,
      remove?: () => void,
    ): Node =>
      h(
        "fieldset",
        { class: "answer" },
        h("legend", null, legend),
        textField(id, "Text", answer.text, (text) => (answer.text = text), { lang, field }),
        textList(
          `${id}-variant`,
          answer.variants,
          { one: (n) => `Variante ${n} von „${legend}“`, add: "Variante hinzufügen" },
          lang,
        ),
        remove &&
          h(
            "button",
            { type: "button", class: "secondary", onclick: remove },
            `${legend} entfernen`,
          ),
      );

    /** Auswahl mit bekannten Werten auf Deutsch; ein anderer Wert aus dem Set bleibt wählbar. */
    const choice = (
      id: string,
      label: string,
      known: Record<string, string>,
      value: string,
      update: (value: string) => void,
    ): Child[] => {
      const options: [string, string][] = [["", "keine Angabe"], ...Object.entries(known)];
      if (value !== "" && !(value in known)) options.push([value, value]);
      return [
        h("label", { for: id }, label),
        h(
          "select",
          { id, onchange: (event: Event) => update((event.target as HTMLSelectElement).value) },
          options.map(([optionValue, text]) =>
            h("option", { value: optionValue, selected: optionValue === value }, text),
          ),
        ),
      ];
    };

    const hasMore = () =>
      [form.partOfSpeech, form.gender, form.plural, form.notes, ...form.forms].some(
        (value) => value.trim() !== "",
      ) ||
      form.examples.length > 0 ||
      form.checked ||
      errors.some(
        (error) => !error.field.startsWith("term") && !error.field.startsWith("meanings"),
      );

    let moreOpen = false;

    const render = (focusId?: string) => {
      const sections = set.sections.length > 1 && [
        h("label", { for: "section" }, "Sektion"),
        h(
          "select",
          {
            id: "section",
            onchange: (event: Event) =>
              (form.sectionId = (event.target as HTMLSelectElement).value),
          },
          set.sections.map((section) =>
            h(
              "option",
              { value: section.id, selected: section.id === form.sectionId },
              section.title,
            ),
          ),
        ),
        h("p", { class: "hint-text" }, "In einer anderen Sektion steht der Eintrag am Ende."),
      ];
      const more = h(
        "details",
        {
          class: "more",
          open: moreOpen || hasMore(),
          ontoggle: () => (moreOpen = more.open),
        },
        h("summary", null, "Weitere Angaben"),
        choice("part-of-speech", "Wortart", PARTS_OF_SPEECH, form.partOfSpeech, (value) => {
          form.partOfSpeech = value;
        }),
        choice("gender", "Genus", GENDERS, form.gender, (value) => (form.gender = value)),
        textField("plural", "Plural", form.plural, (value) => (form.plural = value), {
          lang: set.termLanguage,
          field: "plural",
        }),
        h(
          "fieldset",
          null,
          h("legend", null, "Wortformen"),
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
          "fieldset",
          null,
          h("legend", null, "Beispiele"),
          form.examples.map((example, index) =>
            h(
              "div",
              { class: "example" },
              textField(
                `example-${index}`,
                `Beispiel ${index + 1}`,
                example.text,
                (value) => (example.text = value),
                { lang: set.termLanguage, field: `examples.${index}` },
              ),
              textField(
                `example-${index}-translation`,
                `Übersetzung von Beispiel ${index + 1}`,
                example.translation,
                (value) => (example.translation = value),
                { lang: set.meaningLanguage },
              ),
              h(
                "button",
                {
                  type: "button",
                  class: "secondary",
                  onclick: () => {
                    form.examples.splice(index, 1);
                    render("example-add");
                  },
                },
                `Beispiel ${index + 1} entfernen`,
              ),
            ),
          ),
          h(
            "button",
            {
              type: "button",
              class: "secondary",
              id: "example-add",
              onclick: () => {
                form.examples.push({ text: "", translation: "" });
                render(`example-${form.examples.length - 1}`);
              },
            },
            "Beispiel hinzufügen",
          ),
        ),
        textField("notes", "Notiz", form.notes, (value) => (form.notes = value), {
          field: "notes",
          multiline: true,
        }),
        h(
          "label",
          { class: "check" },
          h("input", {
            type: "checkbox",
            id: "checked",
            checked: form.checked,
            onchange: (event: Event) => (form.checked = (event.target as HTMLInputElement).checked),
          }),
          "Geprüft",
        ),
      );
      fields.replaceChildren(
        h(
          "div",
          { class: "fields" },
          answerGroup("term", "Wort", form.term, set.termLanguage, "term"),
          form.meanings.map((meaning, index) =>
            answerGroup(
              `meaning-${index}`,
              `Bedeutung ${index + 1}`,
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
              class: "secondary",
              id: "meaning-add",
              onclick: () => {
                form.meanings.push({ text: "", variants: [] });
                render(`meaning-${form.meanings.length - 1}`);
              },
            },
            "Bedeutung hinzufügen",
          ),
          sections,
          more,
        ),
      );
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
      const outcome = await context.saveEntry(set, form, entryId);
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
      form = emptyEntryForm(form.sectionId);
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
      const text = h("p", null, "Deine Änderungen an diesem Eintrag sind noch nicht gespeichert.");
      question.replaceChildren(
        h(
          "div",
          { class: "confirm" },
          text,
          h(
            "div",
            { class: "actions" },
            h(
              "button",
              {
                type: "button",
                onclick: async () => {
                  hideQuestion();
                  if (await save()) {
                    original = structuredClone(form);
                    guard.leave();
                  } else guard.stay();
                },
              },
              "Speichern",
            ),
            h("button", { type: "button", class: "secondary", onclick: discard }, "Verwerfen"),
            h(
              "button",
              {
                type: "button",
                class: "secondary",
                onclick: () => {
                  hideQuestion();
                  guard.stay();
                  document.getElementById("term")?.focus();
                },
              },
              "Weiter bearbeiten",
            ),
          ),
        ),
      );
      focusSoon(text);
    }

    function hideQuestion() {
      question.replaceChildren();
    }

    const submit = h("button", { type: "submit" }, "Speichern");
    buttons.push(submit);
    const actions = h(
      "div",
      { class: "actions" },
      submit,
      entryId === undefined && button("Speichern und nächster Eintrag", () => void saveAndNext()),
      button("Verwerfen", discard),
    );

    const heading = h("h1", null, entryId === undefined ? "Neuer Eintrag" : "Eintrag bearbeiten");
    main.replaceChildren(
      heading,
      h("p", { class: "languages" }, set.title),
      question,
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

    /** Löschen mit Ankündigung; die Antworten zum Eintrag bleiben, zählen aber nicht mehr (TDD 10). */
    function deletion(id: string): Node {
      const confirmation = h("div");
      const start = button("Eintrag löschen", () => {
        start.disabled = true;
        const text = h(
          "p",
          null,
          `„${original.term.text}“ wird gelöscht. Dein Lernstand zu diesem Eintrag zählt danach nicht mehr.`,
        );
        const remove = h(
          "button",
          {
            type: "button",
            onclick: async () => {
              remove.disabled = abort.disabled = true;
              const outcome = await context.removeEntry(set, id);
              if (signal.aborted) return;
              if (outcome.ok) return discard();
              confirmation.replaceChildren();
              start.disabled = false;
              summary.textContent = outcome.error;
              focusSoon(summary);
            },
          },
          "Eintrag löschen",
        );
        const abort = h(
          "button",
          {
            type: "button",
            class: "secondary",
            onclick: () => {
              confirmation.replaceChildren();
              start.disabled = false;
              start.focus();
            },
          },
          "Abbrechen",
        );
        confirmation.replaceChildren(
          h("div", { class: "confirm" }, text, h("div", { class: "actions" }, remove, abort)),
        );
        focusSoon(text);
      });
      return h("div", { class: "delete" }, start, confirmation);
    }
  }

  return main;
}
