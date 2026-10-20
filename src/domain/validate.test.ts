import { describe, expect, it } from "vitest";
import { MAX_ENTRIES, MAX_SECTIONS, validateSetFile } from "./validate";

type Json = Record<string, unknown>;

function file(overrides: Json = {}): Json {
  return {
    format: "vokabeltrainer-set",
    formatVersion: 1,
    set: { title: "Englisch – Freizeit", termLanguage: "en", meaningLanguage: "de" },
    sections: [
      {
        title: "Freizeit",
        entries: [
          { term: "football", meanings: ["Fußball"] },
          { term: "to miss", meanings: ["vermissen", "verpassen"] },
        ],
      },
    ],
    ...overrides,
  };
}

function withEntries(...entries: unknown[]): Json {
  return file({ sections: [{ title: "Freizeit", entries }] });
}

function errors(value: unknown): string[] {
  const result = validateSetFile(value);
  return result.ok ? [] : result.errors;
}

describe("validateSetFile – gültige Dateien", () => {
  it("akzeptiert das Minimalbeispiel ohne Warnungen", () => {
    const value = file();
    expect(validateSetFile(value)).toEqual({ ok: true, file: value, warnings: [] });
  });

  it("akzeptiert Kurz- und Langform von Antworten mit Varianten", () => {
    const value = withEntries({
      term: { text: "autumn", acceptedVariants: ["fall"] },
      meanings: [{ text: "Herbst" }, "Spätjahr"],
    });
    expect(validateSetFile(value).ok).toBe(true);
  });

  it("akzeptiert eine leere Sektion", () => {
    expect(errors(file({ sections: [{ title: "Später", entries: [] }] }))).toEqual([]);
  });

  it("akzeptiert IDs aus der Datei und fremde IDs nach dem erlaubten Muster", () => {
    const value = file({
      set: {
        id: "m4x8c2r9tw",
        title: "T",
        termLanguage: "en",
        meaningLanguage: "de",
      },
      sections: [
        {
          id: "Q7H3KD",
          title: "S",
          entries: [{ id: "a8f2kc-0_1", term: "a", meanings: ["b"] }],
        },
      ],
    });
    expect(errors(value)).toEqual([]);
  });

  it("nimmt ohne format und formatVersion Version 1 an und warnt", () => {
    const { format: _f, formatVersion: _v, ...rest } = file();
    expect(validateSetFile(rest)).toEqual({
      ok: true,
      file: rest,
      warnings: ["Die Formatversion fehlt; die App nimmt Version 1 an."],
    });
  });

  it("versteht meaning (Einzahl) und weist einmal darauf hin", () => {
    const result = validateSetFile(
      withEntries({ term: "apple", meaning: "Apfel" }, { term: "pear", meaning: "Birne" }),
    );
    expect(result).toMatchObject({
      ok: true,
      warnings: [
        "Bei 2 Einträgen steht „meaning“ statt „meanings“; das wurde als eine Bedeutung übernommen.",
      ],
    });
  });

  it.each(["en-GB", "pt-BR", "la", "zh-Hant-TW", "EN"])("akzeptiert den Sprachcode %s", (code) => {
    const value = file({ set: { title: "T", termLanguage: code, meaningLanguage: "de" } });
    expect(errors(value)).toEqual([]);
  });

  it("akzeptiert scope für das ganze Set", () => {
    expect(errors(file({ scope: { type: "set" } }))).toEqual([]);
  });
});

