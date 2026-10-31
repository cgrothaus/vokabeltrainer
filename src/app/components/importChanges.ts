// Vorschau einer Datei zu einem vorhandenen Set (TDD 9.7, FR-14, FR-16, FR-29): Aktualisieren oder
// Ersetzen, was sich ändert, Konflikte mit beiden Fassungen, nicht mehr vorhandene Einträge und
// Löschungen. Entschieden wird hier, gerechnet in domain/diff.ts, gespeichert über `save`.
import type { EntryChange, ImportDiff, ImportMode, SectionChange } from "../../domain/diff";
import type { EntryContent, ImportDecisions } from "../../domain/merge";
import type { Answer, StoredEntry, StoredSet } from "../../domain/model";
import type { SetInfo } from "../../domain/normalize";
import { type Child, focusSoon, h } from "../dom";
import type { KnownPreview, KnownSaveOutcome } from "../importText";
import { languageName } from "../languages";
import { entryDetails } from "./entryDetails";

export interface ChangesContext {
  save: (
    preview: KnownPreview,
    mode: ImportMode,
    decisions: ImportDecisions,
  ) => Promise<KnownSaveOutcome>;
  /** Nach dem Speichern, mit der Meldung für die Set-Ansicht. */
  onSaved: (setId: string, message: string) => void;
  onCancel: () => void;
}

const UNEXPECTED =
  "Beim Übernehmen ist ein Fehler aufgetreten. Lade die Seite neu und versuche es noch einmal.";

const MODES: { mode: ImportMode; label: string; hint: string }[] = [
  {
    mode: "update",
    label: "Aktualisieren",
    hint: "Ändert und ergänzt, was in der Datei steht. Was dort fehlt, bleibt erhalten.",
  },
  {
    mode: "replace",
    label: "Ersetzen",
    hint: "Danach entspricht der Bereich genau der Datei. Was dort fehlt, wird gelöscht.",
  },
];

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const answerText = (answer: Answer) =>
  answer.acceptedVariants && answer.acceptedVariants.length > 0
    ? `${answer.text} (auch: ${answer.acceptedVariants.join(", ")})`
    : answer.text;

export function importChanges(preview: KnownPreview, context: ChangesContext): HTMLElement {
  const { local } = preview;
  let mode: ImportMode = "update";
  const takeFile = new Set<string>();
  const adopt = new Set<string>();

  const heading = h("h2", { id: "import-preview" }, "Vorschau");
  const body = h("div");
  const errors = h("div", { role: "alert" });
  const notice = preview.notice
    ? h("div", { class: "warning", tabindex: "-1" }, h("p", null, preview.notice))
    : null;

  const scopeText =
    preview.diffs.update.scope.type === "set"
      ? "Die Datei enthält das ganze Set."
      : `Die Datei enthält ${count(preview.diffs.update.scope.sectionIds.length, "Sektion", "Sektionen")}: ${preview.diffs.update.scope.sectionIds
          .map((id) => local.sections.find((section) => section.id === id)?.title)
          .filter((title) => title !== undefined)
          .map((title) => `„${title}“`)
          .join(", ")}.`;

  const modeChoice = h(
    "fieldset",
    null,
    h("legend", null, "Wie übernehmen?"),
    h(
      "div",
      { class: "choices" },
      MODES.map((choice) =>
        h(
          "label",
          null,
          h("input", {
            type: "radio",
            name: "import-mode",
            checked: choice.mode === mode,
            onchange: () => {
              mode = choice.mode;
              render();
            },
          }),
          choice.label,
        ),
      ),
    ),
  );

  const element = h(
    "section",
    { class: "confirm changes", "aria-labelledby": "import-preview" },
    heading,
    notice,
    h("p", { class: "preview-title" }, local.title),
    h("p", null, `${languageName(local.termLanguage)} → ${languageName(local.meaningLanguage)}`),
    h("p", null, `Dieses Set hast du schon. ${scopeText}`),
    modeChoice,
    body,
    errors,
  );

  const render = () => {
    const diff = preview.diffs[mode];
    const confirm = h(
      "button",
      { type: "button", onclick: () => void submit(confirm, cancel) },
      confirmLabel(diff),
    );
    const cancel = h(
      "button",
      { type: "button", class: "secondary", onclick: () => context.onCancel() },
      diff.hasChanges ? "Abbrechen" : "Zurück",
    );
    body.replaceChildren(
      h(
        "div",
        null,
        h("p", { class: "hint-text" }, MODES.find((choice) => choice.mode === mode)!.hint),
        hints(preview, diff),
        summary(diff),
        conflicts(diff, local, takeFile),
        missing(diff, local, adopt),
        categories(diff, local),
        h("div", { class: "actions" }, diff.hasChanges && confirm, cancel),
      ),
    );
  };

  const submit = async (confirm: HTMLButtonElement, cancel: HTMLButtonElement) => {
    confirm.disabled = true;
    cancel.disabled = true;
    errors.replaceChildren();
    let outcome: KnownSaveOutcome;
    try {
      outcome = await context.save(preview, mode, { takeFile, adopt });
    } catch (error) {
      console.error("Änderungen nicht gespeichert", error);
      outcome = { ok: false, error: UNEXPECTED };
    }
    if (outcome.ok) return context.onSaved(outcome.setId, outcome.message);
    if ("stale" in outcome) {
      // Entscheidungen beziehen sich auf den alten Stand und gelten nicht mehr (D-44).
      const fresh = importChanges(outcome.stale, context);
      element.replaceWith(fresh);
      return;
    }
    confirm.disabled = false;
    cancel.disabled = false;
    errors.replaceChildren(h("p", null, outcome.error));
  };

  render();
  focusSoon(notice ?? heading);
  return element;
}

