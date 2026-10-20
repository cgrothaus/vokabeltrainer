import { describe, expect, it } from "vitest";
import type { ReviewEvent, Session, StoredSet } from "./model";
import { type StoreRecords, validateRecords } from "./validateRecords";

const set = (id: string, overrides: Partial<StoredSet> = {}): StoredSet => ({
  id,
  editCount: 0,
  createdAt: "2026-10-20T10:00:00.000Z",
  updatedAt: "2026-10-20T10:00:00.000Z",
  title: "Wetter",
  termLanguage: "en",
  meaningLanguage: "de",
  sections: [
    {
      id: "sec001",
      title: "Teil 1",
      entries: [
        { id: "ent001", term: { text: "rain" }, meanings: [{ text: "Regen" }] },
        {
          id: "ent002",
          term: { text: "autumn", acceptedVariants: ["fall"] },
          meanings: [{ text: "Herbst" }, { text: "Fall", acceptedVariants: ["Fallen"] }],
        },
      ],
    },
  ],
  ...overrides,
});

const session = (id: string, setId: string, overrides: Partial<Session> = {}): Session => ({
  id,
  setId,
  sectionIds: ["sec001"],
  startedAt: "2026-10-20T11:00:00.000Z",
  status: "completed",
  endedAt: "2026-10-20T11:05:00.000Z",
  config: { direction: "termToMeaning", count: 2, mcShare: 0 },
  ...overrides,
});

const event = (
  id: string,
  sessionId: string,
  setId: string,
  overrides: Partial<ReviewEvent> = {},
): ReviewEvent => ({
  id,
  sessionId,
  setId,
  entryId: "ent001",
  entryRev: "abcdefgh",
  occurredAt: "2026-10-20T11:01:00.000Z",
  direction: "termToMeaning",
  mode: "flashcard",
  result: "correct",
  firstAttempt: true,
  ...overrides,
});

const records = (overrides: Partial<StoreRecords> = {}): StoreRecords => ({
  sets: [set("set0000001")],
  sessions: [session("session00001", "set0000001")],
  reviewEvents: [event("event0000001", "session00001", "set0000001")],
  settings: [{ key: "theme", value: "dark" }],
  ...overrides,
});

