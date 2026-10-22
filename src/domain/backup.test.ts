import { describe, expect, it } from "vitest";
import { backupFileName, createBackup, parseBackup, summarizeRecords } from "./backup";
import type { DataMigration } from "./migrations";
import type { StoredSet } from "./model";

describe("createBackup", () => {
  it("erzeugt die Hülle nach TDD 11.3", () => {
    const data = { sets: [{ id: "a" }], reviewEvents: [], sessions: [], settings: [] };
    expect(
      createBackup({
        dataVersion: 1,
        appVersion: "0.1.0+abc1234",
        exportedAt: "2026-10-20T18:00:00.000Z",
        data,
      }),
    ).toEqual({
      format: "vokabeltrainer-backup",
      formatVersion: 1,
      dataVersion: 1,
      appVersion: "0.1.0+abc1234",
      exportedAt: "2026-10-20T18:00:00.000Z",
      data,
    });
  });

  it("lässt interne Angaben aus meta weg", () => {
    const backup = createBackup({
      dataVersion: 1,
      appVersion: "0.1.0",
      exportedAt: "2026-10-20T18:00:00.000Z",
      data: { sets: [], meta: [{ key: "lastBackupAt" }] },
    });
    expect(backup.data).toEqual({ sets: [] });
  });
});

describe("backupFileName", () => {
  it("nennt das Backup mit dem lokalen Datum", () => {
    expect(backupFileName(new Date(2026, 0, 5, 23, 59))).toBe(
      "Vokabeltrainer-Backup_2026-01-05.json",
    );
  });
});

const storedSet: StoredSet = {
  id: "set0000001",
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
        { id: "ent002", term: { text: "sun" }, meanings: [{ text: "Sonne" }] },
      ],
    },
    {
      id: "sec002",
      title: "Teil 2",
      entries: [{ id: "ent003", term: { text: "snow" }, meanings: [{ text: "Schnee" }] }],
    },
  ],
};

const data = () => ({
  sets: [storedSet],
  sessions: [
    {
      id: "session00001",
      setId: "set0000001",
      sectionIds: ["sec001"],
      startedAt: "2026-10-20T11:00:00.000Z",
      status: "ended",
      endedAt: "2026-10-20T11:02:00.000Z",
      config: { direction: "termToMeaning", count: 3, mcShare: 0 },
    },
  ],
  reviewEvents: ["event0000001", "event0000002"].map((id) => ({
    id,
    sessionId: "session00001",
    setId: "set0000001",
    entryId: "ent001",
    entryRev: "abcdefgh",
    occurredAt: "2026-10-20T11:01:00.000Z",
    direction: "termToMeaning",
    mode: "flashcard",
    result: "correct",
    firstAttempt: id === "event0000001",
  })),
  settings: [{ key: "theme", value: "dark" }],
});

const file = (overrides: Record<string, unknown> = {}) => ({
  format: "vokabeltrainer-backup",
  formatVersion: 1,
  dataVersion: 1,
  appVersion: "0.1.0+abc1234",
  exportedAt: "2026-10-20T18:00:00.000Z",
  data: data(),
  ...overrides,
});

const current = { dataVersion: 1, migrations: [] };

describe("summarizeRecords", () => {
  it("zählt Sets, Einträge über alle Sektionen, Sitzungen und Antworten", () => {
    expect(summarizeRecords(data())).toEqual({ sets: 1, entries: 3, sessions: 1, events: 2 });
  });

  it("zählt einen leeren Bestand als null, auch wenn Einstellungen vorhanden sind", () => {
    expect(
      summarizeRecords({
        sets: [],
        reviewEvents: [],
        sessions: [],
        settings: [{ key: "theme", value: "dark" }],
      }),
    ).toEqual({ sets: 0, entries: 0, sessions: 0, events: 0 });
  });
});

