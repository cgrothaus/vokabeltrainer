import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { entryRev } from "../domain/hash";
import type { ReviewEvent, Session, StoredSet } from "../domain/model";
import { settingKey } from "../domain/practiceSetup";
import { openDatabase } from "../storage/database";
import { recordAnswer, startSession } from "../storage/sessions";
import { addSet } from "../storage/sets";
import { setSetting } from "../storage/settings";
import { forgetAllOverviews } from "./overview";
import { currentPractice, quickStart, recommendedStart } from "./practice";

let db: IDBDatabase;

/** Ein Set mit `size` Einträgen in zwei Sektionen, die zweite ab dem fünften Eintrag. */
function setWith(id: string, size: number): StoredSet {
  const entries = Array.from({ length: size }, (_, index) => ({
    id: `e${String(index).padStart(5, "0")}`,
    term: { text: `word ${index}` },
    meanings: [{ text: `Wort ${index}` }],
  }));
  return {
    id,
    editCount: 0,
    createdAt: "2026-11-01T17:00:00.000Z",
    updatedAt: "2026-11-01T17:00:00.000Z",
    title: `Set ${id}`,
    termLanguage: "en",
    meaningLanguage: "de",
    sections: [
      { id: "q7h3kd", title: "Wetter", entries: entries.slice(0, 4) },
      { id: "z2m8vt", title: "Tiere", entries: entries.slice(4) },
    ],
  };
}

const large = setWith("m4x8c2r9tw", 25);
const small = setWith("k2n7w4b8qp", 3);

let counter = 0;

/** Richtige Antworten Lernsprache → Muttersprache zu den ersten `count` Einträgen am Tag `at`. */
async function answered(set: StoredSet, count: number, at: string): Promise<void> {
  const session: Session = {
    id: `session${String(counter++).padStart(5, "0")}`,
    setId: set.id,
    sectionIds: set.sections.map((section) => section.id),
    startedAt: at,
    status: "completed",
    config: { direction: "termToMeaning", count, mcShare: 0 },
  };
  await startSession(db, session);
  const entries = set.sections.flatMap((section) => section.entries).slice(0, count);
  for (const entry of entries) {
    await recordAnswer(db, {
      id: `event${String(counter++).padStart(7, "0")}`,
      sessionId: session.id,
      setId: set.id,
      entryId: entry.id,
      entryRev: entryRev(entry),
      occurredAt: at,
      direction: "termToMeaning",
      mode: "flashcard",
      result: "correct",
      firstAttempt: true,
    });
  }
  forgetAllOverviews();
}

function remember(set: StoredSet, mcShare: number): Promise<void> {
  return setSetting(db, {
    key: settingKey(set.id),
    value: { sections: "all", direction: "termToMeaning", count: 10, mcShare },
  });
}

const sessions = () =>
  new Promise<Session[]>((resolve, reject) => {
    const request = db.transaction("sessions").objectStore("sessions").getAll();
    request.onsuccess = () => resolve(request.result as Session[]);
    request.onerror = () => reject(request.error);
  });

const events = () =>
  new Promise<ReviewEvent[]>((resolve, reject) => {
    const request = db.transaction("reviewEvents").objectStore("reviewEvents").getAll();
    request.onsuccess = () => resolve(request.result as ReviewEvent[]);
    request.onerror = () => reject(request.error);
  });

const queued = () => currentPractice()!.state.queue;

