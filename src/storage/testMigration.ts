// Strukturteil der Test-Migration v1 → v2 (TDD 7.4); der Datenteil steht in domain/migrations/testMigration.ts.
// Genutzt von den Integrationstests und dem Dev-Schalter `?testmigration=`, nie von der App selbst.
import { failingTestMigration, testMigration } from "../domain/migrations/testMigration";
import { type OpenOptions, type OpenResult, openDatabase } from "./database";
import { schema, type SchemaStep } from "./schema";
import { runTransaction } from "./transaction";

/** Schema der App plus Version 2 mit einem Index auf dem umbenannten Feld. */
export const testSchema: readonly SchemaStep[] = [
  ...schema,
  {
    version: 2,
    structure: (_db, transaction) => transaction.objectStore("sets").createIndex("name", "name"),
  },
];

const TEST_DB_NAME = "vokabeltrainer-testmigration";

/**
 * Dev-Schalter `?testmigration=ok|fail` (nur im Dev-Server): legt eine eigene Testdatenbank in Version 1
 * mit einem Set an und öffnet sie mit der Test-Migration. Die eigentliche Datenbank bleibt unberührt.
 */
export async function openWithTestMigration(
  mode: "ok" | "fail",
  options: OpenOptions,
): Promise<OpenResult> {
  await deleteDatabase(TEST_DB_NAME);
  const v1 = await openDatabase({ ...options, name: TEST_DB_NAME });
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

function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