describe("parseBackup", () => {
  it("übernimmt ein gültiges Backup und fasst den Umfang zusammen", () => {
    expect(parseBackup(file(), current)).toEqual({
      ok: true,
      backup: file(),
      summary: {
        exportedAt: "2026-10-20T18:00:00.000Z",
        sets: 1,
        entries: 3,
        sessions: 1,
        events: 2,
      },
    });
  });

  it("übergeht interne Angaben und unbekannte Bereiche", () => {
    const result = parseBackup(
      file({ data: { ...data(), meta: [{ key: "lastBackupAt" }], extra: [1] } }),
      current,
    );
    expect(result.ok && Object.keys(result.backup.data).sort()).toEqual([
      "reviewEvents",
      "sessions",
      "sets",
      "settings",
    ]);
  });

  it("erkennt ein Vokabelset", () => {
    const set = { format: "vokabeltrainer-set", formatVersion: 1, set: {}, sections: [] };
    const message =
      "Das ist ein Vokabelset, kein Backup. Ein Vokabelset wird importiert, nicht wiederhergestellt.";
    expect(parseBackup(set, current)).toEqual({ ok: false, errors: [message] });
    // Auch ohne Formatkennung, wie sie LLMs gern weglassen.
    expect(parseBackup({ set: {}, sections: [] }, current)).toEqual({
      ok: false,
      errors: [message],
    });
  });

  it("lehnt fremde Dateien ab", () => {
    const message = "Die Datei ist kein Backup des Vokabeltrainers.";
    expect(parseBackup([1, 2], current)).toEqual({ ok: false, errors: [message] });
    expect(parseBackup(file({ format: "anderes" }), current)).toEqual({
      ok: false,
      errors: [message],
    });
  });

  it("lehnt Backups einer neueren App-Version ab", () => {
    const message =
      "Dieses Backup stammt von einer neueren App-Version. Lade die App neu, um es wiederherzustellen.";
    expect(parseBackup(file({ formatVersion: 2 }), current)).toEqual({
      ok: false,
      errors: [message],
    });
    expect(parseBackup(file({ dataVersion: 2 }), current)).toEqual({
      ok: false,
      errors: [message],
    });
  });

  it("meldet ungültige Angaben der Hülle", () => {
    expect(
      parseBackup(file({ formatVersion: "1", dataVersion: 0, exportedAt: "gestern" }), current),
    ).toEqual({
      ok: false,
      errors: [
        "Die Angabe „formatVersion“ fehlt oder ist ungültig.",
        "Die Angabe „dataVersion“ fehlt oder ist ungültig.",
        "Die Angabe „exportedAt“ fehlt oder ist ungültig.",
      ],
    });
  });

  it("verlangt alle Bereiche", () => {
    const { sessions: _, ...partial } = data();
    expect(parseBackup(file({ data: partial }), current)).toEqual({
      ok: false,
      errors: ["Die Angabe „data.sessions“ fehlt oder ist ungültig."],
    });
    expect(parseBackup(file({ data: null }), current)).toEqual({
      ok: false,
      errors: ["Die Angabe „data“ fehlt oder ist ungültig."],
    });
  });

  it("gibt Fehler in den Datensätzen weiter", () => {
    const broken = data();
    broken.reviewEvents[1]!.sessionId = "missing";
    expect(parseBackup(file({ data: broken }), current)).toEqual({
      ok: false,
      errors: ["Antwort 2: Die zugehörige Lernsitzung fehlt."],
    });
  });

  describe("älterer Stand", () => {
    const chain: DataMigration[] = [
      { version: 2, stores: { settings: (r) => ({ ...(r as object), migrated: true }) } },
    ];

    it("bringt die Datensätze über die Migrationskette auf den aktuellen Stand", () => {
      const result = parseBackup(file(), { dataVersion: 2, migrations: chain });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.backup.dataVersion).toBe(2);
      expect(result.backup.data.settings).toEqual([
        { key: "theme", value: "dark", migrated: true },
      ]);
      expect(result.backup.data.sets).toEqual([storedSet]);
    });

    it("prüft die Datensätze erst nach der Migration", () => {
      const renaming: DataMigration[] = [
        {
          version: 2,
          stores: {
            sets: (r) => {
              const { title, ...rest } = r as StoredSet;
              return { ...rest, name: title };
            },
          },
        },
      ];
      expect(parseBackup(file(), { dataVersion: 2, migrations: renaming })).toEqual({
        ok: false,
        errors: ["Set 1: Die Angabe „title“ fehlt oder ist ungültig."],
      });
    });

    const notMigrated = {
      ok: false,
      errors: [
        "Das Backup ließ sich nicht auf den Stand dieser App-Version bringen. Deine Daten auf diesem Gerät bleiben unverändert.",
      ],
    };

    it("meldet eine scheiternde Migration, statt eine Ausnahme zu werfen", () => {
      const failing: DataMigration[] = [
        {
          version: 2,
          stores: {
            sets: () => {
              throw new Error("kaputt");
            },
          },
        },
      ];
      expect(parseBackup(file(), { dataVersion: 2, migrations: failing })).toEqual(notMigrated);
    });

    it("meldet eine Lücke in der Kette", () => {
      expect(parseBackup(file(), { dataVersion: 3, migrations: chain })).toEqual(notMigrated);
    });
  });
});
