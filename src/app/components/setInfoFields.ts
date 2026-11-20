// Felder für die Angaben eines Sets (TDD 10, D-41): beim Anlegen eines leeren Sets und beim Bearbeiten.
// Sprachen als Auswahl mit deutschen Namen, dazu „Andere Sprache …“ mit Feld für den Sprachcode.
// Die Felder schreiben direkt in `form`; Prüfen und Speichern liegen in app/editSet.ts.
import type { FormError } from "../../domain/entryForm";
import type { SetInfoForm } from "../../domain/setInfoForm";
import { h } from "../dom";
import { languageOptions } from "../languages";

const OTHER = "other";

type TextField = "title" | "level" | "textbook" | "edition" | "source" | "license" | "notes";

export interface SetInfoFields {
  element: HTMLElement;
  /** Markiert Felder mit Fehlern und nennt die Meldung darunter; ohne Fehler wird alles zurückgesetzt. */
  showErrors: (errors: FormError[]) => void;
}

/**
 * `languages`: Sprachcodes vorhandener Sets, die zusätzlich zur Auswahl stehen. `extra`: weitere
 * Gruppen vor „Weitere Angaben“, z. B. die erste Sektion beim Anlegen.
 */
export function setInfoFields(
  form: SetInfoForm,
  languages: readonly string[],
  extra: Node[] = [],
): SetInfoFields {
  // Je Feld das Eingabeelement und der Platz für seine Meldung.
  const fields = new Map<string, { input: HTMLElement; message: HTMLElement }>();
  const message = (id: string) => h("p", { id: `${id}-error`, class: "field-error", hidden: true });

  const text = (field: TextField, label: string, multiline = false, big = false): Node => {
    const id = `set-${field}`;
    const props = {
      id,
      class: big ? "big" : null,
      oninput: (event: Event) => {
        form[field] = (event.target as HTMLInputElement).value;
        refreshSummary();
      },
    };
    const input = multiline
      ? h("textarea", { ...props, rows: 3, class: "plain" }, form[field])
      : h("input", { ...props, type: "text", value: form[field], autocomplete: "off" });
    const note = message(id);
    fields.set(field, { input, message: note });
    return h("div", { class: "field" }, h("label", { for: id }, label), input, note);
  };

  const language = (field: "termLanguage" | "meaningLanguage", label: string): Node => {
    const id = `set-${field}`;
    const options = languageOptions([form[field], ...languages]);
    const code = h("input", {
      id: `${id}-code`,
      type: "text",
      value: "",
      autocomplete: "off",
      autocapitalize: "off",
      spellcheck: "false",
      oninput: () => (form[field] = code.value),
    });
    const other = h(
      "div",
      { hidden: true },
      h("label", { for: `${id}-code` }, `Sprachcode der ${label}`),
      code,
      h(
        "p",
        { class: "hint-text" },
        "Zum Beispiel „en-GB“ für britisches Englisch oder „ko“ für Koreanisch.",
      ),
    );
    const select = h(
      "select",
      {
        id,
        onchange: () => {
          const isOther = select.value === OTHER;
          other.hidden = !isOther;
          form[field] = isOther ? code.value : select.value;
          if (isOther) code.focus();
        },
      },
      options.map(([value, name]) => h("option", { value, selected: value === form[field] }, name)),
      h("option", { value: OTHER }, "Andere Sprache …"),
    );
    const note = message(id);
    // Bei „Andere Sprache …“ gehört die Meldung zum Codefeld.
    fields.set(field, { input: select, message: note });
    fields.set(`${field}-code`, { input: code, message: note });
    return h("div", { class: "field" }, h("label", { for: id }, label), select, other, note);
  };

  /** Was unter „Weitere Angaben“ gefüllt ist, damit man es auch zugeklappt sieht (D-54). */
  const moreSummary = h("span", { class: "muted" });
  const refreshSummary = () => {
    const parts = [
      form.level.trim() && "Lernstufe",
      form.textbook.trim() && "Lehrwerk",
      form.edition.trim() && "Ausgabe",
      form.source.trim() && "Herkunft",
      form.license.trim() && "Lizenz",
      form.notes.trim() && "Notiz",
      form.checked && "geprüft",
    ].filter((part): part is string => !!part);
    moreSummary.textContent = parts.length > 0 ? ` · ${parts.join(", ")}` : "";
  };
  const more = h(
    "details",
    { class: "about more-details", id: "set-more" },
    h("summary", null, "Weitere Angaben", moreSummary),
    h(
      "div",
      { class: "more-body" },
      text("level", "Lernstufe"),
      h("div", { class: "pair-fields" }, text("textbook", "Lehrwerk"), text("edition", "Ausgabe")),
      h("div", { class: "pair-fields" }, text("source", "Herkunft"), text("license", "Lizenz")),
      text("notes", "Notiz", true),
      h(
        "label",
        { class: "check" },
        h("input", {
          type: "checkbox",
          checked: form.checked,
          "aria-describedby": "set-checked-hint",
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
            { class: "hint-text", id: "set-checked-hint" },
            "Du hast das Set mit deiner Vokabelliste verglichen.",
          ),
        ),
      ),
    ),
  );
  refreshSummary();

  const element = h(
    "div",
    { class: "fields" },
    h("div", { class: "form-group front" }, text("title", "Titel", false, true)),
    h(
      "div",
      { role: "group", class: "form-group", "aria-labelledby": "set-languages" },
      h("p", { class: "label", id: "set-languages" }, "Sprachen"),
      h(
        "div",
        { class: "pair-fields" },
        language("termLanguage", "Lernsprache"),
        language("meaningLanguage", "Bedeutungssprache"),
      ),
      h(
        "p",
        { class: "hint-text" },
        "Die Lernsprache steht vorn auf der Karteikarte, die Bedeutungssprache hinten.",
      ),
    ),
    extra,
    more,
  );

  const showErrors = (errors: FormError[]) => {
    for (const [, { input, message: note }] of fields) {
      input.removeAttribute("aria-invalid");
      input.removeAttribute("aria-describedby");
      note.hidden = true;
      note.textContent = "";
    }
    for (const error of errors) {
      const field = fields.get(error.field);
      if (!field) continue;
      field.input.setAttribute("aria-invalid", "true");
      field.input.setAttribute("aria-describedby", field.message.id);
      field.message.hidden = false;
      field.message.textContent = error.message;
      if (more.contains(field.input)) more.open = true;
    }
    // Bei „Andere Sprache …“ steht der Fehler am Codefeld.
    for (const field of ["termLanguage", "meaningLanguage"]) {
      const select = fields.get(field)!.input as HTMLSelectElement;
      if (select.value === OTHER && errors.some((error) => error.field === field)) {
        const code = fields.get(`${field}-code`)!.input;
        code.setAttribute("aria-invalid", "true");
        code.setAttribute("aria-describedby", `${select.id}-error`);
        select.removeAttribute("aria-invalid");
        select.removeAttribute("aria-describedby");
      }
    }
  };

  return { element, showErrors };
}
