// Lernüberblick (TDD 12.6, FR-11, AK-17): Antworten des Sets lesen und in domain/stats.ts auswerten.
// Das Ergebnis bleibt pro Set im Arbeitsspeicher, solange das Set unverändert ist und keine Antworten
// dazukommen oder wegfallen (S-38, D-48); wer Antworten schreibt oder löscht, verwirft es.
import type { StoredSet } from "../domain/model";
import { computeStats, type SetStats } from "../domain/stats";
import { listSetEvents } from "../storage/sessions";

interface Cached {
  editCount: number;
  stats: Promise<SetStats>;
}

const cache = new Map<string, Cached>();

/**
 * Das Versprechen liegt schon während des Lesens im Zwischenspeicher: Gleichzeitige Aufrufe teilen es,
 * und wer währenddessen verwirft, entfernt es, sodass ein veraltetes Ergebnis nicht bleibt.
 */
export function loadOverview(db: IDBDatabase, set: StoredSet): Promise<SetStats> {
  const cached = cache.get(set.id);
  if (cached?.editCount === set.editCount) return cached.stats;
  const entry: Cached = {
    editCount: set.editCount,
    stats: listSetEvents(db, set.id).then((events) => computeStats(set, events)),
  };
  cache.set(set.id, entry);
  entry.stats.catch(() => {
    if (cache.get(set.id) === entry) cache.delete(set.id);
  });
  return entry.stats;
}

/** Nach neuen Antworten zum Set oder seinem Löschen. */
export function forgetOverview(setId: string): void {
  cache.delete(setId);
}

/** Nach Wiederherstellen, „Alle Daten löschen“ und jeder Änderung in einem anderen Tab. */
export function forgetAllOverviews(): void {
  cache.clear();
}
