import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ReviewEvent, Session, StoredSet } from "../domain/model";
import { openDatabase } from "./database";
import { isSetMissing } from "./errors";
import {
  finishSession,
  interruptActiveSessions,
  listSetEvents,
  recordAnswer,
  startSession,
} from "./sessions";
import { addSet, deleteSet } from "./sets";
import { getSetting } from "./settings";
import type { StoreName } from "./schema";
import { runTransaction } from "./transaction";

let db: IDBDatabase;

function session(id: string, status: Session["status"] = "active"): Session {
  return {
    id,
    setId: "m4x8c2r9tw",
    sectionIds: ["q7h3kd"],
    startedAt: "2026-10-20T18:00:00.000Z",
    status,
    config: { direction: "termToMeaning", count: 2, mcShare: 0 },
  };
}

function event(id: string, overrides: Partial<ReviewEvent> = {}): ReviewEvent {
  return {
    id,
    sessionId: "s2345678abcd",
    setId: "m4x8c2r9tw",
    entryId: "a8f2kc",
    entryRev: "xq6g2dsd",
    occurredAt: "2026-10-20T18:01:00.000Z",
    direction: "termToMeaning",
    mode: "flashcard",
    result: "correct",
    firstAttempt: true,
    ...overrides,
  };
}

/** Liest alle Datensätze eines Stores, wahlweise über einen Index. */
async function readAll<T>(store: StoreName, index?: string, key?: string): Promise<T[]> {
  let records: T[] = [];
  await runTransaction(db, store, "readonly", (transaction) => {
    const source = transaction.objectStore(store);
    const request = index ? source.index(index).getAll(key) : source.getAll();
    request.onsuccess = () => (records = request.result as T[]);
  });
  return records;
}

function storedSet(id: string): StoredSet {
  return {
    id,
    editCount: 0,
    createdAt: "2026-10-20T17:00:00.000Z",
    updatedAt: "2026-10-20T17:00:00.000Z",
    title: id,
    termLanguage: "en",
    meaningLanguage: "de",
    sections: [{ id: "q7h3kd", title: "Wetter", entries: [] }],
  };
}

beforeEach(async () => {
  indexedDB = new IDBFactory();
  const result = await openDatabase({ appVersion: "test" });
  if (!result.ok) throw new Error(result.reason);
  db = result.db;
  // Antworten und Sitzungen gibt es nur zu vorhandenen Sets (TDD 3.4).
  for (const id of ["m4x8c2r9tw", "k2n7w4b8qp", "anderes"]) await addSet(db, storedSet(id));
});

afterEach(() => db.close());

describe("startSession und finishSession", () => {
  it("legt eine aktive Sitzung an und schließt sie mit Status und Ende ab", async () => {
    await startSession(db, session("s2345678abcd"));
    expect(await readAll("sessions", "setId", "m4x8c2r9tw")).toEqual([session("s2345678abcd")]);

    await finishSession(db, "s2345678abcd", "completed", "2026-10-20T18:05:00.000Z");
    expect(await readAll("sessions")).toEqual([
      { ...session("s2345678abcd"), status: "completed", endedAt: "2026-10-20T18:05:00.000Z" },
    ]);
  });

  it("überschreibt keine vorhandene Sitzung", async () => {
    await startSession(db, session("s2345678abcd"));
    await expect(startSession(db, session("s2345678abcd", "ended"))).rejects.toThrow();
    expect(await readAll("sessions")).toEqual([session("s2345678abcd")]);
  });

  it("merkt die Einrichtung in derselben Transaktion und ersetzt eine frühere", async () => {
    const setup = { sections: ["q7h3kd"], direction: "mixed", count: 10 };
    await startSession(db, session("s2345678abcd"), { key: "practice:m4x8c2r9tw", value: setup });
    expect(await getSetting(db, "practice:m4x8c2r9tw")).toEqual(setup);

    const next = { sections: "all", direction: "termToMeaning", count: "all" };
    await startSession(db, session("t2345678abcd"), { key: "practice:m4x8c2r9tw", value: next });
    expect(await getSetting(db, "practice:m4x8c2r9tw")).toEqual(next);
  });

  it("merkt die Einrichtung nicht, wenn die Sitzung nicht gespeichert wird", async () => {
    await startSession(db, session("s2345678abcd"));
    await expect(
      startSession(db, session("s2345678abcd"), { key: "practice:m4x8c2r9tw", value: {} }),
    ).rejects.toThrow();
    expect(await getSetting(db, "practice:m4x8c2r9tw")).toBeUndefined();
  });

  it("lässt die gemerkte Einrichtung bei einer Fehlersitzung unverändert", async () => {
    const setup = { sections: "all", direction: "mixed", count: 10 };
    await startSession(db, session("s2345678abcd"), { key: "practice:m4x8c2r9tw", value: setup });
    const repeat = { ...session("t2345678abcd"), repeatOf: "s2345678abcd" };
    await startSession(db, repeat);
    expect(await getSetting(db, "practice:m4x8c2r9tw")).toEqual(setup);
    expect(await readAll("sessions")).toEqual([session("s2345678abcd"), repeat]);
  });

  it("lehnt das Abschließen einer unbekannten Sitzung ab, ohne etwas anzulegen", async () => {
    await expect(
      finishSession(db, "unbekannt", "ended", "2026-10-20T18:05:00.000Z"),
    ).rejects.toThrow();
    expect(await readAll("sessions")).toEqual([]);
  });
});

