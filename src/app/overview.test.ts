import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import type { ReviewEvent, Session, StoredSet } from "../domain/model";
import { openDatabase } from "../storage/database";
import { recordAnswer, startSession } from "../storage/sessions";
import { addSet } from "../storage/sets";
import { checkBackup, prepareBackup, restore } from "./backup";
import { removeAllData } from "./deleteAll";
import { removeSet } from "./deleteSet";
import { forgetAllOverviews, forgetOverview, loadOverview } from "./overview";

let db: IDBDatabase;

const set: StoredSet = {
  id: "m4x8c2r9tw",
  editCount: 0,
  createdAt: "2026-11-17T17:00:00.000Z",
  updatedAt: "2026-11-17T17:00:00.000Z",
  title: "Wetter",
  termLanguage: "en",
  meaningLanguage: "de",
  sections: [
    {
      id: "q7h3kd",
      title: "Wetter",
      entries: [{ id: "a8f2kc", term: { text: "drizzle" }, meanings: [{ text: "Nieselregen" }] }],
    },
  ],
};

async function open(): Promise<IDBDatabase> {
  const result = await openDatabase({ appVersion: "test" });
  if (!result.ok) throw new Error(result.reason);
  return result.db;
}

/** Eine Sitzung mit einer Antwort, direkt gespeichert, ohne den Zwischenspeicher. */
async function answerOnce(sessionId: string): Promise<void> {
  const session: Session = {
    id: sessionId,
    setId: set.id,
    sectionIds: ["q7h3kd"],
    startedAt: "2026-11-17T18:00:00.000Z",
    status: "active",
    config: { direction: "termToMeaning", count: 1, mcShare: 0 },
  };
  const event: ReviewEvent = {
    id: `e-${sessionId}`,
    sessionId,
    setId: set.id,
    entryId: "a8f2kc",
    entryRev: "xq6g2dsd",
    occurredAt: "2026-11-17T18:01:00.000Z",
    direction: "termToMeaning",
    mode: "flashcard",
    result: "correct",
    firstAttempt: true,
  };
  await startSession(db, session);
  await recordAnswer(db, event);
}

const sessions = async (loaded: Promise<{ set: { sessions: number } }>) =>
  (await loaded).set.sessions;

beforeEach(async () => {
  indexedDB = new IDBFactory();
  forgetAllOverviews();
  db = await open();
  await addSet(db, set);
});

describe("loadOverview", () => {
  it("liest ein Set nur beim ersten Mal", async () => {
    expect(await sessions(loadOverview(db, set))).toBe(0);
    await answerOnce("s1");
    expect(await sessions(loadOverview(db, set))).toBe(0);
  });

  it("teilt ein laufendes Lesen mit gleichzeitigen Aufrufen", () => {
    expect(loadOverview(db, set)).toBe(loadOverview(db, set));
  });

  it("liest nach dem Verwerfen des Sets oder aller Sets neu", async () => {
    await loadOverview(db, set);
    await answerOnce("s1");
    forgetOverview(set.id);
    expect(await sessions(loadOverview(db, set))).toBe(1);
    await answerOnce("s2");
    forgetAllOverviews();
    expect(await sessions(loadOverview(db, set))).toBe(2);
  });

  it("verwirft nur das genannte Set", async () => {
    const other: StoredSet = { ...set, id: "k2n7w4b8qp" };
    await addSet(db, other);
    const kept = loadOverview(db, other);
    await loadOverview(db, set);
    forgetOverview(set.id);
    expect(loadOverview(db, other)).toBe(kept);
  });

  it("liest neu, wenn sich das Set geändert hat", async () => {
    await loadOverview(db, set);
    await answerOnce("s1");
    expect(await sessions(loadOverview(db, { ...set, editCount: 1 }))).toBe(1);
  });

  it("verwirft auch ein Lesen, das noch läuft", async () => {
    const running = loadOverview(db, set);
    forgetOverview(set.id);
    await running;
    expect(loadOverview(db, set)).not.toBe(running);
  });

  it("behält kein gescheitertes Lesen", async () => {
    db.close();
    await expect(loadOverview(db, set)).rejects.toThrow();
    db = await open();
    await answerOnce("s1");
    expect(await sessions(loadOverview(db, set))).toBe(1);
  });
});

// Ein Set mit derselben ID kann danach wieder mit `editCount` 0 entstehen, z. B. durch erneuten Import.
describe("Abläufe, die Antworten löschen, verwerfen den Lernstand", () => {
  beforeEach(async () => {
    await answerOnce("s1");
    expect(await sessions(loadOverview(db, set))).toBe(1);
  });

  it("Set löschen", async () => {
    expect(await removeSet(db, set)).toEqual({ ok: true });
    await addSet(db, set);
    expect(await sessions(loadOverview(db, set))).toBe(0);
  });

  it("Alle Daten löschen", async () => {
    expect(await removeAllData(db)).toEqual({ ok: true });
    await addSet(db, set);
    expect(await sessions(loadOverview(db, set))).toBe(0);
  });

  it("Backup wiederherstellen", async () => {
    expect(await removeSet(db, set)).toEqual({ ok: true });
    await addSet(db, set);
    const checked = checkBackup(await (await prepareBackup(db, "test")).blob.text());
    if (!checked.ok) throw new Error(checked.errors.join());
    await answerOnce("s2");
    expect(await sessions(loadOverview(db, set))).toBe(1);
    expect(await restore(db, checked.backup)).toEqual({ ok: true });
    expect(await sessions(loadOverview(db, set))).toBe(0);
  });
});
