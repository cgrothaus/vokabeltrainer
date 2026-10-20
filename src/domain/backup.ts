// Backupformat (TDD 11.3): Rohkopien der Stores in einer versionierten Hülle.

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
