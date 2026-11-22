// Ablauf einer Lernsitzung (TDD 12.2, 12.3), übernommen aus dem Prototyp: gemischte Warteschlange,
// falsche Karten kommen erst nach sechs anderen wieder und müssen danach zweimal gewusst werden
// (FR-10, D-60), „Nur Fehler üben“ stellt die Fehler erneut (D-29). Der Zustand liegt nur im
// Arbeitsspeicher. Dazu die Auswahl plausibler Antworten für Multiple Choice (D-18, FR-09).
import type { Direction, StoredEntry } from "./model";

export type Mode = "flashcard" | "multipleChoice";

export interface Card {
  readonly entryId: string;
  readonly direction: Direction;
  /** Beim Start festgelegt; eine falsch beantwortete Karte kommt in derselben Form wieder (D-28). */
  readonly mode: Mode;
  /** Nur die erste Antwort zu einem Eintrag in der Sitzung zählt als Erstversuch. */
  readonly firstAttempt: boolean;
  /** Wie oft die Karte noch gewusst werden muss; ohne Angabe einmal, nach einem Fehler zweimal. */
  readonly needed?: number;
}

export interface PracticeState {
  readonly queue: readonly Card[];
  /** Zahl der Einträge der Sitzung. */
  readonly total: number;
  /** Gewusste Einträge. */
  readonly done: number;
  readonly firstAttempts: number;
  readonly firstCorrect: number;
  /** Beim Erstversuch falsche Karten in der Reihenfolge der Antworten, so wie sie gestellt wurden. */
  readonly missed: readonly Card[];
}

export type Result = "correct" | "incorrect";

export interface RecordedAnswer extends Card {
  readonly result: Result;
}

/** Mindestens so viele andere Karten liegen vor einer falschen oder erst einmal bestätigten Karte. */
export const RETRY_GAP = 6;
/** So oft muss eine Karte nach einem Fehler gewusst werden. */
export const CONFIRMATIONS = 2;

/** Obergrenze der gespeicherten Antwortdauer (TDD 12.4, D-68); länger heißt meist: kurz weggegangen. */
export const MAX_RESPONSE_MS = 60_000;

/**
 * Antwortdauer in ganzen Millisekunden zwischen zwei Zeitpunkten derselben Uhr, höchstens
 * `MAX_RESPONSE_MS`. Ohne Wert, wenn die Messung unterbrochen war (Tab verborgen, Zwischenstand) oder
 * die Zeitpunkte nicht passen.
 */
export function responseTime(
  startedAt: number,
  answeredAt: number,
  interrupted: boolean,
): number | undefined {
  const ms = Math.round(answeredAt - startedAt);
  if (interrupted || !(ms >= 0)) return undefined;
  return Math.min(ms, MAX_RESPONSE_MS);
}

/** Fisher-Yates; `random` liefert Werte in `[0, 1)`, z. B. `Math.random`. Die Eingabe bleibt unverändert. */
export function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const order = [...items];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  return order;
}

export interface PracticeOptions {
  readonly direction: Direction | "mixed";
  /** Anteil an Multiple Choice in Prozent; ohne Angabe nur Karteikarten. */
  readonly mcShare?: number;
  /** Ob der Eintrag in dieser Richtung genug Antwortmöglichkeiten hat; ohne Angabe immer. */
  readonly canChoose?: (entryId: string, direction: Direction) => boolean;
}

/** `random` liefert Werte in `[0, 1)`, z. B. `Math.random`; Tests übergeben eine feste Folge. */
export function startPractice(
  entryIds: readonly string[],
  options: PracticeOptions,
  random: () => number,
): PracticeState {
  const { direction, mcShare = 0, canChoose = () => true } = options;
  const cards = shuffle(entryIds, random).map((entryId) => ({
    entryId,
    direction:
      direction === "mixed"
        ? random() < 0.5
          ? ("termToMeaning" as const)
          : ("meaningToTerm" as const)
        : direction,
  }));
  return fresh(withModes(cards, mcShare, canChoose, random));
}

/** Eine Karte mit fester Richtung, z. B. aus dem Plan (TDD 12.8). */
export interface PlannedCard {
  readonly entryId: string;
  readonly direction: Direction;
  /** Gewünschte Form; ohne Angabe Karteikarte. */
  readonly mode?: Mode;
}

/**
 * Sitzung nach Plan (TDD 12.8, D-63, D-66): Richtung und Form kommen von jeder Karte; Multiple Choice
 * nur mit genug Kandidaten, sonst Karteikarte (D-28). Einen Anteil gibt es hier nicht.
 */
