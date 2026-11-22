// Einrichtung einer Lernsitzung (TDD 12.1, D-27): Sektionen, Richtung, Anzahl in festen Stufen und Anteil
// an Multiple Choice. Die zuletzt gewählte Einrichtung wird pro Set in `settings` gemerkt, die letzte
// Zusammenstellung mehrerer Sets einmal für alle (12.10); beides wird beim Lesen tolerant geprüft, weil
// es auch aus einem Backup stammen kann.
import type { Direction, StoredSet } from "./model";
import { shuffle } from "./practice";

export const COUNT_STEPS = [10, 20, 30] as const;

export type CountChoice = (typeof COUNT_STEPS)[number] | "all";

export const DEFAULT_MC_SHARE = 25;
/** Schrittweite des Reglers in Prozent. */
export const MC_SHARE_STEP = 5;

export interface PracticeSetup {
  /** In der Reihenfolge des Sets. */
  readonly sectionIds: readonly string[];
  readonly direction: Direction | "mixed";
  readonly count: CountChoice;
  /** Anteil an Multiple Choice in ganzen Prozent. */
  readonly mcShare: number;
  /** In Richtung Lernsprache Buchstaben statt Karteikarten (TDD 12.3, D-70). */
  readonly letters: boolean;
}

/** Gemerkte Form: „alle Sektionen“ bleibt „alle“, auch wenn später Sektionen hinzukommen. */
export interface StoredPracticeSetup {
  readonly sections: "all" | readonly string[];
  readonly direction: Direction | "mixed";
  readonly count: CountChoice;
  readonly mcShare: number;
  readonly letters: boolean;
}

const DIRECTIONS: readonly unknown[] = ["termToMeaning", "meaningToTerm", "mixed"];
const COUNTS: readonly unknown[] = [...COUNT_STEPS, "all"];

export function settingKey(setId: string): string {
  return `practice:${setId}`;
}

export function defaultSetup(set: StoredSet): PracticeSetup {
  return {
    sectionIds: set.sections.map((section) => section.id),
    direction: "termToMeaning",
    // Bei weniger Einträgen ergibt das „alle“ (`fitCount`, D-47).
    count: 20,
    mcShare: DEFAULT_MC_SHARE,
    letters: false,
  };
}

const isMcShare = (value: unknown): value is number =>
  Number.isInteger(value) &&
  (value as number) >= 0 &&
  (value as number) <= 100 &&
  (value as number) % MC_SHARE_STEP === 0;

/** Richtung, Anzahl und Anteil; unbrauchbare Teile ersetzt die Voreinstellung. */
function restoreOptions(
  stored: Record<string, unknown>,
  fallback: Omit<PracticeSetup, "sectionIds">,
): Omit<PracticeSetup, "sectionIds"> {
  const { direction, count, mcShare, letters } = stored;
  return {
    direction: DIRECTIONS.includes(direction)
      ? (direction as PracticeSetup["direction"])
      : fallback.direction,
    count: COUNTS.includes(count) ? (count as CountChoice) : fallback.count,
    mcShare: isMcShare(mcShare) ? mcShare : fallback.mcShare,
    // Ältere Einrichtungen kennen den Schalter nicht: dann aus.
    letters: letters === true,
  };
}

/** Unbrauchbare Teile ersetzt die Voreinstellung; fehlende Sektionen fallen weg, ohne Rest gelten alle. */
export function restoreSetup(set: StoredSet, stored: unknown): PracticeSetup {
  const fallback = defaultSetup(set);
  if (typeof stored !== "object" || stored === null) return fallback;
  const record = stored as Record<string, unknown>;
  const chosen = Array.isArray(record.sections) ? new Set<unknown>(record.sections) : null;
  const sectionIds = chosen
    ? fallback.sectionIds.filter((id) => chosen.has(id))
    : fallback.sectionIds;
  return {
    sectionIds: sectionIds.length > 0 ? sectionIds : fallback.sectionIds,
    ...restoreOptions(record, fallback),
  };
}

export function storedSetup(set: StoredSet, setup: PracticeSetup): StoredPracticeSetup {
  const all = set.sections.every((section) => setup.sectionIds.includes(section.id));
  return {
    sections: all ? "all" : [...setup.sectionIds],
    direction: setup.direction,
    count: setup.count,
    mcShare: setup.mcShare,
    letters: setup.letters,
  };
}

export function selectedEntryCount(set: StoredSet, sectionIds: readonly string[]): number {
  return set.sections
    .filter((section) => sectionIds.includes(section.id))
    .reduce((sum, section) => sum + section.entries.length, 0);
}

/** Stufen unter der verfügbaren Zahl, danach „alle“. */
export function countOptions(available: number): CountChoice[] {
  return [...COUNT_STEPS.filter((step) => step < available), "all"];
}

/** Eine Stufe, die bei dieser Auswahl nicht angeboten wird, erscheint als „alle“. */
export function fitCount(count: CountChoice, available: number): CountChoice {
  return countOptions(available).includes(count) ? count : "all";
}

export function effectiveCount(count: CountChoice, available: number): number {
  return count === "all" ? available : Math.min(count, available);
}

