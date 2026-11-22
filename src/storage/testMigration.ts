// Strukturteil der Test-Migration v1 → v2 (TDD 7.4); der Datenteil steht in domain/migrations/testMigration.ts.
// Genutzt von den Integrationstests und dem Dev-Schalter `?testmigration=`, nie von der App selbst.
import { migrations } from "../domain/migrations";
import { failingTestMigration, testMigration } from "../domain/migrations/testMigration";
import { type OpenOptions, type OpenResult, openDatabase } from "./database";
import { deleteDatabase, deletePreMigrationCopy } from "./preMigrationCopy";
import { DB_VERSION, schema, type SchemaStep } from "./schema";
import { runTransaction } from "./transaction";

/**
 * Version 1 der App plus eine eigene Version 2 mit einem Index auf dem umbenannten Feld. Die Version 2
 * der App gehört nicht dazu: Der Mechanismus wird an einer Umwandlung geprüft, die echte hat keine.
 */
export const testSchema: readonly SchemaStep[] = [
  ...schema.filter((step) => step.version === 1),
  {
    version: 2,
    structure: (_db, transaction) => transaction.objectStore("sets").createIndex("name", "name"),
  },
];

/**
 * Eine gedachte nächste App-Version mit der Umwandlung der Test-Migration, für Tests, die eine
 * Datenbank der aktuellen App übernehmen (neuere Version in einem anderen Tab, Sicherungskopie).
 */
export const nextAppVersion = {
  version: DB_VERSION + 1,
  schema: [...schema, { version: DB_VERSION + 1, structure: () => {} }],
  migrations: [...migrations, { ...testMigration, version: DB_VERSION + 1 }],
} satisfies Partial<OpenOptions>;

const TEST_DB_NAME = "vokabeltrainer-testmigration";

/**
 * Dev-Schalter `?testmigration=ok|fail` (nur im Dev-Server): legt eine eigene Testdatenbank in Version 1
 * mit einem Set an und öffnet sie mit der Test-Migration. Die eigentliche Datenbank bleibt unberührt.
 * Die Sicherungskopie liegt danach in `vokabeltrainer-testmigration-premigration` (TDD 7.3).
 */
export async function openWithTestMigration(
  mode: "ok" | "fail",
  options: OpenOptions,
): Promise<OpenResult> {
  await deleteDatabase(TEST_DB_NAME);
  await deletePreMigrationCopy(TEST_DB_NAME);
  const v1 = await openDatabase({
    ...options,
    name: TEST_DB_NAME,
    version: 1,
    schema: testSchema,
    migrations: [],
  });
  if (!v1.ok) return v1;
  await runTransaction(v1.db, "sets", "readwrite", (transaction) => {
    transaction
      .objectStore("sets")
      .put({ id: "beispiel", title: "Beispielset", failMigration: mode === "fail" });
  });
  v1.db.close();
  return openDatabase({
    ...options,
    name: TEST_DB_NAME,
    version: 2,
    schema: testSchema,
    migrations: [mode === "fail" ? failingTestMigration : testMigration],
  });
}
