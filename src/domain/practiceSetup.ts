// Einrichtung einer Lernsitzung (TDD 12.1, D-27): Sektionen, Richtung, Anzahl in festen Stufen und Anteil
// an Multiple Choice. Die
// zuletzt gewählte Einrichtung wird pro Set in `settings` gemerkt und beim Lesen tolerant geprüft, weil
// sie auch aus einem Backup stammen kann.
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
}

/** Gemerkte Form: „alle Sektionen“ bleibt „alle“, auch wenn später Sektionen hinzukommen. */
export interface StoredPracticeSetup {
  readonly sections: "all" | readonly string[];
  readonly direction: Direction | "mixed";
  readonly count: CountChoice;
  readonly mcShare: number;
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
    mcShare: DEFAULT_MC_SHARE,
  };
}

const isMcShare = (value: unknown): value is number =>
  Number.isInteger(value) &&
  (value as number) >= 0 &&
  (value as number) <= 100 &&
  (value as number) % MC_SHARE_STEP === 0;

/** Unbrauchbare Teile ersetzt die Voreinstellung; fehlende Sektionen fallen weg, ohne Rest gelten alle. */
export function restoreSetup(set: StoredSet, stored: unknown): PracticeSetup {
  const fallback = defaultSetup(set);
  if (typeof stored !== "object" || stored === null) return fallback;
  const { sections, direction, count, mcShare } = stored as Record<string, unknown>;
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
    mcShare: isMcShare(mcShare) ? mcShare : fallback.mcShare,
  };
}

export function storedSetup(set: StoredSet, setup: PracticeSetup): StoredPracticeSetup {
  const all = set.sections.every((section) => setup.sectionIds.includes(section.id));
  return {
    sections: all ? "all" : [...setup.sectionIds],
    direction: setup.direction,
    count: setup.count,
    mcShare: setup.mcShare,
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
