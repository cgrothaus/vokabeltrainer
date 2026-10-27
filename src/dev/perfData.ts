// Testdaten für die Performance-Messung (TDD 15.6, TAK-15): ein großes Set und ein langer Lernverlauf.
// Mit fester Zufallsfolge erzeugt statt eingecheckt (50.000 Antworten wären rund 10 MB). Genutzt vom
// Dev-Schalter `?perf` und von den Tests. Nur erfundene Kunstwörter, keine Lehrwerksinhalte.
import { entryRev } from "../domain/hash";
import { type RandomBytes, ID_LENGTH, createId } from "../domain/ids";
import type { Direction, ReviewEvent, Session, StoredSet } from "../domain/model";

export const PERF_ENTRIES = 3_000;
export const PERF_SECTIONS = 20;
export const PERF_EVENTS = 50_000;

/** mulberry32: kleine, reproduzierbare Zufallsfolge in [0, 1). */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export const seededBytes =
  (random: () => number): RandomBytes =>
  (count) =>
    Uint8Array.from({ length: count }, () => Math.floor(random() * 256));

const pick = <T>(random: () => number, items: readonly T[]): T =>
  items[Math.floor(random() * items.length)]!;

const between = (random: () => number, min: number, max: number) =>
  min + Math.floor(random() * (max - min + 1));

// Je zwei Buchstaben: Drei Silben aus der Nummer machen jedes Wort eindeutig (16³ > 3.000).
const TERM_SYLLABLES = "ka lo mi su te ra vi no pe du ge fa zo bi ru ne".split(" ");
const MEANING_SYLLABLES = "bro kel tan wir sel mog fen dur lat hos pim gar".split(" ");
const PARTS_OF_SPEECH = ["noun", "verb", "adjective"] as const;

function termOf(random: () => number, index: number): string {
  let word = "";
  for (let digit = index, i = 0; i < 3; i++, digit >>= 4) word += TERM_SYLLABLES[digit & 15];
  for (let extra = between(random, 0, 2); extra > 0; extra--) word += pick(random, TERM_SYLLABLES);
  return word;
}

function meaningOf(random: () => number): string {
  let word = "";
  for (let count = between(random, 2, 3); count > 0; count--)
    word += pick(random, MEANING_SYLLABLES);
  return word[0]!.toUpperCase() + word.slice(1);
}

/** Ein Eintrag wie aus einer LLM-Antwort: Kurz- und Langform gemischt, optionale Angaben zufällig. */
function entryOf(random: () => number, index: number): Record<string, unknown> {
  const text = termOf(random, index);
  const term = random() < 0.1 ? { text, acceptedVariants: [`${text}e`] } : text;
  const meanings = Array.from({ length: random() < 0.25 ? 2 : 1 }, () => {
    const meaning = meaningOf(random);
    return random() < 0.2 ? { text: meaning, acceptedVariants: [`${meaning}s`] } : meaning;
  });
  const entry: Record<string, unknown> = { term, meanings };
  if (random() < 0.3) {
    const partOfSpeech = pick(random, PARTS_OF_SPEECH);
    entry.grammar =
      partOfSpeech === "noun"
        ? { partOfSpeech, plural: `${text}s` }
        : partOfSpeech === "verb"
          ? { partOfSpeech, forms: [text, `${text}d`, `${text}n`] }
          : { partOfSpeech };
  }
  if (random() < 0.15) {
    entry.examples = [
      random() < 0.5
        ? `${text} ${termOf(random, index)}.`
        : { text: `${text} ${termOf(random, index)}.`, translation: `${meaningOf(random)}.` },
    ];
  }
  if (random() < 0.1) entry.notes = `Merkhilfe: ${meaningOf(random)} wie ${meaningOf(random)}.`;
  return entry;
}

/** Set-Datei als Text, ohne IDs wie ein neues Set: 3.000 Einträge in 20 gleich großen Sektionen. */
export function perfSetText(seed = 1): string {
  const random = seededRandom(seed);
  const perSection = PERF_ENTRIES / PERF_SECTIONS;
  return JSON.stringify(
    {
      format: "vokabeltrainer-set",
      formatVersion: 1,
      set: {
        title: "Messset – 3.000 Kunstwörter",
        termLanguage: "en",
        meaningLanguage: "de",
        source: "Erzeugt für die Performance-Messung",
        license: "CC0",
      },
      sections: Array.from({ length: PERF_SECTIONS }, (_, s) => ({
        title: `Thema ${s + 1}`,
        entries: Array.from({ length: perSection }, (_, e) => entryOf(random, s * perSection + e)),
      })),
    },
    null,
    2,
  );
}

const DIRECTIONS = ["termToMeaning", "meaningToTerm", "mixed"] as const;
const MC_SHARES = [0, 25, 50] as const;
/** Ende des Verlaufs; fest, damit die Daten bei jedem Lauf gleich sind. */
const HISTORY_END = Date.parse("2026-10-01T18:00:00.000Z");
/** Etwa 11.000 Antworten im Jahr (TDD 12.6): 50.000 reichen rund viereinhalb Jahre zurück. */
const HISTORY_DAYS = Math.round((PERF_EVENTS / 11_000) * 365);
const DAY = 86_400_000;

