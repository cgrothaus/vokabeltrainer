// Einrichtung einer Lernsitzung (TDD 12.1, D-27): Sektionen, Richtung und Anzahl in festen Stufen. Die
// zuletzt gewählte Einrichtung wird pro Set in `settings` gemerkt und beim Lesen tolerant geprüft, weil
// sie auch aus einem Backup stammen kann.
import type { Direction, StoredSet } from "./model";
import { shuffle } from "./practice";

export const COUNT_STEPS = [10, 20, 30] as const;

export type CountChoice = (typeof COUNT_STEPS)[number] | "all";

export interface PracticeSetup {
  /** In der Reihenfolge des Sets. */
  readonly sectionIds: readonly string[];
  readonly direction: Direction | "mixed";
  readonly count: CountChoice;
}

/** Gemerkte Form: „alle Sektionen“ bleibt „alle“, auch wenn später Sektionen hinzukommen. */
export interface StoredPracticeSetup {
  readonly sections: "all" | readonly string[];
  readonly direction: Direction | "mixed";
  readonly count: CountChoice;
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
    count: "all",
  };
}

/** Unbrauchbare Teile ersetzt die Voreinstellung; fehlende Sektionen fallen weg, ohne Rest gelten alle. */
export function restoreSetup(set: StoredSet, stored: unknown): PracticeSetup {
  const fallback = defaultSetup(set);
  if (typeof stored !== "object" || stored === null) return fallback;
  const { sections, direction, count } = stored as Record<string, unknown>;
  const chosen = Array.isArray(sections) ? new Set<unknown>(sections) : null;
  const sectionIds = chosen
    ? fallback.sectionIds.filter((id) => chosen.has(id))
    : fallback.sectionIds;
  return {
    sectionIds: sectionIds.length > 0 ? sectionIds : fallback.sectionIds,
    direction: DIRECTIONS.includes(direction)
      ? (direction as PracticeSetup["direction"])
      : fallback.direction,
    count: COUNTS.includes(count) ? (count as CountChoice) : fallback.count,
  };
}

export function storedSetup(set: StoredSet, setup: PracticeSetup): StoredPracticeSetup {
  const all = set.sections.every((section) => setup.sectionIds.includes(section.id));
  return {
    sections: all ? "all" : [...setup.sectionIds],
    direction: setup.direction,
    count: setup.count,
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
