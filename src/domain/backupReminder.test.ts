import { describe, expect, it } from "vitest";
import {
  FIRST_ANSWER_DAYS,
  LEARNING_DAYS,
  REMINDER_DAYS,
  type ReminderSituation,
  reminderDue,
  SNOOZE_DAYS,
  snoozeUntil,
} from "./backupReminder";

const now = new Date("2026-10-29T18:00:00.000Z");
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();

/** Drei Lerntage hintereinander, der erste vor zwei Tagen: Das genügt für die Erinnerung (D-46). */
const threeDays = [daysAgo(2), daysAgo(1), daysAgo(0.1)];

const base: ReminderSituation = {
  unsavedStarts: threeDays,
  lastBackupAt: undefined,
  snoozedUntil: undefined,
  now,
};

const due = (situation: Partial<ReminderSituation>) => reminderDue({ ...base, ...situation });
/** Fällig ohne Backup mit den drei Lerntagen aus `base`. */
const dueWithout = { due: true, daysSince: null, learningDays: 3, firstUnsavedAt: threeDays[0] };

describe("reminderDue", () => {
  it("erinnert ohne Backup, sobald an drei Tagen ungesichert gelernt wurde", () => {
    expect(LEARNING_DAYS).toBe(3);
    expect(due({})).toEqual(dueWithout);
    // Zwei Tage, mehrere Sitzungen am selben Tag: noch nicht.
    expect(due({ unsavedStarts: [daysAgo(1), daysAgo(0.2), daysAgo(0.1)] })).toEqual({
      due: false,
    });
  });

  it("erinnert, wenn die erste ungesicherte Sitzung mindestens 7 Tage zurückliegt", () => {
    expect(FIRST_ANSWER_DAYS).toBe(7);
    expect(due({ unsavedStarts: [daysAgo(6.9)] })).toEqual({ due: false });
    expect(due({ unsavedStarts: [daysAgo(0.5), daysAgo(7)] })).toEqual({
      due: true,
      daysSince: null,
      learningDays: 2,
      firstUnsavedAt: daysAgo(7),
    });
  });

  it("zählt Tage in Ortszeit", () => {
    const at = (day: number, hour: number, minute = 0) =>
      new Date(2026, 9, day, hour, minute).toISOString();
    const evening = new Date(2026, 9, 22, 12);
    // Kurz vor und nach Mitternacht sind zwei Tage.
    const starts = [at(20, 23, 59), at(21, 0, 1), at(21, 12)];
    expect(reminderDue({ ...base, now: evening, unsavedStarts: starts })).toEqual({ due: false });
    expect(
      reminderDue({ ...base, now: evening, unsavedStarts: [...starts, at(22, 8)] }),
    ).toMatchObject({ due: true, learningDays: 3 });
  });

  it("erinnert nie ohne ungesicherte Antworten, auch ohne oder mit altem Backup", () => {
    expect(due({ unsavedStarts: [] })).toEqual({ due: false });
    expect(due({ unsavedStarts: [], lastBackupAt: daysAgo(90) })).toEqual({ due: false });
  });

  it("übergeht unbrauchbare Zeitpunkte", () => {
    expect(due({ unsavedStarts: ["gestern", daysAgo(1)] })).toEqual({ due: false });
  });

  it("erinnert erst, wenn das Backup 14 Tage alt ist", () => {
    expect(REMINDER_DAYS).toBe(14);
    expect(due({ lastBackupAt: daysAgo(13.9) })).toEqual({ due: false });
    expect(due({ lastBackupAt: daysAgo(14) })).toEqual({ ...dueWithout, daysSince: 14 });
    expect(due({ lastBackupAt: daysAgo(20.5) })).toEqual({ ...dueWithout, daysSince: 20 });
  });

  it("schweigt, solange die Erinnerung zurückgestellt ist", () => {
    const tomorrow = new Date(now.getTime() + 86_400_000).toISOString();
    expect(due({ snoozedUntil: tomorrow })).toEqual({ due: false });
    expect(due({ snoozedUntil: daysAgo(1) })).toEqual(dueWithout);
    expect(due({ snoozedUntil: now.toISOString() })).toEqual(dueWithout);
  });

  it.each([null, 42, "", "gestern", { at: "2026-10-01" }])(
    "liest den gespeicherten Wert %j als fehlend",
    (value) => {
      expect(due({ lastBackupAt: value })).toEqual(dueWithout);
      expect(due({ snoozedUntil: value })).toEqual(dueWithout);
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
