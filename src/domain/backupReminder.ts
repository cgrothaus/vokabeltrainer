// Backup-Erinnerung (TDD 6.6, FR-31, AK-20, D-39): erinnert, wenn Antworten noch in keinem Backup
// stecken und das letzte Backup fehlt oder mindestens 14 Tage alt ist. Sets allein lösen nichts aus,
// weil sie sich aus dem Chat neu importieren lassen; der Lernstand nicht.

export const REMINDER_DAYS = 14;
export const SNOOZE_DAYS = 3;

const DAY = 86_400_000;

export interface ReminderSituation {
  /** Es gibt Antworten, die kein Backup enthält: ohne Backup alle, sonst die seit dem Backup. */
  unsavedAnswers: boolean;
  /** Werte aus `meta`, tolerant gelesen. */
  lastBackupAt: unknown;
  snoozedUntil: unknown;
  now: Date;
}

/** `daysSince`: Alter des letzten Backups in ganzen Tagen, `null` ohne Backup. */
export type Reminder = { due: false } | { due: true; daysSince: number | null };

export function reminderDue(situation: ReminderSituation): Reminder {
  if (!situation.unsavedAnswers) return { due: false };
  const now = situation.now.getTime();
  const snoozedUntil = readTime(situation.snoozedUntil);
  if (snoozedUntil !== null && snoozedUntil > now) return { due: false };
  const lastBackup = readTime(situation.lastBackupAt);
  if (lastBackup === null) return { due: true, daysSince: null };
  // Eine verstellte Uhr soll nicht zu einer Erinnerung führen.
  if (lastBackup > now) return { due: false };
  const daysSince = Math.floor((now - lastBackup) / DAY);
  return daysSince >= REMINDER_DAYS ? { due: true, daysSince } : { due: false };
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
