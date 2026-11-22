import { describe, expect, it } from "vitest";
import type { StoredEntry } from "./model";
import {
  answer,
  type Card,
  cardFaces,
  currentCard,
  distractors,
  hasChoices,
  multipleChoice,
  type PracticeState,
  MAX_RESPONSE_MS,
  repeatMistakes,
  responseTime,
  sideText,
  startPlannedPractice,
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

describe("startPlannedPractice", () => {
  const planned = [
    { entryId: "a", direction: "termToMeaning" as const },
    { entryId: "b", direction: "meaningToTerm" as const },
    { entryId: "c", direction: "meaningToTerm" as const },
    { entryId: "d", direction: "termToMeaning" as const },
  ];

  it("mischt die Karten und behält die Richtung jeder Karte", () => {
    const state = startPlannedPractice(planned, {}, sequence(0));
    expect(ids(state)).toEqual(["b", "c", "d", "a"]);
    expect(Object.fromEntries(state.queue.map((card) => [card.entryId, card.direction]))).toEqual({
      a: "termToMeaning",
      b: "meaningToTerm",
      c: "meaningToTerm",
      d: "termToMeaning",
    });
    expect(state.total).toBe(4);
    expect(state.queue.every((card) => card.mode === "flashcard" && card.firstAttempt)).toBe(true);
  });

  it("stellt jede Karte in der Form, die der Plan wünscht, ohne Kandidaten als Karteikarte", () => {
    const state = startPlannedPractice(
      [
        { entryId: "a", direction: "termToMeaning", mode: "multipleChoice" },
        { entryId: "b", direction: "meaningToTerm", mode: "multipleChoice" },
        { entryId: "c", direction: "meaningToTerm", mode: "flashcard" },
        { entryId: "d", direction: "termToMeaning" },
      ],
      { canChoose: (id) => id !== "a" },
      sequence(0),
    );
    expect(Object.fromEntries(state.queue.map((card) => [card.entryId, card.mode]))).toEqual({
      a: "flashcard",
      b: "multipleChoice",
      c: "flashcard",
      d: "flashcard",
    });
  });

  it("stellt Buchstaben nur in Richtung Lernsprache und bei passender Länge", () => {
    const state = startPlannedPractice(
      [
        { entryId: "a", direction: "meaningToTerm", mode: "letters" },
        { entryId: "b", direction: "meaningToTerm", mode: "letters" },
        { entryId: "c", direction: "termToMeaning", mode: "letters" },
      ],
      { canSpell: (id) => id !== "b" },
      sequence(0),
    );
    expect(Object.fromEntries(state.queue.map((card) => [card.entryId, card.mode]))).toEqual({
      a: "letters",
      b: "flashcard",
      c: "flashcard",
    });
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

  it("stellt mit Buchstaben die übrigen Karten in Richtung Lernsprache so, wo es geht", () => {
    const canSpell = (entryId: string) => entryId !== "c";
    const options = { direction: "mixed", mcShare: 30, letters: true, canSpell } as const;
    const state = startPractice(entryIds, options, sequence(0.2, 0.7, 0.4));
    // Der Anteil an Multiple Choice bleibt.
    expect(choices(state)).toHaveLength(3);
    for (const card of state.queue) {
      if (card.mode === "multipleChoice") continue;
      const spellable = card.direction === "meaningToTerm" && card.entryId !== "c";
      expect(card.mode).toBe(spellable ? "letters" : "flashcard");
    }
    expect(state.queue.some((card) => card.mode === "letters")).toBe(true);
  });

  it("stellt ohne Buchstaben in Richtung Lernsprache Karteikarten", () => {
    const state = startPractice(entryIds, { direction: "meaningToTerm" }, sequence(0.5));
    expect(state.queue.every((card) => card.mode === "flashcard")).toBe(true);
  });

  it("stellt eine falsch beantwortete Karte wieder in derselben Form", () => {
    const state = startPractice(
      entryIds,
      { direction: "termToMeaning", mcShare: 100 },
      sequence(0.5),
    );
    const { state: next, recorded } = answer(state, "incorrect");
    expect(recorded.mode).toBe("multipleChoice");
    expect(next.queue[6]).toMatchObject({ entryId: recorded.entryId, mode: "multipleChoice" });
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

  it("fügt eine falsche Karte erst nach sechs anderen wieder ein", () => {
    let state = startPractice(
      ["a", "b", "c", "d", "e", "f", "g", "h"],
      { direction: "termToMeaning" },
      sequence(0.99),
    );
    const [first, ...rest] = ids(state);
    state = reply(state, "incorrect");
    expect(ids(state)).toEqual([...rest.slice(0, 6), first, ...rest.slice(6)]);
    expect(state.queue[6]).toMatchObject({ firstAttempt: false, needed: 2 });
    expect(state.done).toBe(0);
  });

  it("verlangt nach einem Fehler zwei richtige Antworten mit Abstand", () => {
    const entries = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n"];
    let state = startPractice(entries, { direction: "termToMeaning" }, sequence(0.99));
    const first = ids(state)[0]!;
    state = reply(state, "incorrect");
    for (let i = 0; i < 6; i++) state = reply(state, "correct");
    expect(ids(state)[0]).toBe(first);
    state = reply(state, "correct");
    // Einmal gewusst: Sie kommt noch einmal, wieder nach sechs anderen, und zählt noch nicht.
    expect(ids(state)[6]).toBe(first);
    expect(state.queue[6]).toMatchObject({ needed: 1 });
    expect(state.done).toBe(6);
    for (let i = 0; i < 6; i++) state = reply(state, "correct");
    state = reply(state, "correct");
    expect(ids(state)).not.toContain(first);
    expect(state.done).toBe(13);
  });

  it("setzt bei einem erneuten Fehler wieder auf zwei richtige Antworten", () => {
    let state = startPractice(["a", "b"], { direction: "termToMeaning" }, sequence(0.99));
    const first = ids(state)[0]!;
    state = reply(state, "incorrect"); // b, a(2)
    state = reply(state, "correct"); // a(2)
    state = reply(state, "correct"); // a(1)
    expect(state.queue).toMatchObject([{ entryId: first, needed: 1 }]);
    state = reply(state, "incorrect");
    expect(state.queue).toMatchObject([{ entryId: first, needed: 2 }]);
    state = reply(reply(state, "correct"), "correct");
    expect(currentCard(state)).toBeUndefined();
    expect(state.done).toBe(2);
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
    const last = answer(again.state, "correct");
    expect(last.recorded).toMatchObject({ entryId: first.recorded.entryId, firstAttempt: false });
    expect(last.state).toMatchObject({ firstAttempts: 2, firstCorrect: 1, done: 2, total: 2 });
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

  it("merkt die beim Erstversuch falschen Karten in der Reihenfolge der Antworten", () => {
    let state = start();
    expect(state.missed).toEqual([]);
    const [a, b, c] = ids(state);
    state = reply(state, "incorrect"); // a
    state = reply(state, "correct"); // b
    state = reply(state, "incorrect"); // c
    expect(state.missed).toEqual([
      { entryId: a, direction: "termToMeaning", mode: "flashcard", firstAttempt: true },
      { entryId: c, direction: "termToMeaning", mode: "flashcard", firstAttempt: true },
    ]);
    expect(state.missed.map((card) => card.entryId)).not.toContain(b);
  });

  it("merkt eine Karte nur einmal, auch wenn die Wiederholung wieder falsch ist", () => {
    let state = startPractice(["a"], { direction: "termToMeaning" }, sequence(0.99));
    state = reply(reply(reply(state, "incorrect"), "incorrect"), "correct");
    expect(state.missed.map((card) => card.entryId)).toEqual(["a"]);
    expect(state.missed[0]).not.toHaveProperty("needed");
  });
});

describe("repeatMistakes", () => {
  const missed: Card[] = [
    { entryId: "a", direction: "termToMeaning", mode: "flashcard", firstAttempt: true },
    { entryId: "b", direction: "meaningToTerm", mode: "multipleChoice", firstAttempt: true },
    { entryId: "c", direction: "termToMeaning", mode: "multipleChoice", firstAttempt: true },
    { entryId: "d", direction: "meaningToTerm", mode: "letters", firstAttempt: true },
  ];

  it("stellt jede Karte in Richtung und Form wie beim Fehler, neu gemischt", () => {
    // Wie bei startPractice: [a, b, c, d] → [d, b, c, a] → [c, b, d, a] → [b, c, d, a].
    const state = repeatMistakes(missed, sequence(0));
    expect(state.queue).toEqual([missed[1], missed[2], missed[3], missed[0]]);
    expect(state).toMatchObject({ total: 4, done: 0, firstAttempts: 0, firstCorrect: 0 });
    expect(state.missed).toEqual([]);
  });

  it("zählt jede Karte wieder als Erstversuch, einmal gewusst genügt", () => {
    const state = repeatMistakes([{ ...missed[0]!, firstAttempt: false, needed: 2 }], sequence(0));
    expect(state.queue[0]).toEqual(missed[0]);
  });

  it("ändert die Eingabe nicht und kommt mit einer leeren Liste aus", () => {
    const before: unknown = JSON.parse(JSON.stringify(missed));
    repeatMistakes(missed, sequence(0.5));
    expect(missed).toEqual(before);
    expect(repeatMistakes([], sequence(0)).queue).toEqual([]);
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
      entry("b", "shore", "UFER"),
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

  it("nimmt Einträge aus anderen Sets der Sitzung, auch mit gleicher Eintrags-ID (TDD 12.10)", () => {
    // Eintrags-IDs sind nur innerhalb eines Sets eindeutig.
    const elsewhere = entry("big", "tall", "hoch");
    const pool = [big, elsewhere, entry("x", "small", "klein")];
    const found = distractors(big, "termToMeaning", pool, []);
    expect(found.map((c) => sideText(c, "meanings"))).toEqual(["hoch", "klein"]);
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

describe("plausible Kandidaten", () => {
  const as = (partOfSpeech: string, value: StoredEntry): StoredEntry => ({
    ...value,
    grammar: { partOfSpeech },
  });
  const go = as("verb", entry("go", "to go", "gehen"));

  it("bevorzugt dieselbe Wortart, dann unbekannte, dann andere – vor den Sektionen", () => {
    const preferred = [
      as("noun", entry("n", "house", "Haus")),
      entry("u", "quickly", "schnell"),
      as("adjective", entry("j", "tall", "groß")),
    ];
    const rest = [
      as("Verb", entry("v", "to run", "laufen")),
      as("verb", entry("w", "to eat", "essen")),
    ];
    const order = distractors(go, "termToMeaning", preferred, rest).map((c) => c.id);
    expect(order).toEqual(["v", "w", "u", "j", "n"]);
  });

  it("stellt bei gleicher Wortart die Sektionen der Sitzung vor das übrige Set", () => {
    const preferred = [as("verb", entry("p", "to sleep", "schlafen"))];
    const rest = [as("verb", entry("r", "to read", "lesen"))];
    expect(distractors(go, "termToMeaning", preferred, rest).map((c) => c.id)).toEqual(["p", "r"]);
  });

  it("bevorzugt eine ähnliche Form, wenn die Wortart fehlt", () => {
    const pool = [entry("a", "house", "Haus"), entry("b", "to swim", "schwimmen")];
    const plain = entry("g", "to go", "gehen");
    expect(distractors(plain, "meaningToTerm", pool, []).map((c) => c.id)).toEqual(["b", "a"]);
    // Auf der Bedeutungsseite: Kleinschreibung wie „gehen“ vor dem großgeschriebenen Nomen.
    expect(distractors(plain, "termToMeaning", pool, []).map((c) => c.id)).toEqual(["b", "a"]);
  });

  it("wählt für Multiple Choice die drei plausibelsten", () => {
    const preferred = [
      go,
      as("verb", entry("a", "to run", "laufen")),
      as("verb", entry("b", "to eat", "essen")),
      as("noun", entry("c", "house", "Haus")),
      as("noun", entry("d", "tree", "Baum")),
    ];
    const rest = [as("verb", entry("e", "to read", "lesen"))];
    for (const seed of [0.05, 0.5, 0.95]) {
      const choice = multipleChoice(go, "termToMeaning", preferred, rest, sequence(seed))!;
      const wrong = choice.options.filter((_, index) => index !== choice.correct);
      expect(wrong.toSorted()).toEqual(["essen", "laufen", "lesen"]);
    }
  });

  it("schließt Gleichbedeutende trotz gleicher Wortart aus", () => {
    const pool = [as("verb", entry("s", "to walk", "gehen|laufen"))];
    expect(distractors(go, "termToMeaning", pool, [])).toEqual([]);
  });
});

describe("responseTime", () => {
  it("liefert ganze Millisekunden zwischen Start und Antwort", () => {
    expect(responseTime(1000.4, 3500.9, false)).toBe(2501);
    expect(responseTime(1000, 1000, false)).toBe(0);
  });

  it("kappt lange Zeiten bei der Obergrenze", () => {
    expect(MAX_RESPONSE_MS).toBe(60_000);
    expect(responseTime(0, 61_000, false)).toBe(MAX_RESPONSE_MS);
  });

  it("liefert nichts, wenn die Messung unterbrochen war oder nicht stimmen kann", () => {
    expect(responseTime(0, 2000, true)).toBeUndefined();
    expect(responseTime(2000, 1000, false)).toBeUndefined();
    expect(responseTime(Number.NaN, 1000, false)).toBeUndefined();
  });
});
