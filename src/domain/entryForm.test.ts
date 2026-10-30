import { describe, expect, it } from "vitest";
import { emptyEntryForm, type EntryForm, entryToForm, formChanged, formToEntry } from "./entryForm";
import type { StoredEntry } from "./model";

const full: StoredEntry = {
  id: "a8f2kc",
  term: { text: "autumn", acceptedVariants: ["fall"] },
  meanings: [{ text: "Herbst" }, { text: "Spätzeit", acceptedVariants: ["späte Zeit"] }],
  notes: "amerikanisch: fall",
  examples: [{ text: "Leaves fall in autumn.", translation: "Im Herbst fallen Blätter." }],
  grammar: { partOfSpeech: "noun", plural: "autumns", forms: ["autumnal"] },
  reviewStatus: "checked",
};

/** Ein gültiges Formular mit Wort und einer Bedeutung. */
function form(overrides: Partial<EntryForm> = {}): EntryForm {
  return {
    ...emptyEntryForm("q7h3kd"),
    term: { text: "rain", variants: [] },
    meanings: [{ text: "Regen", variants: [] }],
    ...overrides,
  };
}

const errors = (value: EntryForm, previous?: StoredEntry) => {
  const result = formToEntry(value, "a8f2kc", previous);
  return result.ok ? [] : result.errors;
};

describe("entryToForm und formToEntry", () => {
  it("ergeben zusammen wieder denselben Eintrag", () => {
    const result = formToEntry(entryToForm(full, "q7h3kd"), full.id, full);
    expect(result).toEqual({ ok: true, entry: full });
  });

  it("füllt fehlende Angaben mit leeren Feldern", () => {
    const minimal: StoredEntry = {
      id: "a8f2kc",
      term: { text: "rain" },
      meanings: [{ text: "Regen" }],
    };
    expect(entryToForm(minimal, "q7h3kd")).toEqual(form());
  });

  it("legt ein leeres Formular mit einer Bedeutung in der Sektion an", () => {
    expect(emptyEntryForm("q7h3kd")).toEqual({
      sectionId: "q7h3kd",
      term: { text: "", variants: [] },
      meanings: [{ text: "", variants: [] }],
      partOfSpeech: "",
      gender: "",
      plural: "",
      forms: [],
      examples: [],
      notes: "",
      checked: false,
    });
  });
});

