import { describe, expect, test } from "vitest";
import { entryRev } from "../domain/hash";
import { prepareNewSet } from "../domain/importSet";
import type { StoredSet } from "../domain/model";
import { MAX_LENGTH } from "../domain/validate";
import { validateRecords } from "../domain/validateRecords";
import {
  PERF_ENTRIES,
  PERF_EVENTS,
  PERF_SECTIONS,
  perfHistory,
  perfSetText,
  seededBytes,
  seededRandom,
} from "./perfData";

function importPerfSet(): StoredSet {
  const prepared = prepareNewSet(perfSetText(), {
    now: "2026-10-01T12:00:00.000Z",
    randomBytes: seededBytes(seededRandom(7)),
  });
  if (!prepared.ok) throw new Error(prepared.errors.join("\n"));
  expect(prepared.warnings).toEqual([]);
  return prepared.set;
}

describe("seededRandom", () => {
  test("liefert mit gleichem Startwert dieselbe Folge in [0, 1)", () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    const values = Array.from({ length: 1000 }, () => a());
    expect(Array.from({ length: 1000 }, () => b())).toEqual(values);
    expect(values.every((value) => value >= 0 && value < 1)).toBe(true);
    expect(new Set(values).size).toBeGreaterThan(990);
  });
});

describe("perfSetText", () => {
  const set = importPerfSet();
  const entries = set.sections.flatMap((section) => section.entries);

  test("ist ein gültiges neues Set mit 3.000 Einträgen in 20 Sektionen", () => {
    expect(set.sections).toHaveLength(PERF_SECTIONS);
    expect(entries).toHaveLength(PERF_ENTRIES);
    expect(PERF_SECTIONS).toBe(20);
    expect(PERF_ENTRIES).toBe(3_000);
  });

  test("ist ohne IDs, wie ein neu erstelltes Set", () => {
    expect(perfSetText()).not.toMatch(/"id"/);
  });

  test("enthält die Formatmöglichkeiten eines echten Sets", () => {
    expect(entries.some((entry) => entry.term.acceptedVariants)).toBe(true);
    expect(entries.some((entry) => entry.meanings.length > 1)).toBe(true);
    expect(
      entries.some((entry) => entry.meanings.some((meaning) => meaning.acceptedVariants)),
    ).toBe(true);
    expect(entries.some((entry) => entry.grammar?.forms)).toBe(true);
    expect(entries.some((entry) => entry.grammar?.plural)).toBe(true);
    expect(entries.some((entry) => entry.examples?.some((example) => example.translation))).toBe(
      true,
    );
    expect(entries.some((entry) => entry.notes)).toBe(true);
  });

  test("Wörter sind eindeutig und halten die Längengrenzen ein", () => {
    expect(new Set(entries.map((entry) => entry.term.text)).size).toBe(PERF_ENTRIES);
    for (const entry of entries) {
      expect(entry.term.text.length).toBeLessThanOrEqual(MAX_LENGTH.answer);
    }
  });

  test("ist bei gleichem Startwert gleich und bei anderem verschieden", () => {
    expect(perfSetText(1)).toBe(perfSetText(1));
    expect(perfSetText(2)).not.toBe(perfSetText(1));
  });
});

describe("perfHistory", () => {
  const set = importPerfSet();
  const { sessions, events } = perfHistory(set);
  const entryIds = new Set(set.sections.flatMap((section) => section.entries.map((e) => e.id)));

  test("hat genau 50.000 Antworten", () => {
    expect(PERF_EVENTS).toBe(50_000);
    expect(events).toHaveLength(PERF_EVENTS);
  });

  test("besteht die Prüfung der gespeicherten Datensätze", () => {
    expect(validateRecords({ sets: [set], sessions, reviewEvents: events, settings: [] })).toEqual(
      [],
    );
  });

  test("Antworten verweisen auf vorhandene Einträge mit ihrem Inhaltsstand", () => {
    const revs = new Map(
      set.sections.flatMap((section) => section.entries.map((e) => [e.id, entryRev(e)] as const)),
    );
    for (const event of events) {
      expect(entryIds.has(event.entryId)).toBe(true);
      expect(event.entryRev).toBe(revs.get(event.entryId));
    }
  });

  test("Antworten liegen in ihrer Sitzung und in einer der Sektionen der Sitzung", () => {
    const sectionOf = new Map(
      set.sections.flatMap((section) => section.entries.map((e) => [e.id, section.id] as const)),
    );
    const byId = new Map(sessions.map((session) => [session.id, session]));
    for (const event of events) {
      const session = byId.get(event.sessionId)!;
      expect(session.sectionIds).toContain(sectionOf.get(event.entryId));
      expect(event.occurredAt >= session.startedAt).toBe(true);
      expect(event.occurredAt <= session.endedAt!).toBe(true);
    }
  });

  test("Zeitpunkte steigen an und reichen über mehrere Jahre", () => {
    const times = events.map((event) => event.occurredAt);
    expect(times.every((time, i) => i === 0 || times[i - 1]! < time)).toBe(true);
    const years = (Date.parse(times.at(-1)!) - Date.parse(times[0]!)) / (365 * 86_400_000);
    expect(years).toBeGreaterThan(4);
    expect(years).toBeLessThan(5);
  });

  test("je Eintrag und Sitzung genau ein Erstversuch, Wiederholungen danach", () => {
    const seen = new Set<string>();
    for (const event of events) {
      const key = `${event.sessionId}:${event.entryId}`;
      expect(event.firstAttempt).toBe(!seen.has(key));
      seen.add(key);
    }
    expect(events.some((event) => !event.firstAttempt)).toBe(true);
  });

  test("enthält Fehlersitzungen, Multiple Choice und beide Richtungen", () => {
    const ids = new Set(sessions.map((session) => session.id));
    const repeats = sessions.filter((session) => session.repeatOf);
    expect(repeats.length).toBeGreaterThan(0);
    for (const repeat of repeats) expect(ids.has(repeat.repeatOf!)).toBe(true);
    expect(new Set(events.map((event) => event.mode))).toEqual(
      new Set(["flashcard", "multipleChoice"]),
    );
    expect(new Set(events.map((event) => event.direction))).toEqual(
      new Set(["termToMeaning", "meaningToTerm"]),
    );
    expect(new Set(events.map((event) => event.result))).toEqual(new Set(["correct", "incorrect"]));
  });

  test("ist bei gleichem Startwert gleich", () => {
    expect(perfHistory(set)).toEqual({ sessions, events });
  });
});
