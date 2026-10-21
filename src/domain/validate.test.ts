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

  it("akzeptiert einen Teil-Export; ob er zum Ziel passt, prüft der Importablauf", () => {
    expect(errors(file({ scope: { type: "sections", sectionIds: ["q7h3kd"] } }))).toEqual([]);
  });

  it.each([null, "alles", { type: "teil" }])("lehnt den Umfang %j ab", (scope) => {
    expect(errors(file({ scope }))).toEqual(["Der Umfang („scope“) ist ungültig."]);
  });

  it.each([undefined, [], ["q7h3kd", "q7h3kd"], "q7h3kd", ["q7 h3"], [null]])(
    "lehnt sectionIds %j ab",
    (sectionIds) => {
      expect(errors(file({ scope: { type: "sections", sectionIds } }))).toEqual([
        "Der Umfang („scope“) muss die Sektionen als Liste verschiedener Kennungen nennen („sectionIds“).",
      ]);
    },
  );
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

const setInfo = { title: "T", termLanguage: "en", meaningLanguage: "de" };
const at = "Sektion 1 „Freizeit“, Eintrag 1 („to go“)";
const toGo = (fields: Json) => withEntries({ term: "to go", meanings: ["gehen"], ...fields });

function warnings(value: unknown): string[] {
  const result = validateSetFile(value);
  if (!result.ok) throw new Error(result.errors.join("\n"));
  return result.warnings;
}

describe("validateSetFile – optionale Felder", () => {
  it("akzeptiert alle optionalen Felder ohne Warnung", () => {
    const value = file({
      exportedAt: "2026-10-19T17:00:00Z",
      set: {
        ...setInfo,
        rev: "k2p9w4ha",
        level: "Klasse 6",
        textbook: "eigene Liste",
        edition: "2. Auflage",
        source: "Arbeitsblatt vom 3. 10.",
        license: "CC0",
        notes: "Zum Wiederholen",
        reviewStatus: "checked",
      },
      sections: [
        {
          title: "Freizeit",
          rev: "t5m2b8xe",
          entries: [
            {
              rev: "3hd9w2mq",
              term: "to go",
              meanings: ["gehen"],
              notes: "unregelmäßig",
              examples: ["I go home.", { text: "We went.", translation: "Wir gingen." }],
              grammar: { partOfSpeech: "verb", gender: "-", plural: "-", forms: ["go", "went"] },
              reviewStatus: "unchecked",
            },
          ],
        },
      ],
    });
    expect(validateSetFile(value)).toEqual({ ok: true, file: value, warnings: [] });
  });

  it("akzeptiert leere optionale Felder und null ohne Warnung", () => {
    const value = file({
      set: { ...setInfo, level: "", notes: "  ", license: null, reviewStatus: null },
      sections: [
        {
          title: "Freizeit",
          entries: [
            {
              term: { text: "a", acceptedVariants: [] },
              meanings: [{ text: "b", acceptedVariants: null }],
              notes: null,
              examples: [],
              grammar: {},
              reviewStatus: null,
            },
            {
              term: "c",
              meanings: ["d"],
              examples: [
                { text: "x", translation: "" },
                { text: "y", translation: null },
              ],
              grammar: { partOfSpeech: null, plural: " ", forms: [] },
            },
            { term: "e", meanings: ["f"], examples: null, grammar: { forms: null } },
          ],
        },
      ],
    });
    expect(validateSetFile(value)).toEqual({ ok: true, file: value, warnings: [] });
  });

  it.each([
    ["level", "Die Lernstufe"],
    ["textbook", "Das Lehrwerk"],
    ["edition", "Die Ausgabe"],
    ["source", "Die Herkunft"],
    ["license", "Die Lizenz"],
    ["notes", "Die Notiz"],
  ])("meldet %s in den Set-Angaben, wenn es kein Text ist", (field, name) => {
    expect(errors(file({ set: { ...setInfo, [field]: 6 } }))).toEqual([
      `Set-Angaben: ${name} („${field}“) muss ein Text sein.`,
    ]);
  });

  it("meldet einen unbekannten Prüfstatus bei Set und Eintrag", () => {
    const value = file({
      set: { ...setInfo, reviewStatus: "unsure" },
      sections: [
        { title: "Freizeit", entries: [{ term: "to go", meanings: ["x"], reviewStatus: true }] },
      ],
    });
    expect(errors(value)).toEqual([
      "Set-Angaben: Der Prüfstatus („reviewStatus“) muss „unchecked“ oder „checked“ sein.",
      `${at}: Der Prüfstatus („reviewStatus“) muss „unchecked“ oder „checked“ sein.`,
    ]);
  });

  it("meldet Notiz, Beispiele und Grammatik in falscher Form", () => {
    expect(errors(toGo({ notes: ["a"], examples: "I go.", grammar: "verb" }))).toEqual([
      `${at}: Die Notiz („notes“) muss ein Text sein.`,
      `${at}: Die Beispiele („examples“) müssen eine Liste sein.`,
      `${at}: Die Grammatikangaben („grammar“) müssen ein Objekt sein.`,
    ]);
  });

  it("meldet leere und falsch geformte Beispiele", () => {
    const examples = [
      "",
      { text: " " },
      { translation: "x" },
      5,
      null,
      { text: "ok", translation: 3 },
    ];
    expect(errors(toGo({ examples }))).toEqual([
      `${at}: Beispiel 1 ist leer.`,
      `${at}: Beispiel 2 ist leer.`,
      `${at}: Beispiel 3 muss ein Text sein oder ein Objekt mit „text“.`,
      `${at}: Beispiel 4 muss ein Text sein oder ein Objekt mit „text“.`,
      `${at}: Beispiel 5 muss ein Text sein oder ein Objekt mit „text“.`,
      `${at}, Beispiel 6: Die Übersetzung („translation“) muss ein Text sein.`,
    ]);
  });

  it("meldet ungültige Grammatikangaben", () => {
    expect(
      errors(
        withEntries(
          {
            term: "to go",
            meanings: ["x"],
            grammar: { partOfSpeech: 1, forms: ["go", "", "gone"] },
          },
          { term: "to be", meanings: ["x"], grammar: { gender: [], forms: "be" } },
        ),
      ),
    ).toEqual([
      `${at}, Grammatik: Die Wortart („partOfSpeech“) muss ein Text sein.`,
      `${at}, Grammatik: Die Wortformen („forms“) müssen eine Liste nichtleerer Texte sein.`,
      "Sektion 1 „Freizeit“, Eintrag 2 („to be“), Grammatik: Das Genus („gender“) muss ein Text sein.",
      "Sektion 1 „Freizeit“, Eintrag 2 („to be“), Grammatik: Die Wortformen („forms“) müssen eine Liste nichtleerer Texte sein.",
    ]);
  });
});

