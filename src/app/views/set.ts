// Set-Ansicht (TDD 13.1, FR-02, FR-03): Angaben des Sets, Sektionen zum Aufklappen mit allen Angaben
// der Einträge, Lernen und Löschen. Bearbeiten folgt mit M3 (S-30, S-31).
import { setSize } from "../../domain/library";
import type { Answer, StoredEntry, StoredSection, StoredSet } from "../../domain/model";
import { entryDetails } from "../components/entryDetails";
import { learnButton } from "../components/learnButton";
import type { DeleteOutcome, DeletionScope } from "../deleteSet";
import { type Child, h } from "../dom";
import { languageName } from "../languages";

export interface SetContext {
  /** `undefined`, wenn es das Set nicht gibt. */
  loadSet: () => Promise<StoredSet | undefined>;
  deletionScope: (set: StoredSet) => Promise<DeletionScope>;
  removeSet: (set: StoredSet) => Promise<DeleteOutcome>;
  /** Nach dem Löschen: Meldung für die Bibliothek und Wechsel dorthin. */
  onRemoved: (message: string) => void;
}

const NOT_LOADED = "Das Vokabelset konnte nicht geladen werden. Lade die Seite neu.";
const NO_SCOPE =
  "Der Umfang des Sets konnte nicht ermittelt werden. Lade die Seite neu und versuche es noch einmal.";

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const REVIEW_STATUS = { unchecked: "ungeprüft", checked: "geprüft" } as const;

/** Fokus auf ein Element, sobald es eingehängt ist; Screenreader lesen es dann vor. */
function focus(element: HTMLElement): void {
  element.tabIndex = -1;
  if (element.isConnected) element.focus();
  else queueMicrotask(() => element.isConnected && element.focus());
}

const back = () => h("p", null, h("a", { href: "#/" }, "Zurück zur Bibliothek"));

export function setView(context: SetContext): Node {
  const main = h("main", { class: "set" });
  void context.loadSet().then(
    // Ist die Ansicht schon verlassen, hängt `main` nirgends mehr; das Ersetzen bleibt dann folgenlos.
    (set) => {
      if (set) return main.replaceWith(h("main", { class: "set" }, content(set, context)));
      main.replaceChildren(
        h("h1", null, "Set nicht gefunden"),
        h("p", null, "Dieses Vokabelset gibt es nicht (mehr)."),
        back(),
      );
    },
    (error: unknown) => {
      console.error("Set nicht lesbar", error);
      main.replaceChildren(
        h("h1", null, "Vokabelset"),
        h("p", { role: "alert" }, NOT_LOADED),
        back(),
      );
    },
  );
  return main;
}

function content(set: StoredSet, context: SetContext): Child[] {
  const { entries } = setSize(set);
  return [
    h("h1", { class: "set-title" }, set.title),
    h(
      "p",
      { class: "languages" },
      `${languageName(set.termLanguage)} → ${languageName(set.meaningLanguage)} · ${count(entries, "Eintrag", "Einträge")}`,
    ),
    setDetails(set),
    entries > 0 && h("div", { class: "actions" }, learnButton(set)),
    h("h2", null, "Sektionen"),
    set.sections.length === 0
      ? h("p", null, "Dieses Set hat noch keine Sektionen.")
      : set.sections.map((section) => sectionView(section, set)),
    deletion(set, context),
    back(),
  ];
}

/** Nur vorhandene Angaben; ohne Angaben entfällt die Liste. */
function setDetails(set: StoredSet): Node | null {
  const textbook =
    set.textbook && set.edition ? `${set.textbook}, ${set.edition}` : (set.textbook ?? set.edition);
  const rows: [string, string | undefined][] = [
    ["Lernstufe", set.level],
    [set.textbook ? "Lehrwerk" : "Ausgabe", textbook],
    ["Herkunft", set.source],
    ["Lizenz", set.license],
    ["Notiz", set.notes],
    ["Prüfstatus", set.reviewStatus && REVIEW_STATUS[set.reviewStatus]],
  ];
  const shown = rows.filter((row): row is [string, string] => row[1] !== undefined);
  if (shown.length === 0) return null;
  return h(
    "dl",
    { class: "details" },
    shown.map(([label, value]) => h("div", null, h("dt", null, label), h("dd", null, value))),
  );
}

