// Alle Daten löschen (TDD 10): erst den Umfang ankündigen, dann alles, was ins Backup gehört, in einer
// Transaktion löschen. Gezählt wird in domain/backup.ts, gelöscht in storage/backup.ts.
import { BACKUP_STORES, type RecordCounts, summarizeRecords } from "../domain/backup";
import type { StoreRecords } from "../domain/validateRecords";
import { clearAllData, readStores } from "../storage/backup";
import { failureMessage } from "./storageMessages";

export type DeleteAllOutcome = { ok: true } | { ok: false; error: string };

export async function dataScope(db: IDBDatabase): Promise<RecordCounts> {
  // Der eigene Bestand entspricht dem Datenmodell; geprüft wird er erst beim Wiederherstellen.
  return summarizeRecords((await readStores(db, BACKUP_STORES)) as unknown as StoreRecords);
}

/** Gelöscht ist erst, wenn die Transaktion abgeschlossen ist (TDD 6.5). */
export async function removeAllData(db: IDBDatabase): Promise<DeleteAllOutcome> {
  try {
    await clearAllData(db);
    return { ok: true };
  } catch (error) {
    console.error("Daten nicht gelöscht", error);
    return {
      ok: false,
      error: failureMessage(error, "Die Daten wurden nicht gelöscht; sie sind unverändert."),
    };
  }
}