export function startPlannedPractice(
  cards: readonly PlannedCard[],
  options: Pick<PracticeOptions, "canChoose">,
  random: () => number,
): PracticeState {
  const { canChoose = () => true } = options;
  return fresh(
    shuffle(cards, random).map(({ entryId, direction, mode }): Card => ({
      entryId,
      direction,
      mode: mode === "multipleChoice" && canChoose(entryId, direction) ? mode : "flashcard",
      firstAttempt: true,
    })),
  );
}

/** Feste Quote (D-28): genau so viele geeignete Karten wie der Anteil ergibt, zufällig gewählt. */
function withModes(
  cards: readonly PlannedCard[],
  mcShare: number,
  canChoose: (entryId: string, direction: Direction) => boolean,
  random: () => number,
): Card[] {
  const quota = Math.round((cards.length * mcShare) / 100);
  // Nur so viele Karten prüfen, bis die Quote voll ist: Die Prüfung durchsucht das Set.
  const chosen = new Set<PlannedCard>();
  if (quota > 0) {
    for (const card of shuffle(cards, random)) {
      if (chosen.size === quota) break;
      if (canChoose(card.entryId, card.direction)) chosen.add(card);
    }
  }
  return cards.map((card): Card => ({
    ...card,
    mode: chosen.has(card) ? "multipleChoice" : "flashcard",
    firstAttempt: true,
  }));
}

const fresh = (queue: readonly Card[]): PracticeState => ({
  queue,
  total: queue.length,
  done: 0,
  firstAttempts: 0,
  firstCorrect: 0,
  missed: [],
});

/** „Nur Fehler üben“ (D-29): jede Karte in Richtung und Form wie beim Fehler, neu gemischt. */
export function repeatMistakes(missed: readonly Card[], random: () => number): PracticeState {
  return fresh(
    shuffle(missed, random).map(({ needed: _, ...card }) => ({ ...card, firstAttempt: true })),
  );
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
  // Ein Fehler verlangt wieder zwei richtige Antworten; jede kommt erst nach `RETRY_GAP` anderen Karten.
  const needed = result === "correct" ? (card.needed ?? 1) - 1 : CONFIRMATIONS;
  const queue =
    needed === 0
      ? rest
      : rest.toSpliced(Math.min(RETRY_GAP, rest.length), 0, {
          ...card,
          firstAttempt: false,
          needed,
        });
  return {
    state: {
      queue,
      total: state.total,
      done: state.done + (needed === 0 ? 1 : 0),
      firstAttempts: state.firstAttempts + (card.firstAttempt ? 1 : 0),
      firstCorrect: state.firstCorrect + (card.firstAttempt && result === "correct" ? 1 : 0),
      missed: card.firstAttempt && result === "incorrect" ? [...state.missed, card] : state.missed,
    },
    recorded: { ...card, result },
  };
}

export type Side = "term" | "meanings";

/** Eine Bedeutungsseite verbindet alle Bedeutungen mit „; “ (TDD 12.3). */
export function sideText(entry: StoredEntry, side: Side): string {
  return side === "term"
    ? entry.term.text
    : entry.meanings.map((meaning) => meaning.text).join("; ");
}

const answerSide = (direction: Direction): Side =>
  direction === "termToMeaning" ? "meanings" : "term";

export function cardFaces(
  entry: StoredEntry,
  direction: Direction,
): { prompt: string; answer: string } {
  const answer = answerSide(direction);
  return {
    prompt: sideText(entry, answer === "term" ? "meanings" : "term"),
    answer: sideText(entry, answer),
  };
}

/** Für Vergleiche: getrimmt, kleingeschrieben, NFC. */
const comparable = (text: string) => text.normalize("NFC").trim().toLowerCase();

/** Alle `text`- und `acceptedVariants`-Werte der Seite, vergleichbar gemacht. */
function acceptedAnswers(entry: StoredEntry, side: Side): Set<string> {
  const answers = side === "term" ? [entry.term] : entry.meanings;
  return new Set(
    answers.flatMap((answer) => [answer.text, ...(answer.acceptedVariants ?? [])]).map(comparable),
  );
}

/** Kandidaten in der gegebenen Reihenfolge, die nach TDD 12.3 als falsche Antwort taugen. */
function* candidates(
  entry: StoredEntry,
  direction: Direction,
  pool: Iterable<StoredEntry>,
): Generator<StoredEntry> {
  const side = answerSide(direction);
  const correct = acceptedAnswers(entry, side);
  const shown = new Set<string>();
  for (const candidate of pool) {
    if (candidate.id === entry.id) continue;
    if ([...acceptedAnswers(candidate, side)].some((answer) => correct.has(answer))) continue;
    const display = comparable(sideText(candidate, side));
    if (shown.has(display)) continue;
    shown.add(display);
    yield candidate;
  }
}

