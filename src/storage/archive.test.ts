import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { archiveKey } from "../domain/library";
import type { StoredSet } from "../domain/model";
import { readArchived, setArchived } from "./archive";
import { openDatabase } from "./database";
import { getSetting, setSetting } from "./settings";
import { addSet, deleteSet } from "./sets";

let db: IDBDatabase;

function storedSet(id: string): StoredSet {
  return {
    id,
    editCount: 0,
    createdAt: "2026-11-22T08:00:00.000Z",
    updatedAt: "2026-11-22T08:00:00.000Z",
    title: `Set ${id}`,
    termLanguage: "en",
    meaningLanguage: "de",
    sections: [{ id: "q7h3kd", title: "Text A", entries: [] }],
  };
}

beforeEach(async () => {
  indexedDB = new IDBFactory();
  const result = await openDatabase({ appVersion: "test" });
  if (!result.ok) throw new Error(result.reason);
  db = result.db;
});

afterEach(() => {
  db.close();
  vi.restoreAllMocks();
});

describe("Archiv", () => {
  it("archiviert Sets und holt sie zurück", async () => {
    await addSet(db, storedSet("aaaaaaaaaa"));
    await addSet(db, storedSet("bbbbbbbbbb"));
    await setSetting(db, { key: "theme", value: "dark" });
    expect(await setArchived(db, ["aaaaaaaaaa", "bbbbbbbbbb"], true)).toEqual({
      ok: true,
      count: 2,
    });
    expect([...(await readArchived(db))].sort()).toEqual(["aaaaaaaaaa", "bbbbbbbbbb"]);
    expect(await setArchived(db, ["aaaaaaaaaa"], false)).toEqual({ ok: true, count: 1 });
    expect([...(await readArchived(db))]).toEqual(["bbbbbbbbbb"]);
    expect(await getSetting(db, archiveKey("aaaaaaaaaa"))).toBeUndefined();
  });

  it("legt keinen Vermerk zu einem gelöschten Set an", async () => {
    await addSet(db, storedSet("aaaaaaaaaa"));
    expect(await setArchived(db, ["aaaaaaaaaa", "unbekannt0"], true)).toEqual({
      ok: true,
      count: 1,
    });
    expect([...(await readArchived(db))]).toEqual(["aaaaaaaaaa"]);
  });

  it("verliert den Vermerk, wenn das Set gelöscht wird", async () => {
    await addSet(db, storedSet("aaaaaaaaaa"));
    await setArchived(db, ["aaaaaaaaaa"], true);
    await deleteSet(db, "aaaaaaaaaa");
    expect(await getSetting(db, archiveKey("aaaaaaaaaa"))).toBeUndefined();
  });

  it("meldet eine verlorene Verbindung", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    db.close();
    expect(await setArchived(db, ["aaaaaaaaaa"], true)).toEqual({
      ok: false,
      reason: "connection",
    });
  });
});