describe("validateSetFile – Format", () => {
  it("lehnt Werte ab, die kein Objekt sind", () => {
    expect(errors([])).toEqual(["Das Vokabelset muss ein JSON-Objekt sein."]);
  });

  it("erkennt ein Backup", () => {
    expect(errors({ format: "vokabeltrainer-backup", formatVersion: 1, data: {} })).toEqual([
      "Das ist ein Backup, kein Vokabelset. Ein Backup wird nicht importiert, sondern wiederhergestellt.",
    ]);
  });

  it("lehnt eine fremde Formatkennung ab", () => {
    expect(errors(file({ format: "anki" }))).toEqual([
      "Die Datei ist kein Vokabelset: Die Formatkennung („format“) muss „vokabeltrainer-set“ lauten.",
    ]);
  });

  it("lehnt eine neuere Formatversion ab, ohne weiter zu prüfen", () => {
    expect(errors({ format: "vokabeltrainer-set", formatVersion: 2, sets: [] })).toEqual([
      "Diese Datei stammt von einer neueren App-Version. Lade die App neu, um sie zu importieren.",
    ]);
  });

  it.each([0, 1.5, "1"])("lehnt die Formatversion %j ab", (version) => {
    expect(errors(file({ formatVersion: version }))).toEqual([
      "Die Formatversion („formatVersion“) muss eine ganze Zahl ab 1 sein.",
    ]);
  });

  it("lehnt einen Teil-Export ab, weil das Set noch nicht vorhanden ist", () => {
    expect(errors(file({ scope: { type: "sections", sectionIds: ["q7h3kd"] } }))).toEqual([
      "Diese Datei enthält nur einen Teil eines Sets. Ein Teil kann nur in ein vorhandenes Set übernommen werden.",
    ]);
  });

  it("lehnt einen ungültigen Umfang ab", () => {
    expect(errors(file({ scope: "alles" }))).toEqual(["Der Umfang („scope“) ist ungültig."]);
  });
});

describe("validateSetFile – Set-Angaben", () => {
  it("meldet fehlende Set-Angaben", () => {
    expect(errors(file({ set: undefined }))).toEqual(["Es fehlen die Angaben zum Set („set“)."]);
  });

  it("meldet fehlende Pflichtfelder einzeln", () => {
    expect(errors(file({ set: {} }))).toEqual([
      "Set-Angaben: Es fehlt der Titel („title“).",
      "Set-Angaben: Es fehlt die Lernsprache („termLanguage“).",
      "Set-Angaben: Es fehlt die Bedeutungssprache („meaningLanguage“).",
    ]);
  });

  it("behandelt Titel aus Leerzeichen wie einen fehlenden Titel", () => {
    const value = file({ set: { title: "   ", termLanguage: "en", meaningLanguage: "de" } });
    expect(errors(value)).toEqual(["Set-Angaben: Es fehlt der Titel („title“)."]);
  });

  it("meldet einen Titel, der kein Text ist", () => {
    const value = file({ set: { title: 2026, termLanguage: "en", meaningLanguage: "de" } });
    expect(errors(value)).toEqual(["Set-Angaben: Der Titel („title“) muss ein Text sein."]);
  });

  it.each(["english", "e", "en_GB", "Deutsch", "123"])("lehnt den Sprachcode %s ab", (code) => {
    const value = file({ set: { title: "T", termLanguage: code, meaningLanguage: "de" } });
    expect(errors(value)).toEqual([
      `Set-Angaben: Die Lernsprache „${code}“ ist kein gültiger Sprachcode, z. B. „en“ oder „en-GB“.`,
    ]);
  });
});

