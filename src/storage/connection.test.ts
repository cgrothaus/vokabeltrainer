import "fake-indexeddb/auto";
import { forceCloseDatabase, IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { testMigration } from "../domain/migrations/testMigration";
import { keepConnected } from "./connection";
import { type OpenResult, openDatabase } from "./database";
import { getMeta, setMeta } from "./meta";
import { testSchema } from "./testMigration";
import { runTransaction } from "./transaction";

let db: IDBDatabase;
let opened: IDBDatabase[];

// Die Typdeklaration von `fake-indexeddb` verlangt die Klasse statt einer Verbindung.
const forceClose = (connection: IDBDatabase) =>
  forceCloseDatabase(connection as unknown as Parameters<typeof forceCloseDatabase>[0]);

async function open(): Promise<OpenResult> {
  const result = await openDatabase({ appVersion: "test" });
  if (result.ok) opened.push(result.db);
  return result;
}

beforeEach(async () => {
  indexedDB = new IDBFactory();
  opened = [];
  const result = await open();
  if (!result.ok) throw new Error(result.reason);
  db = result.db;
});

describe("keepConnected", () => {
  it("verbindet nach geschlossener Verbindung neu, auch über das alte Handle", async () => {
    const reopen = vi.fn(open);
    keepConnected(db, { reopen });
    db.close();
    await setMeta(db, "persistRequested", true);
    expect(reopen).toHaveBeenCalledOnce();
    expect(await getMeta(db, "persistRequested")).toBe(true);
    expect(reopen).toHaveBeenCalledOnce();
  });

  it("verbindet nach unerwartetem Schließen durch den Browser neu", async () => {
    const reopen = vi.fn(open);
    keepConnected(db, { reopen });
    forceClose(db);
    await setMeta(db, "persistRequested", true);
    expect(reopen).toHaveBeenCalledOnce();
    expect(await getMeta(opened.at(-1)!, "persistRequested")).toBe(true);
  });

  it("öffnet bei gleichzeitigen Aufrufen nur einmal", async () => {
    const reopen = vi.fn(open);
    keepConnected(db, { reopen });
    db.close();
    await Promise.all([
      setMeta(db, "persistRequested", true),
      setMeta(db, "lastBackupAt", "2026-10-22T18:00:00.000Z"),
      getMeta(db, "persistRequested"),
    ]);
    expect(reopen).toHaveBeenCalledOnce();
  });

  it("wiederholt keine Arbeit, die schon lief; erst der nächste Aufruf verbindet neu", async () => {
    const reopen = vi.fn(open);
    keepConnected(db, { reopen });
    let runs = 0;
    // So meldet Safari auf iOS die verlorene Verbindung während einer Transaktion. (`fake-indexeddb`
    // lässt laufende Transaktionen beim erzwungenen Schließen noch abschließen.)
    const failing = runTransaction(db, "meta", "readwrite", (transaction) => {
      runs++;
      transaction.objectStore("meta").put({ key: "persistRequested", value: true });
      throw new DOMException("Connection to Indexed Database server lost", "UnknownError");
    });
    await expect(failing).rejects.toMatchObject({ name: "UnknownError" });
    expect(runs).toBe(1);
    expect(reopen).not.toHaveBeenCalled();
    expect(await getMeta(db, "persistRequested")).toBeUndefined();
    expect(reopen).toHaveBeenCalledOnce();
  });

  it("meldet ein gescheitertes Öffnen und versucht es beim nächsten Aufruf wieder", async () => {
    const onReopenFailed = vi.fn();
    const reopen = vi
      .fn<() => Promise<OpenResult>>()
      .mockResolvedValueOnce({ ok: false, reason: "newer-version" })
      .mockImplementation(open);
    keepConnected(db, { reopen, onReopenFailed });
    db.close();
    await expect(setMeta(db, "persistRequested", true)).rejects.toMatchObject({
      name: "InvalidStateError",
    });
    expect(onReopenFailed).toHaveBeenCalledWith({ ok: false, reason: "newer-version" });
    await setMeta(db, "persistRequested", true);
    expect(reopen).toHaveBeenCalledTimes(2);
  });

  it("verbindet nicht neu, wenn eine neuere App-Version die Datenbank übernimmt", async () => {
    const reopen = vi.fn(open);
    keepConnected(db, { reopen });
    const newer = await openDatabase({
      appVersion: "neu",
      version: 2,
      schema: testSchema,
      migrations: [testMigration],
    });
    expect(newer.ok).toBe(true);
    await expect(setMeta(db, "persistRequested", true)).rejects.toMatchObject({
      name: "InvalidStateError",
    });
    expect(reopen).not.toHaveBeenCalled();
  });

  it("meldet jedes erfolgreiche Schreiben, aber kein Lesen und kein Scheitern", async () => {
    const onSaved = vi.fn();
    keepConnected(db, { reopen: open, onSaved });
    await setMeta(db, "persistRequested", true);
    expect(onSaved).toHaveBeenCalledOnce();
    // Mit den Stores der Transaktion, z. B. für die Nachricht an andere Tabs (TDD 3.4).
    expect(onSaved).toHaveBeenCalledWith(["meta"]);
    await getMeta(db, "persistRequested");
    const failing = runTransaction(db, "meta", "readwrite", () => {
      throw new Error("erzwungener Fehler");
    });
    await expect(failing).rejects.toThrow("erzwungener Fehler");
    expect(onSaved).toHaveBeenCalledOnce();
    await runTransaction(db, ["sets", "settings"], "readwrite", () => {});
    expect(onSaved).toHaveBeenLastCalledWith(["sets", "settings"]);
  });

  it("lässt Verbindungen ohne Anmeldung unverändert scheitern", async () => {
    db.close();
    await expect(setMeta(db, "persistRequested", true)).rejects.toMatchObject({
      name: "InvalidStateError",
    });
    expect(opened).toHaveLength(1);
  });
});
