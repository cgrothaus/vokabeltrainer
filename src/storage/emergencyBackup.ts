// Notfall-Backup (TDD 7.2): Nach einer gescheiterten Migration liegt die Datenbank unverändert im alten
// Stand vor. Sie wird ohne Versionsangabe geöffnet und vollständig roh ausgelesen.
import { type BackupFile, createBackup } from "../domain/backup";
import { readStores } from "./backup";

export function readEmergencyBackup(name: string, appVersion: string): Promise<BackupFile> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name);
    // Gibt es die Datenbank nicht, würde sie hier leer angelegt; dann gibt es auch nichts zu sichern.
    request.onupgradeneeded = () => request.transaction?.abort();
    request.onerror = () => reject(request.error ?? new Error("Datenbank nicht lesbar"));
    request.onsuccess = () => {
      const db = request.result;
      const stores = Array.from(db.objectStoreNames).filter((store) => store !== "meta");
      readStores(db, stores).then(
        (data) => {
          db.close();
          const exportedAt = new Date().toISOString();
          resolve(createBackup({ dataVersion: db.version, appVersion, exportedAt, data }));
        },
        (error: unknown) => {
          db.close();
          reject(error);
        },
      );
    };
  });
}