beforeEach(async () => {
  // Nur die Uhr: Die Rückrufe von fake-indexeddb laufen weiter.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-20T08:00:00.000Z"));
  indexedDB = new IDBFactory();
  forgetAllOverviews();
  const result = await openDatabase({ appVersion: "test" });
  if (!result.ok) throw new Error(result.reason);
  db = result.db;
  for (const set of [large, small]) await addSet(db, set);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("recommendedStart", () => {
  it("startet ohne Gelerntes zehn neue Vokabeln als Multiple Choice, ohne die Einrichtung zu merken", async () => {
    await remember(large, 0);
    expect(await recommendedStart(db, large)).toBe("started");
    expect(queued()).toHaveLength(10);
    expect(new Set(queued().map((card) => card.direction))).toEqual(new Set(["termToMeaning"]));
    expect(new Set(queued().map((card) => card.mode))).toEqual(new Set(["multipleChoice"]));
    expect(
      queued()
        .map((card) => card.entryId)
        .sort(),
    ).toEqual(
      large.sections
        .flatMap((section) => section.entries)
        .slice(0, 10)
        .map((entry) => entry.id),
    );
    const [session] = await sessions();
    expect(session).toMatchObject({
      sectionIds: ["q7h3kd", "z2m8vt"],
      config: { direction: "mixed", count: 10, mcShare: 100 },
    });
  });

  it("wiederholt Fälliges von gestern und füllt mit fünf neuen auf", async () => {
    await remember(large, 0);
    await answered(large, 3, "2026-11-19T08:00:00.000Z");
    expect(await recommendedStart(db, large)).toBe("started");
    expect(
      queued()
        .map((card) => card.entryId)
        .sort(),
    ).toEqual(["e00000", "e00001", "e00002", "e00003", "e00004", "e00005", "e00006", "e00007"]);
  });

  it("fragt nach der Phase ab, nicht nach der gemerkten Einrichtung, und speichert den tatsächlichen Anteil", async () => {
    await remember(large, 0);
    // Zwei Tage gewusst: Phase 2, nach drei Tagen heute fällig und als Karteikarte gestellt.
    await answered(large, 3, "2026-11-16T08:00:00.000Z");
    await answered(large, 3, "2026-11-17T08:00:00.000Z");
    expect(await recommendedStart(db, large)).toBe("started");
    expect(Object.fromEntries(queued().map((card) => [card.entryId, card.mode]))).toEqual({
      e00000: "flashcard",
      e00001: "flashcard",
      e00002: "flashcard",
      e00003: "multipleChoice",
      e00004: "multipleChoice",
      e00005: "multipleChoice",
      e00006: "multipleChoice",
      e00007: "multipleChoice",
    });
    const planned = (await sessions()).find((session) => session.config.direction === "mixed");
    expect(planned?.config.mcShare).toBe(63);
    // Die gemerkte Einrichtung bleibt, wie sie war.
    const stored = await new Promise((resolve) => {
      const request = db.transaction("settings").objectStore("settings").get(settingKey(large.id));
      request.onsuccess = () => resolve(request.result);
    });
    expect(stored).toEqual({
      key: settingKey(large.id),
      value: { sections: "all", direction: "termToMeaning", count: 10, mcShare: 0 },
    });
  });

  it("startet ohne Fälliges und ohne Neues wie bisher den Schnellstart", async () => {
    await answered(small, 3, "2026-11-20T07:00:00.000Z");
    expect(await recommendedStart(db, small)).toBe("setup");
    await remember(small, 0);
    expect(await recommendedStart(db, small)).toBe("started");
    // Die gemerkte Einrichtung: alle drei Einträge in ihrer Richtung.
    expect(queued()).toHaveLength(3);
  });
});

describe("Herkunft und Antwortdauer (TDD 12.4, 12.5, D-68)", () => {
  it("hält fest, ob eine Sitzung vom Plan stammt; „Nur Fehler üben“ übernimmt das", async () => {
    expect(await recommendedStart(db, large)).toBe("started");
    const practice = currentPractice()!;
    for (let i = practice.state.queue.length; i > 0; i--) await practice.answer("incorrect");
    vi.setSystemTime(new Date("2026-11-20T08:10:00.000Z"));
    await practice.repeatMistakes();
    await remember(small, 0);
    vi.setSystemTime(new Date("2026-11-20T08:20:00.000Z"));
    expect(await quickStart(db, small)).toBe("started");
    const byStart = (await sessions()).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
    expect(byStart.map((session) => [session.origin, session.repeatOf !== undefined])).toEqual([
      ["plan", false],
      ["plan", true],
      ["setup", false],
    ]);
  });

  it("speichert die Antwortdauer nur, wenn es eine gibt", async () => {
    await remember(small, 0);
    expect(await quickStart(db, small)).toBe("started");
    const practice = currentPractice()!;
    await practice.answer("correct", 2400);
    await practice.answer("correct");
    const recorded = await events();
    expect(recorded.map((event) => event.responseMs).sort()).toEqual([2400, undefined]);
    expect(recorded.filter((event) => "responseMs" in event)).toHaveLength(1);
  });
});
