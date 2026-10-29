// Backup-Erinnerung in der Bibliothek (TDD 6.6, FR-31, D-39): Fälligkeit in domain/backupReminder.ts,
// Lesen in storage/reminder.ts. Gespeichert wird das Backup über app/backup.ts.
import { type Reminder, reminderDue, snoozeUntil } from "../domain/backupReminder";
import { setMeta } from "../storage/meta";
import { readReminderState } from "../storage/reminder";
import { reportStorageProblem } from "./components/storageNotice";

export async function loadReminder(db: IDBDatabase, now = new Date()): Promise<Reminder> {
  return reminderDue({ ...(await readReminderState(db)), now });
}

/** „Später“: Schreibvorgang im Hintergrund, ein Fehler erscheint im Speicherhinweis (D-32). */
export async function snoozeReminder(db: IDBDatabase, now = new Date()): Promise<void> {
  await setMeta(db, "backupReminderSnoozedUntil", snoozeUntil(now)).catch((error: unknown) => {
    console.warn("Erinnerung nicht zurückgestellt", error);
    reportStorageProblem(
      error,
      "Die Erinnerung ließ sich nicht zurückstellen; sie erscheint beim nächsten Öffnen wieder.",
    );
  });
}
