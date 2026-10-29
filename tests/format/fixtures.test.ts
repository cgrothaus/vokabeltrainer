// Gespeicherte Stände seit der ersten Auslieferung (S-29, TDD 7.4, 15.3, TAK-08): Für jede `DB_VERSION`
// gibt es ein Fixture der Datenbank und eines Backups, erzeugt aus der App. Jedes wird von der aktuellen
// App übernommen; der jüngste Stand muss außerdem genau so wieder herauskommen.
import "fake-indexeddb/auto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import { BACKUP_STORES, parseBackup } from "../../src/domain/backup";
import { migrations } from "../../src/domain/migrations";
import { type StoreRecords, validateRecords } from "../../src/domain/validateRecords";
import { readBackup, readStores, restoreBackup } from "../../src/storage/backup";
import { openDatabase } from "../../src/storage/database";
import { DB_VERSION } from "../../src/storage/schema";

interface StoreFixture {
  keyPath: string;
  indexes: Record<string, string>;
  records: unknown[];
}

interface DbFixture {
  dbVersion: number;
  stores: Record<string, StoreFixture>;
}

type Structure = Record<string, { keyPath: string; indexes: Record<string, string> }>;

const fixtures = new URL("../fixtures/", import.meta.url);
const file = (kind: "db" | "backup", version: number) =>
  new URL(`${kind}/v${version}.json`, fixtures);
const readDb = (version: number) =>
  JSON.parse(readFileSync(file("db", version), "utf8")) as DbFixture;
const readBackupFile = (version: number) => readFileSync(file("backup", version), "utf8");

const versions = Array.from({ length: DB_VERSION }, (_, i) => i + 1);
const NAME = "fixture";

beforeEach(() => {
  indexedDB = new IDBFactory();
});

async function open(version = DB_VERSION): Promise<IDBDatabase> {
  const result = await openDatabase({ appVersion: "test", name: NAME, version });
  if (!result.ok) throw new Error(`Öffnen fehlgeschlagen: ${result.reason}`);
  return result.db;
}

function structureOf(db: IDBDatabase): Structure {
  const names = [...db.objectStoreNames];
  const transaction = db.transaction(names);
  return Object.fromEntries(
    names.map((name) => {
      const store = transaction.objectStore(name);
      const indexes = [...store.indexNames].map((index) => [index, store.index(index).keyPath]);
      return [name, { keyPath: store.keyPath, indexes: Object.fromEntries(indexes) }];
    }),
  ) as Structure;
}

const fixtureStructure = (fixture: DbFixture): Structure =>
  Object.fromEntries(
    Object.entries(fixture.stores).map(([name, { keyPath, indexes }]) => [
      name,
      { keyPath, indexes },
    ]),
  );

/** Legt die Datenbank ohne App-Code an, wie sie eine App mit `dbVersion` hinterlassen hat. */
function createFromFixture(fixture: DbFixture): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(NAME, fixture.dbVersion);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const [name, store] of Object.entries(fixture.stores)) {
        const objectStore = db.createObjectStore(name, { keyPath: store.keyPath });
        for (const [index, keyPath] of Object.entries(store.indexes))
          objectStore.createIndex(index, keyPath);
        for (const record of store.records) objectStore.add(record);
      }
    };
    request.onsuccess = () => {
      request.result.close();
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

describe("Fixtures je DB_VERSION", () => {
  it("gibt es genau für die Versionen 1 bis DB_VERSION", () => {
    for (const kind of ["db", "backup"] as const) {
      const present = readdirSync(new URL(`${kind}/`, fixtures)).sort();
      expect(present, kind).toEqual(versions.map((v) => `v${v}.json`).sort());
      for (const version of versions) expect(existsSync(file(kind, version))).toBe(true);
    }
  });

  it.each(versions)(
    "v%i: Die Schemaschritte bis dahin ergeben die Struktur des Fixtures",
    async (version) => {
      const fixture = readDb(version);
      expect(fixture.dbVersion).toBe(version);
      const db = await open(version);
      expect(structureOf(db)).toEqual(fixtureStructure(fixture));
      db.close();
    },
  );

  it.each(versions)("v%i: Die App übernimmt die Datenbank", async (version) => {
    const fixture = readDb(version);
    await createFromFixture(fixture);
    const db = await open();
    expect(db.version).toBe(DB_VERSION);
    const data = await readStores(db, BACKUP_STORES);
    expect(validateRecords(data as StoreRecords)).toEqual([]);
    if (version === DB_VERSION) {
      const all = await readStores(db, [...db.objectStoreNames]);
      expect(all).toEqual(
        Object.fromEntries(Object.entries(fixture.stores).map(([n, s]) => [n, s.records])),
      );
    }
    db.close();
  });

  it.each(versions)("v%i: Die App stellt das Backup wieder her", async (version) => {
    const text = readBackupFile(version);
    const parsed = parseBackup(JSON.parse(text), { dataVersion: DB_VERSION, migrations });
    if (!parsed.ok) throw new Error(parsed.errors.join("\n"));
    const { backup } = parsed;
    expect(validateRecords(backup.data)).toEqual([]);

    const db = await open();
    expect(await restoreBackup(db, backup)).toEqual({ ok: true });
    if (version === DB_VERSION) {
      // Dasselbe Backup noch einmal geschrieben: Format und Inhalt sind unverändert.
      const again = await readBackup(db, backup.appVersion, backup.exportedAt);
      expect(JSON.stringify(again, null, 2)).toBe(text);
    }
    db.close();
  });
});
