// Was die Bibliothek vor dem Lernstand braucht (TDD 12.1, 12.6, D-50): die Reihenfolge, in der sie
// den Lernstand nachlädt, und „Weiterlernen“ mit dem zuletzt gelernten Set bzw. nach einer Sitzung über
// mehrere Sets mit der gemerkten Zusammenstellung (12.10). Beides ergibt sich aus den Sitzungen, ohne
// Antworten zu lesen.
import type { StoredSet } from "../domain/model";
import {
  effectiveCount,
  selectedEntryCount,
  TOGETHER_KEY,
  togetherSetIds,
} from "../domain/practiceSetup";
import { readLearningOrder } from "../storage/sessions";
import { getSetting } from "../storage/settings";
import { rememberedSetup } from "./practice";

export interface LibraryStart {
  /** Set-IDs, die jüngste Sitzung zuerst; Sets ohne Sitzung fehlen. */
  order: string[];
  /** `count` fehlt ohne gemerkte Einrichtung; dann führt „Weiterlernen“ zur Einrichtung. */
  continueWith?: { set: StoredSet; count?: number };
  /** Statt `continueWith` nach einer Sitzung über mehrere Sets: die Sets der Zusammenstellung. */
  continueTogether?: StoredSet[];
}

export async function loadLibraryStart(
  db: IDBDatabase,
  sets: readonly StoredSet[],
): Promise<LibraryStart> {
  const { order, lastLearned, lastGroup } = await readLearningOrder(db);
  if (lastGroup !== undefined) {
    const together = await rememberedSets(db, sets);
    if (together) return { order, continueTogether: together };
  }
  const set = sets.find((candidate) => candidate.id === lastLearned);
  if (!set || set.sections.every((section) => section.entries.length === 0)) return { order };
  const setup = await rememberedSetup(db, set);
  if (!setup) return { order, continueWith: { set } };
  const count = effectiveCount(setup.count, selectedEntryCount(set, setup.sectionIds));
  return { order, continueWith: { set, count } };
}

const learnable = (set: StoredSet) => set.sections.some((section) => section.entries.length > 0);

/**
 * Die Sets der gemerkten Zusammenstellung, die es noch gibt und die Einträge haben; `null`, wenn davon
 * keine zwei mit demselben Sprachpaar übrig sind.
 */
async function rememberedSets(
  db: IDBDatabase,
  sets: readonly StoredSet[],
): Promise<StoredSet[] | null> {
  // In der gemerkten Reihenfolge; sie stammt aus der Ansicht „Zusammen lernen“, also der Bibliothek.
  const chosen = togetherSetIds(await getSetting(db, TOGETHER_KEY))
    .map((id) => sets.find((set) => set.id === id))
    .filter((set): set is StoredSet => set !== undefined && learnable(set));
  const [first] = chosen;
  const pair = chosen.filter(
    (set) =>
      set.termLanguage === first?.termLanguage && set.meaningLanguage === first.meaningLanguage,
  );
  return pair.length > 1 ? pair : null;
}
