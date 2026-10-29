// Interne Angaben im Store `meta` (TDD 6.1); sie gehören nicht ins Backup.
import { runTransaction } from "./transaction";

export type MetaKey =
  | "persistRequested"
  | "lastBackupAt"
  | "backupReminderSnoozedUntil"
  /** Zeitpunkt der Sicherungskopie vor der letzten Migration (TDD 7.3). */
  | "preMigrationCopyAt";

interface MetaRecord {
  key: MetaKey;
  value: unknown;
}

export async function getMeta(db: IDBDatabase, key: MetaKey): Promise<unknown> {
  let value: unknown;
  await runTransaction(db, "meta", "readonly", (transaction) => {
    const request = transaction.objectStore("meta").get(key);
    request.onsuccess = () => (value = (request.result as MetaRecord | undefined)?.value);
  });
  return value;
}

export function setMeta(db: IDBDatabase, key: MetaKey, value: unknown): Promise<void> {
  return runTransaction(db, "meta", "readwrite", (transaction) => putMeta(transaction, key, value));
}

export function deleteMeta(db: IDBDatabase, key: MetaKey): Promise<void> {
  return runTransaction(db, "meta", "readwrite", (transaction) =>
    transaction.objectStore("meta").delete(key),
  );
}

/** Innerhalb einer größeren Transaktion, die `meta` einschließt. */
export function putMeta(transaction: IDBTransaction, key: MetaKey, value: unknown): void {
  transaction.objectStore("meta").put({ key, value } satisfies MetaRecord);
}
