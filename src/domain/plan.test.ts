import { describe, expect, it } from "vitest";
import { cardKey, type CardState, type Phase } from "./learningState";
import type { Direction, StoredSet } from "./model";
import {
  nextDueIn,
  planMode,
  planSelection,
  planSelectionAcross,
  planSummary,
  planSummaryAcross,
} from "./plan";

const TODAY = 20_000;

/** Ein Set mit `count` Einträgen `e0` … in zwei Sektionen, die zweite ab `e5`. */
function set(count: number): StoredSet {
  const entries = Array.from({ length: count }, (_, i) => ({
    id: `e${i}`,
    term: { text: `word${i}` },
    meanings: [{ text: `Wort${i}` }],
  }));
  return {
    id: "m4x8c2r9tw",
    title: "Test",
    termLanguage: "en",
    meaningLanguage: "de",
    editCount: 0,
    createdAt: "2026-11-01T12:00:00.000Z",
    updatedAt: "2026-11-01T12:00:00.000Z",
    sections: [
      { id: "s1", title: "Eins", entries: entries.slice(0, 5) },
      { id: "s2", title: "Zwei", entries: entries.slice(5) },
    ],
  };
}

type Spec = [entry: number, phase: Exclude<Phase, 0>, daysAgo: number, direction?: Direction];

/** Zustände je Karte; `daysAgo` ist der Tag der letzten maßgeblichen Antwort vor heute. */
function cards(...specs: Spec[]): Map<string, CardState> {
  return new Map(
    specs.map(([entry, phase, daysAgo, direction = "termToMeaning"]) => [
      cardKey(`e${entry}`, direction),
      { phase, lastDay: TODAY - daysAgo, stale: false },
    ]),
  );
}

const ids = (selection: ReturnType<typeof planSelection>) =>
  selection.cards.map(
    ({ entryId, direction }) => `${entryId}:${direction === "termToMeaning" ? "→" : "←"}`,
  );

describe("planSummary", () => {
  it("zählt fällige Karten nach den Abständen ihrer Phase", () => {
    // Phase 1 nach 1 Tag, Phase 2 nach 3, Phase 3 nach 7: fällig sind e0, e1 und e3.
    const states = cards([0, 1, 1], [1, 2, 3], [2, 2, 2], [3, 3, 9], [4, 4, 13]);
    expect(planSummary(set(5), states, TODAY).due).toBe(3);
  });

  it("zählt geänderte Einträge als fällig, auch vor dem Abstand", () => {
    const changed: CardState = { phase: 3, lastDay: TODAY, stale: true };
    const states = new Map([[cardKey("e0", "termToMeaning"), changed]]);
    expect(planSummary(set(1), states, TODAY).due).toBe(1);
  });

  it("zählt als neu, was als Nächstes neu gelernt werden kann", () => {
    // e0 in Phase 2: Die Gegenrichtung ist neu. e1 in Phase 1: noch nicht. e2 bis e5: neu.
    const states = cards([0, 2, 0], [1, 1, 0]);
    expect(planSummary(set(6), states, TODAY).fresh).toBe(5);
  });

  it("nennt ohne Fälliges die Tage bis zum nächsten, sonst null", () => {
    expect(planSummary(set(3), cards([0, 3, 2], [1, 2, 1]), TODAY).nextDueIn).toBe(2);
    expect(planSummary(set(3), cards([0, 1, 1]), TODAY).nextDueIn).toBeNull();
    expect(nextDueIn(cards().values(), TODAY)).toBeNull();
  });
});