function sectionView(section: StoredSection, set: StoredSet): Node {
  return h(
    "details",
    { class: "section" },
    h(
      "summary",
      null,
      h("span", { class: "title" }, section.title),
      " ",
      h("span", { class: "count" }, count(section.entries.length, "Eintrag", "Einträge")),
    ),
    section.entries.length === 0
      ? h("p", null, "Diese Sektion hat noch keine Einträge.")
      : h(
          "ul",
          { class: "entries" },
          section.entries.map((entry) => entryView(entry, set)),
        ),
  );
}

/** Text mit seinen Varianten, z. B. „autumn (auch: fall)“. */
function answer(value: Answer, lang: string, className: string): Node {
  const variants = value.acceptedVariants ?? [];
  return h(
    "span",
    { class: className, lang },
    value.text,
    variants.length > 0 && h("span", { class: "variants" }, ` (auch: ${variants.join(", ")})`),
  );
}

function entryView(entry: StoredEntry, set: StoredSet): Node {
  const meanings = entry.meanings.flatMap((meaning, index) => [
    index > 0 && "; ",
    answer(meaning, set.meaningLanguage, "meaning"),
  ]);
  return h(
    "li",
    null,
    h(
      "p",
      { class: "pair" },
      answer(entry.term, set.termLanguage, "term"),
      " – ",
      meanings,
      // Als Text, nicht nur als Farbe (TDD 13.4).
      entry.reviewStatus === "unchecked" && [" ", h("span", { class: "badge" }, "ungeprüft")],
    ),
    entryDetails(entry, set),
  );
}

function describeScope(scope: DeletionScope): string {
  const content = `Gelöscht werden ${count(scope.sections, "Sektion", "Sektionen")} mit ${count(scope.entries, "Eintrag", "Einträgen")}`;
  if (scope.sessions === 0) return `${content}. Mit diesem Set hast du noch nicht gelernt.`;
  return `${content} und dein Lernstand dazu: ${count(scope.events, "Antwort", "Antworten")} aus ${count(scope.sessions, "Lernsitzung", "Lernsitzungen")}.`;
}

/** Löschen mit Ankündigung des Umfangs (FR-02); die Schaltfläche nennt die Folge (TDD 13.3). */
function deletion(set: StoredSet, context: SetContext): Node {
  const confirmation = h("div");
  const errors = h("div", { role: "alert" });
  const start = h(
    "button",
    {
      type: "button",
      class: "secondary",
      onclick: async () => {
        start.disabled = true;
        errors.replaceChildren();
        let scope: DeletionScope;
        try {
          scope = await context.deletionScope(set);
        } catch (error) {
          console.error("Umfang nicht ermittelt", error);
          errors.textContent = NO_SCOPE;
          start.disabled = false;
          return;
        }
        confirm(scope);
      },
    },
    "Set löschen",
  );

  const cancel = () => {
    confirmation.replaceChildren();
    start.disabled = false;
    start.focus();
  };

  const confirm = (scope: DeletionScope) => {
    const text = h("p", null, describeScope(scope));
    const remove = h(
      "button",
      {
        type: "button",
        onclick: async () => {
          remove.disabled = abort.disabled = true;
          let outcome: DeleteOutcome;
          try {
            outcome = await context.removeSet(set);
          } catch (error) {
            console.error("Set nicht gelöscht", error);
            outcome = { ok: false, error: "Das Set konnte nicht gelöscht werden." };
          }
          if (outcome.ok) return context.onRemoved(`„${set.title}“ gelöscht.`);
          confirmation.replaceChildren();
          errors.textContent = outcome.error;
          start.disabled = false;
        },
      },
      scope.entries > 0
        ? `Set mit ${count(scope.entries, "Eintrag", "Einträgen")} löschen`
        : "Endgültig löschen",
    );
    const abort = h("button", { type: "button", class: "secondary", onclick: cancel }, "Abbrechen");
    confirmation.replaceChildren(
      h(
        "div",
        { class: "confirm" },
        text,
        h(
          "p",
          null,
          "Das lässt sich nicht rückgängig machen. ",
          h("a", { href: "#/backup" }, "Vorher ein Backup speichern"),
        ),
        h("div", { class: "actions" }, remove, abort),
      ),
    );
    focus(text);
  };

  return h("div", { class: "delete" }, start, confirmation, errors);
}
