// Lernüberblick (TDD 12.6, FR-11, AK-17): Antworten des Sets lesen und in domain/stats.ts auswerten.
import type { StoredSet } from "../domain/model";
import { computeStats, type SetStats } from "../domain/stats";
import { listSetEvents } from "../storage/sessions";

export async function loadOverview(db: IDBDatabase, set: StoredSet): Promise<SetStats> {
  return computeStats(set, await listSetEvents(db, set.id));
}
