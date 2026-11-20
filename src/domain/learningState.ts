// Lernstand pro Vokabel und Richtung (TDD 12.7, FR-36, D-56, D-62): Phasen eines Karteikastens
// (Leitner), berechnet aus den Antworten, nicht gespeichert. Austauschbar: Ein anderes Verfahren kann
// dieselbe Historie später neu bewerten.
import type { Direction, ReviewEvent, StoredSet } from "./model";

/** 0 „neu“ (nie beantwortet), 1–5 im Karteikasten. */
export type Phase = 0 | 1 | 2 | 3 | 4 | 5;

/** Abstand in Tagen bis zur nächsten Wiederholung, je Phase 1 bis 5 (D-62). */
export const INTERVALS = [1, 3, 7, 14, 30] as const;

/** Höchste Phase, die Multiple Choice erreicht: Wiedererkennen festigt weniger als Erinnern. */
export const CHOICE_MAX_PHASE = 3;

export interface CardState {
  /** Nur Karten mit Antworten haben einen Zustand; sie sind mindestens in Phase 1. */
  readonly phase: Exclude<Phase, 0>;
  /** Tag (Ortszeit, `dayNumber`) der letzten maßgeblichen Antwort. */
  readonly lastDay: number;
  /** Der Eintrag wurde seit dieser Antwort inhaltlich geändert (R-04): sofort fällig. */
  readonly stale: boolean;
}

/** Schlüssel einer Karte: Eintrag und Richtung. */
export const cardKey = (entryId: string, direction: Direction) => `${direction}:${entryId}`;

const DAY = 86_400_000;

/** Fortlaufende Nummer des Tages in Ortszeit; Abstände sind Differenzen. */
export function dayNumber(date: Date): number {
  return Math.round(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY);
}

const interval = (phase: Exclude<Phase, 0>) => INTERVALS[phase - 1]!;

const HOUR = 3_600_000;

/**
 * Tag in Ortszeit zu einem Zeitpunkt in UTC (ISO 8601), wie `dayNumber`. Der Versatz der Zeitzone
 * wird je Stunde einmal ermittelt: Er wechselt nur zu vollen Stunden, der Tag aber auch dazwischen
 * (z. B. bei +5:30), deshalb wird der Tag aus dem genauen Zeitpunkt gerechnet (TAK-15).
 */
function dayReader(): (iso: string) => number {
  const offsets = new Map<number, number>();
  return (iso) => {
    const time = Date.parse(iso);
    const hour = Math.floor(time / HOUR);
    let offset = offsets.get(hour);
    if (offset === undefined) {
      offset = new Date(time).getTimezoneOffset() * 60_000;
      offsets.set(hour, offset);
    }
    return Math.floor((time - offset) / DAY);
  };
}

/** Tage bis zur Fälligkeit; 0 heißt heute, negativ überfällig. Geänderte Karten sind seit gestern fällig. */
export function dueIn(card: CardState, today: number): number {
  if (card.stale) return Math.min(-1, card.lastDay + interval(card.phase) - today);
  return card.lastDay + interval(card.phase) - today;
}

export function isDue(card: CardState, today: number): boolean {
  return dueIn(card, today) <= 0;
}

interface Tally {
  phase: Exclude<Phase, 0>;
  lastDay: number;
  /** Inhaltsstand bei der letzten maßgeblichen Antwort. */
  rev: string;
  /** Tag der letzten gesehenen Antwort: Je Tag zählt nur die erste. */
  seenDay: number;
}

/**
 * Lernstand je Karte aus den Antworten eines Sets. `revs` enthält den aktuellen Inhaltsstand je Eintrag;
 * Antworten zu Einträgen, die es nicht mehr gibt, zählen nicht (12.6).
 */
export function cardStates(
  events: readonly ReviewEvent[],
  revs: ReadonlyMap<string, string>,
): Map<string, CardState> {
  // Je Karte sammeln und erst dann ordnen: billiger, als alle Antworten zu sortieren. Nach Eintrag
  // gruppiert, ohne Schlüssel je Antwort zusammenzusetzen (TAK-15).
  const byEntry = new Map<string, Record<Direction, ReviewEvent[]>>();
  for (const event of events) {
    if (!revs.has(event.entryId)) continue;
    let lists = byEntry.get(event.entryId);
    if (!lists) {
      lists = { termToMeaning: [], meaningToTerm: [] };
      byEntry.set(event.entryId, lists);
    }
    lists[event.direction].push(event);
  }
  const states = new Map<string, CardState>();
  const dayOf = dayReader();
  for (const [entryId, lists] of byEntry) {
    const current = revs.get(entryId);
    for (const direction of ["termToMeaning", "meaningToTerm"] as const) {
      const list = lists[direction];
      if (list.length === 0) continue;
      // ISO 8601 in UTC: Der Textvergleich ordnet zeitlich.
      list.sort((a, b) => (a.occurredAt < b.occurredAt ? -1 : a.occurredAt > b.occurredAt ? 1 : 0));
      const first = list[0]!;
      const day = dayOf(first.occurredAt);
      const tally: Tally = { phase: 1, lastDay: day, rev: first.entryRev, seenDay: day };
      for (let i = 1; i < list.length; i++) step(tally, list[i]!, dayOf(list[i]!.occurredAt));
      states.set(cardKey(entryId, direction), {
        phase: tally.phase,
        lastDay: tally.lastDay,
        stale: tally.rev !== current,
      });
    }
  }
  return states;
}

/**
 * Eine weitere Antwort fortschreiben (TDD 12.7); die erste einer Karte führt in Phase 1. Ändert
 * `tally` an Ort und Stelle: Kopien je Antwort kosteten bei 50.000 Antworten spürbar Zeit (TAK-15).
 */
function step(tally: Tally, event: ReviewEvent, day: number): void {
  if (day === tally.seenDay) return;
  tally.seenDay = day;
  const due = day >= tally.lastDay + interval(tally.phase) || event.entryRev !== tally.rev;
  // Vor der Fälligkeit bestätigt eine richtige Antwort nur (D-62).
  if (event.result === "correct" && !due) return;
  if (event.result === "incorrect") tally.phase = 1;
  else if (tally.phase < (event.mode === "multipleChoice" ? CHOICE_MAX_PHASE : 5))
    tally.phase = (tally.phase + 1) as Exclude<Phase, 0>;
  tally.lastDay = day;
  tally.rev = event.entryRev;
}

/** Angezeigte Stufen: „neu“ (0), „im Aufbau“ (1–3), „sicher“ (4–5). */
export type Stage = "fresh" | "building" | "secure";

export function stage(phase: Phase): Stage {
  return phase === 0 ? "fresh" : phase <= 3 ? "building" : "secure";
}

export type StageCounts = Record<Stage, number>;

/** Wie viele Einträge je Richtung neu, im Aufbau und sicher sind. */
export function phaseCounts(
  set: StoredSet,
  cards: ReadonlyMap<string, CardState>,
): Record<Direction, StageCounts> {
  const counts = (): StageCounts => ({ fresh: 0, building: 0, secure: 0 });
  const result: Record<Direction, StageCounts> = {
    termToMeaning: counts(),
    meaningToTerm: counts(),
  };
  for (const section of set.sections) {
    for (const entry of section.entries) {
      for (const direction of ["termToMeaning", "meaningToTerm"] as const) {
        result[direction][stage(cards.get(cardKey(entry.id, direction))?.phase ?? 0)]++;
      }
    }
  }
  return result;
}