describe("validateSetFile – Textlängen", () => {
  const x = (count: number) => "x".repeat(count);

  it("zählt Zeichen ohne Leerzeichen am Rand, in NFC und ohne Ersatzzeichen-Paare", () => {
    const decomposed = "u" + String.fromCharCode(0x308);
    const emoji = String.fromCodePoint(0x1f600);
    const title = `  ${decomposed.repeat(100)}${emoji.repeat(100)}  `;
    const value = file({
      set: { ...setInfo, title, level: x(200) },
      sections: [
        {
          title: x(200),
          entries: [
            {
              term: { text: x(500), acceptedVariants: [x(500)] },
              meanings: [x(500)],
              notes: x(2000),
              examples: [x(500), { text: x(500), translation: x(500) }],
              grammar: { plural: x(200), forms: [x(200)] },
            },
          ],
        },
      ],
    });
    expect(errors(value)).toEqual([]);
  });

  it("meldet zu lange Titel", () => {
    const value = file({
      set: { ...setInfo, title: x(201) },
      sections: [{ title: x(201), entries: [] }],
    });
    expect(errors(value)).toEqual([
      "Set-Angaben: Der Titel („title“) ist länger als 200 Zeichen.",
      `Sektion 1 „${x(40)}…“: Der Titel („title“) ist länger als 200 Zeichen.`,
    ]);
  });

  it("meldet zu lange Antworten und Varianten", () => {
    const value = withEntries({
      term: { text: "to go", acceptedVariants: [x(501)] },
      meanings: [x(501), { text: "b", acceptedVariants: ["c", x(501)] }],
    });
    expect(errors(value)).toEqual([
      `${at}: Eine Variante des Wortes ist länger als 500 Zeichen.`,
      `${at}: Bedeutung 1 ist länger als 500 Zeichen.`,
      `${at}: Eine Variante von Bedeutung 2 ist länger als 500 Zeichen.`,
    ]);
  });

  it("meldet ein zu langes Wort", () => {
    expect(errors(withEntries({ term: x(501), meanings: ["b"] }))).toEqual([
      `Sektion 1 „Freizeit“, Eintrag 1 („${x(40)}…“): Das Wort („term“) ist länger als 500 Zeichen.`,
    ]);
  });

  it("meldet zu lange optionale Texte", () => {
    const value = file({
      set: { ...setInfo, level: x(201), notes: x(2001) },
      sections: [
        {
          title: "Freizeit",
          entries: [
            {
              term: "to go",
              meanings: ["gehen"],
              notes: x(2001),
              examples: [x(501), { text: x(501) }, { text: "a", translation: x(501) }],
              grammar: { plural: x(201), forms: ["go", x(201)] },
            },
          ],
        },
      ],
    });
    expect(errors(value)).toEqual([
      "Set-Angaben: Die Lernstufe („level“) ist länger als 200 Zeichen.",
      "Set-Angaben: Die Notiz („notes“) ist länger als 2.000 Zeichen.",
      `${at}: Die Notiz („notes“) ist länger als 2.000 Zeichen.`,
      `${at}: Beispiel 1 ist länger als 500 Zeichen.`,
      `${at}: Beispiel 2 ist länger als 500 Zeichen.`,
      `${at}, Beispiel 3: Die Übersetzung („translation“) ist länger als 500 Zeichen.`,
      `${at}, Grammatik: Der Plural („plural“) ist länger als 200 Zeichen.`,
      `${at}, Grammatik: Eine Wortform ist länger als 200 Zeichen.`,
    ]);
  });
});

