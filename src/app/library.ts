// Was die Bibliothek vor dem Lernstand braucht (TDD 12.1, 12.6, D-50): die Reihenfolge, in der sie
// den Lernstand nachlädt, und „Weiterlernen“ mit dem zuletzt gelernten Set. Beides ergibt sich aus
// den Sitzungen, ohne Antworten zu lesen.
import type { StoredSet } from "../domain/model";
import { effectiveCount, selectedEntryCount } from "../domain/practiceSetup";
import { readLearningOrder } from "../storage/sessions";
import { rememberedSetup } from "./practice";

export interface LibraryStart {
  /** Set-IDs, die jüngste Sitzung zuerst; Sets ohne Sitzung fehlen. */
  order: string[];
  /** `count` fehlt ohne gemerkte Einrichtung; dann führt „Weiterlernen“ zur Einrichtung. */
  continueWith?: { set: StoredSet; count?: number };
}

export async function loadLibraryStart(
  db: IDBDatabase,
  sets: readonly StoredSet[],
): Promise<LibraryStart> {
  const { order, lastLearned } = await readLearningOrder(db);
  const set = sets.find((candidate) => candidate.id === lastLearned);
  if (!set || set.sections.every((section) => section.entries.length === 0)) return { order };
  const setup = await rememberedSetup(db, set);
  if (!setup) return { order, continueWith: { set } };
  const count = effectiveCount(setup.count, selectedEntryCount(set, setup.sectionIds));
  return { order, continueWith: { set, count } };
}
