// Datenbank öffnen, einrichten und migrieren (TDD 6.1, 7.1–7.3) sowie mit anderen Tabs abstimmen (TDD 3.4).
import type { BackupFile } from "../domain/backup";
import {
  type DataMigration,
  migrateRecord,
  migrations as appMigrations,
  storesToMigrate,
} from "../domain/migrations";
import { readEmergencyBackup } from "./emergencyBackup";
import { putMeta } from "./meta";
import { deletePreMigrationCopy, savePreMigrationCopy } from "./preMigrationCopy";
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
  return open(options, undefined);
}

/**
 * `copiedAt`: `undefined`, solange vor einer Datenumwandlung noch nicht gesichert wurde; danach der
 * Zeitpunkt der Sicherungskopie oder `null`, wenn sie sich nicht anlegen ließ (TDD 7.3).
 */
function open(options: OpenOptions, copiedAt: string | null | undefined): Promise<OpenResult> {
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
    // In eine andere Datenbank lässt sich während des Upgrades nicht schreiben: abbrechen, bevor sich
    // etwas ändert, den alten Stand sichern und erneut öffnen.
    let copyFirst = false;
    request.onupgradeneeded = (event) => {
      const from = event.oldVersion;
      upgradedFrom = from;
      const db = request.result;
      const transaction = request.transaction!;
      if (copiedAt === undefined && from > 0 && convertsData(migrations, from, version)) {
        copyFirst = true;
        transaction.abort();
        return;
      }
      try {
        for (let v = from + 1; v <= version; v++)
          schema.find((step) => step.version === v)?.structure(db, transaction);
        // Bei der ersten Einrichtung gibt es keine Datensätze.
        if (from > 0) {
          for (const store of storesToMigrate(migrations, from, version))
            migrateStore(transaction, store, migrations, from, version);
          // Mit der Migration zusammen gespeichert: Die Frist der Kopie beginnt nur, wenn sie gelingt.
          if (copiedAt) putMeta(transaction, "preMigrationCopyAt", copiedAt);
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
      if (copyFirst) resolve(copyThenOpen(options, name));
      else if (request.error?.name === "VersionError")
        resolve({ ok: false, reason: "newer-version" });
      else if (upgradedFrom === null) resolve({ ok: false, reason: "unavailable" });
      // Ohne Daten kein Notfall-Backup: Öffnen ohne Version legte eine leere Datenbank an,
      // und beim nächsten Start liefe die Einrichtung nicht mehr.
      else if (upgradedFrom === 0) resolve({ ok: false, reason: "setup-failed" });
      else resolve(migrationFailed(name, appVersion, copiedAt));
    };
  });
}

/** Ob zwischen den Versionen Datensätze umgewandelt werden. Fehlt ein Glied der Kette, scheitert die Migration ohnehin. */
function convertsData(chain: readonly DataMigration[], from: number, to: number): boolean {
  try {
    return storesToMigrate(chain, from, to).length > 0;
  } catch {
    return false;
  }
}

async function copyThenOpen(options: OpenOptions, name: string): Promise<OpenResult> {
  let copiedAt: string | null = null;
  try {
    const backup = await readEmergencyBackup(name, options.appVersion);
    await savePreMigrationCopy(name, backup);
    copiedAt = backup.exportedAt;
  } catch (error) {
    // Trotzdem migrieren: Das Upgrade bleibt atomar, scheitert es, gibt es das Notfall-Backup (TDD 7.3).
    console.warn("Sicherungskopie vor der Migration nicht angelegt", error);
  }
  return open(options, copiedAt);
}

async function migrationFailed(
  name: string,
  appVersion: string,
  copiedAt: string | null | undefined,
): Promise<OpenResult> {
  // Der alte Stand ist unverändert; eine Kopie ohne Frist bliebe sonst für immer liegen.
  if (copiedAt)
    await deletePreMigrationCopy(name).catch((error: unknown) =>
      console.warn("Sicherungskopie nicht gelöscht", error),
    );
  try {
    return {
      ok: false,
      reason: "migration-failed",
      backup: await readEmergencyBackup(name, appVersion),
    };
  } catch (error) {
    console.error("Notfall-Backup nicht lesbar", error);
    return { ok: false, reason: "migration-failed", backup: null };
  }
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
