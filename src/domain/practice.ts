// Ablauf einer Lernsitzung (TDD 12.2, 12.3), übernommen aus dem Prototyp: gemischte Warteschlange,
// falsche Karten kommen nach drei anderen wieder. Der Zustand liegt nur im Arbeitsspeicher.
import type { Direction, StoredEntry } from "./model";

export interface Card {
  readonly entryId: string;
  readonly direction: Direction;
  /** Nur die erste Antwort zu einem Eintrag in der Sitzung zählt als Erstversuch. */
  readonly firstAttempt: boolean;
}

export interface PracticeState {
  readonly queue: readonly Card[];
  /** Zahl der Einträge der Sitzung. */
  readonly total: number;
  /** Gewusste Einträge. */
  readonly done: number;
  readonly firstAttempts: number;
  readonly firstCorrect: number;
}

export type Result = "correct" | "incorrect";

export interface RecordedAnswer extends Card {
  readonly result: Result;
}

/** Falsch beantwortete Karten werden an Position 4 wieder eingefügt (Index 3). */
const REINSERT_AT = 3;

/** `random` liefert Werte in `[0, 1)`, z. B. `Math.random`; Tests übergeben eine feste Folge. */
export function startPractice(
  entryIds: readonly string[],
  direction: Direction | "mixed",
  random: () => number,
): PracticeState {
  const order = [...entryIds];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  const queue = order.map((entryId): Card => ({
    entryId,
    direction:
      direction === "mixed" ? (random() < 0.5 ? "termToMeaning" : "meaningToTerm") : direction,
    firstAttempt: true,
  }));
  return { queue, total: queue.length, done: 0, firstAttempts: 0, firstCorrect: 0 };
}

export function currentCard(state: PracticeState): Card | undefined {
  return state.queue[0];
}

export function answer(
  state: PracticeState,
  result: Result,
): { state: PracticeState; recorded: RecordedAnswer } {
  const [card, ...rest] = state.queue;
  if (!card) throw new Error("Die Sitzung hat keine Karte mehr");
  const queue =
    result === "correct"
      ? rest
      : rest.toSpliced(Math.min(REINSERT_AT, rest.length), 0, { ...card, firstAttempt: false });
  return {
    state: {
      queue,
      total: state.total,
      done: state.done + (result === "correct" ? 1 : 0),
      firstAttempts: state.firstAttempts + (card.firstAttempt ? 1 : 0),
      firstCorrect: state.firstCorrect + (card.firstAttempt && result === "correct" ? 1 : 0),
    },
    recorded: { ...card, result },
  };
}

/** Eine Bedeutungsseite verbindet alle Bedeutungen mit „; “ (TDD 12.3). */
export function cardFaces(
  entry: StoredEntry,
  direction: Direction,
): { prompt: string; answer: string } {
  const term = entry.term.text;
  const meanings = entry.meanings.map((meaning) => meaning.text).join("; ");
  return direction === "termToMeaning"
    ? { prompt: term, answer: meanings }
    : { prompt: meanings, answer: term };
}
