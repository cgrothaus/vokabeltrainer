import { describe, expect, it } from "vitest";
import type { ReviewEvent, StoredSet } from "./model";
import { computeStats, describeDay } from "./stats";

/** Zwei Sektionen: `wetter` mit `rain`, `sun`; `tiere` mit `cat`. */
function set(sections: Record<string, string[]> = { wetter: ["rain", "sun"], tiere: ["cat"] }) {
  return {
    id: "m4x8c2r9tw",
    editCount: 0,
    createdAt: "2026-10-01T08:00:00.000Z",
    updatedAt: "2026-10-01T08:00:00.000Z",
    title: "Grundwortschatz",
    termLanguage: "en",
    meaningLanguage: "de",
    sections: Object.entries(sections).map(([id, entries]) => ({
      id,
      title: id,
      entries: entries.map((entry) => ({
        id: entry,
        term: { text: entry },
        meanings: [{ text: entry }],
      })),
    })),
  } satisfies StoredSet;
}

let nextId = 0;

/** Eine Antwort; `at` ist die Stunde am 20. Oktober 2026 (UTC), `first` der Erstversuch. */
function answer(
  session: string,
  entryId: string,
  at: number,
  result: ReviewEvent["result"],
  first = true,
): ReviewEvent {
  return {
    id: `event${nextId++}`.padEnd(12, "x"),
    sessionId: session,
    setId: "m4x8c2r9tw",
    entryId,
    entryRev: "abcdefgh",
    occurredAt: new Date(Date.UTC(2026, 9, 20, at)).toISOString(),
    direction: "termToMeaning",
    mode: "flashcard",
    result,
    firstAttempt: first,
  };
}

const at = (hour: number) => new Date(Date.UTC(2026, 9, 20, hour)).toISOString();

describe("computeStats", () => {
  it("liefert ohne Antworten leere Kennzahlen, auch für jede Sektion", () => {
    const stats = computeStats(set(), []);
    expect(stats.set).toEqual({ sessions: 0 });
    expect([...stats.sections]).toEqual([
      ["wetter", { sessions: 0 }],
      ["tiere", { sessions: 0 }],
    ]);
    expect(stats.entries.size).toBe(0);
  });

  it("zählt Sitzungen, letzte Antwort und nur Erstversuche für die Quote", () => {
    const events = [
      answer("s1", "rain", 8, "incorrect"),
      answer("s1", "sun", 9, "correct"),
      answer("s1", "rain", 10, "correct", false),
    ];
    expect(computeStats(set(), events).set).toEqual({
      sessions: 1,
      lastAt: at(10),
      recent: { sessions: 1, firstAttempts: 2, firstCorrect: 1 },
    });
  });

  it("ordnet Antworten der Sektion zu, in der der Eintrag jetzt steht", () => {
    const events = [answer("s1", "rain", 8, "correct"), answer("s1", "cat", 9, "incorrect")];
    // `rain` ist nach `tiere` verschoben worden.
    const stats = computeStats(set({ wetter: ["sun"], tiere: ["rain", "cat"] }), events);
    expect(stats.sections.get("wetter")).toEqual({ sessions: 0 });
    expect(stats.sections.get("tiere")).toEqual({
      sessions: 1,
      lastAt: at(9),
      recent: { sessions: 1, firstAttempts: 2, firstCorrect: 1 },
    });
  });

  it("zählt eine Sitzung über zwei Sektionen in beiden und im Set einmal", () => {
    const events = [answer("s1", "rain", 8, "correct"), answer("s1", "cat", 9, "correct")];
    const stats = computeStats(set(), events);
    expect(stats.set.sessions).toBe(1);
    expect(stats.sections.get("wetter")?.sessions).toBe(1);
    expect(stats.sections.get("tiere")?.sessions).toBe(1);
    expect(stats.sections.get("wetter")?.lastAt).toBe(at(8));
  });

  it("ignoriert Antworten zu Einträgen, die es nicht mehr gibt", () => {
    const events = [
      answer("s1", "rain", 8, "correct"),
      answer("s2", "gone", 9, "incorrect"),
      answer("s1", "gone", 10, "incorrect"),
    ];
    const stats = computeStats(set(), events);
    expect(stats.set).toEqual({
      sessions: 1,
      lastAt: at(8),
      recent: { sessions: 1, firstAttempts: 1, firstCorrect: 1 },
    });
    expect(stats.entries.has("gone")).toBe(false);
  });

  it("bildet die Quote über die letzten fünf Sitzungen nach ihrer letzten Antwort", () => {
    // Sitzung s0 hat ihre letzte Antwort am spätesten, obwohl sie zuerst begann.
    const events = [
      answer("s0", "rain", 1, "correct"),
      answer("s0", "sun", 20, "correct"),
      ...[2, 3, 4, 5, 6].map((hour) => answer(`s${hour}`, "rain", hour, "incorrect")),
    ];
    // Reihenfolge im Array spielt keine Rolle.
    const stats = computeStats(set(), events.reverse());
    expect(stats.set.sessions).toBe(6);
    // s0 (2 von 2) und s3 bis s6 (je 0 von 1); s2 fällt heraus.
    expect(stats.set.recent).toEqual({ sessions: 5, firstAttempts: 6, firstCorrect: 2 });
  });

  it("zählt die Quote einer Sektion nur aus deren Antworten", () => {
    const events = [answer("s1", "rain", 8, "incorrect"), answer("s1", "cat", 9, "correct")];
    const stats = computeStats(set(), events);
    expect(stats.sections.get("wetter")?.recent).toEqual({
      sessions: 1,
      firstAttempts: 1,
      firstCorrect: 0,
    });
    expect(stats.set.recent).toEqual({ sessions: 1, firstAttempts: 2, firstCorrect: 1 });
  });

  it("liefert pro Eintrag Antworten, letzte Antwort und letzten Erstversuch", () => {
    const events = [
      answer("s1", "rain", 8, "incorrect"),
      answer("s1", "rain", 9, "correct", false),
      answer("s2", "rain", 11, "correct"),
      answer("s2", "rain", 10, "incorrect", false),
    ].reverse();
    expect(computeStats(set(), events).entries.get("rain")).toEqual({
      answers: 4,
      lastAt: at(11),
      lastResult: "correct",
      lastFirstResult: "correct",
    });
    const later = [answer("s3", "sun", 8, "incorrect"), answer("s3", "sun", 9, "correct", false)];
    expect(computeStats(set(), later).entries.get("sun")).toEqual({
      answers: 2,
      lastAt: at(9),
      lastResult: "correct",
      lastFirstResult: "incorrect",
    });
  });
});

describe("describeDay", () => {
  const now = new Date(2026, 9, 22, 0, 30);
  const local = (...args: [number, number, number, number]) => new Date(...args).toISOString();

  it("nennt heute und gestern nach dem Kalendertag in Ortszeit", () => {
    expect(describeDay(local(2026, 9, 22, 0), now)).toBe("heute");
    expect(describeDay(local(2026, 9, 21, 23), now)).toBe("gestern");
    expect(describeDay(local(2026, 9, 21, 0), now)).toBe("gestern");
  });

  it("nennt sonst das Datum, mit Jahr nur außerhalb des laufenden Jahres", () => {
    expect(describeDay(local(2026, 9, 20, 23), now)).toBe("am 20. Okt.");
    expect(describeDay(local(2025, 11, 31, 12), now)).toBe("am 31. Dez. 2025");
  });
});
