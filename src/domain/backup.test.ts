import { describe, expect, it } from "vitest";
import { backupFileName, createBackup } from "./backup";

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