const partOfSpeech = (entry: StoredEntry) =>
  entry.grammar?.partOfSpeech?.trim().toLowerCase() || undefined;

/** Grobe Form einer Antwort, unabhängig von der Sprache: Wortzahl, kurzes erstes Wort, Großschreibung. */
function shape(text: string): string {
  const trimmed = text.normalize("NFC").trim();
  const words = trimmed.split(/\s+/);
  // Fängt „to …“, „der …“, „la …“: ein kurzes erstes Wort vor weiteren.
  const lead = words.length > 1 && words[0]!.length <= 3 ? words[0]!.toLowerCase() : "";
  const first = trimmed.charAt(0);
  return `${words.length}|${lead}|${first !== first.toLowerCase()}`;
}

/**
 * Wie plausibel ein Kandidat als falsche Antwort ist (TDD 12.3, D-60), kleiner ist besser: zuerst die
 * Wortart (gleich, unbekannt, andere), dann die Herkunft (Sektionen der Sitzung vor dem übrigen Set),
 * dann eine ähnliche Form. Nennt der Eintrag keine Wortart, zählt nur der Rest.
 */
export function plausibility(
  entry: StoredEntry,
  candidate: StoredEntry,
  side: Side,
  inSession: boolean,
): number {
  const own = partOfSpeech(entry);
  const other = partOfSpeech(candidate);
  const kind = !own || other === own ? 0 : other === undefined ? 1 : 2;
  const similar = shape(sideText(candidate, side)) === shape(sideText(entry, side));
  return kind * 4 + (inSession ? 0 : 2) + (similar ? 0 : 1);
}

/** Der Pool nach Plausibilität geordnet; innerhalb einer Stufe bleibt die gegebene Reihenfolge. */
function ranked(
  entry: StoredEntry,
  direction: Direction,
  preferred: readonly StoredEntry[],
  rest: readonly StoredEntry[],
): StoredEntry[] {
  const side = answerSide(direction);
  const scored = [
    ...preferred.map((candidate) => ({ candidate, inSession: true })),
    ...rest.map((candidate) => ({ candidate, inSession: false })),
  ].map(({ candidate, inSession }) => ({
    candidate,
    score: plausibility(entry, candidate, side, inSession),
  }));
  // `sort` ist stabil: Gleich plausible behalten ihre (gemischte) Reihenfolge.
  return scored.sort((a, b) => a.score - b.score).map(({ candidate }) => candidate);
}

/**
 * Alle geeigneten falschen Antworten: aus demselben Set, auf der Sprachseite der Antwort, ohne
 * gemeinsame akzeptierte Antwort mit dem Eintrag und ohne doppelte Anzeige, die plausibelsten zuerst
 * (`plausibility`): Einträge aus den Sektionen der Sitzung (`preferred`) stehen bei gleicher Wortart vor
 * dem übrigen Set (`rest`).
 */
export function distractors(
  entry: StoredEntry,
  direction: Direction,
  preferred: readonly StoredEntry[],
  rest: readonly StoredEntry[],
): StoredEntry[] {
  return [...candidates(entry, direction, ranked(entry, direction, preferred, rest))];
}

export const CHOICE_COUNT = 4;

/** Ob es genug falsche Antworten für Multiple Choice gibt; sucht nur, bis drei gefunden sind. */
export function hasChoices(
  entry: StoredEntry,
  direction: Direction,
  pool: readonly StoredEntry[],
): boolean {
  let found = 0;
  for (const _ of candidates(entry, direction, pool)) {
    if (++found === CHOICE_COUNT - 1) return true;
  }
  return false;
}

/**
 * Antwortmöglichkeiten einer Multiple-Choice-Frage, gemischt; `correct` ist die Stelle der richtigen.
 * `null`, wenn es weniger als drei geeignete falsche gibt – dann wird die Karte als Karteikarte gestellt.
 */
export function multipleChoice(
  entry: StoredEntry,
  direction: Direction,
  preferred: readonly StoredEntry[],
  rest: readonly StoredEntry[],
  random: () => number,
): { options: string[]; correct: number } | null {
  const side = answerSide(direction);
  const pool = ranked(entry, direction, shuffle(preferred, random), shuffle(rest, random));
  const wrong: string[] = [];
  for (const candidate of candidates(entry, direction, pool)) {
    wrong.push(sideText(candidate, side));
    if (wrong.length === CHOICE_COUNT - 1) break;
  }
  if (wrong.length < CHOICE_COUNT - 1) return null;
  const options = shuffle(wrong, random);
  const correct = Math.floor(random() * CHOICE_COUNT);
  options.splice(correct, 0, sideText(entry, side));
  return { options, correct };
}
