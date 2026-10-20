// Migrationskette für Datensätze (TDD 7.1, D-13): reine Funktionen, genutzt beim Upgrade der Datenbank
// und beim Wiederherstellen älterer Backups.

/** Schritt von `version - 1` nach `version`. Stores ohne Eintrag bleiben unverändert; der Schlüssel eines Datensatzes darf sich nicht ändern. */
export interface DataMigration {
  readonly version: number;
  readonly stores: Readonly<Record<string, (record: unknown) => unknown>>;
}

/** Migrationen der App. Bis zur ersten Auslieferung (S-29) leer, `DB_VERSION` bleibt 1 (TDD 7.4). */
export const migrations: readonly DataMigration[] = [];

/** Bringt einen Datensatz von Version `from` auf `to`. */
export function migrateRecord(
  chain: readonly DataMigration[],
  store: string,
  record: unknown,
  from: number,
  to: number,
): unknown {
  for (const step of steps(chain, from, to)) {
    const migrate = step.stores[store];
    if (migrate) record = migrate(record);
  }
  return record;
}

/** Stores, deren Datensätze zwischen `from` und `to` umgewandelt werden. */
export function storesToMigrate(
  chain: readonly DataMigration[],
  from: number,
  to: number,
): string[] {
  const stores = new Set<string>();
  for (const step of steps(chain, from, to)) {
    for (const store of Object.keys(step.stores)) stores.add(store);
  }
  return [...stores];
}

function steps(chain: readonly DataMigration[], from: number, to: number): DataMigration[] {
  if (from > to)
    throw new Error(`Die Daten (Version ${from}) sind neuer als die App (Version ${to})`);
  const result: DataMigration[] = [];
  for (let version = from + 1; version <= to; version++) {
    const step = chain.find((s) => s.version === version);
    if (!step) throw new Error(`Migration auf Version ${version} fehlt`);
    result.push(step);
  }
  return result;
}
