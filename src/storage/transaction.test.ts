import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase } from "./database";
import { getMeta, setMeta } from "./meta";
import type { StoreName } from "./schema";
import { runTransaction } from "./transaction";

let db: IDBDatabase;

async function readAll(store: StoreName): Promise<unknown[]> {
  let result: unknown[] = [];
  await runTransaction(db, store, "readonly", (transaction) => {
    const request = transaction.objectStore(store).getAll();
    request.onsuccess = () => (result = request.result);
  });
  return result;
}

beforeEach(async () => {
  indexedDB = new IDBFactory();
  const result = await openDatabase({ appVersion: "test" });
  if (!result.ok) throw new Error(result.reason);
  db = result.db;
});

afterEach(() => db.close());

describe("runTransaction", () => {
  it("schreibt in mehrere Stores und erfüllt erst nach dem Abschluss", async () => {
    let completed = false;
    await runTransaction(db, ["sets", "sessions"], "readwrite", (transaction) => {
      transaction.objectStore("sets").put({ id: "a" });
      transaction.objectStore("sessions").put({ id: "s", setId: "a" });
      transaction.addEventListener("complete", () => (completed = true));
    });
    expect(completed).toBe(true);
    expect(await readAll("sets")).toEqual([{ id: "a" }]);
    expect(await readAll("sessions")).toEqual([{ id: "s", setId: "a" }]);
  });

  it("übernimmt nichts, wenn die Arbeit einen Fehler wirft (TAK-05)", async () => {
    await runTransaction(db, "sets", "readwrite", (t) => t.objectStore("sets").put({ id: "a" }));
    const failing = runTransaction(db, ["sets", "sessions"], "readwrite", (transaction) => {
      transaction.objectStore("sets").put({ id: "b" });
      transaction.objectStore("sessions").put({ id: "s", setId: "b" });
      throw new Error("erzwungener Fehler");
    });
    await expect(failing).rejects.toThrow("erzwungener Fehler");
    expect(await readAll("sets")).toEqual([{ id: "a" }]);
    expect(await readAll("sessions")).toEqual([]);
  });

  it("übernimmt nichts, wenn eine einzelne Anfrage scheitert (TAK-05)", async () => {
    await runTransaction(db, "sets", "readwrite", (t) => t.objectStore("sets").put({ id: "a" }));
    const failing = runTransaction(db, ["sets", "sessions"], "readwrite", (transaction) => {
      transaction.objectStore("sessions").put({ id: "s", setId: "a" });
      transaction.objectStore("sets").add({ id: "a" }); // Schlüssel existiert schon
    });
    await expect(failing).rejects.toMatchObject({ name: "ConstraintError" });
    expect(await readAll("sessions")).toEqual([]);
  });

  it("scheitert verständlich bei geschlossener Verbindung", async () => {
    db.close();
    await expect(runTransaction(db, "sets", "readonly", () => {})).rejects.toMatchObject({
      name: "InvalidStateError",
    });
  });
});

describe("meta", () => {
  it("liefert nichts für unbekannte Angaben und speichert Werte", async () => {
    expect(await getMeta(db, "persistRequested")).toBeUndefined();
    await setMeta(db, "persistRequested", true);
    expect(await getMeta(db, "persistRequested")).toBe(true);
  });
});
