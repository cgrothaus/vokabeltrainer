// Was die Backup-Erinnerung braucht (TDD 6.6, D-39, D-46), in einer Lesetransaktion: die Zeitpunkte
// aus `meta` und der Beginn der Sitzungen mit Antworten, die kein Backup enthält. Antworten werden
// dafür nur gezählt, ein Zeitindex ist nicht nötig.
import type { Session } from "../domain/model";
import type { MetaKey } from "./meta";
import { runTransaction } from "./transaction";

export interface ReminderState {
  /** `startedAt` der ungesicherten Sitzungen mit mindestens einer Antwort, ohne feste Reihenfolge. */
  unsavedStarts: string[];
  lastBackupAt: unknown;
  snoozedUntil: unknown;
}

export async function readReminderState(db: IDBDatabase): Promise<ReminderState> {
  const state: ReminderState = {
    unsavedStarts: [],
    lastBackupAt: undefined,
    snoozedUntil: undefined,
  };
  await runTransaction(db, ["meta", "sessions", "reviewEvents"], "readonly", (transaction) => {
    const meta = transaction.objectStore("meta");
    const answers = transaction.objectStore("reviewEvents").index("sessionId");
    const snoozed = meta.get("backupReminderSnoozedUntil" satisfies MetaKey);
    snoozed.onsuccess = () => (state.snoozedUntil = snoozed.result?.value);
    const last = meta.get("lastBackupAt" satisfies MetaKey);
    last.onsuccess = () => {
      state.lastBackupAt = last.result?.value;
      const since = typeof state.lastBackupAt === "string" ? Date.parse(state.lastBackupAt) : NaN;
      // Sitzungen sind wenige (rund 2.500 im Prüffall), Antworten viele. Ohne Backup ist jede
      // Antwort ungesichert, sonst die aus Sitzungen nach dem Backup.
      const sessions = transaction.objectStore("sessions").getAll();
      sessions.onsuccess = () => {
        for (const session of sessions.result as Session[]) {
          if (!Number.isNaN(since) && !(Date.parse(session.startedAt) > since)) continue;
          const count = answers.count(session.id);
          count.onsuccess = () => {
            if (count.result > 0) state.unsavedStarts.push(session.startedAt);
          };
        }
      };
    };
  });
  return state;
}