describe("validateRecords", () => {
  it("akzeptiert einen stimmigen Bestand", () => {
    expect(validateRecords(records())).toEqual([]);
  });

  it("akzeptiert einen leeren Bestand", () => {
    expect(validateRecords({ sets: [], sessions: [], reviewEvents: [], settings: [] })).toEqual([]);
  });

  it("akzeptiert optionale Angaben eines Sets und eines Eintrags", () => {
    const full = set("set0000001", {
      level: "A1",
      textbook: "Eigenes Material",
      edition: "1",
      source: "Wortliste",
      license: "CC0",
      notes: "Notiz",
      reviewStatus: "checked",
    });
    full.sections[0]!.entries[0] = {
      ...full.sections[0]!.entries[0]!,
      notes: "Notiz",
      examples: [{ text: "It rains.", translation: "Es regnet." }, { text: "Rain again." }],
      grammar: { partOfSpeech: "noun", plural: "rains", forms: ["rained"] },
      reviewStatus: "unchecked",
    };
    expect(validateRecords(records({ sets: [full] }))).toEqual([]);
  });

  it("akzeptiert Sitzungen ohne Ende und mit gemischter Richtung", () => {
    const running = session("session00001", "set0000001", {
      status: "interrupted",
      endedAt: undefined,
      config: { direction: "mixed", count: 2, mcShare: 0.5 },
    });
    delete running.endedAt;
    expect(validateRecords(records({ sessions: [running] }))).toEqual([]);
  });

  it("akzeptiert Antworten zu Einträgen, die es im Set nicht mehr gibt", () => {
    const old = event("event0000001", "session00001", "set0000001", { entryId: "gone01" });
    expect(validateRecords(records({ reviewEvents: [old] }))).toEqual([]);
  });

  it("meldet fehlende Pflichtangaben eines Sets mit Fundstelle", () => {
    const { termLanguage: _, ...broken } = set("set0000002");
    expect(validateRecords(records({ sets: [set("set0000001"), broken] }))).toEqual([
      "Set 2: Die Angabe „termLanguage“ fehlt oder ist ungültig.",
    ]);
  });

  it("nennt keine Inhalte aus den Daten", () => {
    const broken = set("set0000001", { title: "Geheimer Titel", editCount: -1 });
    const errors = validateRecords(records({ sets: [broken] }));
    expect(errors).toEqual(["Set 1: Die Angabe „editCount“ fehlt oder ist ungültig."]);
    expect(errors.join()).not.toContain("Geheim");
  });

  it("meldet Datensätze, die keine Objekte sind", () => {
    expect(validateRecords(records({ settings: ["theme"] }))).toEqual([
      "Einstellung 1: Die Angaben sind ungültig.",
    ]);
  });

  it("meldet Fehler in Sektionen und Einträgen mit Fundstelle", () => {
    const broken = set("set0000001");
    broken.sections.push({ id: "sec002", title: "", entries: [] });
    broken.sections[0]!.entries[1] = {
      id: "ent002",
      term: { text: "sun" },
      meanings: [],
    };
    expect(validateRecords(records({ sets: [broken] }))).toEqual([
      "Set 1, Sektion 1, Eintrag 2: Die Angabe „meanings“ fehlt oder ist ungültig.",
      "Set 1, Sektion 2: Die Angabe „title“ fehlt oder ist ungültig.",
    ]);
  });

  it("verlangt Antworten in Langform", () => {
    const broken = set("set0000001");
    (broken.sections[0]!.entries[0] as unknown as { term: unknown }).term = "rain";
    expect(validateRecords(records({ sets: [broken] }))).toEqual([
      "Set 1, Sektion 1, Eintrag 1: Die Angabe „term“ fehlt oder ist ungültig.",
    ]);
  });

  it("prüft die Typen optionaler Angaben", () => {
    const broken = set("set0000001", { reviewStatus: "done" as never, notes: 3 as never });
    broken.sections[0]!.entries[0]!.examples = [{ translation: "x" } as never];
    expect(validateRecords(records({ sets: [broken] }))).toEqual([
      "Set 1: Die Angabe „notes“ fehlt oder ist ungültig.",
      "Set 1: Die Angabe „reviewStatus“ fehlt oder ist ungültig.",
      "Set 1, Sektion 1, Eintrag 1: Die Angabe „examples“ fehlt oder ist ungültig.",
    ]);
  });

  it("meldet doppelte Kennungen von Sektionen und Einträgen innerhalb eines Sets", () => {
    const broken = set("set0000001");
    broken.sections.push({
      id: "sec001",
      title: "Teil 2",
      entries: [{ id: "ent001", term: { text: "sun" }, meanings: [{ text: "Sonne" }] }],
    });
    expect(validateRecords(records({ sets: [broken] }))).toEqual([
      "Set 1, Sektion 2: Die Kennung kommt im Set mehrfach vor.",
      "Set 1, Sektion 2, Eintrag 1: Die Kennung kommt im Set mehrfach vor.",
    ]);
  });

  it("meldet doppelte Schlüssel pro Bereich", () => {
    expect(
      validateRecords(
        records({
          sets: [set("set0000001"), set("set0000001")],
          settings: [{ key: "theme" }, { key: "theme" }],
        }),
      ),
    ).toEqual([
      "Set 2: Die Kennung kommt mehrfach vor.",
      "Einstellung 2: Die Kennung kommt mehrfach vor.",
    ]);
  });

  it("prüft die festen Werte von Sitzungen und Antworten", () => {
    const badSession = session("session00001", "set0000001", { status: "paused" as never });
    const badEvent = event("event0000001", "session00001", "set0000001", {
      mode: "typing" as never,
      firstAttempt: "yes" as never,
    });
    expect(validateRecords(records({ sessions: [badSession], reviewEvents: [badEvent] }))).toEqual([
      "Lernsitzung 1: Die Angabe „status“ fehlt oder ist ungültig.",
      "Antwort 1: Die Angabe „mode“ fehlt oder ist ungültig.",
      "Antwort 1: Die Angabe „firstAttempt“ fehlt oder ist ungültig.",
    ]);
  });

  it("meldet Lernsitzungen und Antworten ohne zugehöriges Set", () => {
    expect(
      validateRecords(
        records({
          sessions: [session("session00001", "set0000001"), session("session00002", "unknown")],
          reviewEvents: [
            event("event0000001", "session00001", "unknown"),
            event("event0000002", "missing", "set0000001"),
          ],
        }),
      ),
    ).toEqual([
      "Lernsitzung 2: Das zugehörige Set fehlt.",
      "Antwort 1: Das zugehörige Set fehlt.",
      "Antwort 2: Die zugehörige Lernsitzung fehlt.",
    ]);
  });

  it("meldet Antworten, deren Set nicht zur Lernsitzung passt", () => {
    expect(
      validateRecords(
        records({
          sets: [set("set0000001"), set("set0000002")],
          reviewEvents: [event("event0000001", "session00001", "set0000002")],
        }),
      ),
    ).toEqual(["Antwort 1: Sie gehört zu einem anderen Set als ihre Lernsitzung."]);
  });
});