function confirmLabel(diff: ImportDiff): string {
  if (diff.mode === "update") return "Aktualisieren";
  const sections = diff.sections.filter((section) => section.kind === "removed").length;
  if (diff.counts.removed > 0)
    return `Ersetzen und ${count(diff.counts.removed, "Eintrag", "Einträge")} löschen`;
  if (sections > 0) return `Ersetzen und ${count(sections, "Sektion", "Sektionen")} löschen`;
  return "Ersetzen";
}

function hints(preview: KnownPreview, diff: ImportDiff): Child {
  const items = [
    ...(preview.trimmed ? ["Text vor und nach dem Vokabelset wurde weggelassen."] : []),
    ...preview.warnings,
    ...diff.warnings,
  ];
  return (
    items.length > 0 &&
    h(
      "div",
      null,
      h("p", null, "Hinweise:"),
      h(
        "ul",
        null,
        items.map((item) => h("li", null, item)),
      ),
    )
  );
}

function summary(diff: ImportDiff): Child {
  if (!diff.hasChanges)
    return h("p", { class: "preview-title" }, "Die Datei enthält keine Änderungen.");
  const { counts } = diff;
  const lines = [
    diff.setInfo?.kind === "changed" && "Die Angaben zum Set ändern sich.",
    counts.added > 0 && `${count(counts.added, "Eintrag", "Einträge")} neu`,
    counts.changed > 0 && `${count(counts.changed, "Eintrag", "Einträge")} geändert`,
    counts.moved > 0 && `${count(counts.moved, "Eintrag", "Einträge")} verschoben`,
    counts.removed > 0 &&
      (counts.removed === 1
        ? "1 Eintrag wird gelöscht"
        : `${counts.removed} Einträge werden gelöscht`),
    counts.conflict > 0 &&
      `${count(counts.conflict, "Eintrag", "Einträge")} in App und Datei geändert`,
    counts.missingLocally > 0 &&
      `${count(counts.missingLocally, "Eintrag", "Einträge")} nicht mehr in der App`,
    counts.notApplicable > 0 &&
      `${count(counts.notApplicable, "Eintrag", "Einträge")} nicht übernehmbar`,
    counts.unchanged > 0 && `${count(counts.unchanged, "Eintrag", "Einträge")} unverändert`,
    ...diff.sections.flatMap(sectionLine),
    diff.sectionsReordered && "Die Sektionen stehen danach in der Reihenfolge der Datei.",
  ].filter((line): line is string => !!line);
  return h(
    "ul",
    { class: "summary" },
    lines.map((line) => h("li", null, line)),
  );
}

