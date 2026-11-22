import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { entryRev } from "../domain/hash";
import type { ReviewEvent, Session, StoredSet } from "../domain/model";
import { settingKey, TOGETHER_KEY } from "../domain/practiceSetup";
import { validateRecords } from "../domain/validateRecords";
import { openDatabase } from "../storage/database";
import { recordAnswer, startSession } from "../storage/sessions";
import { addSet } from "../storage/sets";
import { getSetting, setSetting } from "../storage/settings";
import { removeSet } from "./deleteSet";
import { forgetAllOverviews, loadOverview } from "./overview";
import {
  beginPlannedTogether,
  beginTogether,
  currentPractice,
  quickStart,
  recommendedStart,
  recommendedTogether,
} from "./practice";

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

describe("Mehrere Sets (TDD 12.10, AK-22, AK-33)", () => {
  /** Gleiche Eintrags-IDs wie `small`, aber andere Wörter. */
  const other: StoredSet = {
    ...setWith("p7k2v9q4zd", 6),
    title: "Anderes",
    sections: [
      {
        id: "q7h3kd",
        title: "Farben",
        entries: Array.from({ length: 6 }, (_, index) => ({
          id: `e${String(index).padStart(5, "0")}`,
          term: { text: `colour ${index}` },
          meanings: [{ text: `Farbe ${index}` }],
        })),
      },
    ],
  };
  const both = [small, other];
  const setup = (mcShare: number) =>
    ({
      setIds: [small.id, other.id],
      direction: "termToMeaning",
      count: "all",
      mcShare,
    }) as const;

  beforeEach(async () => {
    await addSet(db, other);
  });

  /** Beim ersten Versuch alles falsch, danach richtig, bis die Runde fertig ist. */
  async function missAll(): Promise<void> {
    const practice = currentPractice()!;
    while (!practice.finished) {
      await practice.answer(practice.state.queue[0]!.firstAttempt ? "incorrect" : "correct");
    }
  }

  async function knowAll(): Promise<void> {
    const practice = currentPractice()!;
    while (!practice.finished) await practice.answer("correct");
  }

  it("legt je Set einen Datensatz mit gemeinsamer Gruppe an, jede Antwort gehört zu ihrem Set", async () => {
    await beginTogether(db, both, setup(0));
    const practice = currentPractice()!;
    expect(practice.title).toBe("Set k2n7w4b8qp und Anderes");
    expect(practice.state.total).toBe(9);
    await knowAll();
    const records = await sessions();
    expect(records.map((record) => record.setId).sort()).toEqual([small.id, other.id].sort());
    expect(new Set(records.map((record) => record.groupId)).size).toBe(1);
    expect(records[0]!.groupId).toHaveLength(12);
    expect(new Set(records.map((record) => record.startedAt)).size).toBe(1);
    expect(records.every((record) => record.status === "completed")).toBe(true);
    const sessionOf = new Map(records.map((record) => [record.setId, record.id]));
    const recorded = await events();
    expect(recorded.every((event) => event.sessionId === sessionOf.get(event.setId))).toBe(true);
    expect(recorded.filter((event) => event.setId === small.id)).toHaveLength(3);
    expect(recorded.filter((event) => event.setId === other.id)).toHaveLength(6);
    expect(await getSetting(db, TOGETHER_KEY)).toEqual(setup(0));
    // Jedes Set sieht nur seine Antworten (TDD 12.6).
    expect((await loadOverview(db, small)).cards.size).toBe(3);
    expect((await loadOverview(db, other)).cards.size).toBe(6);
  });

  it("nimmt falsche Antworten aus allen Sets der Sitzung", async () => {
    // Allein hat `small` zu wenige Kandidaten für Multiple Choice.
    await beginTogether(db, both, setup(100));
    const practice = currentPractice()!;
    expect(practice.state.queue.every((card) => card.mode === "multipleChoice")).toBe(true);
    const question = practice.question();
    if (question.mode !== "multipleChoice") throw new Error("Multiple Choice erwartet");
    const meanings = new Set(
      [...small.sections, ...other.sections]
        .flatMap((section) => section.entries)
        .map((entry) => entry.meanings[0]!.text),
    );
    expect(question.options.every((option) => meanings.has(option))).toBe(true);
  });

  it("wiederholt Fehler je Set mit Verweis auf den Datensatz desselben Sets", async () => {
    await beginTogether(db, both, setup(0));
    await missAll();
    vi.setSystemTime(new Date("2026-11-20T08:10:00.000Z"));
    await currentPractice()!.repeatMistakes();
    const records = await sessions();
    const first = records.filter((record) => record.repeatOf === undefined);
    const repeat = records.filter((record) => record.repeatOf !== undefined);
    expect(repeat).toHaveLength(2);
    for (const record of repeat) {
      const original = first.find((candidate) => candidate.id === record.repeatOf)!;
      expect(original.setId).toBe(record.setId);
    }
    expect(repeat[0]!.groupId).toBeDefined();
    expect(repeat[0]!.groupId).toBe(repeat[1]!.groupId);
    expect(repeat[0]!.groupId).not.toBe(first[0]!.groupId);
  });

  it("lässt beim Löschen eines Sets die Lerndaten des anderen vollständig", async () => {
    await beginTogether(db, both, setup(0));
    await missAll();
    const before = (await events()).filter((event) => event.setId === other.id);
    expect((await removeSet(db, small)).ok).toBe(true);
    expect((await sessions()).map((record) => record.setId)).toEqual([other.id]);
    const left = await events();
    expect(left).toHaveLength(before.length);
    expect(left.every((event) => event.setId === other.id)).toBe(true);
    const records = { sets: [large, other], sessions: await sessions(), reviewEvents: left };
    expect(validateRecords({ ...records, settings: [] })).toEqual([]);
  });

  it("wiederholt nach Plan über alle gewählten Sets und behält die gemerkte freie Auswahl", async () => {
    await setSetting(db, {
      key: TOGETHER_KEY,
      value: { setIds: [other.id], direction: "mixed", count: 10, mcShare: 50 },
    });
    expect(await beginPlannedTogether(db, both)).toBe(true);
    // Neue Vokabeln aus beiden Sets: alle neun, höchstens zehn.
    expect(currentPractice()!.state.total).toBe(9);
    expect((await sessions()).map((record) => record.origin)).toEqual(["plan", "plan"]);
    expect(await getSetting(db, TOGETHER_KEY)).toEqual({
      setIds: [small.id, other.id],
      direction: "mixed",
      count: 10,
      mcShare: 50,
    });
  });

  it("startet ohne Fälliges und Neues die gemerkte freie Auswahl", async () => {
    await beginTogether(db, both, setup(0));
    await knowAll();
    // Alles in Phase 1, die Gegenrichtung ist erst ab Phase 2 neu: Der Plan hat nichts.
    expect(await recommendedTogether(db, both)).toBe("started");
    expect(currentPractice()!.state.total).toBe(9);
    expect((await sessions()).filter((record) => record.origin === "setup")).toHaveLength(4);
  });

  it("öffnet ohne gemerkte Zusammenstellung die Auswahl", async () => {
    await beginPlannedTogether(db, both);
    await knowAll();
    await setSetting(db, { key: TOGETHER_KEY, value: null });
    expect(await recommendedTogether(db, both)).toBe("setup");
  });
});
