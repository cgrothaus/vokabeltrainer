// Notfall-Backup (TDD 7.2): Nach einer gescheiterten Migration liegt die Datenbank unverändert im alten
// Stand vor. Sie wird ohne Versionsangabe geöffnet und vollständig roh ausgelesen.
import { type BackupFile, createBackup } from "../domain/backup";

export function readEmergencyBackup(name: string, appVersion: string): Promise<BackupFile> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name);
    // Gibt es die Datenbank nicht, würde sie hier leer angelegt; dann gibt es auch nichts zu sichern.
    request.onupgradeneeded = () => request.transaction?.abort();
    request.onerror = () => reject(request.error ?? new Error("Datenbank nicht lesbar"));
    request.onsuccess = () => {
      const db = request.result;
      const stores = Array.from(db.objectStoreNames).filter((store) => store !== "meta");
      const data: Record<string, unknown[]> = {};
      const done = () => {
        db.close();
        const exportedAt = new Date().toISOString();
        resolve(createBackup({ dataVersion: db.version, appVersion, exportedAt, data }));
      };
      if (stores.length === 0) return done();
      // Eine Transaktion für alle Stores: ein in sich stimmiger Stand (TDD 11.3).
      const transaction = db.transaction(stores, "readonly");
      for (const store of stores) {
        const read = transaction.objectStore(store).getAll();
        read.onsuccess = () => (data[store] = read.result);
      }
      transaction.oncomplete = done;
      transaction.onabort = () => {
        db.close();
        reject(transaction.error ?? new Error("Lesen abgebrochen"));
      };
    };
  });
}
