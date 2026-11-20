// Ablauf einer Lernsitzung (TDD 12.2–12.5): Die Warteschlange liegt in domain/practice.ts, das
// Speichern in storage/sessions.ts. Hier werden beide verbunden. Die laufende Sitzung lebt nur im
// Arbeitsspeicher; nach einem Neuladen ist sie beendet, gespeicherte Antworten bleiben. „Nur Fehler
// üben“ startet eine neue Sitzung mit Verweis auf die vorige (D-29). „Jetzt wiederholen“ wählt die
// Karten nach Plan (TDD 12.8, D-63).
import { entryRev } from "../domain/hash";
import { createId, ID_LENGTH } from "../domain/ids";
import { dayNumber } from "../domain/learningState";
import type { Direction, ReviewEvent, Session, StoredEntry, StoredSet } from "../domain/model";
import {
  answer,
  currentCard,
  hasChoices,
  multipleChoice,
  type PracticeState,
  repeatMistakes,
  type Result,
  startPlannedPractice,
  startPractice,
} from "../domain/practice";
import { planSelection } from "../domain/plan";
import {
  DEFAULT_MC_SHARE,
  type PracticeSetup,
  pickEntries,
  restoreSetup,
  settingKey,
  storedSetup,
} from "../domain/practiceSetup";
import { randomBytes } from "../platform/random";
import { isSetMissing } from "../storage/errors";
import { finishSession, recordAnswer, startSession } from "../storage/sessions";
import { getSetting } from "../storage/settings";
import { reportStorageProblem } from "./components/storageNotice";
import { forgetOverview, loadOverview } from "./overview";
import { failureMessage, SET_MISSING } from "./storageMessages";

/** Wie die aktuelle Karte gestellt wird (TDD 12.3). */
export type Question =
  | { readonly mode: "flashcard" }
  | {
      readonly mode: "multipleChoice";
      readonly options: readonly string[];
      readonly correct: number;
    };

/** `setGone`: Das Set wurde inzwischen gelöscht, die Sitzung ist damit zu Ende (TDD 3.4). */
export type AnswerOutcome = { ok: true } | { ok: false; error: string; setGone?: true };

export interface PracticeSession {
  readonly set: StoredSet;
  readonly state: PracticeState;
  /** Für die aktuelle Karte einmal ausgewählt; erneutes Zeichnen mischt nicht neu. */
  question(): Question;
  /** Alle Karten gewusst; die Sitzung ist als abgeschlossen gespeichert oder wird es gerade. */
  readonly finished: boolean;
  entry(id: string): StoredEntry;
  /** Speichert die Antwort und rückt danach vor, auch wenn das Speichern scheiterte (TDD 12.4). */
  answer(result: Result): Promise<AnswerOutcome>;
  /** Antworten, die nicht gespeichert wurden; sie fehlen im Lernstand (D-32). */
  readonly unsaved: number;
  /** Vorzeitiges Ende, z. B. beim Verlassen der Ansicht. */
  end(): void;
  /**
   * „Nur Fehler üben“: legt eine neue Sitzung mit den Fehlern an und beendet danach diese, falls sie
   * noch läuft. Scheitert das Speichern, bleibt diese Sitzung bestehen.
   */
  repeatMistakes(): Promise<PracticeSession>;
}

/** Was alle Sitzungen aus derselben Einrichtung teilen; der Inhalt ändert sich währenddessen nicht. */
interface Material {
  readonly set: StoredSet;
  readonly entries: ReadonlyMap<string, StoredEntry>;
  readonly revs: ReadonlyMap<string, string>;
  /** Kandidaten für falsche Antworten: erst die Sektionen der Sitzung, dann das übrige Set. */
  readonly preferred: readonly StoredEntry[];
  readonly rest: readonly StoredEntry[];
}

const CONTINUE = "Du kannst trotzdem weiterlernen.";

let current: PracticeSession | null = null;

export function currentPractice(): PracticeSession | null {
  return current;
}

/** Die gemerkte Einrichtung, tolerant gelesen; `null`, wenn das Set noch keine hat (TDD 12.1). */
export async function rememberedSetup(
  db: IDBDatabase,
  set: StoredSet,
): Promise<PracticeSetup | null> {
  const stored = await getSetting(db, settingKey(set.id));
  return stored === undefined ? null : restoreSetup(set, stored);
}

