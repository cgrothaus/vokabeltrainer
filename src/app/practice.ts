// Ablauf einer Lernsitzung (TDD 12.2–12.5): Die Warteschlange liegt in domain/practice.ts, das
// Speichern in storage/sessions.ts. Hier werden beide verbunden. Die laufende Sitzung lebt nur im
// Arbeitsspeicher; nach einem Neuladen ist sie beendet, gespeicherte Antworten bleiben. „Nur Fehler
// üben“ startet eine neue Sitzung mit Verweis auf die vorige (D-29). „Jetzt wiederholen“ wählt die
// Karten nach Plan (TDD 12.8, D-63). Eine Sitzung kann mehrere Sets umfassen (12.10): je Set ein
// Datensatz mit gemeinsamer `groupId` (D-68), jede Antwort gehört zum Datensatz ihres Sets.
import { entryRev } from "../domain/hash";
import { createId, ID_LENGTH } from "../domain/ids";
import { dayNumber } from "../domain/learningState";
import { canSpell, letterPuzzle, type PatternPart } from "../domain/letters";
import { joinTitles } from "../domain/library";
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
import { planSelectionAcross } from "../domain/plan";
import {
  type EntryRef,
  type PracticeSetup,
  pickAcross,
  pickEntries,
  restoreSetup,
  restoreTogether,
  settingKey,
  storedSetup,
  TOGETHER_KEY,
  type TogetherSetup,
  togetherSetIds,
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
      readonly mode: "letters";
      /** `null` ist eine Stelle für eine Kachel, ein Text steht fest. */
      readonly pattern: readonly PatternPart[];
      readonly tiles: readonly string[];
    }
  | {
      readonly mode: "multipleChoice";
      readonly options: readonly string[];
      readonly correct: number;
    };

/** `setGone`: Das Set wurde inzwischen gelöscht, die Sitzung ist damit zu Ende (TDD 3.4). */
export type AnswerOutcome = { ok: true } | { ok: false; error: string; setGone?: true };

