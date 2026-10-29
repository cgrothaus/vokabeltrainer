import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ReviewEvent, Session } from "../domain/model";
import { openDatabase } from "./database";
import { setMeta } from "./meta";
import { readReminderState } from "./reminder";
import { recordAnswer, startSession } from "./sessions";

let db: IDBDatabase;

beforeEach(async () => {
  indexedDB = new IDBFactory();
  const result = await openDatabase({ appVersion: "test" });
  if (!result.ok) throw new Error(result.reason);
  db = result.db;
});

afterEach(() => db.close());

/** Eine Sitzung, die zu `startedAt` beginnt, mit `answers` Antworten. */
async function practise(id: string, startedAt: string, answers: number): Promise<void> {
  const session: Session = {
    id: id.padEnd(12, "s"),
    setId: "m4x8c2r9tw",
    sectionIds: ["q7h3kd"],
    startedAt,
    status: "completed",
    config: { direction: "termToMeaning", count: answers, mcShare: 0 },
  };
  await startSession(db, session);
  for (let index = 0; index < answers; index++) {
    const event: ReviewEvent = {
      id: `${id}${index}`.padEnd(12, "e"),
      sessionId: session.id,
      setId: session.setId,
      entryId: "a8f2kc",
      entryRev: "xq6g2dsd",
      occurredAt: startedAt,
      direction: "termToMeaning",
      mode: "flashcard",
      result: "correct",
      firstAttempt: true,
    };
    await recordAnswer(db, event);
  }
}

describe("readReminderState", () => {
  it("ohne Antworten gibt es nichts zu sichern", async () => {
    expect(await readReminderState(db)).toEqual({
      unsavedAnswers: false,
      lastBackupAt: undefined,
      snoozedUntil: undefined,
    });
  });

  it("ohne Backup sind alle Antworten ungesichert", async () => {
    await practise("a", "2026-10-01T18:00:00.000Z", 2);
    await setMeta(db, "backupReminderSnoozedUntil", "2026-10-04T18:00:00.000Z");
    expect(await readReminderState(db)).toEqual({
      unsavedAnswers: true,
      lastBackupAt: undefined,
      snoozedUntil: "2026-10-04T18:00:00.000Z",
    });
  });

  it("mit Backup zählen nur Antworten aus Sitzungen danach", async () => {
    await practise("a", "2026-10-01T18:00:00.000Z", 2);
    await setMeta(db, "lastBackupAt", "2026-10-02T18:00:00.000Z");
    expect((await readReminderState(db)).unsavedAnswers).toBe(false);

    // Eine spätere Sitzung ohne Antwort ändert nichts.
    await practise("b", "2026-10-10T18:00:00.000Z", 0);
    expect((await readReminderState(db)).unsavedAnswers).toBe(false);

    await practise("c", "2026-10-20T18:00:00.000Z", 1);
    expect(await readReminderState(db)).toEqual({
      unsavedAnswers: true,
      lastBackupAt: "2026-10-02T18:00:00.000Z",
      snoozedUntil: undefined,
    });
  });

  it("liest einen unbrauchbaren Zeitpunkt des Backups wie keinen", async () => {
    await practise("a", "2026-10-01T18:00:00.000Z", 1);
    await setMeta(db, "lastBackupAt", "gestern");
    expect((await readReminderState(db)).unsavedAnswers).toBe(true);
  });
});
