// Wiederholen nach Plan (TDD 12.8, FR-37, D-57, D-63): was heute fällig ist und was „Jetzt wiederholen“
// bzw. „Neue Vokabeln lernen“ abfragt. Grundlage ist der Lernstand je Karte (learningState.ts); `today`
// ist der Tag in Ortszeit (`dayNumber`), damit Tests mit fester Uhr rechnen.
import { cardKey, type CardState, dueIn } from "./learningState";
import type { Direction, StoredSet } from "./model";

/** Höchstens so viele Karten in einer Sitzung nach Plan; fällige zuerst. */
export const PLAN_LIMIT = 30;
/** Neue Karten, mit denen „Jetzt wiederholen“ auffüllt. */
export const FILL_FRESH = 5;
/** Neue Karten in „Neue Vokabeln lernen“, wenn nichts fällig ist. */
export const FRESH_ONLY = 10;
/** Ab dieser Phase der ersten Richtung ist die Gegenrichtung als neu dran. */
export const REVERSE_FROM_PHASE = 2;

export interface PlanCard {
  readonly entryId: string;
  readonly direction: Direction;
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

const DIRECTIONS: readonly Direction[] = ["termToMeaning", "meaningToTerm"];

interface Due extends PlanCard {
  readonly days: number;
  readonly phase: number;
  readonly order: number;
}

/** Fällige Karten des Sets, die dringendsten zuerst (überfällig, dann niedrigere Phase, Set-Reihenfolge). */
function dueCards(set: StoredSet, cards: ReadonlyMap<string, CardState>, today: number): Due[] {
  const due: Due[] = [];
  for (const entryId of entryIds(set)) {
    for (const direction of DIRECTIONS) {
      const card = cards.get(cardKey(entryId, direction));
      if (!card) continue;
      const days = dueIn(card, today);
      if (days <= 0) due.push({ entryId, direction, days, phase: card.phase, order: due.length });
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
    if (!first) fresh.push({ entryId, direction: "termToMeaning" });
    else if (first.phase >= REVERSE_FROM_PHASE && !cards.has(cardKey(entryId, "meaningToTerm")))
      fresh.push({ entryId, direction: "meaningToTerm" });
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
  const present = entryIds(set).flatMap((entryId) =>
    DIRECTIONS.map((direction) => cards.get(cardKey(entryId, direction))).filter(
      (card): card is CardState => card !== undefined,
    ),
  );
  return {
    due: present.filter((card) => dueIn(card, today) <= 0).length,
    nextDueIn: nextDueIn(present, today),
    fresh: freshCards(set, cards).length,
  };
}

/**
 * Auswahl für die Sitzung nach Plan (TDD 12.8, D-63): höchstens 30 fällige, aufgefüllt mit bis zu
 * 5 neuen; ohne Fälliges 10 neue. Je Eintrag höchstens eine Richtung, sonst verriete die eine Karte
 * die andere; die zweite bleibt fällig.
 */
export function planSelection(
  set: StoredSet,
  cards: ReadonlyMap<string, CardState>,
  today: number,
): PlanSelection {
  const chosen: PlanCard[] = [];
  const used = new Set<string>();
  for (const card of dueCards(set, cards, today)) {
    if (chosen.length === PLAN_LIMIT) break;
    if (used.has(card.entryId)) continue;
    used.add(card.entryId);
    chosen.push({ entryId: card.entryId, direction: card.direction });
  }
  const review = chosen.length > 0;
  const room = review ? Math.min(FILL_FRESH, PLAN_LIMIT - chosen.length) : FRESH_ONLY;
  const fresh = freshCards(set, cards).filter((card) => !used.has(card.entryId));
  chosen.push(...fresh.slice(0, room));
  return { kind: review ? "review" : chosen.length > 0 ? "new" : null, cards: chosen };
}
