// Backupformat (TDD 11.3): Rohkopien der Stores in einer versionierten Hülle. Beim Wiederherstellen
// (TDD 11.4) wird die Hülle geprüft, der Inhalt über die Migrationskette hochgezogen und geprüft.
import { type DataMigration, migrateRecord } from "./migrations";
import type { StoredSet } from "./model";
import { type StoreRecords, validateRecords } from "./validateRecords";

/** Stores im Backup; `meta` bleibt auf dem Gerät. */
export const BACKUP_STORES = ["sets", "reviewEvents", "sessions", "settings"] as const;

/** Schutz vor Blockade; Backups wachsen mit den Antworten über die Grenze des Imports hinaus. */
export const MAX_BACKUP_SIZE = 100 * 1024 * 1024;

export interface BackupFile {
  format: "vokabeltrainer-backup";
  /** Stand der Hülle. */
  formatVersion: 1;
  /** Stand der Datensätze, entspricht `DB_VERSION` beim Export. */
  dataVersion: number;
  appVersion: string;
  exportedAt: string;
  data: Record<string, unknown[]>;
}

export function createBackup(input: {
  dataVersion: number;
  appVersion: string;
  exportedAt: string;
  data: Record<string, unknown[]>;
}): BackupFile {
  // Interne Angaben wie lastBackupAt gehören nicht ins Backup.
  const { meta: _meta, ...data } = input.data;
  return {
    format: "vokabeltrainer-backup",
    formatVersion: 1,
    dataVersion: input.dataVersion,
    appVersion: input.appVersion,
    exportedAt: input.exportedAt,
    data,
  };
}

/** Dateiname nach TDD 14, mit dem Datum aus Sicht der Person. */
export function backupFileName(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `Vokabeltrainer-Backup_${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`;
}

/** Umfang eines Bestands, z. B. für die Vorschau eines Backups oder „Alle Daten löschen“. */
export interface RecordCounts {
  sets: number;
  entries: number;
  sessions: number;
  events: number;
}

export interface BackupSummary extends RecordCounts {
  exportedAt: string;
}

/** Erwartet geprüfte Datensätze; Einstellungen zählen nicht mit. */
export function summarizeRecords(records: StoreRecords): RecordCounts {
  const sets = records.sets as StoredSet[];
  return {
    sets: sets.length,
    entries: sets.reduce(
      (sum, set) => sum + set.sections.reduce((n, section) => n + section.entries.length, 0),
      0,
    ),
    sessions: records.sessions.length,
    events: records.reviewEvents.length,
  };
}

/** Geprüftes Backup auf dem Stand der App, bereit zum Wiederherstellen. */
export type CheckedBackup = BackupFile & { data: StoreRecords };

export type ParseBackupResult =
  { ok: true; backup: CheckedBackup; summary: BackupSummary } | { ok: false; errors: string[] };

const NOT_A_BACKUP = "Die Datei ist kein Backup des Vokabeltrainers.";
const SET_FILE =
  "Das ist ein Vokabelset, kein Backup. Ein Vokabelset wird importiert, nicht wiederhergestellt.";
const NEWER =
  "Dieses Backup stammt von einer neueren App-Version. Lade die App neu, um es wiederherzustellen.";
const NOT_MIGRATED =
  "Das Backup ließ sich nicht auf den Stand dieser App-Version bringen. Deine Daten auf diesem Gerät bleiben unverändert.";

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isVersion = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) >= 1;

const invalid = (field: string) => `Die Angabe „${field}“ fehlt oder ist ungültig.`;

/** Prüft ein geparstes Backup und bringt es auf den Stand `target.dataVersion` (TDD 11.4, Schritte 2 und 3). */
export function parseBackup(
  value: unknown,
  target: { dataVersion: number; migrations: readonly DataMigration[] },
): ParseBackupResult {
  const fail = (...errors: string[]) => ({ ok: false as const, errors });
  if (!isObject(value)) return fail(NOT_A_BACKUP);
  if (value.format === "vokabeltrainer-set") return fail(SET_FILE);
  if (value.format === undefined && ("set" in value || "sections" in value)) return fail(SET_FILE);
  if (value.format !== "vokabeltrainer-backup") return fail(NOT_A_BACKUP);

  const { formatVersion, dataVersion, exportedAt, data } = value;
  if (isVersion(formatVersion) && formatVersion > 1) return fail(NEWER);
  if (isVersion(dataVersion) && dataVersion > target.dataVersion) return fail(NEWER);

  const errors: string[] = [];
  if (!isVersion(formatVersion)) errors.push(invalid("formatVersion"));
  if (!isVersion(dataVersion)) errors.push(invalid("dataVersion"));
  if (typeof exportedAt !== "string" || Number.isNaN(Date.parse(exportedAt)))
    errors.push(invalid("exportedAt"));
  if (!isObject(data)) errors.push(invalid("data"));
  else
    for (const store of BACKUP_STORES)
      if (!Array.isArray(data[store])) errors.push(invalid(`data.${store}`));
  if (errors.length > 0) return fail(...errors);

  const raw = data as unknown as StoreRecords;
  let records: StoreRecords;
  try {
    const migrate = (store: keyof StoreRecords) =>
      raw[store].map((record) =>
        migrateRecord(target.migrations, store, record, dataVersion as number, target.dataVersion),
      );
    records = {
      sets: migrate("sets"),
      reviewEvents: migrate("reviewEvents"),
      sessions: migrate("sessions"),
      settings: migrate("settings"),
    };
  } catch {
    return fail(NOT_MIGRATED);
  }

  const recordErrors = validateRecords(records);
  if (recordErrors.length > 0) return fail(...recordErrors);

  return {
    ok: true,
    backup: {
      format: "vokabeltrainer-backup",
      formatVersion: 1,
      dataVersion: target.dataVersion,
      appVersion: typeof value.appVersion === "string" ? value.appVersion : "",
      exportedAt: exportedAt as string,
      data: records,
    },
    summary: { exportedAt: exportedAt as string, ...summarizeRecords(records) },
  };
}