describe("planSelection", () => {
  it("wiederholt die fälligen Karten, die am längsten überfälligen zuerst, und füllt mit neuen auf", () => {
    const states = cards([0, 1, 1], [1, 1, 5], [2, 2, 3]);
    const selection = planSelection(set(12), states, TODAY);
    expect(selection.kind).toBe("review");
    // Überfällig seit 4, 0 und 0 Tagen; bei Gleichstand die niedrigere Phase zuerst.
    expect(ids(selection)).toEqual([
      "e1:→",
      "e0:→",
      "e2:→",
      "e3:→",
      "e4:→",
      "e5:→",
      "e6:→",
      "e7:→",
    ]);
  });

  it("nimmt höchstens 30 fällige und dann keine neuen mehr", () => {
    const states = cards(...Array.from({ length: 35 }, (_, i): Spec => [i, 1, 1 + (i % 4)]));
    const selection = planSelection(set(40), states, TODAY);
    expect(selection.cards).toHaveLength(30);
    expect(
      selection.cards.every(({ entryId }) => states.has(cardKey(entryId, "termToMeaning"))),
    ).toBe(true);
    // Die am längsten überfälligen (4 Tage, i % 4 = 3) sind dabei.
    expect(ids(selection).slice(0, 8)).toEqual(
      [3, 7, 11, 15, 19, 23, 27, 31].map((i) => `e${i}:→`),
    );
  });

  it("füllt nur bis 30 auf", () => {
    const states = cards(...Array.from({ length: 28 }, (_, i): Spec => [i, 1, 1]));
    const selection = planSelection(set(40), states, TODAY);
    expect(selection.cards).toHaveLength(30);
    expect(ids(selection).slice(28)).toEqual(["e28:→", "e29:→"]);
  });

  it("bietet ohne Fälliges zehn neue Vokabeln in Set-Reihenfolge an", () => {
    const selection = planSelection(set(14), cards([0, 1, 0]), TODAY);
    expect(selection.kind).toBe("new");
    expect(ids(selection)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => `e${i}:→`));
  });

  it("nimmt die Gegenrichtung erst als neu, wenn die erste Richtung Phase 2 erreicht hat", () => {
    const states = cards([0, 2, 0], [1, 1, 0], [2, 1, 0]);
    expect(ids(planSelection(set(3), states, TODAY))).toEqual(["e0:←"]);
  });

  it("fragt je Eintrag nur eine Richtung ab; die andere bleibt fällig", () => {
    const states = cards([0, 1, 3], [0, 1, 1, "meaningToTerm"], [1, 1, 1, "meaningToTerm"]);
    const selection = planSelection(set(2), states, TODAY);
    expect(ids(selection)).toEqual(["e0:→", "e1:←"]);
    expect(planSummary(set(2), states, TODAY).due).toBe(3);
  });

  it("liefert nichts, wenn weder etwas fällig noch etwas neu ist", () => {
    const states = cards([0, 2, 0], [0, 1, 0, "meaningToTerm"]);
    expect(planSelection(set(1), states, TODAY)).toEqual({ kind: null, cards: [] });
  });

  it("ignoriert Zustände zu Einträgen, die es nicht mehr gibt", () => {
    const states = cards([0, 1, 1], [9, 1, 1]);
    expect(ids(planSelection(set(1), states, TODAY))).toEqual(["e0:→"]);
    expect(planSummary(set(1), states, TODAY).due).toBe(1);
  });
});

describe("Abfrageform nach Lernstand", () => {
  const modes = (selection: ReturnType<typeof planSelection>) =>
    Object.fromEntries(
      selection.cards.map(({ entryId, direction, mode }) => [
        `${entryId}:${direction === "termToMeaning" ? "→" : "←"}`,
        mode,
      ]),
    );

  it("stellt Phase 0 und 1 als Multiple Choice, ab Phase 2 als Karteikarte", () => {
    expect(([0, 1, 2, 3, 4, 5] as const).map((phase) => planMode(phase))).toEqual([
      "multipleChoice",
      "multipleChoice",
      "flashcard",
      "flashcard",
      "flashcard",
      "flashcard",
    ]);
  });

  it("richtet die Form fälliger Karten nach ihrer Phase, neue Karten sind Multiple Choice", () => {
    // Fällig: e0 in Phase 1, e1 in Phase 2, e2 in Phase 5; e3 in Phase 2 macht die Gegenrichtung neu.
    const states = cards([0, 1, 1], [1, 2, 3], [2, 5, 30], [3, 2, 0]);
    expect(modes(planSelection(set(5), states, TODAY))).toEqual({
      "e0:→": "multipleChoice",
      "e1:→": "flashcard",
      "e2:→": "flashcard",
      "e3:←": "multipleChoice",
      "e4:→": "multipleChoice",
    });
  });

  it("behält bei geänderten Einträgen die Form ihrer Phase", () => {
    const states = new Map<string, CardState>([
      [cardKey("e0", "termToMeaning"), { phase: 3, lastDay: TODAY, stale: true }],
      [cardKey("e1", "termToMeaning"), { phase: 1, lastDay: TODAY, stale: true }],
    ]);
    expect(modes(planSelection(set(2), states, TODAY))).toEqual({
      "e0:→": "flashcard",
      "e1:→": "multipleChoice",
    });
  });
});

