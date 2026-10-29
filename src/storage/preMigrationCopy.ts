// Sicherungskopie vor Migrationen (TDD 7.3, D-14): Vor einem Upgrade mit Datenumwandlung liegt der alte
// Stand als Backup in einer eigenen Datenbank. Sie bleibt 14 Tage, damit ein Update mit Fehlerbehebung
// sie noch vorfindet und über die Wiederherstellung (TDD 11.4) zurückspielen kann.
import type { BackupFile } from "../domain/backup";
import { deleteMeta, getMeta } from "./meta";

export const PRE_MIGRATION_COPY_DAYS = 14;

const STORE = "copy";
const KEY = "backup";

export function preMigrationCopyName(name: string): string {
  return `${name}-premigration`;
}

/** Ersetzt eine ältere Kopie; gespeichert ist erst nach `complete`. */
export async function savePreMigrationCopy(name: string, backup: BackupFile): Promise<void> {
  const copyName = preMigrationCopyName(name);
  await deleteDatabase(copyName);
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(copyName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "key" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Kopie nicht angelegt"));
  });
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE, "readwrite");
      transaction.oncomplete = () => resolve();
      transaction.onabort = () =>
        reject(transaction.error ?? new DOMException("Transaktion abgebrochen", "AbortError"));
      transaction.objectStore(STORE).put({ key: KEY, backup });
    });
  } finally {
    db.close();
  }
}

/** `null`, wenn es keine Kopie gibt; dann wird auch keine leere Datenbank angelegt. */
export function readPreMigrationCopy(name: string): Promise<BackupFile | null> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(preMigrationCopyName(name));
    let missing = false;
    request.onupgradeneeded = () => {
      missing = true;
      request.transaction?.abort();
    };
    request.onerror = () =>
      missing ? resolve(null) : reject(request.error ?? new Error("Kopie nicht lesbar"));
    request.onsuccess = () => {
      const db = request.result;
      const read = db.transaction(STORE).objectStore(STORE).get(KEY);
      read.onsuccess = () => {
        db.close();
        resolve((read.result as { backup: BackupFile } | undefined)?.backup ?? null);
      };
      read.onerror = () => {
        db.close();
        reject(read.error);
      };
    };
  });
}

export function deletePreMigrationCopy(name: string): Promise<void> {
  return deleteDatabase(preMigrationCopyName(name));
}

/**
 * Beim Start: Löscht die Kopie samt Zeitpunkt, wenn die Frist abgelaufen ist. Ein unbrauchbarer
 * Zeitpunkt gilt als abgelaufen, sonst bliebe die Kopie für immer.
 */
export async function discardExpiredPreMigrationCopy(db: IDBDatabase, now: Date): Promise<void> {
  const copiedAt = await getMeta(db, "preMigrationCopyAt");
  if (copiedAt === undefined) return;
  const time = typeof copiedAt === "string" ? Date.parse(copiedAt) : NaN;
  const expired =
    Number.isNaN(time) || now.getTime() - time >= PRE_MIGRATION_COPY_DAYS * 24 * 60 * 60 * 1000;
  if (!expired) return;
  await deletePreMigrationCopy(db.name);
  await deleteMeta(db, "preMigrationCopyAt");
}

/** Gibt es die Datenbank nicht, gelingt das Löschen trotzdem. */
export function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