/** Antworten gehören zu einer gespeicherten Sitzung. */
async function startSessions(...ids: [id: string, setId: string][]): Promise<void> {
  for (const [id, setId] of ids) await startSession(db, { ...session(id), setId });
}

describe("recordAnswer", () => {
  beforeEach(() => startSessions(["s2345678abcd", "m4x8c2r9tw"], ["andere", "anderes"]));

  it("speichert jede Antwort einzeln, auffindbar über Sitzung und Set", async () => {
    await recordAnswer(db, event("e23456789abc"));
    await recordAnswer(db, event("e3456789abcd", { result: "incorrect", firstAttempt: false }));
    await recordAnswer(db, event("e456789abcde", { sessionId: "andere", setId: "anderes" }));

    expect(await readAll("reviewEvents", "sessionId", "s2345678abcd")).toEqual([
      event("e23456789abc"),
      event("e3456789abcd", { result: "incorrect", firstAttempt: false }),
    ]);
    expect(await readAll("reviewEvents", "setId", "anderes")).toHaveLength(1);
  });

  it("lehnt bei einem Fehler ab und lässt den Bestand unverändert", async () => {
    await recordAnswer(db, event("e23456789abc"));
    await expect(
      recordAnswer(db, event("e23456789abc", { result: "incorrect" })),
    ).rejects.toThrow();
    expect(await readAll("reviewEvents")).toEqual([event("e23456789abc")]);

    db.close();
    await expect(recordAnswer(db, event("e3456789abcd"))).rejects.toThrow();
  });
});

describe("Set gibt es nicht mehr, z. B. in einem anderen Tab gelöscht (TDD 3.4)", () => {
  it("legt keine Sitzung an und merkt keine Einrichtung", async () => {
    await deleteSet(db, "m4x8c2r9tw");
    const started = startSession(db, session("s2345678abcd"), {
      key: "practice:m4x8c2r9tw",
      value: {},
    });
    await expect(started).rejects.toSatisfy(isSetMissing);
    expect(await readAll("sessions")).toEqual([]);
    expect(await getSetting(db, "practice:m4x8c2r9tw")).toBeUndefined();
  });

  it("speichert keine Antwort", async () => {
    await startSession(db, session("s2345678abcd"));
    await recordAnswer(db, event("e23456789abc"));
    await deleteSet(db, "m4x8c2r9tw");
    await expect(recordAnswer(db, event("e3456789abcd"))).rejects.toSatisfy(isSetMissing);
    expect(await readAll("reviewEvents")).toEqual([]);
  });

  it("meldet beim Abschließen, dass die Sitzung mit dem Set gelöscht wurde", async () => {
    await startSession(db, session("s2345678abcd"));
    await deleteSet(db, "m4x8c2r9tw");
    await expect(
      finishSession(db, "s2345678abcd", "ended", "2026-10-20T18:05:00.000Z"),
    ).rejects.toSatisfy(isSetMissing);
    expect(await readAll("sessions")).toEqual([]);
  });

  it("unterscheidet das von anderen Fehlern", async () => {
    await startSession(db, session("s2345678abcd"));
    await recordAnswer(db, event("e23456789abc"));
    await expect(recordAnswer(db, event("e23456789abc"))).rejects.not.toSatisfy(isSetMissing);
  });
});

describe("listSetEvents", () => {
  it("liefert alle Antworten eines Sets und keine anderen", async () => {
    await startSessions(["s2345678abcd", "k2n7w4b8qp"], ["s9876543wxyz", "m4x8c2r9tw"]);
    await recordAnswer(db, event("e1aaaaaaaaaa"));
    await recordAnswer(db, event("e2aaaaaaaaaa", { setId: "k2n7w4b8qp" }));
    await recordAnswer(db, event("e3aaaaaaaaaa", { sessionId: "s9876543wxyz" }));
    const events = await listSetEvents(db, "m4x8c2r9tw");
    expect(events.map((e) => e.id).sort()).toEqual(["e1aaaaaaaaaa", "e3aaaaaaaaaa"]);
    expect(await listSetEvents(db, "unbekannt")).toEqual([]);
  });
});

describe("interruptActiveSessions", () => {
  it("setzt nur noch aktive Sitzungen auf unterbrochen", async () => {
    await startSession(db, session("a23456789abc"));
    await startSession(db, session("b23456789abc", "completed"));
    await startSession(db, session("c23456789abc", "ended"));
    await startSession(db, session("d23456789abc"));

    expect(await interruptActiveSessions(db)).toBe(2);
    const statuses = (await readAll<Session>("sessions")).map(({ id, status }) => [id, status]);
    expect(statuses).toEqual([
      ["a23456789abc", "interrupted"],
      ["b23456789abc", "completed"],
      ["c23456789abc", "ended"],
      ["d23456789abc", "interrupted"],
    ]);
    expect(await interruptActiveSessions(db)).toBe(0);
  });
});
