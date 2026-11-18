import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StoredSet } from "../domain/model";
import { settingKey } from "../domain/practiceSetup";
import { openDatabase } from "../storage/database";
import { readLearningOrder } from "../storage/sessions";
import { addSet } from "../storage/sets";
import { setSetting } from "../storage/settings";
import { loadLibraryStart } from "./library";
import { currentPractice, quickStart } from "./practice";

let db: IDBDatabase;

/** Ein Set mit `size` Einträgen in einer Sektion. */
function setWith(id: string, size: number): StoredSet {
  return {
    id,
    editCount: 0,
    createdAt: "2026-11-17T17:00:00.000Z",
    updatedAt: "2026-11-17T17:00:00.000Z",
    title: `Set ${id}`,
    termLanguage: "en",
    meaningLanguage: "de",
    sections: [
      {
        id: "q7h3kd",
        title: "Wetter",
        entries: Array.from({ length: size }, (_, index) => ({
          id: `e${String(index).padStart(5, "0")}`,
          term: { text: `word ${index}` },
          meanings: [{ text: `Wort ${index}` }],
        })),
      },
    ],
  };
}

const large = setWith("m4x8c2r9tw", 25);
const small = setWith("k2n7w4b8qp", 3);
const empty = setWith("p3v9c6x2hd", 0);

function remember(set: StoredSet, count: 10 | 20 | 30 | "all"): Promise<void> {
  return setSetting(db, {
    key: settingKey(set.id),
    value: { sections: "all", direction: "termToMeaning", count, mcShare: 0 },
  });
}

/**
 * Schnellstart eine Minute nach dem vorigen: Zwei Sitzungen in derselben Millisekunde hätten dasselbe
 * `startedAt`, ihre Reihenfolge hinge dann von den zufälligen IDs ab (in der CI geschehen).
 */
function startLater(set: StoredSet): Promise<"started" | "setup"> {
  vi.setSystemTime(Date.now() + 60_000);
  return quickStart(db, set);
}

/** Startet per Schnellstart und beantwortet die erste Karte. */
async function learn(set: StoredSet): Promise<void> {
  expect(await startLater(set)).toBe("started");
  const practice = currentPractice()!;
  const outcome = await practice.answer("correct");
  expect(outcome).toEqual({ ok: true });
}

beforeEach(async () => {
  // Nur die Uhr: Die Rückrufe von fake-indexeddb laufen weiter.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-18T08:00:00.000Z"));
  indexedDB = new IDBFactory();
  const result = await openDatabase({ appVersion: "test" });
  if (!result.ok) throw new Error(result.reason);
  db = result.db;
  for (const set of [large, small, empty]) await addSet(db, set);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("quickStart", () => {
  it("öffnet ohne gemerkte Einrichtung die Einrichtung und legt keine Sitzung an", async () => {
    expect(await startLater(large)).toBe("setup");
    expect(await readLearningOrder(db)).toEqual({ order: [] });
  });

  it("startet mit der gemerkten Einrichtung sofort", async () => {
    await remember(large, 10);
    expect(await startLater(large)).toBe("started");
    const practice = currentPractice()!;
    expect(practice.set.id).toBe(large.id);
    expect(practice.state.total).toBe(10);
    expect((await readLearningOrder(db)).order).toEqual([large.id]);
  });
});

describe("loadLibraryStart", () => {
  it("bietet ohne gelerntes Set kein Weiterlernen an", async () => {
    expect(await loadLibraryStart(db, [large, small, empty])).toEqual({ order: [] });
  });

  it("nennt das zuletzt gelernte Set mit der Anzahl aus seiner Einrichtung", async () => {
    await remember(small, 20);
    await learn(small);
    await remember(large, 20);
    await learn(large);
    expect(await loadLibraryStart(db, [large, small, empty])).toEqual({
      order: [large.id, small.id],
      continueWith: { set: large, count: 20 },
    });
  });

  it("begrenzt die Anzahl auf die Einträge des Sets", async () => {
    await remember(small, 20);
    await learn(small);
    const start = await loadLibraryStart(db, [large, small]);
    expect(start.continueWith).toEqual({ set: small, count: 3 });
  });

  it("zählt eine angefangene Sitzung ohne Antwort nicht", async () => {
    await remember(small, "all");
    await learn(small);
    await remember(large, 10);
    expect(await startLater(large)).toBe("started");
    const start = await loadLibraryStart(db, [large, small]);
    expect(start.order).toEqual([large.id, small.id]);
    expect(start.continueWith?.set).toBe(small);
  });

  it("führt ohne gemerkte Einrichtung zur Einrichtung, also ohne Anzahl", async () => {
    await remember(small, 10);
    await learn(small);
    // Wie ein Backup ohne Einstellungen: Der Wert fehlt.
    await setSetting(db, { key: settingKey(small.id), value: undefined });
    const start = await loadLibraryStart(db, [small]);
    expect(start.continueWith).toEqual({ set: small });
  });

  it("bietet ein Set nicht an, das es nicht mehr gibt oder das keine Einträge hat", async () => {
    await remember(large, 10);
    await learn(large);
    expect((await loadLibraryStart(db, [small])).continueWith).toBeUndefined();
    expect(
      (await loadLibraryStart(db, [{ ...large, sections: empty.sections }])).continueWith,
    ).toBeUndefined();
  });
});
