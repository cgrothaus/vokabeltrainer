// Backup lesen und wiederherstellen (TDD 11.3, 11.4). Geprüft und migriert wird vorher in
// domain/backup.ts; hier geht es nur um konsistentes Lesen und atomares Ersetzen bzw. Leeren.
import { BACKUP_STORES, type BackupFile, type CheckedBackup, createBackup } from "../domain/backup";
import { type MetaKey, putMeta } from "./meta";
import type { StoreName } from "./schema";
import { runTransaction } from "./transaction";

export type RestoreResult = { ok: true } | { ok: false; reason: "quota" | "failed" };

/** Liest alle `stores` roh in einer Read-only-Transaktion: ein in sich stimmiger Stand (TDD 11.3). */
export async function readStores(
  db: IDBDatabase,
  stores: readonly string[],
): Promise<Record<string, unknown[]>> {
  const data: Record<string, unknown[]> = {};
  // Eine Transaktion ohne Stores lehnt IndexedDB ab.
  if (stores.length === 0) return data;
  // Auch fremde Stores älterer Datenbanken (Notfall-Backup), daher die Umwandlung.
  await runTransaction(db, [...stores] as StoreName[], "readonly", (transaction) => {
    for (const store of stores) {
      const request = transaction.objectStore(store).getAll();
      request.onsuccess = () => (data[store] = request.result);
    }
  });
  return data;
}

export async function readBackup(
  db: IDBDatabase,
  appVersion: string,
  exportedAt: string,
): Promise<BackupFile> {
  const data = await readStores(db, BACKUP_STORES);
  return createBackup({ dataVersion: db.version, appVersion, exportedAt, data });
}

/**
 * Ersetzt den gesamten Bestand außer `meta` in einer Transaktion und setzt dort auch `lastBackupAt`
 * auf den Stand des Backups. Scheitert etwas, bleibt alles wie vorher (TAK-05).
 */
export async function restoreBackup(
  db: IDBDatabase,
  backup: CheckedBackup,
): Promise<RestoreResult> {
  try {
    await runTransaction(db, [...BACKUP_STORES, "meta"], "readwrite", (transaction) => {
      for (const store of BACKUP_STORES) {
        const objectStore = transaction.objectStore(store);
        objectStore.clear();
        for (const record of backup.data[store]) objectStore.add(record);
      }
      putMeta(transaction, "lastBackupAt", backup.exportedAt);
    });
    return { ok: true };
  } catch (error) {
    if ((error as { name?: unknown } | null)?.name === "QuotaExceededError")
      return { ok: false, reason: "quota" };
    console.error("Backup nicht wiederhergestellt", error);
    return { ok: false, reason: "failed" };
  }
}

/**
 * „Alle Daten löschen“ (TDD 10): leert in einer Transaktion alles, was ins Backup gehört, und vergisst
 * das letzte Backup samt Erinnerung, weil es den neuen Bestand nicht mehr sichert. Die Anfrage nach
 * dauerhaftem Speicher betrifft den Browser und bleibt vermerkt.
 */
export function clearAllData(db: IDBDatabase): Promise<void> {
  return runTransaction(db, [...BACKUP_STORES, "meta"], "readwrite", (transaction) => {
    for (const store of BACKUP_STORES) transaction.objectStore(store).clear();
    const meta = transaction.objectStore("meta");
    meta.delete("lastBackupAt" satisfies MetaKey);
    meta.delete("backupReminderSnoozedUntil" satisfies MetaKey);
  });
}
