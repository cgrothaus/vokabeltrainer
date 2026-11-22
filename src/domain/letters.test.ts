import { describe, expect, it } from "vitest";
import {
  canSpell,
  composeWord,
  extraCount,
  LETTERS_MAX,
  letterPattern,
  letterPuzzle,
  spelled,
} from "./letters";
import type { StoredEntry } from "./model";

/** Liefert die angegebenen Werte der Reihe nach und danach immer wieder von vorn. */
function sequence(...values: number[]): () => number {
  let next = 0;
  return () => values[next++ % values.length]!;
}

/** `term` mit Varianten nach „|“, z. B. „grey|gray“. */
function entry(term: string, meaning = "Bedeutung"): StoredEntry {
  const [text, ...acceptedVariants] = term.split("|");
  return {
    id: term,
    term: acceptedVariants.length > 0 ? { text: text!, acceptedVariants } : { text: text! },
    meanings: [{ text: meaning }],
  };
}

describe("letterPattern", () => {
  it("macht Buchstaben und Ziffern zu Stellen, alles andere steht fest", () => {
    expect(letterPattern("to look-up Mr. O'Neil 2")).toEqual([
      ...[null, null, " "],
      ...[null, null, null, null, "-", null, null, " "],
      ...[null, null, ".", " "],
      ...[null, "'", null, null, null, null, " ", null],
    ]);
  });

  it("trimmt und behält kombinierende Zeichen in derselben Stelle", () => {
    const e = "e" + String.fromCharCode(0x0301);
    const n = "n" + String.fromCharCode(0x0303) + String.fromCharCode(0x0301);
    expect(letterPattern(`  caf${e} `)).toEqual([null, null, null, null]);
    // Ohne NFC-Zusammenfassung bleibt das Graphem trotzdem eine Stelle.
    expect(letterPattern(`a${n}o`)).toEqual([null, null, null]);
  });
});

describe("canSpell", () => {
  it("gilt nur in Richtung Lernsprache", () => {
    expect(canSpell(entry("house"), "meaningToTerm")).toBe(true);
    expect(canSpell(entry("house"), "termToMeaning")).toBe(false);
  });

  it(`lässt Antworten bis ${LETTERS_MAX} Zeichen zu, längere und solche mit einem Buchstaben nicht`, () => {
    expect(canSpell(entry("a".repeat(18) + " b"), "meaningToTerm")).toBe(true);
    expect(canSpell(entry("a".repeat(19) + " b"), "meaningToTerm")).toBe(false);
    expect(canSpell(entry("I"), "meaningToTerm")).toBe(false);
    expect(canSpell(entry("a-"), "meaningToTerm")).toBe(false);
    expect(canSpell(entry("ok"), "meaningToTerm")).toBe(true);
  });
});

describe("extraCount", () => {
  it("ist ein Viertel der Buchstaben, mindestens 2 und höchstens 4", () => {
    expect([2, 5, 10, 12, 14, 20].map(extraCount)).toEqual([2, 2, 3, 3, 4, 4]);
  });
});

describe("letterPuzzle", () => {
  const pool = [entry("ü"), entry("tree"), entry("dog")];

  it("bietet die Buchstaben der Antwort wie geschrieben und zusätzliche aus anderen Wörtern", () => {
    const own = entry("House");
    const puzzle = letterPuzzle(own, [own, ...pool], sequence(0.5, 0.1, 0.9, 0.3))!;
    expect(puzzle.pattern).toEqual([null, null, null, null, null]);
    expect(puzzle.tiles).toHaveLength(7);
    const extra = [...puzzle.tiles];
    for (const letter of ["H", "o", "u", "s", "e"]) extra.splice(extra.indexOf(letter), 1);
    // Zusätzliche kleingeschrieben und aus den anderen Wörtern, nicht aus dem eigenen.
    expect(extra.every((letter) => "ütreedog".includes(letter))).toBe(true);
  });

  it("mischt die Kacheln", () => {
    const own = entry("abcdefgh");
    const tiles = letterPuzzle(own, [], sequence(0.3, 0.8, 0.1, 0.6))!.tiles;
    expect(tiles.slice(0, 8).join("")).not.toBe("abcdefgh");
  });

  it("nimmt ohne andere Wörter die Buchstaben der Antwort", () => {
    const puzzle = letterPuzzle(entry("Zz"), [], sequence(0.5))!;
    expect(puzzle.tiles).toHaveLength(4);
    expect(puzzle.tiles.every((letter) => letter === "Z" || letter === "z")).toBe(true);
  });

  it("schreibt zusätzliche groß, wenn die Antwort ganz großgeschrieben ist", () => {
    const tiles = letterPuzzle(entry("USA"), pool, sequence(0.5))!.tiles;
    expect(tiles.every((letter) => letter === letter.toUpperCase())).toBe(true);
  });

  it("legt die Buchstaben gleich langer Varianten dazu, statt zufälliger", () => {
    const puzzle = letterPuzzle(entry("grey|gray|grau-e"), pool, sequence(0.5))!;
    // „gray“: ein „a“; „grau-e“ hat andere Stellen und zählt nicht. Danach ein zufälliger.
    expect(puzzle.tiles).toHaveLength(6);
    const rest = [...puzzle.tiles];
    for (const letter of ["g", "r", "e", "y", "a"]) rest.splice(rest.indexOf(letter), 1);
    expect(rest).toHaveLength(1);
  });

  it("legt bei Varianten nur fehlende Buchstaben dazu, auch mehrere", () => {
    const puzzle = letterPuzzle(entry("Mum|Mom|MOOM"), pool, sequence(0.5))!;
    // „Mom“ braucht ein „o“, „MOOM“ ist länger. Zwei zusätzliche insgesamt.
    expect(puzzle.tiles.filter((letter) => !"Mum".includes(letter))).toHaveLength(2);
    expect(puzzle.tiles).toContain("o");
  });

  it("eignet sich nicht für zu lange Antworten", () => {
    expect(letterPuzzle(entry("a".repeat(LETTERS_MAX + 1)), pool, sequence(0.5))).toBeNull();
  });
});

describe("spelled", () => {
  it("setzt die Kacheln in die Stellen zwischen die festen Zeichen", () => {
    const pattern = letterPattern("to-do it");
    expect(composeWord(pattern, ["t", "o", "d", "o", "i", "t"])).toBe("to-do it");
    expect(composeWord(pattern, ["t", "o"])).toBe("to- ");
  });

  it("wertet die Antwort ohne Groß-/Kleinschreibung aus", () => {
    const own = entry("Haus");
    const pattern = letterPattern("Haus");
    expect(spelled(own, pattern, ["H", "a", "u", "s"])).toBe("correct");
    expect(spelled(own, pattern, ["h", "a", "u", "s"])).toBe("correct");
    expect(spelled(own, pattern, ["H", "u", "a", "s"])).toBe("incorrect");
  });

  it("zählt gleich lange Varianten als richtig", () => {
    const own = entry("grey|gray");
    const pattern = letterPattern("grey");
    expect(spelled(own, pattern, ["g", "r", "a", "y"])).toBe("correct");
    expect(spelled(own, pattern, ["g", "r", "a", "e"])).toBe("incorrect");
  });

  it("vergleicht in NFC", () => {
    const decomposed = "e" + String.fromCharCode(0x0301);
    const own = entry("café");
    expect(spelled(own, letterPattern("café"), ["c", "a", "f", decomposed])).toBe("correct");
  });
});
