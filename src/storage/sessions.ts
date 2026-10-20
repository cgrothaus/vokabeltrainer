// Lernsitzungen und Antworten speichern (TDD 12.4, 12.5). Jede Antwort läuft in einer eigenen
// Transaktion und gilt erst nach `complete` als gespeichert (6.5). `add` statt `put`: Vorhandenes
// wird nie überschrieben.
import type { ReviewEvent, Session, SessionStatus } from "../domain/model";
import { runTransaction } from "./transaction";

export function startSession(db: IDBDatabase, session: Session): Promise<void> {
  return runTransaction(db, "sessions", "readwrite", (transaction) => {
    transaction.objectStore("sessions").add(session);
  });
}

export function recordAnswer(db: IDBDatabase, event: ReviewEvent): Promise<void> {
  return runTransaction(db, "reviewEvents", "readwrite", (transaction) => {
    transaction.objectStore("reviewEvents").add(event);
  });
}

/** Lesen und Schreiben in einer Transaktion; eine unbekannte Sitzung bricht ab. */
export function finishSession(
  db: IDBDatabase,
  id: string,
  status: Extract<SessionStatus, "completed" | "ended">,
  endedAt: string,
): Promise<void> {
  return runTransaction(db, "sessions", "readwrite", (transaction) => {
    const store = transaction.objectStore("sessions");
    const request = store.get(id);
    request.onsuccess = () => {
      const session = request.result as Session | undefined;
      if (!session) return transaction.abort();
      store.put({ ...session, status, endedAt } satisfies Session);
    };
  });
}

/**
 * Beim Start: Sitzungen, die noch aktiv sind, wurden durch Neuladen oder Schließen beendet. Ein
 * Ende wird nicht eingetragen, weil der Zeitpunkt unbekannt ist. Liefert die Zahl der Sitzungen.
 */
export async function interruptActiveSessions(db: IDBDatabase): Promise<number> {
  let count = 0;
  await runTransaction(db, "sessions", "readwrite", (transaction) => {
    const request = transaction.objectStore("sessions").openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      const session = cursor.value as Session;
      if (session.status === "active") {
        cursor.update({ ...session, status: "interrupted" } satisfies Session);
        count++;
      }
      cursor.continue();
    };
  });
  return count;
}
