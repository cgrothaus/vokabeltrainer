// Leeres Set anlegen (`#/new-set`, FR-02) und Angaben eines Sets bearbeiten (`#/set-info/<id>`,
// TDD 10, D-41). Beide Formulare fragen bei ungespeicherten Änderungen nach (components/unsavedGuard.ts).
import type { FormError } from "../../domain/entryForm";
import type { StoredSet } from "../../domain/model";
import {
  emptySetInfoForm,
  type SetInfoForm,
  setInfoChanged,
  setInfoToForm,
} from "../../domain/setInfoForm";
import { leaveQuestion } from "../components/leaveQuestion";
import { setInfoFields } from "../components/setInfoFields";
import { guardUnsaved } from "../components/unsavedGuard";
import type { InfoOutcome } from "../editSet";
import { focusSoon, h } from "../dom";

export interface NewSetContext {
  /** Sprachcodes vorhandener Sets für die Auswahl; scheitert das Laden, gibt es nur die gängigen. */
  loadLanguages: () => Promise<string[]>;
  createSet: (form: SetInfoForm, sectionTitle: string) => Promise<InfoOutcome>;
  /** Nach dem Anlegen, bevor die App zur Bearbeitung des Sets wechselt. */
  onCreated: (set: StoredSet) => void;
}

export interface SetInfoContext {
  /** `undefined`, wenn es das Set nicht gibt. */
  loadSet: () => Promise<StoredSet | undefined>;
  loadLanguages: () => Promise<string[]>;
  saveSetInfo: (set: StoredSet, form: SetInfoForm) => Promise<InfoOutcome>;
}

const NOT_LOADED = "Das Vokabelset konnte nicht geladen werden. Lade die Seite neu.";
const FIRST_SECTION = "Sektion 1";

const editPath = (id: string) => `#/edit/${encodeURIComponent(id)}`;

export function newSetView(context: NewSetContext, signal: AbortSignal): Node {
  const main = h("main", { class: "editor" });
  void context
    .loadLanguages()
    .catch(() => [])
    .then((languages) => {
      if (signal.aborted) return;
      const sectionId = "set-section";
      let sectionTitle = FIRST_SECTION;
      const sectionInput = h("input", {
        id: sectionId,
        type: "text",
        value: sectionTitle,
        autocomplete: "off",
        oninput: () => (sectionTitle = sectionInput.value),
      });
      const sectionError = h("p", { id: `${sectionId}-error`, class: "field-error", hidden: true });
      infoForm(main, signal, {
        title: "Leeres Set anlegen",
        intro:
          "Ein leeres Set füllst du selbst mit Einträgen. Die erste Sektion legst du gleich mit an; weitere kannst du später ergänzen.",
        initial: emptySetInfoForm(),
        languages,
        fallback: "#/",
        submitLabel: "Set anlegen",
        question: "Das neue Set ist noch nicht angelegt.",
        extra: [h("label", { for: sectionId }, "Erste Sektion"), sectionInput, sectionError],
        extraChanged: () => sectionTitle.trim() !== FIRST_SECTION,
        showExtraErrors: (errors) => {
          const error = errors.find((item) => item.field === "section");
          sectionError.hidden = !error;
          sectionError.textContent = error?.message ?? "";
          if (error) {
            sectionInput.setAttribute("aria-invalid", "true");
            sectionInput.setAttribute("aria-describedby", sectionError.id);
          } else {
            sectionInput.removeAttribute("aria-invalid");
            sectionInput.removeAttribute("aria-describedby");
          }
        },
        save: async (form) => {
          const outcome = await context.createSet(form, sectionTitle);
          if (outcome.ok) context.onCreated(outcome.set);
          return outcome;
        },
        // Zurück führt danach zur Bibliothek, nicht noch einmal ins leere Formular.
        done: (set, guard) => guard.leaveTo(editPath(set.id)),
      });
    });
  return main;
}

