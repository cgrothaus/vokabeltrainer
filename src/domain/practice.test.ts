import { describe, expect, it } from "vitest";
import type { StoredEntry } from "./model";
import { answer, cardFaces, currentCard, type PracticeState, startPractice } from "./practice";

/** Liefert die angegebenen Werte der Reihe nach und danach immer wieder von vorn. */
function sequence(...values: number[]): () => number {
  let next = 0;
  return () => values[next++ % values.length]!;
}

const ids = (state: PracticeState) => state.queue.map((card) => card.entryId);

/** Beantwortet die aktuelle Karte und liefert nur den neuen Zustand. */
const reply = (state: PracticeState, result: "correct" | "incorrect") =>
  answer(state, result).state;

describe("startPractice", () => {
  it("mischt die Einträge (Fisher-Yates mit übergebenem Zufall)", () => {
    // Bei 0 tauscht jeder Schritt mit dem ersten Element: [a, b, c] → [c, b, a] → [b, c, a].
    const state = startPractice(["a", "b", "c"], "termToMeaning", sequence(0));
    expect(ids(state)).toEqual(["b", "c", "a"]);
  });

  it("enthält jeden Eintrag genau einmal und ändert die Eingabe nicht", () => {
    const entryIds = ["a", "b", "c", "d", "e", "f"];
    const state = startPractice(entryIds, "termToMeaning", sequence(0.7, 0.1, 0.4, 0.9, 0.3));
    expect([...ids(state)].sort()).toEqual(entryIds);
    expect(entryIds).toEqual(["a", "b", "c", "d", "e", "f"]);
    expect(state.total).toBe(6);
    expect(state.queue.every((card) => card.firstAttempt)).toBe(true);
  });

  it("nutzt die feste Richtung für alle Karten", () => {
    const state = startPractice(["a", "b"], "meaningToTerm", sequence(0.5));
    expect(state.queue.map((card) => card.direction)).toEqual(["meaningToTerm", "meaningToTerm"]);
  });

  it("wählt bei gemischter Richtung pro Karte zufällig", () => {
    // Erst ein Wert fürs Mischen (zwei Einträge), dann einer pro Karte.
    const state = startPractice(["a", "b"], "mixed", sequence(0.9, 0.2, 0.7));
    expect(state.queue.map((card) => card.direction)).toEqual(["termToMeaning", "meaningToTerm"]);
  });
});

describe("answer", () => {
  const start = () =>
    startPractice(["a", "b", "c", "d", "e", "f"], "termToMeaning", sequence(0.99));

  it("nimmt eine gewusste Karte aus der Warteschlange", () => {
    const state = start();
    const first = ids(state)[0];
    const next = reply(state, "correct");
    expect(ids(next)).not.toContain(first);
    expect(next.done).toBe(1);
  });

  it("fügt eine falsche Karte an Position 4 wieder ein", () => {
    const state = start();
    const [first, ...rest] = ids(state);
    const next = reply(state, "incorrect");
    expect(ids(next)).toEqual([...rest.slice(0, 3), first, ...rest.slice(3)]);
    expect(next.queue[3]!.firstAttempt).toBe(false);
    expect(next.done).toBe(0);
  });

  it("fügt ans Ende ein, wenn die Warteschlange kürzer ist", () => {
    let state = startPractice(["a", "b", "c"], "termToMeaning", sequence(0.99));
    const first = ids(state)[0];
    state = reply(state, "incorrect");
    expect(ids(state)).toHaveLength(3);
    expect(ids(state)[2]).toBe(first);
    // Als letzte Karte bleibt sie die einzige.
    state = reply(reply(state, "correct"), "correct");
    state = reply(state, "incorrect");
    expect(ids(state)).toEqual([first]);
  });

  it("zählt nur die erste Antwort zu einem Eintrag als Erstversuch", () => {
    let state = startPractice(["a", "b"], "termToMeaning", sequence(0.99));
    const first = answer(state, "incorrect");
    expect(first.recorded).toEqual({
      entryId: ids(state)[0],
      direction: "termToMeaning",
      result: "incorrect",
      firstAttempt: true,
    });
    state = first.state;
    expect(answer(state, "correct").recorded.firstAttempt).toBe(true); // zweiter Eintrag
    state = reply(state, "correct");
    const again = answer(state, "correct");
    expect(again.recorded).toMatchObject({ entryId: first.recorded.entryId, firstAttempt: false });
    expect(again.state).toMatchObject({ firstAttempts: 2, firstCorrect: 1, done: 2, total: 2 });
  });

  it("ist fertig, wenn alle Karten gewusst sind", () => {
    let state = startPractice(["a", "b"], "termToMeaning", sequence(0.99));
    state = reply(reply(state, "correct"), "correct");
    expect(currentCard(state)).toBeUndefined();
    expect(() => answer(state, "correct")).toThrow();
  });

  it("ändert den bisherigen Zustand nicht", () => {
    const state = start();
    const before: unknown = JSON.parse(JSON.stringify(state));
    reply(state, "incorrect");
    expect(state).toEqual(before);
  });
});

describe("cardFaces", () => {
  const entry: StoredEntry = {
    id: "a8f2kc",
    term: { text: "to miss", acceptedVariants: ["miss"] },
    meanings: [{ text: "vermissen" }, { text: "verpassen" }],
  };

  it("zeigt den Begriff als Frage und alle Bedeutungen als Antwort", () => {
    expect(cardFaces(entry, "termToMeaning")).toEqual({
      prompt: "to miss",
      answer: "vermissen; verpassen",
    });
  });

  it("dreht die Seiten in der Gegenrichtung", () => {
    expect(cardFaces(entry, "meaningToTerm")).toEqual({
      prompt: "vermissen; verpassen",
      answer: "to miss",
    });
  });
});
