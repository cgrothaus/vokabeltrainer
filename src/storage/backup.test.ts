import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BACKUP_STORES, type CheckedBackup, parseBackup } from "../domain/backup";
import { migrations } from "../domain/migrations";
import type { ReviewEvent, Session, StoredSet } from "../domain/model";
import { readBackup, readStores, restoreBackup } from "./backup";
import { openDatabase } from "./database";
import { getMeta, setMeta } from "./meta";
import { DB_VERSION } from "./schema";
import { recordAnswer, startSession } from "./sessions";
import { addSet } from "./sets";
import { runTransaction } from "./transaction";

let db: IDBDatabase;

const storedSet = (id: string, title: string): StoredSet => ({
  id,
  editCount: 0,
  createdAt: "2026-10-20T18:00:00.000Z",
  updatedAt: "2026-10-20T18:00:00.000Z",
  title,
  termLanguage: "en",
  meaningLanguage: "de",
  sections: [
    {
      id: "q7h3kd",
      title: "Wetter",
      entries: [
        { id: "a8f2kc", term: { text: "rain" }, meanings: [{ text: "Regen" }] },
        {
          id: "p3z7rn",
          term: { text: "autumn", acceptedVariants: ["fall"] },
          meanings: [{ text: "Herbst" }],
        },
      ],
    },
  ],
});

const session: Session = {
  id: "s2345678abcd",
  setId: "set2345678",
  sectionIds: ["q7h3kd"],
  startedAt: "2026-10-20T19:00:00.000Z",
  status: "active",
  config: { direction: "termToMeaning", count: 2, mcShare: 0 },
};

const answer = (id: string, firstAttempt: boolean): ReviewEvent => ({
  id,
  sessionId: session.id,
  setId: session.setId,
  entryId: "a8f2kc",
  entryRev: "abcdefgh",
  occurredAt: "2026-10-20T19:01:00.000Z",
  direction: "termToMeaning",
  mode: "flashcard",
  result: firstAttempt ? "incorrect" : "correct",
  firstAttempt,
});

async function open(): Promise<IDBDatabase> {
  const result = await openDatabase({ appVersion: "test" });
  if (!result.ok) throw new Error(result.reason);
  return result.db;
}

/** Ein Bestand mit Daten in jedem Store. */
async function fill(target: IDBDatabase): Promise<void> {
  await addSet(target, storedSet("set2345678", "Englisch – Wetter"));
  await addSet(target, storedSet("set3456789", "Englisch – Tiere"));
  await startSession(target, session);
  await recordAnswer(target, answer("e2345678abcd", true));
  await recordAnswer(target, answer("e3456789abcd", false));
  await runTransaction(target, "settings", "readwrite", (transaction) => {
    transaction.objectStore("settings").put({ key: "theme", value: "dark" });
  });
  await setMeta(target, "persistRequested", true);
}

/** Wie in der App: Datei geschrieben, gelesen und geprüft. */
function check(backup: unknown): CheckedBackup {
  const result = parseBackup(JSON.parse(JSON.stringify(backup)), {
    dataVersion: DB_VERSION,
    migrations,
  });
  if (!result.ok) throw new Error(result.errors.join("\n"));
  return result.backup;
}

beforeEach(async () => {
  indexedDB = new IDBFactory();
  db = await open();
});

afterEach(() => {
  db.close();
  vi.restoreAllMocks();
});

describe("readBackup", () => {
  it("liest alle Stores außer meta", async () => {
    await fill(db);
    const backup = await readBackup(db, "0.1.0+abc1234", "2026-10-20T20:00:00.000Z");
    expect(backup).toMatchObject({
      format: "vokabeltrainer-backup",
      formatVersion: 1,
      dataVersion: DB_VERSION,
      appVersion: "0.1.0+abc1234",
      exportedAt: "2026-10-20T20:00:00.000Z",
    });
    expect(Object.keys(backup.data).sort()).toEqual([...BACKUP_STORES].sort());
    expect(backup.data.sets).toHaveLength(2);
    expect(backup.data.reviewEvents).toHaveLength(2);
    expect(backup.data.sessions).toEqual([session]);
    expect(backup.data.settings).toEqual([{ key: "theme", value: "dark" }]);
  });

  it("liest auch einen leeren Bestand", async () => {
    const backup = await readBackup(db, "test", "2026-10-20T20:00:00.000Z");
    expect(backup.data).toEqual({ sets: [], reviewEvents: [], sessions: [], settings: [] });
  });
});

describe("restoreBackup", () => {
  it("TAK-09: Backup → frisches Gerät → Wiederherstellen ergibt denselben Bestand", async () => {
    await fill(db);
    const before = await readStores(db, BACKUP_STORES);
    const backup = check(await readBackup(db, "test", "2026-10-20T20:00:00.000Z"));

    db.close();
    indexedDB = new IDBFactory();
    db = await open();
    expect(await restoreBackup(db, backup)).toEqual({ ok: true });

    expect(await readStores(db, BACKUP_STORES)).toEqual(before);
    expect(await getMeta(db, "lastBackupAt")).toBe("2026-10-20T20:00:00.000Z");
  });

  it("ersetzt den vorhandenen Bestand vollständig und behält die übrigen internen Angaben", async () => {
    await fill(db);
    const backup = check(await readBackup(db, "test", "2026-10-20T20:00:00.000Z"));
    await addSet(db, storedSet("set4567892", "Englisch – Neu"));
    await setMeta(db, "lastBackupAt", "2026-10-21T08:00:00.000Z");

    expect(await restoreBackup(db, backup)).toEqual({ ok: true });

    const sets = (await readStores(db, ["sets"])).sets as StoredSet[];
    expect(sets.map((set) => set.title).sort()).toEqual(["Englisch – Tiere", "Englisch – Wetter"]);
    expect(await getMeta(db, "persistRequested")).toBe(true);
    expect(await getMeta(db, "lastBackupAt")).toBe("2026-10-20T20:00:00.000Z");
  });

  it("stellt einen leeren Bestand wieder her", async () => {
    await fill(db);
    const empty = check(await readBackup(db, "test", "2026-10-20T20:00:00.000Z"));
    for (const store of BACKUP_STORES) empty.data[store] = [];
    expect(await restoreBackup(db, empty)).toEqual({ ok: true });
    expect(await readStores(db, BACKUP_STORES)).toEqual({
      sets: [],
      reviewEvents: [],
      sessions: [],
      settings: [],
    });
  });

  it("TAK-05: Ein Fehler beim Schreiben lässt den alten Bestand unverändert", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await fill(db);
    await setMeta(db, "lastBackupAt", "2026-10-01T08:00:00.000Z");
    const before = await readStores(db, BACKUP_STORES);
    const backup = check(await readBackup(db, "test", "2026-10-20T20:00:00.000Z"));
    // An der Prüfung vorbei: Ein doppelter Schlüssel lässt `add()` scheitern, nachdem schon geleert wurde.
    backup.data.settings.push({ key: "theme", value: "light" });

    expect(await restoreBackup(db, backup)).toEqual({ ok: false, reason: "failed" });
    expect(await readStores(db, BACKUP_STORES)).toEqual(before);
    expect(await getMeta(db, "lastBackupAt")).toBe("2026-10-01T08:00:00.000Z");
  });
});