function sectionLine(section: SectionChange): string[] {
  const lines: string[] = [];
  if (section.kind === "added") lines.push(`Neue Sektion „${section.title}“`);
  if (section.kind === "removed") lines.push(`Die Sektion „${section.title}“ wird gelöscht.`);
  if (section.kind === "changed")
    lines.push(`Die Sektion „${section.title}“ heißt danach „${section.fileTitle}“.`);
  if (section.reordered) lines.push(`In „${section.title}“ ändert sich die Reihenfolge.`);
  return lines;
}

function entryLine(entry: EntryContent, set: StoredSet): Child[] {
  return [
    h("span", { lang: set.termLanguage }, answerText(entry.term)),
    " – ",
    h("span", { lang: set.meaningLanguage }, entry.meanings.map(answerText).join("; ")),
  ];
}

function entryVersion(label: string, entry: EntryContent, set: StoredSet): Node {
  const shown = { id: "", ...entry } as StoredEntry;
  return h(
    "div",
    { class: "version" },
    h("p", { class: "version-label" }, label),
    h("p", null, entryLine(entry, set)),
    entryDetails(shown, set),
    entry.reviewStatus === "unchecked" && h("p", { class: "extra" }, "Noch nicht geprüft"),
  );
}

function infoVersion(label: string, info: SetInfo): Node {
  const rows = [
    info.title,
    `${languageName(info.termLanguage)} → ${languageName(info.meaningLanguage)}`,
    info.level && `Lernstufe: ${info.level}`,
    info.textbook && `Lehrwerk: ${info.textbook}`,
    info.edition && `Ausgabe: ${info.edition}`,
    info.source && `Herkunft: ${info.source}`,
    info.license && `Lizenz: ${info.license}`,
    info.notes && `Notiz: ${info.notes}`,
  ].filter((row): row is string => !!row);
  return h(
    "div",
    { class: "version" },
    h("p", { class: "version-label" }, label),
    rows.map((row) => h("p", null, row)),
  );
}

function titleVersion(label: string, title: string): Node {
  return h(
    "div",
    { class: "version" },
    h("p", { class: "version-label" }, label),
    h("p", null, title),
  );
}

/** Konflikte (TDD 9.5): beide Fassungen, Standard „In der App behalten“, gemeinsam umschaltbar. */
function conflicts(diff: ImportDiff, set: StoredSet, takeFile: Set<string>): Child {
  const items: { key: string; legend: string; versions: [Node, Node] }[] = [];
  if (diff.setInfo?.kind === "conflict")
    items.push({
      key: "set",
      legend: "Angaben zum Set",
      versions: [
        infoVersion("In der App", diff.setInfo.local),
        infoVersion("In der Datei", diff.setInfo.file),
      ],
    });
  for (const section of diff.sections)
    if (section.kind === "conflict")
      items.push({
        key: section.key,
        legend: `Titel der Sektion „${section.title}“`,
        versions: [
          titleVersion("In der App", section.title),
          titleVersion("In der Datei", section.fileTitle!),
        ],
      });
  for (const entry of diff.entries)
    if (entry.kind === "conflict")
      items.push({
        key: entry.key,
        legend: entry.local!.term.text,
        versions: [
          entryVersion("In der App", entry.local!, set),
          entryVersion("In der Datei", entry.file!, set),
        ],
      });
  if (items.length === 0) return null;

  const radios: { key: string; app: HTMLInputElement; file: HTMLInputElement }[] = [];
  const groups = items.map((item, index) => {
    const name = `conflict-${index}`;
    const choose = (fromFile: boolean) => {
      if (fromFile) takeFile.add(item.key);
      else takeFile.delete(item.key);
    };
    const app = h("input", {
      type: "radio",
      name,
      checked: !takeFile.has(item.key),
      onchange: () => choose(false),
    });
    const file = h("input", {
      type: "radio",
      name,
      checked: takeFile.has(item.key),
      onchange: () => choose(true),
    });
    radios.push({ key: item.key, app, file });
    return h(
      "fieldset",
      { class: "conflict" },
      h("legend", null, item.legend),
      h("div", { class: "versions" }, item.versions),
      h(
        "div",
        { class: "choices" },
        h("label", null, app, "In der App behalten"),
        h("label", null, file, "Datei übernehmen"),
      ),
    );
  });
  const all = h(
    "button",
    {
      type: "button",
      class: "secondary",
      onclick: () => {
        for (const radio of radios) {
          radio.file.checked = true;
          takeFile.add(radio.key);
        }
      },
    },
    "Bei allen die Datei übernehmen",
  );
  return h(
    "div",
    { class: "conflicts" },
    h("h3", null, "Konflikte"),
    h(
      "p",
      null,
      "Das wurde seit dem Export in der App und in der Datei geändert. Ohne deine Wahl bleibt die Fassung aus der App.",
    ),
    items.length > 1 && h("div", { class: "actions" }, all),
    groups,
  );
}