export function setInfoView(context: SetInfoContext, signal: AbortSignal, setId: string): Node {
  const main = h("main", { class: "editor" });
  void Promise.all([context.loadSet(), context.loadLanguages().catch(() => [])]).then(
    ([set, languages]) => {
      if (signal.aborted) return;
      if (!set)
        return main.replaceChildren(
          h("h1", null, "Set nicht gefunden"),
          h("p", null, "Dieses Vokabelset gibt es nicht (mehr)."),
          h("p", null, h("a", { href: "#/" }, "Zurück zur Bibliothek")),
        );
      infoForm(main, signal, {
        title: "Angaben bearbeiten",
        intro: null,
        initial: setInfoToForm(set),
        languages,
        fallback: editPath(set.id),
        submitLabel: "Speichern",
        question: "Deine Änderungen an den Angaben sind noch nicht gespeichert.",
        extra: [],
        extraChanged: () => false,
        showExtraErrors: () => {},
        save: (form) => context.saveSetInfo(set, form),
        done: (_set, guard) => guard.leave(),
      });
    },
    (error: unknown) => {
      console.error("Set nicht lesbar", error);
      main.replaceChildren(
        h("h1", null, "Angaben bearbeiten"),
        h("p", { role: "alert" }, NOT_LOADED),
        h("p", null, h("a", { href: editPath(setId) }, "Zurück")),
      );
    },
  );
  return main;
}

interface InfoFormOptions {
  title: string;
  intro: string | null;
  initial: SetInfoForm;
  languages: string[];
  fallback: string;
  submitLabel: string;
  question: string;
  /** Weitere Felder unter den Angaben, z. B. die erste Sektion beim Anlegen. */
  extra: Node[];
  extraChanged: () => boolean;
  showExtraErrors: (errors: FormError[]) => void;
  save: (form: SetInfoForm) => Promise<InfoOutcome>;
  done: (set: StoredSet, guard: ReturnType<typeof guardUnsaved>) => void;
}

function infoForm(main: HTMLElement, signal: AbortSignal, options: InfoFormOptions): void {
  const form = structuredClone(options.initial);
  let original = structuredClone(options.initial);
  let busy = false;
  let leaving = false;
  const changed = () => !leaving && (setInfoChanged(form, original) || options.extraChanged());

  const question = h("div");
  const summary = h("div", { role: "alert" });
  const fields = setInfoFields(form, options.languages);
  const submit = h("button", { type: "submit" }, options.submitLabel);
  const discardButton = h(
    "button",
    { type: "button", class: "secondary", onclick: () => discard() },
    "Verwerfen",
  );

  const guard = guardUnsaved({
    signal,
    fallback: options.fallback,
    changed,
    ask: () =>
      question.replaceChildren(
        leaveQuestion(options.question, {
          save: async () => {
            question.replaceChildren();
            if (!(await save())) guard.stay();
          },
          discard,
          stay: () => {
            question.replaceChildren();
            guard.stay();
            document.getElementById("set-title")?.focus();
          },
        }),
      ),
    resume: () => question.replaceChildren(),
  });

  const discard = () => {
    leaving = true;
    guard.leave();
  };

  /** Speichert; liefert `true`, wenn gespeichert ist, und verlässt dann das Formular. */
  const save = async (): Promise<boolean> => {
    if (busy) return false;
    busy = submit.disabled = discardButton.disabled = true;
    summary.replaceChildren();
    const outcome = await options.save(form);
    if (signal.aborted) return false;
    busy = submit.disabled = discardButton.disabled = false;
    if (outcome.ok) {
      original = structuredClone(form);
      leaving = true;
      options.done(outcome.set, guard);
      return true;
    }
    if ("errors" in outcome) {
      fields.showErrors(outcome.errors);
      options.showExtraErrors(outcome.errors);
      summary.replaceChildren(
        h("p", null, "Noch nicht gespeichert:"),
        h(
          "ul",
          null,
          outcome.errors.map((error) => h("li", null, error.message)),
        ),
      );
    } else summary.textContent = outcome.error;
    focusSoon(summary);
    return false;
  };

  main.replaceChildren(
    h("h1", null, options.title),
    options.intro ? h("p", null, options.intro) : "",
    question,
    summary,
    h(
      "form",
      {
        novalidate: true,
        onsubmit: (event: Event) => {
          event.preventDefault();
          void save();
        },
      },
      fields.element,
      ...options.extra,
      h("div", { class: "actions" }, submit, discardButton),
    ),
  );
}
