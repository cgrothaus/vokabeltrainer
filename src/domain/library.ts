// Bibliothek (TDD 13.1, FR-01, FR-02): Sets nach Lernsprache gruppiert, innerhalb nach Lernstufe und
// Titel. Den Anzeigenamen einer Sprache liefert die App, damit hier keine Umgebung vorausgesetzt wird.
import type { StoredSet } from "./model";
import { MAX_LENGTH } from "./validate";

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

/** Sets, die sich zusammen lernen lassen (TDD 12.10): gleiches Sprachpaar, jeweils mit Einträgen. */
export interface LanguagePair {
  termLanguage: string;
  meaningLanguage: string;
  /** In der Reihenfolge der Gruppe. */
  sets: StoredSet[];
}

/** Die Sprachpaare einer Gruppe mit mindestens zwei Sets mit Einträgen, in der Reihenfolge der Gruppe. */
export function pairsToCombine(group: SetGroup): LanguagePair[] {
  const pairs = new Map<string, LanguagePair>();
  for (const set of group.sets) {
    if (setSize(set).entries === 0) continue;
    let pair = pairs.get(set.meaningLanguage);
    if (!pair) {
      pair = { termLanguage: set.termLanguage, meaningLanguage: set.meaningLanguage, sets: [] };
      pairs.set(set.meaningLanguage, pair);
    }
    pair.sets.push(set);
  }
  return [...pairs.values()].filter((pair) => pair.sets.length > 1);
}

const titleList = new Intl.ListFormat("de", { type: "conjunction" });

/** Titel mehrerer Sets für Sitzung und „Weiterlernen“ (TDD 12.10): „A, B und C“. */
export function joinTitles(sets: readonly StoredSet[]): string {
  return titleList.format(sets.map((set) => set.title));
}

/**
 * Archiv (D-72): eine Präferenz pro Set in `settings` mit dem Wert `true`; sie blendet das Set nur aus
 * der Bibliothek aus. Gehört ins Backup und wird mit dem Set gelöscht.
 */
export const ARCHIVE_PREFIX = "archived:";
export const archiveKey = (setId: string) => `${ARCHIVE_PREFIX}${setId}`;

/** Die archivierten Sets aus den Einstellungen; Werte aus einem Backup werden tolerant gelesen. */
export function archivedSetIds(records: readonly { key: string; value: unknown }[]): Set<string> {
  return new Set(
    records
      .filter((record) => record.key.startsWith(ARCHIVE_PREFIX) && record.value === true)
      .map((record) => record.key.slice(ARCHIVE_PREFIX.length)),
  );
}

/** Gemerkte Sprache der Filter in der Bibliothek (global, D-72). */
export const LANGUAGE_FILTER_KEY = "libraryLanguage";

/** Die gemerkte Sprache, wenn es sie unter `languages` noch gibt; sonst `null` (alle Sprachen). */
export function languageFilter(value: unknown, languages: readonly string[]): string | null {
  return typeof value === "string" && languages.includes(value) ? value : null;
}

/** Ab so vielen Sets einer Sprache stehen die zuletzt gelernten oben (D-72). */
const RECENT_FROM = 5;
const RECENT_COUNT = 3;

/**
 * Teilt die geordneten Sets einer Gruppe: ab fünf Sets die drei zuletzt gelernten nach `order`
 * (Set-IDs, jüngste Sitzung zuerst) nach oben, die übrigen in ihrer Reihenfolge.
 */
export function splitRecent(
  sets: StoredSet[],
  order: readonly string[],
): { recent: StoredSet[]; rest: StoredSet[] } {
  if (sets.length < RECENT_FROM) return { recent: [], rest: sets };
  const recent = order
    .map((id) => sets.find((set) => set.id === id))
    .filter((set): set is StoredSet => set !== undefined)
    .slice(0, RECENT_COUNT);
  return { recent, rest: sets.filter((set) => !recent.includes(set)) };
}

/** Die vorhandenen Lernstufen, Zahlen der Größe nach. */
export function knownLevels(sets: readonly StoredSet[]): string[] {
  const levels = new Set(sets.flatMap((set) => (set.level === undefined ? [] : [set.level])));
  return [...levels].sort(compare);
}

/** Vorschlag für ein neues Set ohne Lernstufe: die des zuletzt hinzugefügten Sets, das eine hat. */
export function suggestedLevel(sets: readonly StoredSet[]): string | undefined {
  let latest: StoredSet | undefined;
  for (const set of sets)
    if (set.level !== undefined && (!latest || set.createdAt > latest.createdAt)) latest = set;
  return latest?.level;
}

export type LevelInput = { ok: true; level: string } | { ok: false; error: string };

/** Eine neue Lernstufe aus einem Textfeld, geprüft wie in „Angaben bearbeiten“ (setInfoForm.ts). */
export function levelFromInput(text: string): LevelInput {
  const level = text.trim().normalize("NFC");
  if (level === "") return { ok: false, error: "Gib einen Namen für die Lernstufe ein." };
  if ([...level].length > MAX_LENGTH.short)
    return {
      ok: false,
      error: `Die Lernstufe ist länger als ${MAX_LENGTH.short.toLocaleString("de-DE")} Zeichen.`,
    };
  return { ok: true, level };
}

/** Das Set mit dieser Lernstufe; `undefined` entfernt sie. */
export function withLevel(set: StoredSet, level: string | undefined): StoredSet {
  const { level: _level, ...rest } = set;
  return level === undefined ? rest : { ...rest, level };
}

export interface LevelGroup {
  /** Ohne Lernstufe `undefined`. */
  level: string | undefined;
  sets: StoredSet[];
}

/** Archiv (D-72): nach Lernstufe, ohne Lernstufe zuletzt; darin nach Sprache und Titel. */
export function groupByLevel(
  sets: readonly StoredSet[],
  languageName: (code: string) => string,
): LevelGroup[] {
  const groups = new Map<string | undefined, StoredSet[]>();
  for (const set of sets) groups.set(set.level, [...(groups.get(set.level) ?? []), set]);
  const byLanguage = (a: StoredSet, b: StoredSet) =>
    compare(languageName(a.termLanguage), languageName(b.termLanguage)) ||
    compare(a.title, b.title) ||
    compare(a.id, b.id);
  return [...groups.entries()]
    .sort(([a], [b]) => (a === undefined ? 1 : b === undefined ? -1 : compare(a, b)))
    .map(([level, list]) => ({ level, sets: list.sort(byLanguage) }));
}

export function setSize(set: StoredSet): { sections: number; entries: number } {
  return {
    sections: set.sections.length,
    entries: set.sections.reduce((sum, section) => sum + section.entries.length, 0),
  };
}
