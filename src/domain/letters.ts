// Schreiben ohne Tastatur (TDD 12.3, FR-41, D-70): In Richtung Lernsprache setzt man das Wort aus
// Kacheln zusammen. Jede Stelle ist ein Graphem mit Buchstabe oder Ziffer; Leerzeichen, Bindestriche
// und andere Zeichen stehen fest. Die Kacheln zeigen die Buchstaben wie in der Antwort, verglichen wird
// wie bei Multiple Choice (getrimmt, kleingeschrieben, NFC); gleich lange Varianten zählen mit.
import type { Direction, StoredEntry } from "./model";
import { acceptedAnswers, comparable, type Result, shuffle } from "./practice";

/** Längere Antworten werden als Karteikarte gestellt. */
export const LETTERS_MAX = 20;
/** Mit weniger Stellen gibt es nichts zusammenzusetzen. */
const MIN_SLOTS = 2;

/** Ein Teil des Worts: `null` ist eine Stelle für eine Kachel, ein Text steht fest. */
export type PatternPart = string | null;

export interface LetterPuzzle {
  readonly pattern: readonly PatternPart[];
  /** Gemischt: die Buchstaben der Antwort, die gleich langer Varianten und einige zusätzliche. */
  readonly tiles: readonly string[];
}

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });
const isLetter = (grapheme: string) => /[\p{L}\p{N}]/u.test(grapheme);

/** Die Grapheme der Antwort (NFC, getrimmt) und daraus die Buchstaben in ihrer Reihenfolge. */
function split(text: string): { parts: string[]; letters: string[] } {
  const parts = [...graphemes.segment(text.normalize("NFC").trim())].map((part) => part.segment);
  return { parts, letters: parts.filter(isLetter) };
}

/** Stellen und feste Zeichen eines Worts. */
export function letterPattern(text: string): PatternPart[] {
  return split(text).parts.map((part) => (isLetter(part) ? null : part));
}

/** Ob sich der Eintrag in dieser Richtung aus Buchstaben zusammensetzen lässt (nur zur Lernsprache). */
export function canSpell(entry: StoredEntry, direction: Direction): boolean {
  if (direction !== "meaningToTerm") return false;
  const { parts, letters } = split(entry.term.text);
  return parts.length <= LETTERS_MAX && letters.length >= MIN_SLOTS;
}

/** So viele Kacheln kommen höchstens zur Antwort hinzu: ein Viertel ihrer Buchstaben, 2 bis 4. */
export const extraCount = (letters: number) => Math.min(4, Math.max(2, Math.round(letters / 4)));

/** Wie oft jeder Buchstabe vorkommt, ohne Groß-/Kleinschreibung. */
function tally(letters: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const letter of letters) {
    const key = comparable(letter);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/**
 * Buchstaben, die gleich lange Varianten über die Antwort hinaus brauchen (z. B. das „a“ in „gray“
 * neben „grey“), so geschrieben wie in der Variante. Ungleich lange Varianten lassen sich in den
 * Stellen nicht bilden und zählen nicht.
 */
function variantLetters(entry: StoredEntry, pattern: readonly PatternPart[]): string[] {
  const own = tally(split(entry.term.text).letters);
  const needed = new Map<string, { letter: string; count: number }>();
  for (const variant of entry.term.acceptedVariants ?? []) {
    const other = letterPattern(variant);
    if (other.length !== pattern.length || other.some((part, i) => part !== pattern[i])) continue;
    const letters = split(variant).letters;
    for (const [key, count] of tally(letters)) {
      const missing = count - (own.get(key) ?? 0);
      if (missing > (needed.get(key)?.count ?? 0))
        needed.set(key, {
          letter: letters.find((letter) => comparable(letter) === key)!,
          count: missing,
        });
    }
  }
  return [...needed.values()].flatMap(({ letter, count }) => Array<string>(count).fill(letter));
}

/**
 * Stellen und Kacheln für die aktuelle Karte; `null`, wenn sich der Eintrag nicht eignet (zu lang oder
 * zu kurz, `canSpell`). Zusätzliche Buchstaben kommen aus den Wörtern von `pool` (andere Einträge der
 * Sitzung, so passen sie zum Alphabet der Sprache), sonst aus der Antwort selbst; sie sind
 * kleingeschrieben, außer die Antwort ist ganz großgeschrieben.
 */
export function letterPuzzle(
  entry: StoredEntry,
  pool: readonly StoredEntry[],
  random: () => number,
): LetterPuzzle | null {
  if (!canSpell(entry, "meaningToTerm")) return null;
  const pattern = letterPattern(entry.term.text);
  const { letters } = split(entry.term.text);
  const fromVariants = variantLetters(entry, pattern);
  const upper = letters.every((letter) => letter !== letter.toLowerCase());
  const others = pool
    .filter((other) => other !== entry)
    .flatMap((other) => split(other.term.text).letters);
  const source = others.length > 0 ? others : letters;
  const extra = Array.from(
    { length: Math.max(0, extraCount(letters.length) - fromVariants.length) },
    () => {
      const letter = source[Math.floor(random() * source.length)]!;
      return upper ? letter.toUpperCase() : letter.toLowerCase();
    },
  );
  return { pattern, tiles: shuffle([...letters, ...fromVariants, ...extra], random) };
}

/** Das zusammengesetzte Wort: die Kacheln in den Stellen, dazwischen die festen Zeichen. */
export function composeWord(pattern: readonly PatternPart[], placed: readonly string[]): string {
  let next = 0;
  return pattern.map((part) => part ?? placed[next++] ?? "").join("");
}

/** Richtig ist die Antwort oder eine akzeptierte Variante, ohne Groß-/Kleinschreibung (TDD 12.3). */
export function spelled(
  entry: StoredEntry,
  pattern: readonly PatternPart[],
  placed: readonly string[],
): Result {
  return acceptedAnswers(entry, "term").has(comparable(composeWord(pattern, placed)))
    ? "correct"
    : "incorrect";
}
