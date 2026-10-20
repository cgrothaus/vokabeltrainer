// Test-Migration v1 → v2 (TDD 7.4): prüft den Mechanismus, solange es keine echten Migrationen gibt.
// Genutzt von den Integrationstests und dem Dev-Schalter `?testmigration=`, nie von der App selbst.
import type { DataMigration } from "./index";

function renameTitle(record: unknown): unknown {
  const { title, ...rest } = record as Record<string, unknown>;
  return { ...rest, name: title };
}

/** Benennt in Sets `title` in `name` um. */
export const testMigration: DataMigration = { version: 2, stores: { sets: renameTitle } };

/** Wie `testMigration`, scheitert aber an Sets mit `failMigration: true`. */
export const failingTestMigration: DataMigration = {
  version: 2,
  stores: {
    sets: (record) => {
      if ((record as { failMigration?: unknown }).failMigration === true)
        throw new Error("Test-Migration absichtlich fehlgeschlagen");
      return renameTitle(record);
    },
  },
};
