import { describe, expect, it } from "vitest";
import type { StoredEntry } from "./model";
import {
  answer,
  cardFaces,
  currentCard,
  distractors,
  hasChoices,
  multipleChoice,
  type PracticeState,
  sideText,
  startPractice,
} from "./practice";

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
    const state = startPractice(["a", "b", "c"], { direction: "termToMeaning" }, sequence(0));
    expect(ids(state)).toEqual(["b", "c", "a"]);
  });

  it("enthält jeden Eintrag genau einmal und ändert die Eingabe nicht", () => {
    const entryIds = ["a", "b", "c", "d", "e", "f"];
    const state = startPractice(
      entryIds,
      { direction: "termToMeaning" },
      sequence(0.7, 0.1, 0.4, 0.9, 0.3),
    );
    expect([...ids(state)].sort()).toEqual(entryIds);
    expect(entryIds).toEqual(["a", "b", "c", "d", "e", "f"]);
    expect(state.total).toBe(6);
    expect(state.queue.every((card) => card.firstAttempt)).toBe(true);
  });

  it("nutzt die feste Richtung für alle Karten", () => {
    const state = startPractice(["a", "b"], { direction: "meaningToTerm" }, sequence(0.5));
    expect(state.queue.map((card) => card.direction)).toEqual(["meaningToTerm", "meaningToTerm"]);
  });

  it("wählt bei gemischter Richtung pro Karte zufällig", () => {
    // Erst ein Wert fürs Mischen (zwei Einträge), dann einer pro Karte.
    const state = startPractice(["a", "b"], { direction: "mixed" }, sequence(0.9, 0.2, 0.7));
    expect(state.queue.map((card) => card.direction)).toEqual(["termToMeaning", "meaningToTerm"]);
  });

  it("stellt ohne Anteil nur Karteikarten", () => {
    const state = startPractice(["a", "b", "c"], { direction: "termToMeaning" }, sequence(0));
    expect(state.queue.every((card) => card.mode === "flashcard")).toBe(true);
  });
});

describe("startPractice mit Multiple Choice", () => {
  const entryIds = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];
  const modes = (state: PracticeState) =>
    Object.fromEntries(state.queue.map((card) => [card.entryId, card.mode]));
  const choices = (state: PracticeState) =>
    state.queue.filter((card) => card.mode === "multipleChoice").map((card) => card.entryId);

  it("bestimmt beim Start genau den Anteil der Karten als Multiple Choice", () => {
    const random = sequence(0.7, 0.1, 0.4, 0.9, 0.3);
    const state = startPractice(entryIds, { direction: "termToMeaning", mcShare: 30 }, random);
    expect(choices(state)).toHaveLength(3);
    // 25 % von 10 Karten sind 2,5 – gerundet 3; 20 % sind genau 2.
    expect(
      choices(startPractice(entryIds, { direction: "mixed", mcShare: 25 }, random)),
    ).toHaveLength(3);
    expect(
      choices(startPractice(entryIds, { direction: "mixed", mcShare: 20 }, random)),
    ).toHaveLength(2);
    expect(
      choices(startPractice(entryIds, { direction: "mixed", mcShare: 100 }, random)),
    ).toHaveLength(10);
  });

  it("wählt die Karten zufällig", () => {
    const first = startPractice(
      entryIds,
      { direction: "termToMeaning", mcShare: 30 },
      sequence(0.1),
    );
    const second = startPractice(
      entryIds,
      { direction: "termToMeaning", mcShare: 30 },
      sequence(0.9),
    );
    expect(new Set(choices(first))).not.toEqual(new Set(choices(second)));
  });

  it("nimmt nur Karten mit genug Antwortmöglichkeiten, höchstens alle davon", () => {
    const canChoose = (entryId: string) => ["b", "e"].includes(entryId);
    const options = { direction: "termToMeaning", mcShare: 50, canChoose } as const;
    const state = startPractice(entryIds, options, sequence(0.3, 0.8));
    expect(choices(state).sort()).toEqual(["b", "e"]);
    expect(modes(state)).toMatchObject({ a: "flashcard", c: "flashcard" });
  });

  it("prüft die Eignung in der Richtung der Karte", () => {
    const canChoose = (_: string, direction: string) => direction === "meaningToTerm";
    const state = startPractice(
      entryIds,
      { direction: "mixed", mcShare: 100, canChoose },
      sequence(0.2, 0.7),
    );
    for (const card of state.queue) {
      expect(card.mode).toBe(card.direction === "meaningToTerm" ? "multipleChoice" : "flashcard");
    }
  });

  it("stellt eine falsch beantwortete Karte wieder in derselben Form", () => {
    const state = startPractice(
      entryIds,
      { direction: "termToMeaning", mcShare: 100 },
      sequence(0.5),
    );
    const { state: next, recorded } = answer(state, "incorrect");
    expect(recorded.mode).toBe("multipleChoice");
    expect(next.queue[3]).toMatchObject({ entryId: recorded.entryId, mode: "multipleChoice" });
  });
});

