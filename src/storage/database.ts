// Datenbank öffnen, einrichten und migrieren (TDD 6.1, 7.1, 7.2) sowie mit anderen Tabs abstimmen (TDD 3.4).
import type { BackupFile } from "../domain/backup";
import {
  type DataMigration,
  migrateRecord,
  migrations as appMigrations,
  storesToMigrate,
} from "../domain/migrations";
import { readEmergencyBackup } from "./emergencyBackup";
import { DB_NAME, DB_VERSION, schema as appSchema, type SchemaStep } from "./schema";

export type OpenResult =
  | { ok: true; db: IDBDatabase }
  /** Der Browser erlaubt keine Speicherung, z. B. in manchen privaten Modi (TDD 6.5). */
  | { ok: false; reason: "unavailable" }
  /** Die Datenbank stammt von einer neueren App-Version; es wird nichts geschrieben. */
  | { ok: false; reason: "newer-version" }
  /** Die erste Einrichtung ist gescheitert; es gab noch keine Daten. */
  | { ok: false; reason: "setup-failed" }
  /** Die Migration ist gescheitert, der alte Stand ist unverändert. `backup` ist `null`, wenn er sich nicht lesen ließ. */
  | { ok: false; reason: "migration-failed"; backup: BackupFile | null };

export interface OpenOptions {
  /** Für das Notfall-Backup. */
  appVersion: string;
  /** Eine andere Verbindung braucht eine neuere Version; diese Verbindung ist bereits geschlossen. */
  onVersionChange?: () => void;
  /** Eine Verbindung in einem anderen Tab verhindert das Upgrade; das Öffnen wartet weiter. */
  onBlocked?: () => void;
  /** Nur für Tests und den Dev-Schalter `?testmigration=`. */
  name?: string;
  version?: number;
  schema?: readonly SchemaStep[];
  migrations?: readonly DataMigration[];
}

export function openDatabase(options: OpenOptions): Promise<OpenResult> {
  const {
    appVersion,
    onVersionChange,
    onBlocked,
    name = DB_NAME,
    version = DB_VERSION,
    schema = appSchema,
    migrations = appMigrations,
  } = options;

  return new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(name, version);
    } catch {
      // indexedDB fehlt ganz oder ist gesperrt.
      return resolve({ ok: false, reason: "unavailable" });
    }

    let upgradedFrom: number | null = null;
    request.onupgradeneeded = (event) => {
      const from = event.oldVersion;
      upgradedFrom = from;
      const db = request.result;
      const transaction = request.transaction!;
      try {
        for (let v = from + 1; v <= version; v++)
          schema.find((step) => step.version === v)?.structure(db, transaction);
        // Bei der ersten Einrichtung gibt es keine Datensätze.
        if (from > 0) {
          for (const store of storesToMigrate(migrations, from, version))
            migrateStore(transaction, store, migrations, from, version);
        }
      } catch (error) {
        abortUpgrade(transaction, error);
      }
    };

    request.onblocked = () => onBlocked?.();

    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        onVersionChange?.();
      };
      resolve({ ok: true, db });
    };

    request.onerror = () => {
      if (request.error?.name === "VersionError") resolve({ ok: false, reason: "newer-version" });
      else if (upgradedFrom === null) resolve({ ok: false, reason: "unavailable" });
      // Ohne Daten kein Notfall-Backup: Öffnen ohne Version legte eine leere Datenbank an,
      // und beim nächsten Start liefe die Einrichtung nicht mehr.
      else if (upgradedFrom === 0) resolve({ ok: false, reason: "setup-failed" });
      else {
        readEmergencyBackup(name, appVersion).then(
          (backup) => resolve({ ok: false, reason: "migration-failed", backup }),
          (error: unknown) => {
            console.error("Notfall-Backup nicht lesbar", error);
            resolve({ ok: false, reason: "migration-failed", backup: null });
          },
        );
      }
    };
  });
}

/** Ein Cursor-Durchlauf pro Store mit der ganzen Kette: Zwei offene Cursor auf demselben Store würden sich verschränken. */
function migrateStore(
  transaction: IDBTransaction,
  store: string,
  chain: readonly DataMigration[],
  from: number,
  to: number,
): void {
  const cursorRequest = transaction.objectStore(store).openCursor();
  cursorRequest.onsuccess = () => {
    const cursor = cursorRequest.result;
    if (!cursor) return;
    try {
      cursor.update(migrateRecord(chain, store, cursor.value, from, to));
      cursor.continue();
    } catch (error) {
      abortUpgrade(transaction, error);
    }
  };
}

/** Bricht das Upgrade ausdrücklich ab; der Browser verwirft dann alle Änderungen (TDD 7.2). */
function abortUpgrade(transaction: IDBTransaction, error: unknown): void {
  console.error("Migration fehlgeschlagen", error);
  try {
    transaction.abort();
  } catch {
    // Schon abgebrochen.
  }
}