/** Einträge der gewählten Sektionen; bei kleinerer Anzahl eine zufällige Teilmenge. */
export function pickEntries(set: StoredSet, setup: PracticeSetup, random: () => number): string[] {
  const ids = set.sections
    .filter((section) => setup.sectionIds.includes(section.id))
    .flatMap((section) => section.entries.map((entry) => entry.id));
  const count = effectiveCount(setup.count, ids.length);
  return count < ids.length ? shuffle(ids, random).slice(0, count) : ids;
}

/** Schlüssel der letzten Zusammenstellung mehrerer Sets in `settings`; ohne Doppelpunkt, gilt für alle. */
export const TOGETHER_KEY = "together";

/**
 * Zusammen lernen (TDD 12.10): gewählte Sets mit allen Sektionen, dazu Richtung, Anzahl und Anteil wie
 * in der Einrichtung. So wird sie auch gemerkt.
 */
export interface TogetherSetup {
  /** In der Reihenfolge der Bibliothek. */
  readonly setIds: readonly string[];
  readonly direction: Direction | "mixed";
  readonly count: CountChoice;
  readonly mcShare: number;
  readonly letters: boolean;
}

/** Ein Eintrag in einem bestimmten Set; Eintrags-IDs sind nur innerhalb eines Sets eindeutig. */
export interface EntryRef {
  readonly setId: string;
  readonly entryId: string;
}

/** Die gemerkten Sets, tolerant gelesen: nur Texte, jeder einmal. */
export function togetherSetIds(stored: unknown): string[] {
  if (typeof stored !== "object" || stored === null) return [];
  const { setIds } = stored as Record<string, unknown>;
  if (!Array.isArray(setIds)) return [];
  return [...new Set(setIds.filter((id): id is string => typeof id === "string"))];
}

/**
 * Vorbelegung für die Sets eines Sprachpaars (`candidates`, in der Reihenfolge der Bibliothek): die
 * gemerkten darunter, sonst alle; Richtung, Anzahl und Anteil wie bei `restoreSetup`.
 */
export function restoreTogether(candidates: readonly StoredSet[], stored: unknown): TogetherSetup {
  const remembered = new Set(togetherSetIds(stored));
  const setIds = candidates.map((set) => set.id).filter((id) => remembered.has(id));
  const { sectionIds: _, ...fallback } = defaultSetup(candidates[0]!);
  const record = typeof stored === "object" && stored !== null ? stored : {};
  return {
    setIds: setIds.length > 0 ? setIds : candidates.map((set) => set.id),
    ...restoreOptions(record as Record<string, unknown>, fallback),
  };
}

const chosenSets = (sets: readonly StoredSet[], setIds: readonly string[]) =>
  sets.filter((set) => setIds.includes(set.id));

export function togetherEntryCount(sets: readonly StoredSet[], setIds: readonly string[]): number {
  return chosenSets(sets, setIds).reduce(
    (sum, set) =>
      sum +
      selectedEntryCount(
        set,
        set.sections.map((section) => section.id),
      ),
    0,
  );
}

/** Alle Einträge der gewählten Sets; bei kleinerer Anzahl eine zufällige Teilmenge (wie `pickEntries`). */
export function pickAcross(
  sets: readonly StoredSet[],
  setup: TogetherSetup,
  random: () => number,
): EntryRef[] {
  const refs = chosenSets(sets, setup.setIds).flatMap((set) =>
    set.sections.flatMap((section) =>
      section.entries.map((entry) => ({ setId: set.id, entryId: entry.id })),
    ),
  );
  const count = effectiveCount(setup.count, refs.length);
  return count < refs.length ? shuffle(refs, random).slice(0, count) : refs;
}

/**
 * Zusammenfassung für „Wie beim letzten Mal“ (TDD 12.1), z. B. „20 Vokabeln“, „Englisch → Deutsch“,
 * „alle Sektionen“, „25 % Multiple Choice“, „mit Buchstaben“. Bei nur einer Sektion entfällt die Angabe
 * dazu, Buchstaben nennt sie nur, wo sie in dieser Richtung vorkommen.
 */
export function describeSetup(
  set: StoredSet,
  setup: PracticeSetup,
  languageName: (code: string) => string,
): string[] {
  const cards = effectiveCount(setup.count, selectedEntryCount(set, setup.sectionIds));
  const term = languageName(set.termLanguage);
  const meaning = languageName(set.meaningLanguage);
  const direction =
    setup.direction === "mixed"
      ? "Gemischt"
      : setup.direction === "termToMeaning"
        ? `${term} → ${meaning}`
        : `${meaning} → ${term}`;
  const chosen = set.sections.filter((section) => setup.sectionIds.includes(section.id));
  const sections =
    set.sections.length < 2
      ? []
      : chosen.length === set.sections.length
        ? ["alle Sektionen"]
        : chosen.length === 1
          ? [chosen[0]!.title]
          : [`${chosen.length} Sektionen`];
  const share =
    setup.mcShare === 0
      ? "nur Karteikarten"
      : setup.mcShare === 100
        ? "nur Multiple Choice"
        : `${setup.mcShare} % Multiple Choice`;
  const letters =
    setup.letters && setup.direction !== "termToMeaning" && setup.mcShare < 100
      ? ["mit Buchstaben"]
      : [];
  return [
    cards === 1 ? "1 Vokabel" : `${cards} Vokabeln`,
    direction,
    ...sections,
    share,
    ...letters,
  ];
}
