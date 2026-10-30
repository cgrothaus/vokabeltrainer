// Lernsitzungen und Antworten speichern (TDD 12.4, 12.5). Jede Antwort läuft in einer eigenen
// Transaktion und gilt erst nach `complete` als gespeichert (6.5). `add` statt `put`: Vorhandenes
// wird nie überschrieben.
import type { ReviewEvent, Session, SessionStatus } from "../domain/model";
import { SetMissingError } from "./errors";
import type { StoreName } from "./schema";
import { putSetting, type SettingRecord } from "./settings";
import { runTransaction } from "./transaction";

/**
 * Schreibt nur, wenn `exists` in derselben Transaktion etwas findet; sonst wird nichts geschrieben,
 * und das Versprechen lehnt mit `SetMissingError` ab. Ein anderer Tab kann das Set inzwischen
 * gelöscht oder alles ersetzt haben (TDD 3.4); Antworten oder Sitzungen ohne Set machten jedes Backup
 * ungültig (D-25). `count` liest dabei kein ganzes Dokument.
 */
async function writeIfPresent(
  db: IDBDatabase,
  stores: StoreName[],
  exists: (transaction: IDBTransaction) => IDBRequest<number>,
  write: (transaction: IDBTransaction) => void,
): Promise<void> {
  let missing = false;
  // Wirft `write` im Rückruf, bricht der Browser mit einem eigenen `AbortError` ab; gemeldet wird
  // dann der eigentliche Fehler, z. B. ein voller Speicher.
  let thrown: unknown;
  try {
    await runTransaction(db, stores, "readwrite", (transaction) => {
      const request = exists(transaction);
      request.onsuccess = () => {
        if (request.result === 0) {
          missing = true;
          return transaction.abort();
        }
        try {
          write(transaction);
        } catch (error) {
          thrown = error;
          transaction.abort();
        }
      };
    });
  } catch (error) {
    throw missing ? new SetMissingError() : (thrown ?? error);
  }
}

/** `remember` (die Einrichtung, TDD 12.1) wird nur zusammen mit der Sitzung gespeichert. */
export function startSession(
  db: IDBDatabase,
  session: Session,
  remember?: SettingRecord,
): Promise<void> {
  const stores: StoreName[] = remember ? ["sets", "sessions", "settings"] : ["sets", "sessions"];
  return writeIfPresent(
    db,
    stores,
    (transaction) => transaction.objectStore("sets").count(session.setId),
    (transaction) => {
      transaction.objectStore("sessions").add(session);
      if (remember) putSetting(transaction, remember);
    },
  );
}

/**
 * Prüft die Sitzung statt des Sets: Sie verschwindet in derselben Transaktion wie ihr Set, und `sets`
 * bleibt so aus jeder Antwort heraus.
 */
export function recordAnswer(db: IDBDatabase, event: ReviewEvent): Promise<void> {
  return writeIfPresent(
    db,
    ["sessions", "reviewEvents"],
    (transaction) => transaction.objectStore("sessions").count(event.sessionId),
    (transaction) => transaction.objectStore("reviewEvents").add(event),
  );
}

/** Alle Antworten eines Sets über den Index `setId`, Grundlage des Lernstands (TDD 12.6). */
export async function listSetEvents(db: IDBDatabase, setId: string): Promise<ReviewEvent[]> {
  let events: ReviewEvent[] = [];
  await runTransaction(db, "reviewEvents", "readonly", (transaction) => {
    const request = transaction.objectStore("reviewEvents").index("setId").getAll(setId);
    request.onsuccess = () => (events = request.result as ReviewEvent[]);
  });
  return events;
}

/**
 * Lesen und Schreiben in einer Transaktion. Eine unbekannte Sitzung wurde mit ihrem Set gelöscht:
 * `SetMissingError`, nichts wird angelegt.
 */
export async function finishSession(
  db: IDBDatabase,
  id: string,
  status: Extract<SessionStatus, "completed" | "ended">,
  endedAt: string,
): Promise<void> {
  let missing = false;
  try {
    await runTransaction(db, "sessions", "readwrite", (transaction) => {
      const store = transaction.objectStore("sessions");
      const request = store.get(id);
      request.onsuccess = () => {
        const session = request.result as Session | undefined;
        if (session) return store.put({ ...session, status, endedAt } satisfies Session);
        missing = true;
        transaction.abort();
      };
    });
  } catch (error) {
    throw missing ? new SetMissingError() : error;
  }
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
