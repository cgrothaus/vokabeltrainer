import { describe, expect, it } from "vitest";
import { normalizeSetFile } from "./normalize";
import type { SetFile } from "./validate";

const base = { title: "Englisch", termLanguage: "en", meaningLanguage: "de" };

describe("normalizeSetFile", () => {
  it("löst Kurzformen in die Langform auf", () => {
    const file: SetFile = {
      set: base,
      sections: [
        {
          title: "S",
          entries: [{ term: "apple", meanings: ["Apfel", { text: "Paradiesapfel" }] }],
        },
      ],
    };
    expect(normalizeSetFile(file).sections[0]!.entries[0]).toEqual({
      term: { text: "apple" },
      meanings: [{ text: "Apfel" }, { text: "Paradiesapfel" }],
    });
  });

  it("behält Varianten und lässt leere Variantenlisten weg", () => {
    const file: SetFile = {
      set: base,
      sections: [
        {
          title: "S",
          entries: [
            {
              term: { text: "autumn", acceptedVariants: ["fall"] },
              meanings: [{ text: "Herbst", acceptedVariants: [] }],
            },
          ],
        },
      ],
    };
    expect(normalizeSetFile(file).sections[0]!.entries[0]).toEqual({
      term: { text: "autumn", acceptedVariants: ["fall"] },
      meanings: [{ text: "Herbst" }],
    });
  });

  it("macht aus meaning (Einzahl) eine Liste mit einer Bedeutung", () => {
    const file: SetFile = {
      set: base,
      sections: [{ title: "S", entries: [{ term: "apple", meaning: "Apfel" }] }],
    };
    expect(normalizeSetFile(file).sections[0]!.entries[0]!.meanings).toEqual([{ text: "Apfel" }]);
  });

  it("trimmt Texte und überführt sie in NFC, innere Leerzeichen bleiben", () => {
    // „Bär“ zerlegt: a mit kombinierendem Trema (U+0308).
    const decomposed = `Ba${String.fromCharCode(0x308)}r`;
    const file: SetFile = {
      set: { ...base, title: "  Englisch  Klasse 6 " },
      sections: [
        {
          title: " Tiere ",
          entries: [
            {
              term: { text: " bear ", acceptedVariants: [" Bear "] },
              meanings: [` ${decomposed} `],
            },
          ],
        },
      ],
    };
    const set = normalizeSetFile(file);
    expect(set.title).toBe("Englisch  Klasse 6");
    expect(set.sections[0]!.title).toBe("Tiere");
    expect(set.sections[0]!.entries[0]).toEqual({
      term: { text: "bear", acceptedVariants: ["Bear"] },
      meanings: [{ text: String.fromCharCode(0x42, 0xe4, 0x72) }],
    });
  });

  it("kanonisiert Sprachcodes", () => {
    const file: SetFile = {
      set: { ...base, termLanguage: "EN-gb", meaningLanguage: " DE " },
      sections: [{ title: "S", entries: [] }],
    };
    expect(normalizeSetFile(file)).toMatchObject({ termLanguage: "en-GB", meaningLanguage: "de" });
  });

  it("behält IDs aus der Datei und übernimmt nur bekannte Felder", () => {
    const file = {
      format: "vokabeltrainer-set",
      set: { ...base, id: "m4x8c2r9tw", rev: "k2p9w4ha", level: "Klasse 6", color: "blau" },
      sections: [
        {
          id: "q7h3kd",
          title: "S",
          entries: [{ id: "a8f2kc", term: "a", meanings: ["b"], notes: "später", difficulty: 3 }],
        },
        { title: "Ohne", entries: [{ term: "c", meanings: ["d"] }] },
      ],
    } as SetFile;
    expect(normalizeSetFile(file)).toEqual({
      id: "m4x8c2r9tw",
      title: "Englisch",
      termLanguage: "en",
      meaningLanguage: "de",
      sections: [
        {
          id: "q7h3kd",
          title: "S",
          entries: [{ id: "a8f2kc", term: { text: "a" }, meanings: [{ text: "b" }] }],
        },
        { title: "Ohne", entries: [{ term: { text: "c" }, meanings: [{ text: "d" }] }] },
      ],
    });
  });
});
