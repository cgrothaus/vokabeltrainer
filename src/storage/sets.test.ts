import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BACKUP_STORES } from "../domain/backup";
import type { ReviewEvent, Session, StoredSet } from "../domain/model";
import { type StoreRecords, validateRecords } from "../domain/validateRecords";
import { settingKey } from "../domain/practiceSetup";
import { readBackup } from "./backup";
import { openDatabase } from "./database";
import { recordAnswer, startSession } from "./sessions";
import { getSetting } from "./settings";
import {
  addSet,
  countSetActivity,
  countSets,
  deleteSet,
  getSet,
  listSets,
  updateSet,
} from "./sets";

let db: IDBDatabase;

function storedSet(id: string, title = "Englisch – Wetter"): StoredSet {
  return {
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

describe("addSet", () => {
  it("speichert ein Set so, wie es gelesen wird", async () => {
    const set = storedSet("m4x8c2r9tw");
    expect(await addSet(db, set)).toEqual({ ok: true });
    expect(await getSet(db, "m4x8c2r9tw")).toEqual(set);
    expect(await listSets(db)).toEqual([set]);
  });

  it("überschreibt nie ein vorhandenes Set mit derselben ID", async () => {
    await addSet(db, storedSet("m4x8c2r9tw", "Erstes"));
    expect(await addSet(db, storedSet("m4x8c2r9tw", "Zweites"))).toEqual({
      ok: false,
      reason: "exists",
    });
    expect(await listSets(db)).toEqual([storedSet("m4x8c2r9tw", "Erstes")]);
  });

  it("meldet einen vollen Speicher", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const full = {
      transaction: () => {
        throw new DOMException("Speicher voll", "QuotaExceededError");
      },
    } as unknown as IDBDatabase;
    expect(await addSet(full, storedSet("a"))).toEqual({ ok: false, reason: "quota" });
  });

  it("meldet eine verlorene Verbindung und speichert nichts", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    db.close();
    expect(await addSet(db, storedSet("a"))).toEqual({ ok: false, reason: "connection" });
    expect(error).toHaveBeenCalled();
  });
});

describe("getSet, listSets und countSets", () => {
  it("liefert nichts für unbekannte IDs und eine leere Liste ohne Sets", async () => {
    expect(await getSet(db, "unbekannt")).toBeUndefined();
    expect(await listSets(db)).toEqual([]);
    expect(await countSets(db)).toBe(0);
  });

  it("zählt die Sets, ohne sie zu lesen", async () => {
    await addSet(db, storedSet("m4x8c2r9tw"));
    await addSet(db, storedSet("b7k2n9q4xz", "Englisch – Schule"));
    expect(await countSets(db)).toBe(2);
  });
});

/** Eine Sitzung mit `answers` Antworten zu `setId`; IDs werden aus `prefix` gebildet. */
async function practise(setId: string, prefix: string, answers: number): Promise<void> {
  const session: Session = {
    id: `${prefix}`.padEnd(12, "s"),
    setId,
    sectionIds: ["q7h3kd"],
    startedAt: "2026-10-21T18:00:00.000Z",
    status: "completed",
    config: { direction: "termToMeaning", count: answers, mcShare: 0 },
  };
  // Wie in der App: Die Einrichtung wird beim Start gemerkt.
  await startSession(db, session, {
    key: settingKey(setId),
    value: { sections: "all", direction: "termToMeaning", count: "all" },
  });
  for (let index = 0; index < answers; index++) {
    const event: ReviewEvent = {
      id: `${prefix}${index}`.padEnd(12, "e"),
      sessionId: session.id,
      setId,
      entryId: "a8f2kc",
      entryRev: "xq6g2dsd",
      occurredAt: "2026-10-21T18:01:00.000Z",
      direction: "termToMeaning",
      mode: "flashcard",
      result: "correct",
      firstAttempt: index === 0,
    };
    await recordAnswer(db, event);
  }
}

describe("countSetActivity", () => {
  it("zählt Sitzungen und Antworten nur des genannten Sets", async () => {
    await addSet(db, storedSet("m4x8c2r9tw"));
    await addSet(db, storedSet("k2n7w4b8qp", "Anderes"));
    await practise("m4x8c2r9tw", "a", 2);
    await practise("m4x8c2r9tw", "b", 3);
    await practise("k2n7w4b8qp", "c", 1);
    expect(await countSetActivity(db, "m4x8c2r9tw")).toEqual({ sessions: 2, events: 5 });
    expect(await countSetActivity(db, "unbekannt")).toEqual({ sessions: 0, events: 0 });
  });
});

