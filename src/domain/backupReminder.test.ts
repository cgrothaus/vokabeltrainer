import { describe, expect, it } from "vitest";
import {
  REMINDER_DAYS,
  type ReminderSituation,
  reminderDue,
  SNOOZE_DAYS,
  snoozeUntil,
} from "./backupReminder";

const now = new Date("2026-10-29T18:00:00.000Z");
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();

const base: ReminderSituation = {
  unsavedAnswers: true,
  lastBackupAt: undefined,
  snoozedUntil: undefined,
  now,
};

const due = (situation: Partial<ReminderSituation>) => reminderDue({ ...base, ...situation });

describe("reminderDue", () => {
  it("erinnert ohne Backup sofort, sobald es Antworten gibt", () => {
    expect(due({})).toEqual({ due: true, daysSince: null });
  });

  it("erinnert nie ohne ungesicherte Antworten, auch ohne oder mit altem Backup", () => {
    expect(due({ unsavedAnswers: false })).toEqual({ due: false });
    expect(due({ unsavedAnswers: false, lastBackupAt: daysAgo(90) })).toEqual({ due: false });
  });

  it("erinnert erst, wenn das Backup 14 Tage alt ist", () => {
    expect(REMINDER_DAYS).toBe(14);
    expect(due({ lastBackupAt: daysAgo(13.9) })).toEqual({ due: false });
    expect(due({ lastBackupAt: daysAgo(14) })).toEqual({ due: true, daysSince: 14 });
    expect(due({ lastBackupAt: daysAgo(20.5) })).toEqual({ due: true, daysSince: 20 });
  });

  it("schweigt, solange die Erinnerung zurückgestellt ist", () => {
    const tomorrow = new Date(now.getTime() + 86_400_000).toISOString();
    expect(due({ snoozedUntil: tomorrow })).toEqual({ due: false });
    expect(due({ snoozedUntil: daysAgo(1) })).toEqual({ due: true, daysSince: null });
    expect(due({ snoozedUntil: now.toISOString() })).toEqual({ due: true, daysSince: null });
  });

  it.each([null, 42, "", "gestern", { at: "2026-10-01" }])(
    "liest den gespeicherten Wert %j als fehlend",
    (value) => {
      expect(due({ lastBackupAt: value })).toEqual({ due: true, daysSince: null });
      expect(due({ snoozedUntil: value })).toEqual({ due: true, daysSince: null });
    },
  );

  it("erinnert nicht, wenn das Backup in der Zukunft liegt (Uhr verstellt)", () => {
    const later = new Date(now.getTime() + 3_600_000).toISOString();
    expect(due({ lastBackupAt: later })).toEqual({ due: false });
  });
});

describe("snoozeUntil", () => {
  it("stellt um drei Tage zurück", () => {
    expect(SNOOZE_DAYS).toBe(3);
    expect(snoozeUntil(now)).toBe("2026-11-01T18:00:00.000Z");
    expect(due({ snoozedUntil: snoozeUntil(now) })).toEqual({ due: false });
  });
});
