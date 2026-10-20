// Ablauf von Backup und Wiederherstellung (TDD 11.3, 11.4): Prüfen in domain/backup.ts, Lesen und
// Schreiben in storage/backup.ts, Ausliefern in platform/deliverFile.ts. Hier werden sie verbunden.
import {
  type BackupSummary,
  type CheckedBackup,
  backupFileName,
  parseBackup,
} from "../domain/backup";
import { extractJson } from "../domain/extract";
import { migrations } from "../domain/migrations";
import { type Delivery, deliverFile } from "../platform/deliverFile";
import { readBackup, restoreBackup } from "../storage/backup";
import { getMeta, setMeta } from "../storage/meta";
import { DB_VERSION } from "../storage/schema";

export interface PreparedBackup {
  blob: Blob;
  filename: string;
  exportedAt: string;
}

export type CheckOutcome =
  { ok: true; backup: CheckedBackup; summary: BackupSummary } | { ok: false; errors: string[] };

export type RestoreOutcome = { ok: true } | { ok: false; error: string };

const UNREADABLE =
  "Die Datei enthält kein lesbares Backup. Wähle die Backup-Datei des Vokabeltrainers aus.";

const RESTORE_ERRORS = {
  quota:
    "Der Speicher auf diesem Gerät ist voll. Das Backup wurde nicht wiederhergestellt; deine bisherigen Daten sind unverändert.",
  failed:
    "Das Backup konnte nicht wiederhergestellt werden; deine bisherigen Daten sind unverändert. Lade die Seite neu und versuche es noch einmal.",
} as const;

/**
 * Liest den Bestand schon vor dem Tippen auf „Backup speichern“: Das Teilen-Menü öffnet sich nur
 * direkt nach der Geste (TDD 11.2).
 */
export async function prepareBackup(db: IDBDatabase, appVersion: string): Promise<PreparedBackup> {
  const now = new Date();
  const exportedAt = now.toISOString();
  const backup = await readBackup(db, appVersion, exportedAt);
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  return { blob, filename: backupFileName(now), exportedAt };
}

/** Nach dem Ausliefern gilt der Stand des Backups als gesichert (TDD 11.3). */
export async function saveBackup(db: IDBDatabase, prepared: PreparedBackup): Promise<Delivery> {
  // Als Erstes: Vor `share()` darf nichts warten.
  const delivery = await deliverFile(prepared.blob, prepared.filename);
  if (delivery !== "cancelled") {
    await setMeta(db, "lastBackupAt", prepared.exportedAt).catch((error: unknown) => {
      // Die Datei ist trotzdem gespeichert; nur die Erinnerung (S-27) kennt den Zeitpunkt nicht.
      console.warn("Zeitpunkt des Backups nicht vermerkt", error);
    });
  }
  return delivery;
}

export async function lastBackupAt(db: IDBDatabase): Promise<string | undefined> {
  const value = await getMeta(db, "lastBackupAt");
  return typeof value === "string" ? value : undefined;
}

/** Schritte 1 bis 3 aus TDD 11.4; schreibt nichts. */
export function checkBackup(text: string): CheckOutcome {
  const extracted = extractJson(text);
  if (!extracted.ok) return { ok: false, errors: [UNREADABLE] };
  return parseBackup(extracted.value, { dataVersion: DB_VERSION, migrations });
}

export async function restore(db: IDBDatabase, backup: CheckedBackup): Promise<RestoreOutcome> {
  const result = await restoreBackup(db, backup);
  return result.ok ? result : { ok: false, error: RESTORE_ERRORS[result.reason] };
}
