// Wiederholen nach Plan (TDD 12.8, FR-37, D-57, D-63): was heute fällig ist und was „Jetzt wiederholen“
// bzw. „Neue Vokabeln lernen“ abfragt, für ein Set oder mehrere zusammen (12.10). Grundlage ist der
// Lernstand je Karte (learningState.ts); `today` ist der Tag in Ortszeit (`dayNumber`), damit Tests mit
// fester Uhr rechnen.
import { cardKey, type CardState, dueIn, type Phase } from "./learningState";
import type { Direction, StoredSet } from "./model";
import type { Mode } from "./practice";

/** Höchstens so viele Karten in einer Sitzung nach Plan; fällige zuerst. */
export const PLAN_LIMIT = 30;
/** Neue Karten, mit denen „Jetzt wiederholen“ auffüllt. */
export const FILL_FRESH = 5;
/** Neue Karten in „Neue Vokabeln lernen“, wenn nichts fällig ist. */
export const FRESH_ONLY = 10;
/** Ab dieser Phase der ersten Richtung ist die Gegenrichtung als neu dran. */
export const REVERSE_FROM_PHASE = 2;
/** Bis zu dieser Phase fragt der Plan als Multiple Choice ab, danach als Karteikarte (D-66). */
export const PLAN_CHOICE_MAX_PHASE = 1;
/** Ab dieser Phase fragt der Plan in Richtung Lernsprache mit Buchstaben ab (D-70). */
export const PLAN_LETTERS_FROM_PHASE = 4;

export interface PlanCard {
  readonly setId: string;
  readonly entryId: string;
  readonly direction: Direction;
  /** Gewünschte Form; Multiple Choice bzw. Buchstaben nur, wenn es geht (TDD 12.3). */
  readonly mode: Mode;
}

/**
 * Abfrageform nach Lernstand (TDD 12.8, FR-37, D-66, D-70): Neue und unsichere Karten als Multiple
 * Choice, sicherere als Karteikarte, damit sie ohne Auswahl erinnert werden; sichere in Richtung
 * Lernsprache aus Buchstaben, damit die Schreibweise geübt wird.
 */
export function planMode(phase: Phase, direction: Direction): Mode {
  if (phase <= PLAN_CHOICE_MAX_PHASE) return "multipleChoice";
  return phase >= PLAN_LETTERS_FROM_PHASE && direction === "meaningToTerm"
    ? "letters"
    : "flashcard";
}

export interface PlanSummary {
  /** Karten, die heute fällig sind (auch überfällige). */
  readonly due: number;
  /** Tage bis zur nächsten Fälligkeit unter den übrigen Karten; `null`, wenn keine kommt. */
  readonly nextDueIn: number | null;
  /** Karten, die jetzt neu gelernt werden können. */
  readonly fresh: number;
}

export interface PlanSelection {
  /** `review`: mit Fälligem, `new`: nur neue Karten, `null`: nichts zu tun. */
  readonly kind: "review" | "new" | null;
  /** In Abfragereihenfolge vor dem Mischen: die dringendsten zuerst, dann neue in Set-Reihenfolge. */
  readonly cards: readonly PlanCard[];
}

/** Ein Set mit seinem Lernstand; bei mehreren Sets in der Reihenfolge, in der sie gewählt sind. */
export interface PlanPart {
  readonly set: StoredSet;
  readonly cards: ReadonlyMap<string, CardState>;
}

const DIRECTIONS: readonly Direction[] = ["termToMeaning", "meaningToTerm"];

interface Due extends PlanCard {
  readonly days: number;
  readonly phase: number;
  readonly order: number;
}

/**
 * Fällige Karten aller Sets, die dringendsten zuerst: überfällig, dann niedrigere Phase, dann die
 * Reihenfolge der Sets und darin die des Sets.
 */
function dueCards(parts: readonly PlanPart[], today: number): Due[] {
  const due: Due[] = [];
  for (const { set, cards } of parts) {
    for (const entryId of entryIds(set)) {
      for (const direction of DIRECTIONS) {
        const card = cards.get(cardKey(entryId, direction));
        if (!card) continue;
        const days = dueIn(card, today);
        if (days <= 0) {
          const { phase } = card;
          const mode = planMode(phase, direction);
          due.push({ setId: set.id, entryId, direction, mode, days, phase, order: due.length });
        }
      }
    }
  }
  return due.sort((a, b) => a.days - b.days || a.phase - b.phase || a.order - b.order);
}

