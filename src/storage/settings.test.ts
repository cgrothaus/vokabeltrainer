import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase } from "./database";
import { getSetting, setSetting } from "./settings";

let db: IDBDatabase;

beforeEach(async () => {
  indexedDB = new IDBFactory();
  const result = await openDatabase({ appVersion: "test" });
  if (!result.ok) throw new Error(result.reason);
  db = result.db;
});

afterEach(() => db.close());

describe("setSetting", () => {
  it("speichert eine Einstellung, die danach gelesen werden kann", async () => {
    expect(await getSetting(db, "theme")).toBeUndefined();
    await setSetting(db, { key: "theme", value: "dark" });
    expect(await getSetting(db, "theme")).toBe("dark");
  });

  it("überschreibt einen vorhandenen Wert", async () => {
    await setSetting(db, { key: "theme", value: "dark" });
    await setSetting(db, { key: "theme", value: "light" });
    expect(await getSetting(db, "theme")).toBe("light");
  });
});