export interface PracticeSession {
  /** Titel des Sets, bei mehreren Sets ihre Aufzählung („A, B und C“). */
  readonly title: string;
  /** Für alle Sets der Sitzung gleich (TDD 12.10). */
  readonly termLanguage: string;
  readonly meaningLanguage: string;
  readonly state: PracticeState;
  /** Für die aktuelle Karte einmal ausgewählt; erneutes Zeichnen mischt nicht neu. */
  question(): Question;
  /** Alle Karten gewusst; die Sitzung ist als abgeschlossen gespeichert oder wird es gerade. */
  readonly finished: boolean;
  /** Eintrag zur Karte (`Card.entryId`; bei mehreren Sets ein Schlüssel aus Set und Eintrag). */
  entry(key: string): StoredEntry;
  /**
   * Speichert die Antwort und rückt danach vor, auch wenn das Speichern scheiterte (TDD 12.4).
   * `responseMs` aus `responseTime`; ohne Wert fehlt die Angabe in der Antwort.
   */
  answer(result: Result, responseMs?: number): Promise<AnswerOutcome>;
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

/** Ein Eintrag der Sitzung mit seinem Set und seinem Inhaltsstand. */
interface Item {
  readonly entry: StoredEntry;
  readonly setId: string;
  readonly rev: string;
}

/** Was alle Sitzungen aus derselben Einrichtung teilen; der Inhalt ändert sich währenddessen nicht. */
interface Material {
  /** Alle gewählten Sets, auch solche ohne Karte in dieser Sitzung (Kandidaten, TDD 12.3). */
  readonly sets: readonly StoredSet[];
  /** Je Karte (`Card.entryId`). */
  readonly items: ReadonlyMap<string, Item>;
  /** Kandidaten für falsche Antworten: erst die Sektionen der Sitzung, dann das Übrige der Sets. */
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
 * „Jetzt wiederholen“ bzw. „Neue Vokabeln lernen“ (TDD 12.8): Auswahl und Abfrageform nach Plan
 * (D-66); die gemerkte Einrichtung wirkt hier nicht und bleibt unverändert. `false`, wenn weder etwas
 * fällig noch etwas neu ist.
 */
export function beginPlanned(db: IDBDatabase, set: StoredSet): Promise<boolean> {
  return beginPlannedAcross(db, [set]);
}

/** Die gemerkte Zusammenstellung für die Sets eines Sprachpaars, tolerant gelesen (TDD 12.10). */
export async function rememberedTogether(
  db: IDBDatabase,
  candidates: readonly StoredSet[],
): Promise<TogetherSetup> {
  return restoreTogether(candidates, await getSetting(db, TOGETHER_KEY));
}

/**
 * Zusammen lernen nach Plan (TDD 12.8, 12.10): das Fällige aller Sets zusammen, sonst neue Vokabeln.
 * Merkt die Sets als Zusammenstellung; Richtung, Anzahl und Anteil der freien Auswahl bleiben, wie
 * sie gemerkt sind. `false`, wenn nichts zu tun ist.
 */
export async function beginPlannedTogether(
  db: IDBDatabase,
  sets: readonly StoredSet[],
): Promise<boolean> {
  const stored = await getSetting(db, TOGETHER_KEY);
  const kept = typeof stored === "object" && stored !== null ? stored : {};
  const value = { ...kept, setIds: sets.map((set) => set.id) };
  return beginPlannedAcross(db, sets, { key: TOGETHER_KEY, value });
}

/**
 * Empfohlener Einstieg für mehrere Sets („Weiterlernen“ nach einer gemeinsamen Sitzung): Plan, sonst
 * die gemerkte freie Auswahl, ohne sie `"setup"`.
 */
export async function recommendedTogether(
  db: IDBDatabase,
  sets: readonly StoredSet[],
): Promise<"started" | "setup"> {
  if (await beginPlannedTogether(db, sets)) return "started";
  const stored = await getSetting(db, TOGETHER_KEY);
  if (togetherSetIds(stored).length === 0) return "setup";
  const setup = restoreTogether(sets, stored);
  await beginTogether(db, sets, { ...setup, setIds: sets.map((set) => set.id) });
  return "started";
}

async function beginPlannedAcross(
  db: IDBDatabase,
  sets: readonly StoredSet[],
  remember?: { key: string; value: unknown },
): Promise<boolean> {
  const parts = await Promise.all(
    sets.map(async (set) => ({ set, cards: (await loadOverview(db, set)).cards })),
  );
  const selection = planSelectionAcross(parts, dayNumber(new Date()));
  if (selection.kind === null) return false;
  // Sektionen je Set: die mit gewählten Einträgen.
  const sectionIds = new Map(
    sets.map((set) => {
      const chosen = new Set(
        selection.cards.filter((card) => card.setId === set.id).map((card) => card.entryId),
      );
      const ids = set.sections
        .filter((section) => section.entries.some((entry) => chosen.has(entry.id)))
        .map((section) => section.id);
      return [set.id, ids];
    }),
  );
  const material = gather(sets, selection.cards, sectionIds);
  const state = startPlannedPractice(
    selection.cards.map((card) => ({ ...card, entryId: keyOf(sets, card) })),
    { canChoose: canChoose(material), canSpell: spellable(material) },
    Math.random,
  );
  const choices = state.queue.filter((card) => card.mode === "multipleChoice").length;
  const records = sessionRecords(material, sectionIds, {
    // Der Anteil ist der tatsächliche (TDD 12.8).
    config: {
      direction: "mixed",
      count: state.total,
      mcShare: Math.round((choices * 100) / state.total),
    },
    origin: "plan",
  });
  await startSession(db, records, remember);
  current = run(db, material, records, state);
  return true;
}

/**
 * Bei mehreren Sets ist die Karte ein Schlüssel aus Set und Eintrag: Eintrags-IDs sind nur innerhalb
 * eines Sets eindeutig. Bei einem Set bleibt es die Eintrags-ID.
 */
const keyOf = (sets: readonly StoredSet[], ref: EntryRef) =>
  sets.length > 1 ? `${ref.setId}/${ref.entryId}` : ref.entryId;

/** Einträge der Sitzung und Kandidaten für falsche Antworten (TDD 12.3) aus allen gewählten Sets. */
function gather(
  sets: readonly StoredSet[],
  chosen: readonly EntryRef[],
  sectionIds: ReadonlyMap<string, readonly string[]>,
): Material {
  const byId = new Map(
    sets.map((set) => [
      set.id,
      new Map(set.sections.flatMap((section) => section.entries).map((e) => [e.id, e])),
    ]),
  );
  // Einmal pro Eintrag: Der Inhalt ändert sich während der Sitzung nicht.
  const items = new Map(
    chosen.map((ref) => {
      const entry = byId.get(ref.setId)!.get(ref.entryId)!;
      return [keyOf(sets, ref), { entry, setId: ref.setId, rev: entryRev(entry) }];
    }),
  );
  // Falsche Antworten bevorzugt aus den Sektionen der Sitzung, dann aus dem Übrigen der Sets.
  const preferred: StoredEntry[] = [];
  const rest: StoredEntry[] = [];
  for (const set of sets) {
    const inSession = new Set(sectionIds.get(set.id) ?? []);
    for (const section of set.sections)
      (inSession.has(section.id) ? preferred : rest).push(...section.entries);
  }
  return { sets, items, preferred, rest };
}

const canChoose = ({ items, preferred, rest }: Material) => {
  const everything = [...preferred, ...rest];
  return (key: string, direction: Direction) =>
    hasChoices(items.get(key)!.entry, direction, everything);
};

const spellable =
  ({ items }: Material) =>
  (key: string, direction: Direction) =>
    canSpell(items.get(key)!.entry, direction);

/**
 * Je Set mit Karten ein Datensatz, alle mit demselben Beginn; bei mehreren eine gemeinsame `groupId`
 * (TDD 12.5, D-68). `config` gilt für die ganze Sitzung.
 */
function sessionRecords(
  material: Material,
  sectionIds: ReadonlyMap<string, readonly string[]>,
  shared: Pick<Session, "config" | "origin">,
): Session[] {
  const used = new Set([...material.items.values()].map((item) => item.setId));
  const sets = material.sets.filter((set) => used.has(set.id));
  const groupId = sets.length > 1 ? createId(ID_LENGTH.session, randomBytes) : undefined;
  const startedAt = new Date().toISOString();
  return sets.map((set) => ({
    id: createId(ID_LENGTH.session, randomBytes),
    setId: set.id,
    sectionIds: [...(sectionIds.get(set.id) ?? [])],
    startedAt,
    status: "active",
    ...shared,
    ...(groupId === undefined ? {} : { groupId }),
  }));
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
  const chosen = pickEntries(set, setup, Math.random).map((entryId) => ({
    setId: set.id,
    entryId,
  }));
  const remember = { key: settingKey(set.id), value: storedSetup(set, setup) };
  await beginChosen(db, [set], chosen, new Map([[set.id, setup.sectionIds]]), setup, remember);
}

/**
 * Freie Auswahl über mehrere Sets (TDD 12.10): alle Sektionen der gewählten Sets; merkt die
 * Zusammenstellung samt Einrichtung in derselben Transaktion.
 */
export async function beginTogether(
  db: IDBDatabase,
  candidates: readonly StoredSet[],
  setup: TogetherSetup,
): Promise<void> {
  const sets = candidates.filter((set) => setup.setIds.includes(set.id));
  const chosen = pickAcross(sets, setup, Math.random);
  const sectionIds = new Map(sets.map((set) => [set.id, set.sections.map((s) => s.id)]));
  const value = { ...setup, setIds: [...setup.setIds] };
  await beginChosen(db, sets, chosen, sectionIds, setup, { key: TOGETHER_KEY, value });
}

async function beginChosen(
  db: IDBDatabase,
  sets: readonly StoredSet[],
  chosen: readonly EntryRef[],
  sectionIds: ReadonlyMap<string, readonly string[]>,
  setup: Pick<PracticeSetup, "direction" | "mcShare" | "letters">,
  remember: { key: string; value: unknown },
): Promise<void> {
  const material = gather(sets, chosen, sectionIds);
  const state = startPractice(
    [...material.items.keys()],
    {
      direction: setup.direction,
      mcShare: setup.mcShare,
      canChoose: canChoose(material),
      letters: setup.letters,
      canSpell: spellable(material),
    },
    Math.random,
  );
  const records = sessionRecords(material, sectionIds, {
    config: { direction: setup.direction, count: state.total, mcShare: setup.mcShare },
    origin: "setup",
  });
  await startSession(db, records, remember);
  current = run(db, material, records, state);
}

function run(
  db: IDBDatabase,
  material: Material,
  records: readonly Session[],
  initial: PracticeState,
): PracticeSession {
  const { items, preferred, rest } = material;
  const sessionOf = new Map(records.map((record) => [record.setId, record]));
  const sets = material.sets.filter((set) => sessionOf.has(set.id));
  let state = initial;
  let finished = false;
  let unsaved = 0;
  let ended = false;
  let asked: { state: PracticeState; question: Question } | null = null;
  const question = (): Question => {
    if (asked?.state !== state) {
      const card = currentCard(state)!;
      const { entry } = items.get(card.entryId)!;
      const choice =
        card.mode === "multipleChoice"
          ? multipleChoice(entry, card.direction, preferred, rest, Math.random)
          : null;
      // Zusätzliche Buchstaben aus den Wörtern der Sitzung und ihrer Sets (TDD 12.3).
      const puzzle =
        card.mode === "letters" ? letterPuzzle(entry, [...preferred, ...rest], Math.random) : null;
      // Ohne genug falsche Antworten bzw. bei ungeeigneter Länge als Karteikarte; beim Start geprüft,
      // also nur zur Sicherheit.
      asked = {
        state,
        question: choice
          ? { mode: "multipleChoice", ...choice }
          : puzzle
            ? { mode: "letters", ...puzzle }
            : { mode: "flashcard" },
      };
    }
    return asked.question;
  };
  const ids = records.map((record) => record.id);
  const close = (status: "completed" | "ended") =>
    finishSession(db, ids, status, new Date().toISOString()).catch((error: unknown) => {
      // Mit den Sets gelöscht: Es gibt nichts mehr abzuschließen.
      if (isSetMissing(error)) return;
      // Beim nächsten Start wird die Sitzung als unterbrochen vermerkt.
      console.warn("Ende der Sitzung nicht gespeichert", error);
      reportStorageProblem(error, "Das Ende der Lernsitzung wurde nicht gespeichert.");
    });

  const practice: PracticeSession = {
    title: joinTitles(sets),
    termLanguage: sets[0]!.termLanguage,
    meaningLanguage: sets[0]!.meaningLanguage,
    get state() {
      return state;
    },
    get finished() {
      return finished;
    },
    get unsaved() {
      return unsaved;
    },
    entry: (key) => items.get(key)!.entry,
    question,
    async answer(result, responseMs) {
      const { mode } = question();
      const next = answer(state, result);
      const item = items.get(next.recorded.entryId)!;
      const event: ReviewEvent = {
        id: createId(ID_LENGTH.reviewEvent, randomBytes),
        sessionId: sessionOf.get(item.setId)!.id,
        setId: item.setId,
        entryId: item.entry.id,
        entryRev: item.rev,
        occurredAt: new Date().toISOString(),
        direction: next.recorded.direction,
        mode,
        result,
        firstAttempt: next.recorded.firstAttempt,
        // Ohne Messung fehlt das Feld ganz, statt als `undefined` gespeichert zu werden.
        ...(responseMs === undefined ? {} : { responseMs }),
      };
      let outcome: AnswerOutcome = { ok: true };
      try {
        await recordAnswer(db, event);
        forgetOverview(item.setId);
      } catch (error) {
        if (isSetMissing(error)) {
          // Ohne Set gibt es nichts weiter zu speichern; die ganze Sitzung endet (TDD 12.10). Die
          // Datensätze der übrigen Sets werden geschlossen, der des gelöschten übergangen.
          ended = true;
          if (current === practice) current = null;
          if (records.length > 1) void close("ended");
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
      // Nur die Sets mit Fehlern; je Datensatz der Verweis auf den desselben Sets (D-29).
      const withMistakes = new Set(state.missed.map((card) => items.get(card.entryId)!.setId));
      const before = records.filter((record) => withMistakes.has(record.setId));
      const groupId = before.length > 1 ? createId(ID_LENGTH.session, randomBytes) : undefined;
      const startedAt = new Date().toISOString();
      const next = before.map((record): Session => ({
        id: createId(ID_LENGTH.session, randomBytes),
        setId: record.setId,
        sectionIds: record.sectionIds,
        startedAt,
        status: "active",
        config: { ...record.config, count: repeat.total },
        repeatOf: record.id,
        // Die Herkunft der Ausgangssitzung; dass es eine Wiederholung ist, sagt `repeatOf`.
        origin: record.origin,
        ...(groupId === undefined ? {} : { groupId }),
      }));
      // Ohne gemerkte Einrichtung: Sie gehört zur Auswahl, nicht zu den Fehlern.
      await startSession(db, next);
      practice.end();
      current = run(db, material, next, repeat);
      return current;
    },
  };
  return practice;
}