describe("answer", () => {
  const start = () =>
    startPractice(["a", "b", "c", "d", "e", "f"], { direction: "termToMeaning" }, sequence(0.99));

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
    let state = startPractice(["a", "b", "c"], { direction: "termToMeaning" }, sequence(0.99));
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
    let state = startPractice(["a", "b"], { direction: "termToMeaning" }, sequence(0.99));
    const first = answer(state, "incorrect");
    expect(first.recorded).toEqual({
      entryId: ids(state)[0],
      direction: "termToMeaning",
      mode: "flashcard",
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
    let state = startPractice(["a", "b"], { direction: "termToMeaning" }, sequence(0.99));
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

/** Eintrag mit einer Bedeutung pro Text; Varianten als „Text|Variante“. */
function entry(id: string, term: string, ...meanings: string[]): StoredEntry {
  const answer = (value: string) => {
    const [text, ...acceptedVariants] = value.split("|");
    return acceptedVariants.length > 0 ? { text: text!, acceptedVariants } : { text: text! };
  };
  return { id, term: answer(term), meanings: meanings.map(answer) };
}

describe("distractors", () => {
  const big = entry("big", "big|large", "groß");

  it("nimmt andere Einträge auf der Sprachseite der Antwort", () => {
    const others = [entry("x", "small", "klein"), entry("y", "old", "alt")];
    const toMeaning = distractors(big, "termToMeaning", [big, ...others], []);
    expect(toMeaning.map((candidate) => sideText(candidate, "meanings"))).toEqual(["klein", "alt"]);
    expect(distractors(big, "meaningToTerm", others, []).map((c) => c.id)).toEqual(["x", "y"]);
  });

  it("schließt Kandidaten aus, die eine akzeptierte Antwort teilen", () => {
    const pool = [
      entry("a", "large", "weit"), // Wort ist Variante von „big“
      entry("b", "huge", "riesig|groß"), // Variante der Bedeutung
      entry("c", "tall", "lang", "Groß "), // zweite Bedeutung, andere Schreibweise
      entry("d", "great", "großartig"),
    ];
    expect(distractors(big, "termToMeaning", pool, []).map((c) => c.id)).toEqual(["a", "d"]);
    expect(distractors(big, "meaningToTerm", pool, []).map((c) => c.id)).toEqual(["b", "c", "d"]);
  });

  it("vergleicht unabhängig von der Unicode-Darstellung", () => {
    // „über“ mit zerlegtem Umlaut (u + Trema) ist ohne NFC ein anderer Text.
    const decomposed = entry("u", "over", "u" + String.fromCharCode(0x0308) + "ber");
    const target = entry("t", "above", "über");
    expect(distractors(target, "termToMeaning", [decomposed], [])).toEqual([]);
  });

  it("nimmt von mehreren Kandidaten mit gleicher Anzeige nur einen", () => {
    const pool = [
      entry("a", "bank", "Ufer"),
      entry("b", "shore", "ufer"),
      entry("c", "coast", "Küste"),
    ];
    expect(distractors(big, "termToMeaning", pool, []).map((c) => c.id)).toEqual(["a", "c"]);
  });

  it("zeigt bei mehreren Bedeutungen alle zusammen", () => {
    const pool = [entry("a", "to miss", "vermissen", "verpassen")];
    expect(sideText(pool[0]!, "meanings")).toBe("vermissen; verpassen");
    expect(distractors(big, "termToMeaning", pool, [])).toHaveLength(1);
  });

  it("stellt Kandidaten der Sitzung vor die übrigen", () => {
    const preferred = [entry("p", "small", "klein")];
    const rest = [entry("r", "old", "alt")];
    expect(distractors(big, "termToMeaning", preferred, rest).map((c) => c.id)).toEqual(["p", "r"]);
  });
});

describe("multipleChoice", () => {
  const big = entry("big", "big|large", "groß");
  const preferred = [big, entry("a", "small", "klein"), entry("b", "old", "alt")];
  const rest = [
    entry("c", "new", "neu"),
    entry("d", "young", "jung"),
    entry("e", "huge", "riesig|groß"),
  ];

  it("bietet die richtige Antwort und drei falsche von derselben Sprachseite", () => {
    const choice = multipleChoice(big, "termToMeaning", preferred, rest, sequence(0.5))!;
    expect(choice.options).toHaveLength(4);
    expect(choice.options[choice.correct]).toBe("groß");
    const wrong = choice.options.filter((_, index) => index !== choice.correct);
    expect(wrong).not.toContain("riesig");
    // Beide aus der Sitzung, dann einer aus dem übrigen Set.
    expect(wrong).toEqual(expect.arrayContaining(["klein", "alt"]));
    expect(["neu", "jung"]).toContain(wrong.find((option) => !["klein", "alt"].includes(option)));
  });

  it("zeigt in der Gegenrichtung Wörter statt Bedeutungen", () => {
    const choice = multipleChoice(big, "meaningToTerm", preferred, rest, sequence(0.1))!;
    expect(choice.options[choice.correct]).toBe("big");
    for (const option of choice.options) {
      // „huge“ teilt „groß“ nur auf der Bedeutungsseite und ist hier geeignet.
      expect(["big", "small", "old", "new", "young", "huge"]).toContain(option);
    }
  });

  it("mischt Antworten und Position der richtigen", () => {
    const first = multipleChoice(big, "termToMeaning", preferred, rest, sequence(0.05))!;
    const second = multipleChoice(big, "termToMeaning", preferred, rest, sequence(0.95))!;
    expect(first.correct).not.toBe(second.correct);
    expect(first.options).not.toEqual(second.options);
  });

  it("liefert nichts bei weniger als drei geeigneten Kandidaten", () => {
    // „riesig“ teilt „groß“, „Klein“ zeigt dasselbe wie „klein“: nur zwei geeignete.
    const few = [
      big,
      entry("a", "small", "klein"),
      entry("e", "huge", "riesig|groß"),
      entry("f", "little", "Klein"),
      entry("c", "new", "neu"),
    ];
    expect(multipleChoice(big, "termToMeaning", few, [], sequence(0.5))).toBeNull();
    const enough = [...few, entry("d", "young", "jung")];
    expect(multipleChoice(big, "termToMeaning", enough, [], sequence(0.5))).not.toBeNull();
    expect(hasChoices(big, "termToMeaning", few)).toBe(false);
    expect(hasChoices(big, "termToMeaning", enough)).toBe(true);
  });
});
