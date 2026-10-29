// Was die Backup-Erinnerung braucht (TDD 6.6, D-39), in einer Lesetransaktion: die Zeitpunkte aus
// `meta` und ob es Antworten gibt, die kein Backup enthält. Antworten werden dafür nur gezählt.
import type { Session } from "../domain/model";
import type { MetaKey } from "./meta";
import { runTransaction } from "./transaction";

export interface ReminderState {
  unsavedAnswers: boolean;
  lastBackupAt: unknown;
  snoozedUntil: unknown;
}

export async function readReminderState(db: IDBDatabase): Promise<ReminderState> {
  const state: ReminderState = {
    unsavedAnswers: false,
    lastBackupAt: undefined,
    snoozedUntil: undefined,
  };
  await runTransaction(db, ["meta", "sessions", "reviewEvents"], "readonly", (transaction) => {
    const meta = transaction.objectStore("meta");
    const events = transaction.objectStore("reviewEvents");
    const snoozed = meta.get("backupReminderSnoozedUntil" satisfies MetaKey);
    snoozed.onsuccess = () => (state.snoozedUntil = snoozed.result?.value);
    const last = meta.get("lastBackupAt" satisfies MetaKey);
    last.onsuccess = () => {
      state.lastBackupAt = last.result?.value;
      const since = typeof state.lastBackupAt === "string" ? Date.parse(state.lastBackupAt) : NaN;
      function noteAnswers(request: IDBRequest<number>): void {
        request.onsuccess = () => {
          if (request.result > 0) state.unsavedAnswers = true;
        };
      }
      // Ohne Backup ist jede Antwort ungesichert.
      if (Number.isNaN(since)) {
        noteAnswers(events.count());
        return;
      }
      // Kein Zeitindex: Sitzungen sind wenige (rund 2.500 im Prüffall), Antworten viele.
      const sessions = transaction.objectStore("sessions").getAll();
      sessions.onsuccess = () => {
        for (const session of sessions.result as Session[])
          if (Date.parse(session.startedAt) > since)
            noteAnswers(events.index("sessionId").count(session.id));
      };
    };
  });
  return state;
}