function entryIds(set: StoredSet): string[] {
  return set.sections.flatMap((section) => section.entries.map((entry) => entry.id));
}

/**
 * Je Eintrag die Karte, die als Nächstes neu ist: zuerst Lernsprache → Muttersprache, die Gegenrichtung
 * erst ab Phase 2 der ersten (D-63). In Set-Reihenfolge.
 */
function freshCards(set: StoredSet, cards: ReadonlyMap<string, CardState>): PlanCard[] {
  const fresh: PlanCard[] = [];
  for (const entryId of entryIds(set)) {
    const first = cards.get(cardKey(entryId, "termToMeaning"));
    const setId = set.id;
    if (!first)
      fresh.push({
        setId,
        entryId,
        direction: "termToMeaning",
        mode: planMode(0, "termToMeaning"),
      });
    else if (first.phase >= REVERSE_FROM_PHASE && !cards.has(cardKey(entryId, "meaningToTerm")))
      fresh.push({
        setId,
        entryId,
        direction: "meaningToTerm",
        mode: planMode(0, "meaningToTerm"),
      });
  }
  return fresh;
}

/** Tage bis zur nächsten Fälligkeit unter den Karten, die heute nicht fällig sind. */
export function nextDueIn(cards: Iterable<CardState>, today: number): number | null {
  let next: number | null = null;
  for (const card of cards) {
    const days = dueIn(card, today);
    if (days > 0 && (next === null || days < next)) next = days;
  }
  return next;
}

export function planSummary(
  set: StoredSet,
  cards: ReadonlyMap<string, CardState>,
  today: number,
): PlanSummary {
  return planSummaryAcross([{ set, cards }], today);
}

/** Zusammen über mehrere Sets (TDD 12.10). */
export function planSummaryAcross(parts: readonly PlanPart[], today: number): PlanSummary {
  const present = parts.flatMap(({ set, cards }) =>
    entryIds(set).flatMap((entryId) =>
      DIRECTIONS.map((direction) => cards.get(cardKey(entryId, direction))).filter(
        (card): card is CardState => card !== undefined,
      ),
    ),
  );
  return {
    due: present.filter((card) => dueIn(card, today) <= 0).length,
    nextDueIn: nextDueIn(present, today),
    fresh: parts.reduce((sum, { set, cards }) => sum + freshCards(set, cards).length, 0),
  };
}

export function planSelection(
  set: StoredSet,
  cards: ReadonlyMap<string, CardState>,
  today: number,
): PlanSelection {
  return planSelectionAcross([{ set, cards }], today);
}

/**
 * Auswahl für die Sitzung nach Plan (TDD 12.8, D-63), auch über mehrere Sets (12.10): höchstens 30
 * fällige, aufgefüllt mit bis zu 5 neuen; ohne Fälliges 10 neue, abwechselnd aus den Sets und darin in
 * Set-Reihenfolge, damit jedes gewählte Set neue Vokabeln beisteuert. Je
 * Eintrag höchstens eine Richtung, sonst verriete die eine Karte die andere; die zweite bleibt fällig.
 */
export function planSelectionAcross(parts: readonly PlanPart[], today: number): PlanSelection {
  const chosen: PlanCard[] = [];
  const used = new Set<string>();
  // Eintrags-IDs sind nur innerhalb eines Sets eindeutig.
  const key = (card: PlanCard) => JSON.stringify([card.setId, card.entryId]);
  for (const card of dueCards(parts, today)) {
    if (chosen.length === PLAN_LIMIT) break;
    if (used.has(key(card))) continue;
    used.add(key(card));
    const { setId, entryId, direction, mode } = card;
    chosen.push({ setId, entryId, direction, mode });
  }
  const review = chosen.length > 0;
  const room = review ? Math.min(FILL_FRESH, PLAN_LIMIT - chosen.length) : FRESH_ONLY;
  const fresh = interleave(parts.map(({ set, cards }) => freshCards(set, cards))).filter(
    (card) => !used.has(key(card)),
  );
  chosen.push(...fresh.slice(0, room));
  return { kind: review ? "review" : chosen.length > 0 ? "new" : null, cards: chosen };
}

/** Abwechselnd je eins aus jeder Liste, bis alle erschöpft sind. */
function interleave<T>(lists: readonly (readonly T[])[]): T[] {
  const result: T[] = [];
  const longest = Math.max(0, ...lists.map((list) => list.length));
  for (let i = 0; i < longest; i++) {
    for (const list of lists) if (i < list.length) result.push(list[i]!);
  }
  return result;
}
