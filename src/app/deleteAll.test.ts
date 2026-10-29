import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, expect, it } from "vitest";
import { createBackup } from "../domain/backup";
import { openDatabase } from "../storage/database";
import { readPreMigrationCopy, savePreMigrationCopy } from "../storage/preMigrationCopy";
import { removeAllData } from "./deleteAll";

beforeEach(() => {
  indexedDB = new IDBFactory();
});

it("löscht auch die Sicherungskopie vor einer Migration (TDD 7.3)", async () => {
  const opened = await openDatabase({ appVersion: "test" });
  if (!opened.ok) throw new Error(opened.reason);
  const data = { sets: [{ id: "a" }], reviewEvents: [], sessions: [], settings: [] };
  const exportedAt = "2026-10-29T10:00:00.000Z";
  await savePreMigrationCopy(
    opened.db.name,
    createBackup({ dataVersion: 1, appVersion: "test", exportedAt, data }),
  );

  expect(await removeAllData(opened.db)).toEqual({ ok: true });
  expect(await readPreMigrationCopy(opened.db.name)).toBeNull();
  opened.db.close();
});
