// Präferenzen im Store `settings` (TDD 6.1); sie gehören ins Backup. Werte werden beim Lesen tolerant
// geprüft (z. B. `restoreSetup` in domain/practiceSetup.ts), weil sie auch aus einem Backup stammen.
import { runTransaction } from "./transaction";

export interface SettingRecord {
  key: string;
  value: unknown;
}

export async function getSetting(db: IDBDatabase, key: string): Promise<unknown> {
  let value: unknown;
  await runTransaction(db, "settings", "readonly", (transaction) => {
    const request = transaction.objectStore("settings").get(key);
    request.onsuccess = () => (value = (request.result as SettingRecord | undefined)?.value);
  });
  return value;
}

/** Gespeichert erst, wenn die Transaktion abgeschlossen ist. */
export function setSetting(db: IDBDatabase, record: SettingRecord): Promise<void> {
  return runTransaction(db, "settings", "readwrite", (transaction) =>
    putSetting(transaction, record),
  );
}

/** Innerhalb einer größeren Transaktion, die `settings` einschließt. */
export function putSetting(transaction: IDBTransaction, record: SettingRecord): void {
  transaction.objectStore("settings").put(record);
}
