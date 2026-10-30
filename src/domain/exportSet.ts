// Set- und Sektionsexport (TDD 11.1, FR-18): eine Datei nach der Formatspezifikation mit IDs und
// Prüfwerten, damit ein späterer Rückimport Einträge und Lernstand zuordnen kann (TDD 9). Antworten
// ohne Varianten in Kurzform, leere optionale Felder entfallen, kein Lernstand.
import { entryRev, sectionRev, setRev } from "./hash";
import type { Answer, StoredEntry, StoredSection, StoredSet } from "./model";
import type { FileAnswer, FileExample } from "./validate";

export type ExportScope = { type: "set" } | { type: "sections"; sectionIds: string[] };

/** Felder in der Reihenfolge der Spezifikation (`KNOWN_FIELDS`). */
export interface ExportedSetFile {
  format: "vokabeltrainer-set";
  formatVersion: 1;
  exportedAt: string;
  scope: ExportScope;
  set: Omit<StoredSet, "editCount" | "createdAt" | "updatedAt" | "sections"> & { rev: string };
  sections: ExportedSection[];
}

export interface ExportedSection {
  id: string;
  rev: string;
  title: string;
  entries: ExportedEntry[];
}

export interface ExportedEntry {
  id: string;
  rev: string;
  term: FileAnswer;
  meanings: FileAnswer[];
  notes?: string;
  examples?: FileExample[];
  grammar?: StoredEntry["grammar"];
  reviewStatus?: StoredEntry["reviewStatus"];
}

/**
 * Beim Teil-Export zählen nur Sektionen, die es im Set gibt, in dessen Reihenfolge; so passt der Scope
 * immer zum Inhalt.
 */
export function exportSetFile(
  set: StoredSet,
  scope: ExportScope,
  exportedAt: Date,
): ExportedSetFile {
  const sections = selectedSections(set, scope);
  return {
    format: "vokabeltrainer-set",
    formatVersion: 1,
    exportedAt: exportedAt.toISOString(),
    scope:
      scope.type === "set"
        ? { type: "set" }
        : { type: "sections", sectionIds: sections.map((section) => section.id) },
    set: compact({
      id: set.id,
      rev: setRev(set),
      title: set.title,
      termLanguage: set.termLanguage,
      meaningLanguage: set.meaningLanguage,
      level: set.level,
      textbook: set.textbook,
      edition: set.edition,
      source: set.source,
      license: set.license,
      notes: set.notes,
      reviewStatus: set.reviewStatus,
    }),
    sections: sections.map((section) => ({
      id: section.id,
      rev: sectionRev(section),
      title: section.title,
      entries: section.entries.map(exportEntry),
    })),
  };
}

export function selectedSections(set: StoredSet, scope: ExportScope): StoredSection[] {
  if (scope.type === "set") return set.sections;
  const chosen = new Set(scope.sectionIds);
  return set.sections.filter((section) => chosen.has(section.id));
}

function exportEntry(entry: StoredEntry): ExportedEntry {
  return compact({
    id: entry.id,
    rev: entryRev(entry),
    term: answer(entry.term),
    meanings: entry.meanings.map(answer),
    notes: entry.notes,
    examples: entry.examples?.map((example) =>
      example.translation === undefined ? example.text : example,
    ),
    grammar: entry.grammar,
    reviewStatus: entry.reviewStatus,
  });
}

const answer = (value: Answer): FileAnswer =>
  value.acceptedVariants && value.acceptedVariants.length > 0 ? value : value.text;

/** Entfernt Felder mit dem Wert `undefined`, damit sie in der Datei nicht als `null` erscheinen. */
function compact<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}

const MAX_FILE_NAME = 80;

/**
 * `<Titel>_<JJJJ-MM-TT>.json` (TDD 11.1), beim Teil-Export mit der Sektion oder der Zahl der
 * Sektionen. Zeichen, die Dateisysteme nicht mögen, werden ersetzt; gekürzt wird der Name, nie das
 * Datum.
 */
export function exportFileName(set: StoredSet, scope: ExportScope, date: Date): string {
  const sections = selectedSections(set, scope);
  const part =
    scope.type === "set"
      ? []
      : sections.length === 1
        ? [sections[0]!.title]
        : [`${sections.length} Sektionen`];
  const pad = (n: number) => String(n).padStart(2, "0");
  const suffix = `_${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`;
  const name = [set.title, ...part]
    .join("_")
    .replace(/\s+/g, " ")
    .replace(/[\\/:*?"<>|\p{Cc}]/gu, "-")
    .trim();
  return `${[...name].slice(0, MAX_FILE_NAME - suffix.length).join("")}${suffix}`;
}
