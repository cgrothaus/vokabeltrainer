// Lernstand und Überblick aus den Antworten eines Sets (TDD 12.6, FR-11, AK-17, D-07). Es gibt keinen
// gespeicherten Lernstand; alles entsteht in einem Durchlauf über die Events (TAK-15).
import type { ReviewEvent, StoredSet } from "./model";

type Result = ReviewEvent["result"];

/** Kennzahlen für das Set oder eine Sektion. Eine Sitzung zählt, wenn sie dort eine Antwort hat. */
export interface Overview {
  sessions: number;
  /** Zeitpunkt der letzten Antwort; fehlt ohne Sitzung. */
  lastAt?: string;
  /** Erstversuche der letzten `RECENT_SESSIONS` Sitzungen, zusammengezählt. */
  recent?: { sessions: number; firstAttempts: number; firstCorrect: number };
}

/** Berechnet für spätere Didaktik (12.7), noch nicht angezeigt (D-30). */
export interface EntryStats {
  answers: number;
  lastAt: string;
  lastResult: Result;
  lastFirstResult?: Result;
}

export interface SetStats {
  set: Overview;
  /** Jede Sektion des Sets, in seiner Reihenfolge, auch ohne Antworten. */
  sections: Map<string, Overview>;
  /** Nur Einträge mit Antworten. */
  entries: Map<string, EntryStats>;
}

export const RECENT_SESSIONS = 5;

interface SessionTally {
  lastAt: string;
  firstAttempts: number;
  firstCorrect: number;
}

/** Sitzungen eines Bereichs (Set oder Sektion), nach Sitzungs-ID. */
type Scope = Map<string, SessionTally>;

function tally(scope: Scope, event: ReviewEvent): void {
  let session = scope.get(event.sessionId);
  if (!session) {
    session = { lastAt: event.occurredAt, firstAttempts: 0, firstCorrect: 0 };
    scope.set(event.sessionId, session);
  }
  // ISO 8601 in UTC aus `toISOString`: Der Textvergleich ordnet zeitlich.
  if (event.occurredAt > session.lastAt) session.lastAt = event.occurredAt;
  if (event.firstAttempt) {
    session.firstAttempts++;
    if (event.result === "correct") session.firstCorrect++;
  }
}

function overview(scope: Scope): Overview {
  if (scope.size === 0) return { sessions: 0 };
  const sessions = [...scope.values()].sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1));
  const recent = sessions.slice(0, RECENT_SESSIONS);
  return {
    sessions: sessions.length,
    lastAt: sessions[0]!.lastAt,
    recent: {
      sessions: recent.length,
      firstAttempts: recent.reduce((sum, session) => sum + session.firstAttempts, 0),
      firstCorrect: recent.reduce((sum, session) => sum + session.firstCorrect, 0),
    },
  };
}

/** Zusätzlich der Zeitpunkt des letzten Erstversuchs, der vor der letzten Antwort liegen kann. */
type EntryTally = EntryStats & { lastFirstAt?: string };

function countEntry(entries: Map<string, EntryTally>, event: ReviewEvent): void {
  const entry = entries.get(event.entryId);
  const first = event.firstAttempt ? event.result : undefined;
  if (!entry) {
    entries.set(event.entryId, {
      answers: 1,
      lastAt: event.occurredAt,
      lastResult: event.result,
      ...(first && { lastFirstResult: first, lastFirstAt: event.occurredAt }),
    });
    return;
  }
  entry.answers++;
  if (event.occurredAt > entry.lastAt) {
    entry.lastAt = event.occurredAt;
    entry.lastResult = event.result;
  }
  if (first && (!entry.lastFirstAt || event.occurredAt > entry.lastFirstAt)) {
    entry.lastFirstAt = event.occurredAt;
    entry.lastFirstResult = first;
  }
}

/**
 * Ordnet jede Antwort der Sektion zu, in der ihr Eintrag **jetzt** steht; Antworten zu Einträgen,
 * die es nicht mehr gibt, zählen nirgends (12.6).
 */
export function computeStats(set: StoredSet, events: readonly ReviewEvent[]): SetStats {
  const sectionOf = new Map<string, string>();
  const sectionScopes = new Map<string, Scope>();
  for (const section of set.sections) {
    sectionScopes.set(section.id, new Map());
    for (const entry of section.entries) sectionOf.set(entry.id, section.id);
  }
  const setScope: Scope = new Map();
  const entries = new Map<string, EntryTally>();
  for (const event of events) {
    const sectionId = sectionOf.get(event.entryId);
    if (sectionId === undefined) continue;
    tally(setScope, event);
    tally(sectionScopes.get(sectionId)!, event);
    countEntry(entries, event);
  }
  return {
    set: overview(setScope),
    sections: new Map([...sectionScopes].map(([id, scope]) => [id, overview(scope)])),
    entries: new Map(
      [...entries].map(([id, { lastFirstAt: _, ...entry }]) => [id, entry satisfies EntryStats]),
    ),
  };
}

const SHORT_DATE = new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short" });
const LONG_DATE = new Intl.DateTimeFormat("de-DE", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const dayStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

/** „heute“, „gestern“ oder „am 18. Okt.“ (mit Jahr außerhalb des laufenden), in Ortszeit. */
export function describeDay(iso: string, now: Date): string {
  const date = new Date(iso);
  const days = Math.round((dayStart(now).getTime() - dayStart(date).getTime()) / 86_400_000);
  if (days === 0) return "heute";
  if (days === 1) return "gestern";
  const format = date.getFullYear() === now.getFullYear() ? SHORT_DATE : LONG_DATE;
  return `am ${format.format(date)}`;
}
