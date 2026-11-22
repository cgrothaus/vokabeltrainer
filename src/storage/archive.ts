// Archiv der Bibliothek (D-72): ein Vermerk pro Set in `settings` (`archived:<setId>`), der das Set nur
// aus der Bibliothek ausblendet. Er gehört ins Backup; `deleteSet` löscht ihn mit (storage/sets.ts).
import { ARCHIVE_PREFIX, archiveKey, archivedSetIds } from "../domain/library";
import { type StorageFailure, storageFailure } from "./errors";
import type { SettingRecord } from "./settings";
import { runTransaction } from "./transaction";

/** IDs der archivierten Sets; Vermerke zu gelöschten Sets kann es nicht geben (D-25). */
export async function readArchived(db: IDBDatabase): Promise<Set<string>> {
  let records: SettingRecord[] = [];
  await runTransaction(db, "settings", "readonly", (transaction) => {
    // Alle Schlüssel mit dem Präfix: bis zum größten Zeichen dahinter.
    const range = IDBKeyRange.bound(ARCHIVE_PREFIX, ARCHIVE_PREFIX + String.fromCharCode(0xffff));
    const request = transaction.objectStore("settings").getAll(range);
    request.onsuccess = () => (records = request.result as SettingRecord[]);
  });
  return archivedSetIds(records);
}

export type ArchiveResult =
  /** `count`: so viele der Sets gibt es noch; gelöschte werden übergangen. */
  { ok: true; count: number } | { ok: false; reason: StorageFailure };

/**
 * Archiviert die Sets oder holt sie zurück, in einer Transaktion. Prüft dabei, ob es jedes Set noch
 * gibt, damit kein Vermerk zu einem gelöschten Set entsteht (z. B. aus einem anderen Tab).
 */
export async function setArchived(
  db: IDBDatabase,
  setIds: readonly string[],
  archived: boolean,
): Promise<ArchiveResult> {
  let count = 0;
  try {
    await runTransaction(db, ["sets", "settings"], "readwrite", (transaction) => {
      const settings = transaction.objectStore("settings");
      for (const id of setIds) {
        const request = transaction.objectStore("sets").getKey(id);
        request.onsuccess = () => {
          if (request.result === undefined) return;
          count++;
          if (archived) settings.put({ key: archiveKey(id), value: true } satisfies SettingRecord);
          else settings.delete(archiveKey(id));
        };
      }
    });
    return { ok: true, count };
  } catch (error) {
    console.error("Archiv nicht gespeichert", error);
    return { ok: false, reason: storageFailure(error) };
  }
}
