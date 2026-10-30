// Änderungen an einem Set in der App (TDD 10, FR-04): reine Funktionen, die ein neues Set liefern.
// `editCount` und `updatedAt` setzt erst das Speichern (storage/sets.ts `updateSet`). Fehlt ein
// Eintrag oder eine Sektion (z. B. inzwischen anderswo gelöscht), ist das Ergebnis `undefined`.
import { freshId, ID_LENGTH, idsInSet, type RandomBytes } from "./ids";
import type { StoredEntry, StoredSection, StoredSet } from "./model";

export function findEntry(
  set: StoredSet,
  entryId: string,
): { section: StoredSection; entry: StoredEntry } | undefined {
  for (const section of set.sections) {
    const entry = section.entries.find((item) => item.id === entryId);
    if (entry) return { section, entry };
  }
  return undefined;
}

/** Eintrags-ID, die im Set noch frei ist (TDD 6.3). */
export function newEntryId(set: StoredSet, randomBytes: RandomBytes): string {
  return freshId(idsInSet(set), ID_LENGTH.entry, randomBytes);
}

/**
 * Ersetzt den Eintrag mit derselben ID. Gehört er bisher zu einer anderen Sektion als `sectionId`,
 * kommt er ans Ende der neuen Sektion (D-41).
 */
export function replaceEntry(
  set: StoredSet,
  entry: StoredEntry,
  sectionId: string,
): StoredSet | undefined {
  const found = findEntry(set, entry.id);
  if (!found || !set.sections.some((section) => section.id === sectionId)) return undefined;
  if (found.section.id === sectionId) {
    return mapSections(set, (section) =>
      section.id === sectionId
        ? {
            ...section,
            entries: section.entries.map((item) => (item.id === entry.id ? entry : item)),
          }
        : section,
    );
  }
  return addEntry(deleteEntry(set, entry.id)!, sectionId, entry);
}

/** Hängt den Eintrag ans Ende der Sektion. */
export function addEntry(
  set: StoredSet,
  sectionId: string,
  entry: StoredEntry,
): StoredSet | undefined {
  if (!set.sections.some((section) => section.id === sectionId)) return undefined;
  return mapSections(set, (section) =>
    section.id === sectionId ? { ...section, entries: [...section.entries, entry] } : section,
  );
}

export function deleteEntry(set: StoredSet, entryId: string): StoredSet | undefined {
  if (!findEntry(set, entryId)) return undefined;
  return mapSections(set, (section) => ({
    ...section,
    entries: section.entries.filter((item) => item.id !== entryId),
  }));
}

function mapSections(set: StoredSet, map: (section: StoredSection) => StoredSection): StoredSet {
  return { ...set, sections: set.sections.map(map) };
}
