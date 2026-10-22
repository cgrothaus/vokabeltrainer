// Ablauf einer Lernsitzung (TDD 12.2–12.5): Die Warteschlange liegt in domain/practice.ts, das
// Speichern in storage/sessions.ts. Hier werden beide verbunden. Die laufende Sitzung lebt nur im
// Arbeitsspeicher; nach einem Neuladen ist sie beendet, gespeicherte Antworten bleiben.
import { entryRev } from "../domain/hash";
import { createId, ID_LENGTH } from "../domain/ids";
import type { ReviewEvent, Session, StoredEntry, StoredSet } from "../domain/model";
import { answer, type PracticeState, type Result, startPractice } from "../domain/practice";
import {
  type PracticeSetup,
  pickEntries,
  restoreSetup,
  settingKey,
  storedSetup,
} from "../domain/practiceSetup";
import { randomBytes } from "../platform/random";
import { finishSession, recordAnswer, startSession } from "../storage/sessions";
import { getSetting } from "../storage/settings";

export interface PracticeSession {
  readonly set: StoredSet;
  readonly state: PracticeState;
  /** Alle Karten gewusst; die Sitzung ist als abgeschlossen gespeichert oder wird es gerade. */
  readonly finished: boolean;
  entry(id: string): StoredEntry;
  /** Speichert die Antwort und rückt danach vor; `false`, wenn das Speichern scheiterte. */
  answer(result: Result): Promise<boolean>;
  /** Vorzeitiges Ende, z. B. beim Verlassen der Ansicht. */
  end(): void;
}

let current: PracticeSession | null = null;

export function currentPractice(): PracticeSession | null {
  return current;
}

/** Zuletzt gewählte Einrichtung des Sets (TDD 12.1); ist sie nicht lesbar, gilt die Voreinstellung. */
export async function loadSetup(db: IDBDatabase, set: StoredSet): Promise<PracticeSetup> {
  const stored = await getSetting(db, settingKey(set.id)).catch((error: unknown) => {
    console.warn("Einrichtung nicht lesbar", error);
    return undefined;
  });
  return restoreSetup(set, stored);
}

/**
 * Legt die Sitzung an und merkt die Einrichtung in derselben Transaktion; scheitert das Speichern,
 * gibt es keine Sitzung.
 */
export async function beginPractice(
  db: IDBDatabase,
  set: StoredSet,
  setup: PracticeSetup,
): Promise<void> {
  const chosen = new Set(pickEntries(set, setup, Math.random));
  const entries = new Map(
    set.sections
      .flatMap((section) => section.entries)
      .filter((entry) => chosen.has(entry.id))
      .map((entry) => [entry.id, entry]),
  );
  let state = startPractice([...entries.keys()], setup.direction, Math.random);
  const session: Session = {
    id: createId(ID_LENGTH.session, randomBytes),
    setId: set.id,
    sectionIds: [...setup.sectionIds],
    startedAt: new Date().toISOString(),
    status: "active",
    // Multiple Choice folgt mit S-18.
    config: { direction: setup.direction, count: state.total, mcShare: 0 },
  };
  await startSession(db, session, { key: settingKey(set.id), value: storedSetup(set, setup) });

  // Einmal pro Eintrag: Der Inhalt ändert sich während der Sitzung nicht.
  const revs = new Map([...entries].map(([id, entry]) => [id, entryRev(entry)]));
  let finished = false;
  let ended = false;
  const close = (status: "completed" | "ended") =>
    finishSession(db, session.id, status, new Date().toISOString()).catch((error: unknown) => {
      // Beim nächsten Start wird die Sitzung als unterbrochen vermerkt.
      console.warn("Ende der Sitzung nicht gespeichert", error);
    });

  const practice: PracticeSession = {
    set,
    get state() {
      return state;
    },
    get finished() {
      return finished;
    },
    entry: (id) => entries.get(id)!,
    async answer(result) {
      const next = answer(state, result);
      const event: ReviewEvent = {
        id: createId(ID_LENGTH.reviewEvent, randomBytes),
        sessionId: session.id,
        setId: set.id,
        entryId: next.recorded.entryId,
        entryRev: revs.get(next.recorded.entryId)!,
        occurredAt: new Date().toISOString(),
        direction: next.recorded.direction,
        mode: "flashcard",
        result,
        firstAttempt: next.recorded.firstAttempt,
      };
      let saved = true;
      try {
        await recordAnswer(db, event);
      } catch (error) {
        console.error("Antwort nicht gespeichert", error);
        saved = false;
      }
      // Auch ohne gespeicherte Antwort geht die Sitzung weiter (TDD 12.4).
      state = next.state;
      if (state.queue.length === 0 && !ended) {
        finished = true;
        void close("completed");
      }
      return saved;
    },
    end() {
      if (current === practice) current = null;
      if (finished || ended) return;
      ended = true;
      void close("ended");
    },
  };
  current = practice;
}