interface Card {
  entryId: string;
  direction: Direction;
  mode: ReviewEvent["mode"];
}

interface PlannedSession {
  session: Omit<Session, "startedAt" | "endedAt">;
  answers: Omit<ReviewEvent, "id" | "sessionId" | "setId" | "occurredAt">[];
}

/**
 * Sitzungen mit 10 bis 30 Karten aus 1 bis 3 benachbarten Sektionen, wie sie die App anlegt: Eine
 * falsche Antwort kommt später in derselben Sitzung wieder, ein Teil der Sitzungen bekommt danach
 * „Nur Fehler üben“ (`repeatOf`). Zeitpunkte gleichmäßig über den Zeitraum verteilt, aufsteigend.
 */
export function perfHistory(
  set: StoredSet,
  seed = 2,
): { sessions: Session[]; events: ReviewEvent[] } {
  const random = seededRandom(seed);
  const bytes = seededBytes(random);
  const revs = new Map(
    set.sections.flatMap((section) => section.entries.map((e) => [e.id, entryRev(e)] as const)),
  );

  const play = (session: PlannedSession["session"], cards: Card[]): PlannedSession => {
    const queue = [...cards];
    const tries = new Map<string, number>();
    const answers: PlannedSession["answers"] = [];
    for (let card = queue.shift(); card; card = queue.shift()) {
      const tried = tries.get(card.entryId) ?? 0;
      tries.set(card.entryId, tried + 1);
      const result = random() < 0.8 || tried >= 2 ? "correct" : "incorrect";
      answers.push({
        entryId: card.entryId,
        entryRev: revs.get(card.entryId)!,
        direction: card.direction,
        mode: card.mode,
        result,
        firstAttempt: tried === 0,
      });
      if (result === "incorrect") queue.splice(Math.min(queue.length, 3), 0, card);
    }
    return { session, answers };
  };

  const planned: PlannedSession[] = [];
  let total = 0;
  while (total < PERF_EVENTS) {
    const first = between(random, 0, set.sections.length - 1);
    const sections = set.sections.slice(first, first + between(random, 1, 3));
    const pool = sections.flatMap((section) => section.entries.map((entry) => entry.id));
    const config = {
      direction: pick(random, DIRECTIONS),
      count: Math.min(pool.length, between(random, 10, 30)),
      mcShare: pick(random, MC_SHARES),
    };
    const chosen = new Set<string>();
    while (chosen.size < config.count) chosen.add(pick(random, pool));
    const cards = [...chosen].map((entryId): Card => ({
      entryId,
      direction:
        config.direction === "mixed"
          ? random() < 0.5
            ? "termToMeaning"
            : "meaningToTerm"
          : config.direction,
      mode: random() * 100 < config.mcShare ? "multipleChoice" : "flashcard",
    }));
    const session = {
      id: createId(ID_LENGTH.session, bytes),
      setId: set.id,
      sectionIds: sections.map((section) => section.id),
      status: "completed" as const,
      config,
    };
    const played = play(session, cards);
    planned.push(played);
    total += played.answers.length;

    const missed = cards.filter((card) =>
      played.answers.some(
        (a) => a.entryId === card.entryId && a.firstAttempt && a.result !== "correct",
      ),
    );
    if (missed.length > 0 && random() < 0.3) {
      const repeat = { ...session, id: createId(ID_LENGTH.session, bytes), repeatOf: session.id };
      const replayed = play({ ...repeat, config: { ...config, count: missed.length } }, missed);
      planned.push(replayed);
      total += replayed.answers.length;
    }
  }

  // Überzählige Antworten fallen am Ende weg; die letzte Sitzung gilt dann als vorzeitig beendet.
  let excess = total - PERF_EVENTS;
  while (excess > 0) {
    const last = planned.at(-1)!;
    const cut = Math.min(excess, last.answers.length);
    last.answers.length -= cut;
    last.session.status = "ended";
    excess -= cut;
    if (last.answers.length === 0) planned.pop();
  }

  const sessions: Session[] = [];
  const events: ReviewEvent[] = [];
  const step = (HISTORY_DAYS * DAY) / planned.length;
  const start = HISTORY_END - HISTORY_DAYS * DAY;
  planned.forEach(({ session, answers }, i) => {
    let time = start + i * step + Math.floor(random() * (step / 2));
    const startedAt = new Date(time).toISOString();
    for (const answer of answers) {
      time += between(random, 3, 12) * 1000;
      events.push({
        id: createId(ID_LENGTH.reviewEvent, bytes),
        sessionId: session.id,
        setId: set.id,
        occurredAt: new Date(time).toISOString(),
        ...answer,
      });
    }
    sessions.push({ ...session, startedAt, endedAt: new Date(time + 1000).toISOString() });
  });
  return { sessions, events };
}
