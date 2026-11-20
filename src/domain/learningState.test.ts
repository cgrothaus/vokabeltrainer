import { describe, expect, it } from "vitest";
import {
  cardKey,
  cardStates,
  type CardState,
  dayNumber,
  dueIn,
  INTERVALS,
  isDue,
  phaseCounts,
  stage,
} from "./learningState";
import type { Direction, ReviewEvent, StoredSet } from "./model";

/** Tag `day` im November 2026, `hour` Uhr Ortszeit. */
const local = (day: number, hour = 10) => new Date(2026, 10, day, hour).toISOString();
const today = (day: number) => dayNumber(new Date(2026, 10, day, 12));

let nextId = 0;

interface Answer {
  day: number;
  hour?: number;
  result?: ReviewEvent["result"];
  mode?: ReviewEvent["mode"];
  direction?: Direction;
  entryId?: string;
  rev?: string;
}

function event({
  day,
  hour = 10,
  result = "correct",
  mode = "flashcard",
  direction = "termToMeaning",
  entryId = "rain",
  rev = "rev1",
}: Answer): ReviewEvent {
  return {
    id: `event${nextId++}`.padEnd(12, "x"),
    sessionId: `session${day}`.padEnd(12, "x"),
    setId: "m4x8c2r9tw",
    entryId,
    entryRev: rev,
    occurredAt: local(day, hour),
    direction,
    mode,
    result,
    firstAttempt: true,
  };
}

const revs = new Map([
  ["rain", "rev1"],
  ["sun", "rev1"],
]);

/** Zustand der Karte `rain` Lernsprache → Muttersprache nach den Antworten. */
function state(answers: Answer[], current = revs): CardState | undefined {
  return cardStates(answers.map(event), current).get(cardKey("rain", "termToMeaning"));
}

describe("cardStates", () => {
  it("führt eine neue Karte mit der ersten Antwort in Phase 1, richtig oder falsch", () => {
    expect(state([{ day: 1 }])).toEqual({ phase: 1, lastDay: today(1), stale: false });
    expect(state([{ day: 1, result: "incorrect" }])?.phase).toBe(1);
    expect(state([])).toBeUndefined();
  });

  it("rückt mit jeder fälligen richtigen Antwort eine Phase vor, bis Phase 5", () => {
    // Abstände 1, 3, 7, 14, 30 Tage (D-62).
    expect(INTERVALS).toEqual([1, 3, 7, 14, 30]);
    const days = [1, 2, 5, 12, 26, 56, 86];
    const phases = days.map((_, index) => state(days.slice(0, index + 1).map((day) => ({ day }))));
    expect(phases.map((s) => s?.phase)).toEqual([1, 2, 3, 4, 5, 5, 5]);
    expect(phases.at(-1)?.lastDay).toBe(today(86));
  });

  it("zählt je Tag nur die erste Antwort, auch nach Fehlern in der Sitzung", () => {
    const answers: Answer[] = [
      { day: 1 },
      { day: 2, hour: 9 },
      { day: 2, hour: 10 },
      { day: 2, hour: 11, result: "incorrect" },
    ];
    expect(state(answers)).toMatchObject({ phase: 2, lastDay: today(2) });
    // Erst falsch, dann am selben Tag zweimal richtig: bleibt Phase 1.
    expect(state([{ day: 1 }, { day: 2, result: "incorrect" }, { day: 2, hour: 11 }])?.phase).toBe(
      1,
    );
  });

  it("ordnet nach dem Zeitpunkt, nicht nach der Reihenfolge im Speicher", () => {
    const answers = [event({ day: 2 }), event({ day: 1, result: "incorrect" })];
    expect(cardStates(answers, revs).get(cardKey("rain", "termToMeaning"))?.phase).toBe(2);
  });

  it("bestätigt eine richtige Antwort vor der Fälligkeit nur", () => {
    // Phase 2 ab Tag 2, fällig erst an Tag 5.
    const early = state([{ day: 1 }, { day: 2 }, { day: 3 }, { day: 4 }]);
    expect(early).toEqual({ phase: 2, lastDay: today(2), stale: false });
    expect(state([{ day: 1 }, { day: 2 }, { day: 3 }, { day: 5 }])?.phase).toBe(3);
  });

  it("setzt eine falsche Antwort immer auf Phase 1 zurück, auch vor der Fälligkeit", () => {
    const answers: Answer[] = [{ day: 1 }, { day: 2 }, { day: 5 }, { day: 6, result: "incorrect" }];
    expect(state(answers)).toEqual({ phase: 1, lastDay: today(6), stale: false });
  });

  it("bringt eine Karte mit Multiple Choice höchstens bis Phase 3", () => {
    const answers: Answer[] = [1, 2, 5, 12, 26].map((day) => ({ day, mode: "multipleChoice" }));
    expect(state(answers)).toEqual({ phase: 3, lastDay: today(26), stale: false });
    // Danach bringt eine Karteikarte sie weiter.
    expect(state([...answers, { day: 40 }])?.phase).toBe(4);
    // In Phase 4 bestätigt Multiple Choice nur; die Phase bleibt.
    const known = [{ day: 1 }, { day: 2 }, { day: 5 }, { day: 12 }];
    expect(state([...known, { day: 26, mode: "multipleChoice" }])).toMatchObject({
      phase: 4,
      lastDay: today(26),
    });
  });

  it("führt beide Richtungen getrennt", () => {
    const states = cardStates(
      [event({ day: 1 }), event({ day: 2 }), event({ day: 2, direction: "meaningToTerm" })],
      revs,
    );
    expect(states.get(cardKey("rain", "termToMeaning"))?.phase).toBe(2);
    expect(states.get(cardKey("rain", "meaningToTerm"))?.phase).toBe(1);
  });

  it("macht eine inhaltlich geänderte Karte sofort fällig, die Phase bleibt", () => {
    const answers: Answer[] = [{ day: 1 }, { day: 2 }, { day: 5 }];
    const changed = new Map([["rain", "rev2"]]);
    expect(state(answers, changed)).toEqual({ phase: 3, lastDay: today(5), stale: true });
    expect(isDue(state(answers, changed)!, today(5))).toBe(true);
    // Eine Antwort nach der Änderung zählt als fällig und rückt vor.
    expect(state([...answers, { day: 6, rev: "rev2" }], changed)).toEqual({
      phase: 4,
      lastDay: today(6),
      stale: false,
    });
  });

  it("übergeht Antworten zu Einträgen, die es nicht mehr gibt", () => {
    const states = cardStates([event({ day: 1, entryId: "gone" })], revs);
    expect(states.size).toBe(0);
  });

  it("rechnet Tage in Ortszeit, kurz vor und nach Mitternacht", () => {
    const late = new Date(2026, 10, 1, 23, 50).toISOString();
    const early = new Date(2026, 10, 2, 0, 10).toISOString();
    const states = cardStates(
      [
        { ...event({ day: 1 }), occurredAt: late },
        { ...event({ day: 2 }), occurredAt: early },
      ],
      revs,
    );
    expect(states.get(cardKey("rain", "termToMeaning"))?.phase).toBe(2);
  });
});