/**
 * Lernen-Knopf der Bibliothek und „Weiterlernen“ (TDD 12.1, D-50): mit gemerkter Einrichtung sofort
 * starten, sonst zur Einrichtung. Scheitert Lesen oder Speichern, lehnt das Versprechen ab.
 */
export async function quickStart(db: IDBDatabase, set: StoredSet): Promise<"started" | "setup"> {
  const setup = await rememberedSetup(db, set);
  if (!setup) return "setup";
  await beginPractice(db, set, setup);
  return "started";
}

/**
 * Empfohlener Einstieg für den Lernen-Knopf der Bibliothek und „Weiterlernen“ (TDD 12.1, 12.8, D-63):
 * Fälliges wiederholen, sonst neue Vokabeln, sonst der Schnellstart.
 */
export async function recommendedStart(
  db: IDBDatabase,
  set: StoredSet,
): Promise<"started" | "setup"> {
  if (await beginPlanned(db, set)) return "started";
  return quickStart(db, set);
}

/**
 * „Jetzt wiederholen“ bzw. „Neue Vokabeln lernen“ (TDD 12.8): Auswahl nach Plan, Anteil an Multiple
 * Choice aus der gemerkten Einrichtung (bis S-51). Die Einrichtung bleibt unverändert. `false`, wenn
 * weder etwas fällig noch etwas neu ist.
 */
export async function beginPlanned(db: IDBDatabase, set: StoredSet): Promise<boolean> {
  const stats = await loadOverview(db, set);
  const selection = planSelection(set, stats.cards, dayNumber(new Date()));
  if (selection.kind === null) return false;
  const remembered = await rememberedSetup(db, set);
  const chosen = new Set(selection.cards.map((card) => card.entryId));
  const sectionIds = set.sections
    .filter((section) => section.entries.some((entry) => chosen.has(entry.id)))
    .map((section) => section.id);
  const material = gather(set, chosen, sectionIds);
  const state = startPlannedPractice(
    selection.cards,
    {
      mcShare: remembered?.mcShare ?? DEFAULT_MC_SHARE,
      canChoose: canChoose(material),
    },
    Math.random,
  );
  const choices = state.queue.filter((card) => card.mode === "multipleChoice").length;
  const session: Session = {
    id: createId(ID_LENGTH.session, randomBytes),
    setId: set.id,
    sectionIds,
    startedAt: new Date().toISOString(),
    status: "active",
    // Bis S-53 eine gewöhnliche Sitzung; der Anteil ist der tatsächliche (TDD 12.8).
    config: {
      direction: "mixed",
      count: state.total,
      mcShare: Math.round((choices * 100) / state.total),
    },
  };
  await startSession(db, session);
  current = run(db, material, session, state);
  return true;
}

/** Einträge der Sitzung und Kandidaten für falsche Antworten (TDD 12.3). */
function gather(
  set: StoredSet,
  chosen: ReadonlySet<string>,
  sectionIds: readonly string[],
): Material {
  const entries = new Map(
    set.sections
      .flatMap((section) => section.entries)
      .filter((entry) => chosen.has(entry.id))
      .map((entry) => [entry.id, entry]),
  );
  // Falsche Antworten bevorzugt aus den Sektionen der Sitzung, dann aus dem übrigen Set.
  const inSession = new Set(sectionIds);
  const preferred = set.sections.filter((s) => inSession.has(s.id)).flatMap((s) => s.entries);
  const rest = set.sections.filter((s) => !inSession.has(s.id)).flatMap((s) => s.entries);
  // Einmal pro Eintrag: Der Inhalt ändert sich während der Sitzung nicht.
  const revs = new Map([...entries].map(([id, entry]) => [id, entryRev(entry)]));
  return { set, entries, revs, preferred, rest };
}

const canChoose = ({ entries, preferred, rest }: Material) => {
  const everything = [...preferred, ...rest];
  return (id: string, direction: Direction) => hasChoices(entries.get(id)!, direction, everything);
};

/**
 * Legt die Sitzung an und merkt die Einrichtung in derselben Transaktion; scheitert das Speichern,
 * gibt es keine Sitzung.
 */