describe("validateSetFile – null, rev und exportedAt", () => {
  it("behandelt null bei Pflichtfeldern wie ein fehlendes Feld", () => {
    const value = file({
      set: { title: null, termLanguage: "en", meaningLanguage: "de" },
      sections: [
        {
          title: "Freizeit",
          entries: [
            { term: null, meanings: ["x"] },
            { term: "to go", meanings: null },
          ],
        },
      ],
    });
    expect(errors(value)).toEqual([
      "Set-Angaben: Es fehlt der Titel („title“).",
      "Sektion 1 „Freizeit“, Eintrag 1: Es fehlt das Wort („term“).",
      "Sektion 1 „Freizeit“, Eintrag 2 („to go“): Es fehlt die Bedeutung („meanings“).",
    ]);
  });

  it("lehnt null bei IDs, rev, exportedAt und in Listen ab", () => {
    const value = file({
      exportedAt: null,
      set: { ...setInfo, id: null, rev: null },
      sections: [
        {
          title: "Freizeit",
          entries: [{ term: "to go", meanings: [{ text: "gehen", acceptedVariants: [null] }] }],
        },
      ],
    });
    expect(errors(value)).toEqual([
      "Der Exportzeitpunkt („exportedAt“) muss ein Text sein.",
      "Set-Angaben: Die Kennung ist ungültig.",
      "Set-Angaben: Der Prüfwert („rev“) ist ungültig.",
      `${at}: Die Varianten („acceptedVariants“) von Bedeutung 1 müssen eine Liste nichtleerer Texte sein.`,
    ]);
  });

  it("prüft rev wie eine Kennung, ohne gleiche Werte als doppelt zu melden", () => {
    const value = withEntries(
      { rev: "3hd9w2mq", term: "a", meanings: ["b"] },
      { rev: "3hd9w2mq", term: "c", meanings: ["d"] },
      { rev: "a b", term: "e", meanings: ["f"] },
    );
    expect(errors(value)).toEqual([
      "Sektion 1 „Freizeit“, Eintrag 3 („e“): Der Prüfwert („rev“) ist ungültig.",
    ]);
  });

  it("meldet exportedAt, das kein Text ist", () => {
    expect(errors(file({ exportedAt: 20261019 }))).toEqual([
      "Der Exportzeitpunkt („exportedAt“) muss ein Text sein.",
    ]);
  });
});

describe("validateSetFile – unbekannte Felder", () => {
  it("warnt einmal pro Ebene und Feld mit erster Fundstelle und Zahl weiterer Stellen", () => {
    const value = file({
      $schema: "https://example.org/schema.json",
      scope: { type: "set", note: "ganz" },
      set: { ...setInfo, color: "blau" },
      sections: [
        {
          title: "Freizeit",
          icon: "Ball",
          entries: [
            {
              term: "to go",
              meanings: [{ text: "gehen", hint: "x" }],
              difficulty: 1,
              examples: [{ text: "I go.", source: "x" }],
              grammar: { tense: "present" },
            },
            { term: "to see", meanings: ["sehen"], difficulty: 2 },
            { term: "to be", meanings: ["sein"], difficulty: 3 },
          ],
        },
        { title: "Schule", icon: "Buch", entries: [] },
      ],
    });
    expect(warnings(value)).toEqual([
      "Das Feld „$schema“ wird ignoriert (oberste Ebene).",
      "Das Feld „note“ wird ignoriert (Umfang).",
      "Das Feld „color“ wird ignoriert (Set-Angaben).",
      "Das Feld „icon“ wird ignoriert (Sektion 1 „Freizeit“ und 1 weitere Stelle).",
      `Das Feld „difficulty“ wird ignoriert (${at} und 2 weitere Stellen).`,
      `Das Feld „hint“ wird ignoriert (${at}, Bedeutung 1).`,
      `Das Feld „source“ wird ignoriert (${at}, Beispiel 1).`,
      `Das Feld „tense“ wird ignoriert (${at}, Grammatik).`,
    ]);
  });

  it("unterscheidet gleiche Feldnamen auf verschiedenen Ebenen", () => {
    const value = file({
      set: { ...setInfo, notes: "bekannt" },
      sections: [{ title: "Freizeit", notes: "unbekannt", entries: [] }],
    });
    expect(warnings(value)).toEqual(["Das Feld „notes“ wird ignoriert (Sektion 1 „Freizeit“)."]);
  });

  it("ignoriert meaning neben meanings", () => {
    expect(warnings(toGo({ meaning: "laufen" }))).toEqual([
      `Das Feld „meaning“ wird ignoriert (${at}).`,
    ]);
  });

  it("warnt bei unbekannten Feldern auch, wenn die Datei Fehler hat", () => {
    const result = validateSetFile(toGo({ difficulty: 1, notes: 5 }));
    expect(result).toEqual({
      ok: false,
      errors: [`${at}: Die Notiz („notes“) muss ein Text sein.`],
      warnings: [`Das Feld „difficulty“ wird ignoriert (${at}).`],
    });
  });
});
