// Bibliothek (TDD 13.1, FR-01, FR-02): Sets nach Lernsprache gruppiert, innerhalb nach Lernstufe und
// Titel. Den Anzeigenamen einer Sprache liefert die App, damit hier keine Umgebung vorausgesetzt wird.
import type { StoredSet } from "./model";

export interface SetGroup {
  /** `termLanguage`, kanonisch; Varianten wie `en-GB` bilden eine eigene Gruppe. */
  language: string;
  name: string;
  sets: StoredSet[];
}

/** Zahlen der Größe nach: „Klasse 5“ vor „Klasse 10“. */
const compare = (a: string, b: string) => a.localeCompare(b, "de", { numeric: true });

function compareSets(a: StoredSet, b: StoredSet): number {
  if (a.level !== b.level) {
    // Ohne Lernstufe zuletzt.
    if (a.level === undefined) return 1;
    if (b.level === undefined) return -1;
    const byLevel = compare(a.level, b.level);
    if (byLevel !== 0) return byLevel;
  }
  return compare(a.title, b.title) || compare(a.id, b.id);
}

export function groupSets(sets: StoredSet[], languageName: (code: string) => string): SetGroup[] {
  const groups = new Map<string, SetGroup>();
  for (const set of sets) {
    let group = groups.get(set.termLanguage);
    if (!group) {
      group = { language: set.termLanguage, name: languageName(set.termLanguage), sets: [] };
      groups.set(set.termLanguage, group);
    }
    group.sets.push(set);
  }
  for (const group of groups.values()) group.sets.sort(compareSets);
  return [...groups.values()].sort(
    (a, b) => compare(a.name, b.name) || compare(a.language, b.language),
  );
}

export function setSize(set: StoredSet): { sections: number; entries: number } {
  return {
    sections: set.sections.length,
    entries: set.sections.reduce((sum, section) => sum + section.entries.length, 0),
  };
}