export async function beginPractice(
  db: IDBDatabase,
  set: StoredSet,
  setup: PracticeSetup,
): Promise<void> {
  const material = gather(set, new Set(pickEntries(set, setup, Math.random)), setup.sectionIds);
  const state = startPractice(
    [...material.entries.keys()],
    { direction: setup.direction, mcShare: setup.mcShare, canChoose: canChoose(material) },
    Math.random,
  );
  const session: Session = {
    id: createId(ID_LENGTH.session, randomBytes),
    setId: set.id,
    sectionIds: [...setup.sectionIds],
    startedAt: new Date().toISOString(),
    status: "active",
    config: { direction: setup.direction, count: state.total, mcShare: setup.mcShare },
  };
  await startSession(db, session, { key: settingKey(set.id), value: storedSetup(set, setup) });
  current = run(db, material, session, state);
}

function run(
  db: IDBDatabase,
  material: Material,
  session: Session,
  initial: PracticeState,
): PracticeSession {
  const { set, entries, revs, preferred, rest } = material;
  let state = initial;
  let finished = false;
  let unsaved = 0;
  let ended = false;
  let asked: { state: PracticeState; question: Question } | null = null;
  const question = (): Question => {
    if (asked?.state !== state) {
      const card = currentCard(state)!;
      const choice =
        card.mode === "multipleChoice"
          ? multipleChoice(entries.get(card.entryId)!, card.direction, preferred, rest, Math.random)
          : null;
      // Ohne genug falsche Antworten als Karteikarte; beim Start geprüft, also nur zur Sicherheit.
      asked = {
        state,
        question: choice ? { mode: "multipleChoice", ...choice } : { mode: "flashcard" },
      };
    }
    return asked.question;
  };
  const close = (status: "completed" | "ended") =>
    finishSession(db, session.id, status, new Date().toISOString()).catch((error: unknown) => {
      // Mit dem Set gelöscht: Es gibt nichts mehr abzuschließen.
      if (isSetMissing(error)) return;
      // Beim nächsten Start wird die Sitzung als unterbrochen vermerkt.
      console.warn("Ende der Sitzung nicht gespeichert", error);
      reportStorageProblem(error, "Das Ende der Lernsitzung wurde nicht gespeichert.");
    });

  const practice: PracticeSession = {
    set,
    get state() {
      return state;
    },
    get finished() {
      return finished;
    },
    get unsaved() {
      return unsaved;
    },
    entry: (id) => entries.get(id)!,
    question,
    async answer(result) {
      const { mode } = question();
      const next = answer(state, result);
      const event: ReviewEvent = {
        id: createId(ID_LENGTH.reviewEvent, randomBytes),
        sessionId: session.id,
        setId: set.id,
        entryId: next.recorded.entryId,
        entryRev: revs.get(next.recorded.entryId)!,
        occurredAt: new Date().toISOString(),
        direction: next.recorded.direction,
        mode,
        result,
        firstAttempt: next.recorded.firstAttempt,
      };
      let outcome: AnswerOutcome = { ok: true };
      try {
        await recordAnswer(db, event);
        forgetOverview(set.id);
      } catch (error) {
        if (isSetMissing(error)) {
          // Ohne Set gibt es nichts weiter zu speichern; auch das Ende der Sitzung nicht.
          ended = true;
          if (current === practice) current = null;
          return { ok: false, error: `${SET_MISSING} Die Lernsitzung ist beendet.`, setGone: true };
        }
        console.error("Antwort nicht gespeichert", error);
        unsaved++;
        const consequence = "Die Antwort wurde nicht gespeichert.";
        outcome = { ok: false, error: failureMessage(error, consequence, CONTINUE) };
      }
      // Auch ohne gespeicherte Antwort geht die Sitzung weiter (TDD 12.4).
      state = next.state;
      if (state.queue.length === 0 && !ended) {
        finished = true;
        void close("completed");
      }
      return outcome;
    },
    end() {
      if (current === practice) current = null;
      if (finished || ended) return;
      ended = true;
      void close("ended");
    },
    async repeatMistakes() {
      const repeat = repeatMistakes(state.missed, Math.random);
      const next: Session = {
        id: createId(ID_LENGTH.session, randomBytes),
        setId: set.id,
        sectionIds: session.sectionIds,
        startedAt: new Date().toISOString(),
        status: "active",
        config: { ...session.config, count: repeat.total },
        repeatOf: session.id,
      };
      // Ohne gemerkte Einrichtung: Sie gehört zur Auswahl, nicht zu den Fehlern.
      await startSession(db, next);
      practice.end();
      current = run(db, material, next, repeat);
      return current;
    },
  };
  return practice;
}
