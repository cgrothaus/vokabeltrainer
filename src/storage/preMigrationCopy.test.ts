import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type BackupFile, createBackup } from "../domain/backup";
import { openDatabase } from "./database";
import { deleteMeta, getMeta, setMeta } from "./meta";
import {
  deletePreMigrationCopy,
  discardExpiredPreMigrationCopy,
  preMigrationCopyName,
  readPreMigrationCopy,
  savePreMigrationCopy,
} from "./preMigrationCopy";
import { DB_NAME } from "./schema";

const backup = (title: string): BackupFile =>
  createBackup({
    dataVersion: 1,
    appVersion: "test",
    exportedAt: "2026-10-29T10:00:00.000Z",
    data: { sets: [{ id: "a", title }], reviewEvents: [], sessions: [], settings: [] },
  });

const databaseNames = async () => (await indexedDB.databases()).map((info) => info.name).sort();

let db: IDBDatabase;

beforeEach(async () => {
  indexedDB = new IDBFactory();
  const result = await openDatabase({ appVersion: "test" });
  if (!result.ok) throw new Error(result.reason);
  db = result.db;
});

afterEach(() => db.close());

describe("Sicherungskopie speichern und lesen", () => {
  it("legt die Kopie in einer eigenen Datenbank neben der Datenbank der App ab", async () => {
    expect(preMigrationCopyName(DB_NAME)).toBe("vokabeltrainer-premigration");
    await savePreMigrationCopy(DB_NAME, backup("Erstes"));
    expect(await databaseNames()).toEqual(["vokabeltrainer", "vokabeltrainer-premigration"]);
    expect(await readPreMigrationCopy(DB_NAME)).toEqual(backup("Erstes"));
  });

  it("ersetzt eine ältere Kopie", async () => {
    await savePreMigrationCopy(DB_NAME, backup("Erstes"));
    await savePreMigrationCopy(DB_NAME, backup("Zweites"));
    expect(await readPreMigrationCopy(DB_NAME)).toEqual(backup("Zweites"));
  });

  it("liefert nichts und legt nichts an, wenn es keine Kopie gibt", async () => {
    expect(await readPreMigrationCopy(DB_NAME)).toBeNull();
    expect(await databaseNames()).toEqual(["vokabeltrainer"]);
  });

  it("löscht die Kopie, auch wenn es keine gibt", async () => {
    await deletePreMigrationCopy(DB_NAME);
    await savePreMigrationCopy(DB_NAME, backup("Erstes"));
    await deletePreMigrationCopy(DB_NAME);
    expect(await databaseNames()).toEqual(["vokabeltrainer"]);
  });
});

describe("discardExpiredPreMigrationCopy (14 Tage)", () => {
  const copiedAt = "2026-10-01T12:00:00.000Z";
  const days = (n: number) => new Date(Date.parse(copiedAt) + n * 24 * 60 * 60 * 1000);

  beforeEach(async () => {
    await savePreMigrationCopy(DB_NAME, backup("Erstes"));
    await setMeta(db, "preMigrationCopyAt", copiedAt);
  });

  it("behält die Kopie vor Ablauf der Frist", async () => {
    await discardExpiredPreMigrationCopy(db, new Date(days(14).getTime() - 1));
    expect(await readPreMigrationCopy(DB_NAME)).toEqual(backup("Erstes"));
    expect(await getMeta(db, "preMigrationCopyAt")).toBe(copiedAt);
  });

  it("löscht Kopie und Zeitpunkt nach 14 Tagen", async () => {
    await discardExpiredPreMigrationCopy(db, days(14));
    expect(await databaseNames()).toEqual(["vokabeltrainer"]);
    expect(await getMeta(db, "preMigrationCopyAt")).toBeUndefined();
  });

  it("löscht auch bei unbrauchbarem Zeitpunkt, statt die Kopie für immer zu behalten", async () => {
    await setMeta(db, "preMigrationCopyAt", "kein Datum");
    await discardExpiredPreMigrationCopy(db, days(1));
    expect(await databaseNames()).toEqual(["vokabeltrainer"]);
    expect(await getMeta(db, "preMigrationCopyAt")).toBeUndefined();
  });

  it("tut ohne vermerkten Zeitpunkt nichts", async () => {
    await deleteMeta(db, "preMigrationCopyAt");
    await discardExpiredPreMigrationCopy(db, days(30));
    expect(await readPreMigrationCopy(DB_NAME)).toEqual(backup("Erstes"));
  });
});