/** Einträge, die es in der App nicht mehr gibt (TDD 9.6): nur auf Wunsch neu anlegen. */
function missing(diff: ImportDiff, set: StoredSet, adopt: Set<string>): Child {
  const items = diff.entries.filter((entry) => entry.kind === "missingLocally");
  if (items.length === 0) return null;
  return h(
    "div",
    null,
    h("h3", null, "Nicht mehr vorhanden"),
    h(
      "p",
      null,
      "Diese Einträge gibt es in der App nicht mehr, zum Beispiel weil du sie gelöscht hast. Sie werden nur angelegt, wenn du sie auswählst.",
    ),
    h(
      "ul",
      { class: "section-choice" },
      items.map((entry) =>
        h(
          "li",
          null,
          h(
            "label",
            null,
            h("input", {
              type: "checkbox",
              checked: adopt.has(entry.key),
              onchange: (event: Event) => {
                if ((event.target as HTMLInputElement).checked) adopt.add(entry.key);
                else adopt.delete(entry.key);
              },
            }),
            h("span", { class: "title" }, entryLine(entry.file!, set)),
            h("span", { class: "count" }, entry.section),
          ),
        ),
      ),
    ),
  );
}

const CATEGORIES: {
  kind: EntryChange["kind"] | "moved";
  title: string;
  open: boolean;
  explanation?: string;
}[] = [
  { kind: "added", title: "Neu", open: true },
  { kind: "changed", title: "Geändert", open: true },
  { kind: "moved", title: "Verschoben", open: true },
  { kind: "removed", title: "Wird gelöscht", open: true },
  {
    kind: "notApplicable",
    title: "Kann nicht übernommen werden",
    open: true,
    explanation:
      "Diese Einträge stehen in der App in einer Sektion, die nicht zur Datei gehört. Exportiere diese Sektion, um sie dort zu ändern.",
  },
  { kind: "unchanged", title: "Unverändert", open: false },
];

function categories(diff: ImportDiff, set: StoredSet): Child[] {
  return CATEGORIES.map((category) => {
    const items = diff.entries.filter((entry) =>
      category.kind === "moved" ? entry.movedFrom !== undefined : entry.kind === category.kind,
    );
    if (items.length === 0) return null;
    return h(
      "details",
      { open: category.open && items.length <= 50 },
      h("summary", null, `${category.title} (${items.length})`),
      category.explanation && h("p", null, category.explanation),
      h(
        "ul",
        null,
        items.map((entry) =>
          h(
            "li",
            null,
            // Unverändert bleibt die Fassung der App, auch wenn die Datei sie anders zeigt (TDD 9.5).
            entryLine(
              entry.kind === "unchanged" ? entry.local! : (entry.file ?? entry.local!),
              set,
            ),
            " ",
            h(
              "span",
              { class: "count" },
              entry.movedFrom !== undefined
                ? `${entry.movedFrom} → ${entry.section}`
                : entry.section,
            ),
          ),
        ),
      ),
    );
  });
}