describe("deleteSet", () => {
  it("löscht das Set samt Sitzungen, Antworten und Einrichtung; andere Sets und ihr Lernstand bleiben", async () => {
    const other = storedSet("k2n7w4b8qp", "Anderes");
    await addSet(db, storedSet("m4x8c2r9tw"));
    await addSet(db, other);
    await practise("m4x8c2r9tw", "a", 2);
    await practise("k2n7w4b8qp", "c", 1);

    expect(await deleteSet(db, "m4x8c2r9tw")).toEqual({ ok: true });

    expect(await listSets(db)).toEqual([other]);
    expect(await countSetActivity(db, "m4x8c2r9tw")).toEqual({ sessions: 0, events: 0 });
    expect(await countSetActivity(db, "k2n7w4b8qp")).toEqual({ sessions: 1, events: 1 });
    expect(await getSetting(db, settingKey("m4x8c2r9tw"))).toBeUndefined();
    expect(await getSetting(db, settingKey("k2n7w4b8qp"))).toBeDefined();
  });

  it("hinterlässt einen Bestand, den ein Backup ohne Fehler enthält", async () => {
    await addSet(db, storedSet("m4x8c2r9tw"));
    await addSet(db, storedSet("k2n7w4b8qp", "Anderes"));
    await practise("m4x8c2r9tw", "a", 2);
    await practise("k2n7w4b8qp", "c", 1);
    await deleteSet(db, "m4x8c2r9tw");

    const backup = await readBackup(db, "test", "2026-10-21T19:00:00.000Z");
    const records = Object.fromEntries(BACKUP_STORES.map((store) => [store, backup.data[store]]));
    expect(validateRecords(records as StoreRecords)).toEqual([]);
  });

  it("meldet ein unbekanntes Set und ändert nichts", async () => {
    await addSet(db, storedSet("m4x8c2r9tw"));
    await practise("m4x8c2r9tw", "a", 1);
    expect(await deleteSet(db, "unbekannt")).toEqual({ ok: false, reason: "missing" });
    expect(await listSets(db)).toHaveLength(1);
    expect(await countSetActivity(db, "m4x8c2r9tw")).toEqual({ sessions: 1, events: 1 });
    expect(await getSetting(db, settingKey("m4x8c2r9tw"))).toBeDefined();
  });

  it("meldet eine verlorene Verbindung", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    db.close();
    expect(await deleteSet(db, "m4x8c2r9tw")).toEqual({ ok: false, reason: "connection" });
    expect(error).toHaveBeenCalled();
  });

  it("meldet einen vollen Speicher", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const full = {
      transaction: () => {
        throw new DOMException("Speicher voll", "QuotaExceededError");
      },
    } as unknown as IDBDatabase;
    expect(await deleteSet(full, "m4x8c2r9tw")).toEqual({ ok: false, reason: "quota" });
  });
});

describe("updateSet", () => {
  const now = "2026-10-30T09:00:00.000Z";

  it("speichert die Änderung, erhöht editCount und setzt updatedAt", async () => {
    const set = storedSet("m4x8c2r9tw");
    await addSet(db, set);
    const changed = { ...set, title: "Englisch – Wetter und Jahreszeiten" };
    const saved = { ...changed, editCount: 1, updatedAt: now };
    expect(await updateSet(db, changed, 0, now)).toEqual({ ok: true, set: saved });
    expect(await getSet(db, "m4x8c2r9tw")).toEqual(saved);
  });

  it("schreibt nichts, wenn das Set inzwischen anderswo geändert wurde", async () => {
    const set = storedSet("m4x8c2r9tw");
    await addSet(db, set);
    await updateSet(db, { ...set, title: "Anderes Fenster" }, 0, now);
    expect(await updateSet(db, { ...set, title: "Veraltet" }, 0, now)).toEqual({
      ok: false,
      reason: "changed",
    });
    expect((await getSet(db, "m4x8c2r9tw"))?.title).toBe("Anderes Fenster");
  });

  it("legt kein gelöschtes Set wieder an", async () => {
    expect(await updateSet(db, storedSet("m4x8c2r9tw"), 0, now)).toEqual({
      ok: false,
      reason: "missing",
    });
    expect(await listSets(db)).toEqual([]);
  });

  it("meldet eine verlorene Verbindung und ändert nichts", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const set = storedSet("m4x8c2r9tw");
    await addSet(db, set);
    db.close();
    expect(await updateSet(db, { ...set, title: "Neu" }, 0, now)).toEqual({
      ok: false,
      reason: "connection",
    });
    const reopened = await openDatabase({ appVersion: "test" });
    if (!reopened.ok) throw new Error(reopened.reason);
    db = reopened.db;
    expect(await getSet(db, "m4x8c2r9tw")).toEqual(set);
  });
});
