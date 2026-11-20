import { describe, expect, it } from "vitest";
import { cardKey, type CardState, type Phase } from "./learningState";
import type { Direction, StoredSet } from "./model";
import { nextDueIn, planSelection, planSummary } from "./plan";

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
