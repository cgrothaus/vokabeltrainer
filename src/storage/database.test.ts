import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { failingTestMigration, testMigration } from "../domain/migrations/testMigration";
import { type OpenOptions, type OpenResult, openDatabase } from "./database";
import { readPreMigrationCopy, savePreMigrationCopy } from "./preMigrationCopy";
import { DB_NAME } from "./schema";
import { testSchema } from "./testMigration";

vi.mock("./preMigrationCopy", async (importOriginal) => {
  const original = await importOriginal<typeof import("./preMigrationCopy")>();
  return { ...original, savePreMigrationCopy: vi.fn(original.savePreMigrationCopy) };
});

const v2: Partial<OpenOptions> = { version: 2, schema: testSchema, migrations: [testMigration] };
const open = (options: Partial<OpenOptions> = {}) =>
  openDatabase({ appVersion: "test", ...options });

function expectOk(result: OpenResult): IDBDatabase {
  if (!result.ok) throw new Error(`Öffnen fehlgeschlagen: ${result.reason}`);
  return result.db;
}

/** Öffnet die Datenbank ohne Versionsangabe, wie sie gerade ist. */
function rawOpen(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function readAll(db: IDBDatabase, store: string): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    const request = db.transaction(store).objectStore(store).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Legt eine Datenbank in Version 1 mit den angegebenen Datensätzen an. */
async function seed(records: Record<string, unknown[]>): Promise<void> {
  const db = expectOk(await open());
  const transaction = db.transaction(Object.keys(records), "readwrite");
  for (const [store, items] of Object.entries(records))
    for (const item of items) transaction.objectStore(store).put(item);
  await new Promise((resolve) => (transaction.oncomplete = resolve));
  db.close();
}

const sets = [
  { id: "a", title: "Erstes" },
  { id: "b", title: "Zweites" },
  { id: "c", title: "Drittes", failMigration: true },
];

beforeEach(() => {
  indexedDB = new IDBFactory();
  // Gescheiterte Migrationen protokollieren absichtlich einen Fehler.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

describe("Einrichtung", () => {
  it("legt alle Stores mit ihren Indizes an", async () => {
    const db = expectOk(await open());
    expect(db.version).toBe(1);
    expect(Array.from(db.objectStoreNames).sort()).toEqual([
      "meta",
      "reviewEvents",
      "sessions",
      "sets",
      "settings",
    ]);
    const transaction = db.transaction(["reviewEvents", "sessions", "settings"]);
    const events = transaction.objectStore("reviewEvents");
    expect(events.keyPath).toBe("id");
    expect(Array.from(events.indexNames).sort()).toEqual(["sessionId", "setId"]);
    expect(Array.from(transaction.objectStore("sessions").indexNames)).toEqual(["setId"]);
    expect(transaction.objectStore("settings").keyPath).toBe("key");
    db.close();
  });

  it("öffnet eine bestehende Datenbank, ohne etwas zu ändern", async () => {
    await seed({ sets: [sets[0]] });
    const db = expectOk(await open());
    expect(db.version).toBe(1);
    expect(await readAll(db, "sets")).toEqual([sets[0]]);
    db.close();
  });

  it("legt nach gescheiterter Einrichtung keine Datenbank an", async () => {
    const broken = [
      {
        version: 1,
        structure: () => {
          throw new Error("kaputt");
        },
      },
    ];
    expect(await open({ schema: broken })).toEqual({ ok: false, reason: "setup-failed" });
    expect(await indexedDB.databases()).toEqual([]);
    // Ein späterer Start richtet die Datenbank vollständig ein.
    const db = expectOk(await open());
    expect(db.objectStoreNames).toHaveLength(5);
    db.close();
  });

  it("meldet, wenn der Browser keinen Speicher bereitstellt", async () => {
    (globalThis as { indexedDB?: unknown }).indexedDB = undefined;
    expect(await open()).toEqual({ ok: false, reason: "unavailable" });
  });
});

describe("Migration (TAK-08)", () => {
  it("bringt Datensätze und Struktur auf die neue Version", async () => {
    await seed({ sets: sets.slice(0, 2), settings: [{ key: "theme", value: "dark" }] });
    const db = expectOk(await open(v2));
    expect(db.version).toBe(2);
    expect(await readAll(db, "sets")).toEqual([
      { id: "a", name: "Erstes" },
      { id: "b", name: "Zweites" },
    ]);
    expect(await readAll(db, "settings")).toEqual([{ key: "theme", value: "dark" }]);
    expect(Array.from(db.transaction("sets").objectStore("sets").indexNames)).toEqual(["name"]);
    db.close();
  });

  it("lässt bei einem Fehler den alten Stand unverändert und liefert ein Notfall-Backup", async () => {
    await seed({ sets, meta: [{ key: "persistRequested", value: true }] });
    const result = await open({ ...v2, migrations: [failingTestMigration] });

    if (result.ok || result.reason !== "migration-failed") throw new Error("Fehler erwartet");
    expect(result.backup).toMatchObject({
      format: "vokabeltrainer-backup",
      dataVersion: 1,
      appVersion: "test",
      data: { sets, reviewEvents: [], sessions: [], settings: [] },
    });
    expect(result.backup?.data).not.toHaveProperty("meta");

    const db = await rawOpen();
    expect(db.version).toBe(1);
    expect(await readAll(db, "sets")).toEqual(sets);
    expect(Array.from(db.transaction("sets").objectStore("sets").indexNames)).toEqual([]);
    db.close();
  });

  it("scheitert, wenn ein Schritt in der Kette fehlt", async () => {
    await seed({ sets: [sets[0]] });
    const result = await open({ ...v2, migrations: [] });
    expect(result).toMatchObject({ ok: false, reason: "migration-failed" });
  });
});

describe("Sicherungskopie vor Migrationen (TDD 7.3)", () => {
  const databaseNames = async () => (await indexedDB.databases()).map((info) => info.name).sort();
  const metaKeys = async (db: IDBDatabase) =>
    (await readAll(db, "meta")).map((record) => (record as { key: string }).key);

  it("sichert den alten Stand, bevor Datensätze umgewandelt werden", async () => {
    const settings = [{ key: "theme", value: "dark" }];
    await seed({
      sets: sets.slice(0, 2),
      settings,
      meta: [{ key: "persistRequested", value: true }],
    });
    const db = expectOk(await open(v2));

    expect(await readAll(db, "sets")).toEqual([
      { id: "a", name: "Erstes" },
      { id: "b", name: "Zweites" },
    ]);
    const copy = await readPreMigrationCopy(DB_NAME);
    expect(copy).toMatchObject({
      format: "vokabeltrainer-backup",
      dataVersion: 1,
      appVersion: "test",
      data: { sets: sets.slice(0, 2), reviewEvents: [], sessions: [], settings },
    });
    expect(copy?.data).not.toHaveProperty("meta");
    // In derselben Transaktion wie die Migration vermerkt, für die Frist von 14 Tagen.
    expect(await readAll(db, "meta")).toContainEqual({
      key: "preMigrationCopyAt",
      value: copy?.exportedAt,
    });
    db.close();
  });

  it("ersetzt die Kopie einer früheren Migration", async () => {
    await savePreMigrationCopy(DB_NAME, {
      format: "vokabeltrainer-backup",
      formatVersion: 1,
      dataVersion: 1,
      appVersion: "alt",
      exportedAt: "2026-01-01T00:00:00.000Z",
      data: { sets: [], reviewEvents: [], sessions: [], settings: [] },
    });
    await seed({ sets: [sets[0]] });
    expectOk(await open(v2)).close();
    expect(await readPreMigrationCopy(DB_NAME)).toMatchObject({
      appVersion: "test",
      data: { sets: [sets[0]] },
    });
  });

  it("braucht für ein rein strukturelles Upgrade keine Kopie", async () => {
    await seed({ sets: [sets[0]] });
    const db = expectOk(await open({ ...v2, migrations: [{ version: 2, stores: {} }] }));
    expect(await readAll(db, "sets")).toEqual([sets[0]]);
    expect(await databaseNames()).toEqual([DB_NAME]);
    expect(await metaKeys(db)).toEqual([]);
    db.close();
  });

  it("legt bei Einrichtung und normalem Öffnen keine Kopie an", async () => {
    expectOk(await open()).close();
    await seed({ sets: [sets[0]] });
    expect(await databaseNames()).toEqual([DB_NAME]);
  });

  it("lässt nach einer gescheiterten Migration keine Kopie zurück", async () => {
    await seed({ sets });
    const result = await open({ ...v2, migrations: [failingTestMigration] });
    expect(result).toMatchObject({ ok: false, reason: "migration-failed" });
    expect(await databaseNames()).toEqual([DB_NAME]);
  });

  it("migriert trotzdem, wenn sich die Kopie nicht anlegen lässt", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(savePreMigrationCopy).mockRejectedValueOnce(
      new DOMException("Speicher voll", "QuotaExceededError"),
    );
    await seed({ sets: [sets[0]] });
    const db = expectOk(await open(v2));
    expect(await readAll(db, "sets")).toEqual([{ id: "a", name: "Erstes" }]);
    expect(await metaKeys(db)).toEqual([]);
    expect(warn).toHaveBeenCalledOnce();
    db.close();
  });
});

describe("Mehrere Versionen und Tabs (TDD 3.4, 7.2)", () => {
  it("meldet eine Datenbank, die neuer als die App ist", async () => {
    expectOk(await open(v2)).close();
    expect(await open()).toEqual({ ok: false, reason: "newer-version" });
    const db = await rawOpen();
    expect(db.version).toBe(2);
    db.close();
  });

  it("gibt die Verbindung frei, wenn eine neuere Version sie braucht", async () => {
    const onVersionChange = vi.fn();
    const first = expectOk(await open({ onVersionChange }));
    const second = expectOk(await open(v2));
    expect(onVersionChange).toHaveBeenCalledOnce();
    expect(second.version).toBe(2);
    second.close();
    first.close();
  });

  it("meldet, wenn eine fremde Verbindung das Upgrade blockiert, und öffnet danach", async () => {
    expectOk(await open()).close();
    const foreign = await rawOpen();
    const onBlocked = vi.fn();
    const pending = open({ ...v2, onBlocked });
    await vi.waitFor(() => expect(onBlocked).toHaveBeenCalled());
    foreign.close();
    const db = expectOk(await pending);
    expect(db.version).toBe(2);
    db.close();
  });
});