describe("Plan über mehrere Sets", () => {
  /** Ein zweites Set mit eigener ID; die Eintrags-IDs `e0` … gleichen denen des ersten. */
  const other = (count: number): StoredSet => ({ ...set(count), id: "p7k2v9q4zd", title: "Zwei" });
  const keys = (selection: ReturnType<typeof planSelectionAcross>) =>
    selection.cards.map(({ setId, entryId }) => `${setId === "m4x8c2r9tw" ? "A" : "B"}${entryId}`);

  it("ordnet fällige Karten über alle Sets nach Überfälligkeit und Phase, bei Gleichstand nach Set", () => {
    const parts = [
      { set: set(2), cards: cards([0, 1, 1], [1, 2, 3]) },
      { set: other(2), cards: cards([0, 1, 4], [1, 1, 1]) },
    ];
    const selection = planSelectionAcross(parts, TODAY);
    expect(selection.kind).toBe("review");
    // B e0 seit 3 Tagen überfällig, dann Phase 1 vor Phase 2, bei Gleichstand das erste Set.
    expect(keys(selection)).toEqual(["Be0", "Ae0", "Be1", "Ae1"]);
  });

  it("hält gleiche Eintrags-IDs in zwei Sets auseinander", () => {
    const parts = [
      { set: set(1), cards: cards([0, 1, 1]) },
      { set: other(1), cards: cards([0, 1, 1]) },
    ];
    expect(keys(planSelectionAcross(parts, TODAY))).toEqual(["Ae0", "Be0"]);
    expect(planSummaryAcross(parts, TODAY).due).toBe(2);
  });

  it("nimmt über alle Sets höchstens 30 und füllt mit neuen abwechselnd aus den Sets auf", () => {
    const due = (n: number) => cards(...Array.from({ length: n }, (_, i): Spec => [i, 1, 1]));
    const parts = [
      { set: set(20), cards: due(14) },
      { set: other(20), cards: due(14) },
    ];
    const selection = planSelectionAcross(parts, TODAY);
    expect(selection.cards).toHaveLength(30);
    expect(keys(selection).slice(28)).toEqual(["Ae14", "Be14"]);
  });

  it("bietet ohne Fälliges zehn neue an, abwechselnd aus den Sets", () => {
    const parts = [
      { set: set(8), cards: cards() },
      { set: other(2), cards: cards() },
    ];
    const selection = planSelectionAcross(parts, TODAY);
    expect(selection.kind).toBe("new");
    // Ist ein Set erschöpft, kommen die übrigen aus den anderen.
    expect(keys(selection)).toEqual([
      "Ae0",
      "Be0",
      "Ae1",
      "Be1",
      ...[2, 3, 4, 5, 6, 7].map((i) => `Ae${i}`),
    ]);
  });

  it("fasst die Übersicht zusammen", () => {
    const parts = [
      { set: set(3), cards: cards([0, 1, 1], [1, 3, 2]) },
      { set: other(2), cards: cards([0, 2, 1], [1, 2, 1]) },
    ];
    // Fällig: A e0. Als Nächstes in 2 Tagen (B), A e1 erst in 5. Neu: A e2 und die Gegenrichtungen
    // von A e1, B e0 und B e1 (ab Phase 2).
    expect(planSummaryAcross(parts, TODAY)).toEqual({ due: 1, nextDueIn: 2, fresh: 4 });
  });
});
