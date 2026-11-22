// Lernsitzungen und Antworten speichern (TDD 12.4, 12.5). Jede Antwort läuft in einer eigenen
// Transaktion und gilt erst nach `complete` als gespeichert (6.5). `add` statt `put`: Vorhandenes
// wird nie überschrieben.
import type { ReviewEvent, Session, SessionStatus } from "../domain/model";
import { SetMissingError } from "./errors";
import type { StoreName } from "./schema";
import { putSetting, type SettingRecord } from "./settings";
import { runTransaction } from "./transaction";

/**
 * Schreibt nur, wenn jede Anfrage aus `exists` in derselben Transaktion etwas findet; sonst wird nichts
 * geschrieben, und das Versprechen lehnt mit `SetMissingError` ab. Ein anderer Tab kann das Set
 * inzwischen gelöscht oder alles ersetzt haben (TDD 3.4); Antworten oder Sitzungen ohne Set machten
 * jedes Backup ungültig (D-25). `count` liest dabei kein ganzes Dokument.
 */
async function writeIfPresent(
  db: IDBDatabase,
  stores: StoreName[],
  exists: (transaction: IDBTransaction) => IDBRequest<number>[],
  write: (transaction: IDBTransaction) => void,
): Promise<void> {
  let missing = false;
  // Wirft `write` im Rückruf, bricht der Browser mit einem eigenen `AbortError` ab; gemeldet wird
  // dann der eigentliche Fehler, z. B. ein voller Speicher.
  let thrown: unknown;
  try {
    await runTransaction(db, stores, "readwrite", (transaction) => {
      const requests = exists(transaction);
      let pending = requests.length;
      for (const request of requests) {
        request.onsuccess = () => {
          if (missing) return;
          if (request.result === 0) {
            missing = true;
            return transaction.abort();
          }
          if (--pending > 0) return;
          try {
            write(transaction);
          } catch (error) {
            thrown = error;
            transaction.abort();
          }
        };
      }
    });
  } catch (error) {
    throw missing ? new SetMissingError() : (thrown ?? error);
  }
}

/**
 * Eine Sitzung über mehrere Sets ist je Set ein Datensatz (TDD 12.5, D-68); sie entstehen nur
 * zusammen, und nur, wenn es jedes Set noch gibt. `remember` (die Einrichtung, TDD 12.1, bzw. die
 * Zusammenstellung, 12.10) wird nur zusammen mit der Sitzung gespeichert.
 */
export function startSession(
  db: IDBDatabase,
  session: Session | readonly Session[],
  remember?: SettingRecord,
): Promise<void> {
  const records = Array.isArray(session) ? session : [session as Session];
  const stores: StoreName[] = remember ? ["sets", "sessions", "settings"] : ["sets", "sessions"];
  return writeIfPresent(
    db,
    stores,
    (transaction) => records.map((record) => transaction.objectStore("sets").count(record.setId)),
    (transaction) => {
      for (const record of records) transaction.objectStore("sessions").add(record);
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
    (transaction) => [transaction.objectStore("sessions").count(event.sessionId)],
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

export interface LearningOrder {
  /** Set-IDs nach ihrer jüngsten Sitzung, die jüngste zuerst; Sets ohne Sitzung fehlen. */
  order: string[];
  /** Set der jüngsten Sitzung mit mindestens einer Antwort (TDD 12.6). */
  lastLearned?: string;
  /** Deren Gruppe, wenn sie mehrere Sets umfasste (TDD 12.10). */
  lastGroup?: string;
}

/**
 * Was die Bibliothek vor dem Lernstand braucht (TDD 12.6, D-50): Reihenfolge des Nachladens und das
 * Set für „Weiterlernen“. Wie bei der Backup-Erinnerung werden Antworten nur gezählt, und nur, bis
 * eine Sitzung mit Antwort gefunden ist.
 */
export async function readLearningOrder(db: IDBDatabase): Promise<LearningOrder> {
  const result: LearningOrder = { order: [] };
  await runTransaction(db, ["sessions", "reviewEvents"], "readonly", (transaction) => {
    const request = transaction.objectStore("sessions").getAll();
    request.onsuccess = () => {
      const sessions = (request.result as Session[]).sort(
        (a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt),
      );
      result.order = [...new Set(sessions.map((session) => session.setId))];
      const answers = transaction.objectStore("reviewEvents").index("sessionId");
      function check(index: number): void {
        const session = sessions[index];
        if (!session) return;
        const count = answers.count(session.id);
        count.onsuccess = () => {
          if (count.result === 0) return check(index + 1);
          result.lastLearned = session.setId;
          if (session.groupId !== undefined) result.lastGroup = session.groupId;
        };
      }
      check(0);
    };
  });
  return result;
}

/**
 * Lesen und Schreiben in einer Transaktion, bei mehreren Sets für alle Datensätze der Sitzung. Ein
 * unbekannter Datensatz wurde mit seinem Set gelöscht und wird übergangen; fehlen alle:
 * `SetMissingError`, nichts wird angelegt.
 */
export async function finishSession(
  db: IDBDatabase,
  id: string | readonly string[],
  status: Extract<SessionStatus, "completed" | "ended">,
  endedAt: string,
): Promise<void> {
  const ids = typeof id === "string" ? [id] : id;
  let missing = false;
  try {
    await runTransaction(db, "sessions", "readwrite", (transaction) => {
      const store = transaction.objectStore("sessions");
      let pending = ids.length;
      let found = 0;
      for (const each of ids) {
        const request = store.get(each);
        request.onsuccess = () => {
          const session = request.result as Session | undefined;
          if (session) {
            found++;
            store.put({ ...session, status, endedAt } satisfies Session);
          }
          if (--pending === 0 && found === 0) {
            missing = true;
            transaction.abort();
          }
        };
      }
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