describe("validateSetFile – Sektionen und Einträge", () => {
  it("meldet fehlende oder leere Sektionslisten", () => {
    expect(errors(file({ sections: undefined }))).toEqual([
      "Es fehlen die Sektionen („sections“).",
    ]);
    expect(errors(file({ sections: [] }))).toEqual(["Das Set braucht mindestens eine Sektion."]);
  });

  it("meldet Sektionen ohne Titel oder Einträge", () => {
    expect(errors(file({ sections: [{ entries: [] }, { title: "Schule" }, "Essen"] }))).toEqual([
      "Sektion 1: Es fehlt der Titel („title“).",
      "Sektion 2 „Schule“: Es fehlt die Liste der Einträge („entries“).",
      "Sektion 3: Die Angaben sind ungültig.",
    ]);
  });

  it("nennt Sektion und Eintrag mit Wort, wenn die Bedeutung fehlt", () => {
    const value = file({
      sections: [
        { title: "Schule", entries: [] },
        { title: "Freizeit", entries: [{ term: "a", meanings: ["b"] }, { term: "to miss" }] },
      ],
    });
    expect(errors(value)).toEqual([
      "Sektion 2 „Freizeit“, Eintrag 2 („to miss“): Es fehlt die Bedeutung („meanings“).",
    ]);
  });

  it("meldet fehlende, leere und falsch geformte Wörter", () => {
    expect(
      errors(
        withEntries(
          { meanings: ["x"] },
          { term: " ", meanings: ["x"] },
          { term: 5, meanings: ["x"] },
        ),
      ),
    ).toEqual([
      "Sektion 1 „Freizeit“, Eintrag 1: Es fehlt das Wort („term“).",
      "Sektion 1 „Freizeit“, Eintrag 2: Es fehlt das Wort („term“).",
      "Sektion 1 „Freizeit“, Eintrag 3: Das Wort („term“) muss ein Text sein oder ein Objekt mit „text“.",
    ]);
  });

  it("meldet leere Bedeutungslisten und einzelne ungültige Bedeutungen", () => {
    expect(
      errors(
        withEntries(
          { term: "a", meanings: [] },
          { term: "b", meanings: "Bett" },
          { term: "c", meanings: ["x", "", { text: "y" }, { acceptedVariants: ["z"] }] },
        ),
      ),
    ).toEqual([
      "Sektion 1 „Freizeit“, Eintrag 1 („a“): Es fehlt die Bedeutung („meanings“).",
      "Sektion 1 „Freizeit“, Eintrag 2 („b“): Die Bedeutungen („meanings“) müssen eine Liste sein.",
      "Sektion 1 „Freizeit“, Eintrag 3 („c“): Bedeutung 2 ist leer.",
      "Sektion 1 „Freizeit“, Eintrag 3 („c“): Bedeutung 4 muss ein Text sein oder ein Objekt mit „text“.",
    ]);
  });

  it("meldet ungültige Varianten", () => {
    expect(
      errors(
        withEntries(
          { term: { text: "car", acceptedVariants: "auto" }, meanings: ["Auto"] },
          { term: "car", meanings: [{ text: "Auto", acceptedVariants: ["Wagen", ""] }] },
        ),
      ),
    ).toEqual([
      "Sektion 1 „Freizeit“, Eintrag 1 („car“): Die Varianten („acceptedVariants“) des Wortes müssen eine Liste nichtleerer Texte sein.",
      "Sektion 1 „Freizeit“, Eintrag 2 („car“): Die Varianten („acceptedVariants“) von Bedeutung 1 müssen eine Liste nichtleerer Texte sein.",
    ]);
  });

  it("kürzt lange Titel und Wörter in der Fundstelle", () => {
    const long = "x".repeat(60);
    const value = file({ sections: [{ title: long, entries: [{ term: long }] }] });
    expect(errors(value)).toEqual([
      `Sektion 1 „${"x".repeat(40)}…“, Eintrag 1 („${"x".repeat(40)}…“): Es fehlt die Bedeutung („meanings“).`,
    ]);
  });
});

describe("validateSetFile – IDs und Grenzen", () => {
  it("meldet ungültige IDs", () => {
    const value = file({
      set: { id: "", title: "T", termLanguage: "en", meaningLanguage: "de" },
      sections: [{ id: "a b", title: "S", entries: [{ id: 7, term: "a", meanings: ["b"] }] }],
    });
    expect(errors(value)).toEqual([
      "Set-Angaben: Die Kennung ist ungültig.",
      "Sektion 1 „S“: Die Kennung ist ungültig.",
      "Sektion 1 „S“, Eintrag 1 („a“): Die Kennung ist ungültig.",
    ]);
  });

  it("meldet doppelte IDs einmal pro ID", () => {
    const entry = { id: "a8f2kc", term: "a", meanings: ["b"] };
    const value = file({
      sections: [
        { id: "a8f2kc", title: "S", entries: [entry, entry] },
        { id: "q7h3kd", title: "T", entries: [entry] },
      ],
    });
    expect(errors(value)).toEqual([
      "Die Kennung „a8f2kc“ kommt mehrfach vor. Jede Kennung darf in einem Set nur einmal vorkommen.",
    ]);
  });

  it("begrenzt die Zahl der Sektionen", () => {
    const sections = Array.from({ length: MAX_SECTIONS + 1 }, () => ({ title: "S", entries: [] }));
    expect(errors(file({ sections }))).toEqual([`Das Set hat mehr als ${MAX_SECTIONS} Sektionen.`]);
  });

  it("begrenzt die Zahl der Einträge", () => {
    const entries = Array.from({ length: MAX_ENTRIES + 1 }, () => ({ term: "a", meanings: ["b"] }));
    expect(errors(withEntries(...entries))).toEqual(["Das Set hat mehr als 20.000 Einträge."]);
  });
});
