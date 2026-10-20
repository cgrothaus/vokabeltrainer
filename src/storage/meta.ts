// Interne Angaben im Store `meta` (TDD 6.1); sie gehören nicht ins Backup.
import { runTransaction } from "./transaction";

export type MetaKey = "persistRequested" | "lastBackupAt" | "backupReminderSnoozedUntil";

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
  return runTransaction(db, "meta", "readwrite", (transaction) => {
    transaction.objectStore("meta").put({ key, value } satisfies MetaRecord);
  });
}
