// Änderungen an einem Set in der App (TDD 10, FR-02–FR-04): reine Funktionen, die ein neues Set
// liefern. `editCount` und `updatedAt` setzt erst das Speichern (storage/sets.ts `updateSet`). Fehlt
// ein Eintrag oder eine Sektion (z. B. inzwischen anderswo gelöscht), ist das Ergebnis `undefined`;
// eine Verschiebung über den Rand hinaus liefert das Set unverändert.
import { createId, freshId, ID_LENGTH, idsInSet, type RandomBytes } from "./ids";
import type { StoredEntry, StoredSection, StoredSet } from "./model";

/** Die Angaben eines Sets ohne Sektionen und Verwaltungsfelder. */
export type SetInfo = Omit<StoredSet, "id" | "editCount" | "createdAt" | "updatedAt" | "sections">;

/** Ein neues, leeres Set mit einer Sektion: Jedes Set hat mindestens eine (D-41). */
export function createEmptySet(
  info: SetInfo,
  sectionTitle: string,
  now: string,
  randomBytes: RandomBytes,
): StoredSet {
  return {
    id: createId(ID_LENGTH.set, randomBytes),
    editCount: 0,
    createdAt: now,
    updatedAt: now,
    ...info,
    sections: [{ id: createId(ID_LENGTH.section, randomBytes), title: sectionTitle, entries: [] }],
  };
}

/** Ersetzt alle Angaben; was in `info` fehlt, entfällt. */
export function updateSetInfo(set: StoredSet, info: SetInfo): StoredSet {
  const { id, editCount, createdAt, updatedAt, sections } = set;
  return { id, editCount, createdAt, updatedAt, ...info, sections };
}

/** Hängt eine leere Sektion ans Ende. */
export function addSection(set: StoredSet, title: string, randomBytes: RandomBytes): StoredSet {
  const id = freshId(idsInSet(set), ID_LENGTH.section, randomBytes);
  return { ...set, sections: [...set.sections, { id, title, entries: [] }] };
}

export function renameSection(
  set: StoredSet,
  sectionId: string,
  title: string,
): StoredSet | undefined {
  if (!set.sections.some((section) => section.id === sectionId)) return undefined;
  return mapSections(set, (section) =>
    section.id === sectionId ? { ...section, title } : section,
  );
}

/** Um eine Stelle nach oben (`-1`) oder unten (`1`). */
export function moveSection(
  set: StoredSet,
  sectionId: string,
  step: -1 | 1,
): StoredSet | undefined {
  const index = set.sections.findIndex((section) => section.id === sectionId);
  if (index < 0) return undefined;
  const sections = swap(set.sections, index, step);
  return sections ? { ...set, sections } : set;
}

/** Löscht die Sektion samt Einträgen; die letzte bleibt (D-41). */
export function deleteSection(set: StoredSet, sectionId: string): StoredSet | undefined {
  if (set.sections.length <= 1) return undefined;
  if (!set.sections.some((section) => section.id === sectionId)) return undefined;
  return { ...set, sections: set.sections.filter((section) => section.id !== sectionId) };
}

/** Um eine Stelle innerhalb der Sektion; in eine andere Sektion verschiebt `replaceEntry` (D-41). */
export function moveEntry(set: StoredSet, entryId: string, step: -1 | 1): StoredSet | undefined {
  const found = findEntry(set, entryId);
  if (!found) return undefined;
  const index = found.section.entries.indexOf(found.entry);
  const entries = swap(found.section.entries, index, step);
  if (!entries) return set;
  return mapSections(set, (section) =>
    section.id === found.section.id ? { ...section, entries } : section,
  );
}

/** Tauscht mit dem Nachbarn; `undefined`, wenn es keinen gibt. */
function swap<T>(items: readonly T[], index: number, step: -1 | 1): T[] | undefined {
  const other = index + step;
  if (other < 0 || other >= items.length) return undefined;
  const result = [...items];
  [result[index], result[other]] = [result[other]!, result[index]!];
  return result;
}

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