describe("isDue und dueIn", () => {
  const card: CardState = { phase: 2, lastDay: today(10), stale: false };

  it("ist fällig, wenn der Abstand der Phase bis heute abgelaufen ist", () => {
    expect(isDue(card, today(12))).toBe(false);
    expect(isDue(card, today(13))).toBe(true);
    expect(isDue(card, today(20))).toBe(true);
  });

  it("nennt die Tage bis zur Fälligkeit, negativ für überfällige", () => {
    expect(dueIn(card, today(11))).toBe(2);
    expect(dueIn(card, today(13))).toBe(0);
    expect(dueIn(card, today(15))).toBe(-2);
    expect(dueIn({ ...card, stale: true }, today(11))).toBe(-1);
  });
});

describe("phaseCounts und stage", () => {
  const set: StoredSet = {
    id: "m4x8c2r9tw",
    editCount: 0,
    createdAt: "2026-10-01T08:00:00.000Z",
    updatedAt: "2026-10-01T08:00:00.000Z",
    title: "Grundwortschatz",
    termLanguage: "en",
    meaningLanguage: "de",
    sections: [
      {
        id: "s1",
        title: "s1",
        entries: ["rain", "sun", "snow"].map((id) => ({
          id,
          term: { text: id },
          meanings: [{ text: id }],
        })),
      },
    ],
  };

  it("ordnet Phasen den Stufen neu, im Aufbau und sicher zu", () => {
    expect(([0, 1, 2, 3, 4, 5] as const).map(stage)).toEqual([
      "fresh",
      "building",
      "building",
      "building",
      "secure",
      "secure",
    ]);
  });

  it("zählt je Richtung, Einträge ohne Antwort sind neu", () => {
    const cards = new Map<string, CardState>([
      [cardKey("rain", "termToMeaning"), { phase: 4, lastDay: 0, stale: false }],
      [cardKey("sun", "termToMeaning"), { phase: 2, lastDay: 0, stale: false }],
      [cardKey("rain", "meaningToTerm"), { phase: 1, lastDay: 0, stale: false }],
    ]);
    expect(phaseCounts(set, cards)).toEqual({
      termToMeaning: { fresh: 1, building: 1, secure: 1 },
      meaningToTerm: { fresh: 2, building: 1, secure: 0 },
    });
  });
});
