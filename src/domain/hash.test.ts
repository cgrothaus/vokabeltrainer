import { describe, expect, it } from "vitest";
import { canonicalize, cyrb53, encodeRev, entryRev } from "./hash";
import type { StoredEntry } from "./model";
import { normalizeSetFile } from "./normalize";
import type { FileAnswer, SetFile } from "./validate";

describe("cyrb53", () => {
  it("liefert die Werte der Referenzimplementierung", () => {
    expect(cyrb53("a")).toBe(7929297801672961);
    expect(cyrb53("b")).toBe(8684336938537663);
    expect(cyrb53("revenge")).toBe(4051478007546757);
    expect(cyrb53("revenue")).toBe(8309097637345594);
  });

  it("bleibt unter 2^53", () => {
    for (const text of ["", "x", "Fußball", "😀".repeat(50)])
      expect(cyrb53(text)).toBeLessThanOrEqual(Number.MAX_SAFE_INTEGER);
  });
});

describe("encodeRev", () => {
  it("schreibt die niederwertigsten acht Stellen zur Basis 31, die kleinste zuerst", () => {
    expect(encodeRev(0)).toBe("22222222");
    expect(encodeRev(1)).toBe("32222222");
    expect(encodeRev(30)).toBe("z2222222");
    expect(encodeRev(31)).toBe("23222222");
    expect(encodeRev(31 ** 7 * 30)).toBe("2222222z");
    expect(encodeRev(31 ** 8)).toBe("22222222");
    expect(encodeRev(Number.MAX_SAFE_INTEGER)).toMatch(/^[2-9a-hjkmnp-z]{8}$/);
  });
});

describe("canonicalize", () => {
  it("sortiert Schlüssel auf jeder Ebene", () => {
    expect(canonicalize({ b: 1, a: { d: 2, c: 3 } })).toBe('{"a":{"c":3,"d":2},"b":1}');
  });

  it("lässt fehlende Felder, leere Arrays und leere Objekte weg", () => {
    expect(canonicalize({ a: undefined, b: [], c: {}, d: { e: [] }, f: "" })).toBe('{"f":""}');
  });

  it("behält die Reihenfolge von Arrays", () => {
    expect(canonicalize({ a: ["y", "x"] })).toBe('{"a":["y","x"]}');
  });
});

describe("entryRev", () => {
  const entry: StoredEntry = {
    id: "a8f2kc",
    term: { text: "to miss" },
    meanings: [{ text: "vermissen" }, { text: "verpassen" }],
  };

  it("hat acht Zeichen aus dem ID-Alphabet", () => {
    expect(entryRev(entry)).toMatch(/^[2-9a-hjkmnp-z]{8}$/);
  });

  it("ist eingefroren: exportierte Prüfwerte müssen gültig bleiben", () => {
    expect(entryRev(entry)).toBe("xq6g2dsd");
  });

  it("hängt nicht von der ID und der Schlüsselreihenfolge ab", () => {
    expect(entryRev({ ...entry, id: "zzzzzz" })).toBe(entryRev(entry));
    expect(entryRev({ meanings: entry.meanings, term: entry.term, id: entry.id })).toBe(
      entryRev(entry),
    );
  });

  it("ändert sich mit jeder inhaltlichen Änderung", () => {
    const revs = [
      entry,
      { ...entry, term: { text: "to mis" } },
      { ...entry, term: { text: "to miss", acceptedVariants: ["miss"] } },
      { ...entry, meanings: [{ text: "verpassen" }, { text: "vermissen" }] },
      { ...entry, meanings: [{ text: "vermissen" }] },
      { ...entry, notes: "Notiz" },
      { ...entry, grammar: { partOfSpeech: "verb" } },
      { ...entry, reviewStatus: "checked" as const },
    ].map(entryRev);
    expect(new Set(revs).size).toBe(revs.length);
  });

  it("wertet leere Variantenlisten wie fehlende", () => {
    expect(
      entryRev({ ...entry, term: { text: "to miss", acceptedVariants: [] }, grammar: {} }),
    ).toBe(entryRev(entry));
  });

  it("ergibt für Kurz- und Langform derselben Datei denselben Wert", () => {
    const file = (term: FileAnswer, meanings: FileAnswer[]): SetFile => ({
      set: { title: "T", termLanguage: "en", meaningLanguage: "de" },
      sections: [{ title: "S", entries: [{ id: "a8f2kc", term, meanings }] }],
    });
    const rev = (setFile: SetFile) =>
      entryRev(normalizeSetFile(setFile).sections[0]!.entries[0] as StoredEntry);
    expect(rev(file("to miss", ["vermissen", "verpassen"]))).toBe(
      rev(
        file({ text: "to miss" }, [
          { text: "vermissen" },
          { text: "verpassen", acceptedVariants: [] },
        ]),
      ),
    );
  });
});
