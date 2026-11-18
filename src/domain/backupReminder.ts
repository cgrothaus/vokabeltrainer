// Backup-Erinnerung (TDD 6.6, FR-31, AK-20, D-39, D-46): erinnert, wenn Antworten noch in keinem
// Backup stecken, das letzte Backup fehlt oder mindestens 14 Tage alt ist und der ungesicherte
// Lernstand an mindestens drei Tagen entstanden ist oder seine erste Sitzung mindestens 7 Tage
// zurückliegt. Sets allein lösen nichts aus, weil sie sich aus dem Chat neu importieren lassen; der
// Lernstand nicht.

export const REMINDER_DAYS = 14;
export const SNOOZE_DAYS = 3;
/** So viele verschiedene Lerntage (Ortszeit) mit ungesicherten Antworten genügen. */
export const LEARNING_DAYS = 3;
/** So alt darf die erste ungesicherte Sitzung höchstens werden. */
export const FIRST_ANSWER_DAYS = 7;

const DAY = 86_400_000;

export interface ReminderSituation {
  /**
   * `startedAt` der Sitzungen mit Antworten, die kein Backup enthält: ohne Backup alle, sonst die
   * nach dem Backup begonnenen.
   */
  unsavedStarts: readonly string[];
  /** Werte aus `meta`, tolerant gelesen. */
  lastBackupAt: unknown;
  snoozedUntil: unknown;
  now: Date;
}

/**
 * `daysSince`: Alter des letzten Backups in ganzen Tagen, `null` ohne Backup; `learningDays`: Zahl der
 * Tage mit ungesicherten Antworten; `firstUnsavedAt`: Beginn der ersten ungesicherten Sitzung.
 */
export type Reminder =
  | { due: false }
  | { due: true; daysSince: number | null; learningDays: number; firstUnsavedAt: string };

export function reminderDue(situation: ReminderSituation): Reminder {
  const starts = situation.unsavedStarts
    .map((at) => ({ at, time: readTime(at) }))
    .filter((start): start is { at: string; time: number } => start.time !== null)
    .sort((a, b) => a.time - b.time);
  if (starts.length === 0) return { due: false };
  const now = situation.now.getTime();
  const snoozedUntil = readTime(situation.snoozedUntil);
  if (snoozedUntil !== null && snoozedUntil > now) return { due: false };
  const lastBackup = readTime(situation.lastBackupAt);
  // Eine verstellte Uhr soll nicht zu einer Erinnerung führen.
  if (lastBackup !== null && lastBackup > now) return { due: false };
  const daysSince = lastBackup === null ? null : Math.floor((now - lastBackup) / DAY);
  if (daysSince !== null && daysSince < REMINDER_DAYS) return { due: false };
  // Nicht schon nach dem ersten Ausprobieren (D-46).
  const first = starts[0]!;
  const learningDays = new Set(starts.map((start) => localDay(start.time))).size;
  if (learningDays < LEARNING_DAYS && now - first.time < FIRST_ANSWER_DAYS * DAY)
    return { due: false };
  return { due: true, daysSince, learningDays, firstUnsavedAt: first.at };
}

function localDay(time: number): string {
  const date = new Date(time);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/** Bis wann „Später“ die Erinnerung zurückstellt, als ISO-Zeitpunkt für `meta`. */
export function snoozeUntil(now: Date): string {
  return new Date(now.getTime() + SNOOZE_DAYS * DAY).toISOString();
}

function readTime(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : time;
}