describe("formToEntry", () => {
  it("trimmt Texte, bringt sie in NFC und lässt leere optionale Felder weg", () => {
    const decomposed = `Spa${String.fromCharCode(0x308)}tzeit`;
    const result = formToEntry(
      form({
        term: { text: "  rain ", variants: [" drizzle "] },
        meanings: [{ text: decomposed, variants: [] }],
        notes: "   ",
        plural: " ",
      }),
      "a8f2kc",
    );
    expect(result).toEqual({
      ok: true,
      entry: {
        id: "a8f2kc",
        term: { text: "rain", acceptedVariants: ["drizzle"] },
        meanings: [{ text: "Spätzeit" }],
      },
    });
  });

  it("lässt leere Zeilen still weg", () => {
    const result = formToEntry(
      form({
        term: { text: "rain", variants: ["", " "] },
        meanings: [
          { text: "", variants: [""] },
          { text: "Regen", variants: ["", "Niederschlag"] },
          { text: " ", variants: [] },
        ],
        forms: ["", " "],
        examples: [{ text: "", translation: "" }],
      }),
      "a8f2kc",
    );
    expect(result).toEqual({
      ok: true,
      entry: {
        id: "a8f2kc",
        term: { text: "rain" },
        meanings: [{ text: "Regen", acceptedVariants: ["Niederschlag"] }],
      },
    });
  });

  it("verlangt das Wort und mindestens eine Bedeutung", () => {
    expect(errors(form({ term: { text: " ", variants: [] } }))).toEqual([
      { field: "term", message: "Das Wort fehlt." },
    ]);
    expect(errors(form({ meanings: [{ text: "", variants: [] }] }))).toEqual([
      { field: "meanings.0", message: "Es fehlt eine Bedeutung." },
    ]);
  });

  it("meldet Varianten ohne Text an ihrer Zeile", () => {
    expect(
      errors(
        form({
          meanings: [
            { text: "Regen", variants: [] },
            { text: "", variants: ["Niederschlag"] },
          ],
        }),
      ),
    ).toEqual([{ field: "meanings.1", message: "Bei Bedeutung 2 fehlt der Text." }]);
    expect(errors(form({ term: { text: "", variants: ["drizzle"] } }))).toEqual([
      { field: "term", message: "Das Wort fehlt." },
    ]);
  });

  it("meldet eine Übersetzung ohne Beispielsatz", () => {
    expect(errors(form({ examples: [{ text: " ", translation: "Es regnet." }] }))).toEqual([
      { field: "examples.0", message: "Bei Beispiel 1 fehlt der Satz." },
    ]);
  });

  it("prüft die Höchstlängen nach dem Trimmen", () => {
    const long = (n: number) => "x".repeat(n);
    expect(errors(form({ term: { text: ` ${long(500)} `, variants: [] } }))).toEqual([]);
    expect(
      errors(
        form({
          term: { text: long(501), variants: [long(501)] },
          meanings: [{ text: "Regen", variants: [long(501)] }],
          notes: long(2001),
          plural: long(201),
          forms: [long(201)],
          examples: [{ text: long(501), translation: long(501) }],
        }),
      ),
    ).toEqual([
      { field: "term", message: "Das Wort ist länger als 500 Zeichen." },
      { field: "term", message: "Eine Variante des Wortes ist länger als 500 Zeichen." },
      {
        field: "meanings.0",
        message: "Eine Variante von Bedeutung 1 ist länger als 500 Zeichen.",
      },
      { field: "plural", message: "Der Plural ist länger als 200 Zeichen." },
      { field: "forms", message: "Eine Wortform ist länger als 200 Zeichen." },
      { field: "examples.0", message: "Beispiel 1 ist länger als 500 Zeichen." },
      {
        field: "examples.0",
        message: "Die Übersetzung von Beispiel 1 ist länger als 500 Zeichen.",
      },
      { field: "notes", message: "Die Notiz ist länger als 2.000 Zeichen." },
    ]);
  });

  it("zählt Zeichen, nicht UTF-16-Einheiten", () => {
    expect(errors(form({ term: { text: "😀".repeat(500), variants: [] } }))).toEqual([]);
  });

  it("setzt den Prüfstatus nach dem Haken und lässt ihn weg, wenn er vorher fehlte", () => {
    const status = (checked: boolean, previous?: StoredEntry) => {
      const result = formToEntry(form({ checked }), "a8f2kc", previous);
      return result.ok ? result.entry.reviewStatus : "Fehler";
    };
    const before = (reviewStatus?: "checked" | "unchecked"): StoredEntry => ({
      ...full,
      ...(reviewStatus ? { reviewStatus } : { reviewStatus: undefined }),
    });
    expect(status(true)).toBe("checked");
    expect(status(false)).toBeUndefined();
    expect(status(false, before())).toBeUndefined();
    expect(status(false, before("unchecked"))).toBe("unchecked");
    expect(status(false, before("checked"))).toBe("unchecked");
    expect(status(true, before("unchecked"))).toBe("checked");
  });
});

describe("formChanged", () => {
  it("erkennt Änderungen an Inhalt, Sektion und Prüfstatus", () => {
    const original = entryToForm(full, "q7h3kd");
    expect(formChanged(original, original)).toBe(false);
    expect(formChanged({ ...original, notes: "neu" }, original)).toBe(true);
    expect(formChanged({ ...original, sectionId: "x4k9pd" }, original)).toBe(true);
    expect(formChanged({ ...original, checked: false }, original)).toBe(true);
    expect(formChanged({ ...original, meanings: [...original.meanings].reverse() }, original)).toBe(
      true,
    );
  });

  it("übersieht Leerraum am Rand und leere Zeilen", () => {
    const original = entryToForm(full, "q7h3kd");
    const padded: EntryForm = {
      ...original,
      term: { text: " autumn ", variants: ["fall", " "] },
      forms: [...original.forms, ""],
      examples: [...original.examples, { text: "", translation: "" }],
    };
    expect(formChanged(padded, original)).toBe(false);
  });

  it("sieht ein leeres neues Formular als unverändert an", () => {
    const empty = emptyEntryForm("q7h3kd");
    expect(formChanged({ ...empty, meanings: [] }, empty)).toBe(false);
    expect(formChanged({ ...empty, notes: "x" }, empty)).toBe(true);
  });
});
