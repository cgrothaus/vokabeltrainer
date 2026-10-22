// Schemaabgleich (TAK-10, TDD 15.3): Validator und JSON Schema urteilen über alle Fixtures gleich.
import { randomBytes } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020";
import { describe, expect, it } from "vitest";
import { extractJson } from "../../src/domain/extract";
import { prepareNewSet } from "../../src/domain/importSet";
import { KNOWN_FIELDS, validateSetFile } from "../../src/domain/validate";

type Schema = { properties: Record<string, unknown>; $defs: Record<string, Schema> };

const schema = JSON.parse(
  readFileSync(new URL("../../docs/vokabeltrainer-set.schema.json", import.meta.url), "utf8"),
) as Schema;
// `required` in `anyOf` und `if` bezieht sich auf Felder des umgebenden Schemas; das meldet
// `strictRequired` fälschlich.
const ajv = new Ajv2020({
  strict: true,
  strictRequired: false,
  allErrors: true,
  allowUnionTypes: true,
});
const schemaAccepts = ajv.compile(schema);

const fixtures = new URL("../fixtures/setfile/v1/", import.meta.url);
const files = (dir: string) => readdirSync(new URL(`${dir}/`, fixtures)).sort();

function judge(dir: string, file: string) {
  const extracted = extractJson(readFileSync(new URL(`${dir}/${file}`, fixtures), "utf8"));
  if (!extracted.ok) throw new Error(extracted.error);
  return {
    validator: validateSetFile(extracted.value),
    schema: schemaAccepts(extracted.value),
    schemaErrors: ajv.errorsText(schemaAccepts.errors),
  };
}

const at = "Sektion 1 „Wetter“, Eintrag 1 („rain“)";

/** Erwartete Warnungen gültiger Dateien. */
const VALID: Record<string, string[]> = {
  "antworten.json": [],
  "export-ganzes-set.json": [],
  "grenzen.json": [],
  "leere-optionale-felder.json": [],
  "leere-sektion.json": [],
  "minimal.json": [],
  "optionale-felder.json": [],
  "sprachen.json": [],
  "teil-export.json": [],
};

/** Erwartete Warnungen typischer LLM-Ausgaben. */
const LLM: Record<string, string[]> = {
  "begleittext-ohne-codeblock.txt": [],
  "codeblock-mit-begleittext.txt": [],
  // Vortest zu S-15 (TDD 15.7): Antworten eines LLM auf Spezifikation und abgetippte Liste bzw. Export.
  "foto-mit-unsicheren-stellen.txt": [],
  "korrektur-mit-ids.txt": [],
  "meaning-einzahl.txt": [
    "Bei 2 Einträgen steht „meaning“ statt „meanings“; das wurde als eine Bedeutung übernommen.",
  ],
  "ohne-formatangaben.txt": ["Die Formatversion fehlt; die App nimmt Version 1 an."],
  "unsicher-und-leere-felder.txt": [],
  "zusatzfelder.txt": [
    "Das Feld „description“ wird ignoriert (Set-Angaben).",
    `Das Feld „pronunciation“ wird ignoriert (${at} und 1 weitere Stelle).`,
  ],
};

/** Genau ein Fehler pro Datei. */
const INVALID: Record<string, string> = {
  "antwort-zu-lang.json": `${at}: Bedeutung 1 ist länger als 500 Zeichen.`,
  "backup.json":
    "Das ist ein Backup, kein Vokabelset. Ein Backup wird nicht importiert, sondern wiederhergestellt.",
  "bedeutung-fehlt.json": `${at}: Es fehlt die Bedeutung („meanings“).`,
  "bedeutung-leer.json": `${at}: Bedeutung 2 ist leer.`,
  "bedeutungen-leer.json": `${at}: Es fehlt die Bedeutung („meanings“).`,
  "beispiel-leer.json": `${at}: Beispiel 1 ist leer.`,
  "beispiele-kein-array.json": `${at}: Die Beispiele („examples“) müssen eine Liste sein.`,
  "eintraege-fehlen.json": "Sektion 1 „Wetter“: Es fehlt die Liste der Einträge („entries“).",
  "exportedAt-zahl.json": "Der Exportzeitpunkt („exportedAt“) muss ein Text sein.",
  "formatversion-text.json": "Die Formatversion („formatVersion“) muss eine ganze Zahl ab 1 sein.",
  "fremdes-format.json":
    "Die Datei ist kein Vokabelset: Die Formatkennung („format“) muss „vokabeltrainer-set“ lauten.",
  "grammatik-kein-objekt.json": `${at}: Die Grammatikangaben („grammar“) müssen ein Objekt sein.`,
  "id-ungueltig.json": `${at}: Die Kennung ist ungültig.`,
  "lernstufe-zu-lang.json": "Set-Angaben: Die Lernstufe („level“) ist länger als 200 Zeichen.",
  "meaning-ungueltig.json": `${at}: Bedeutung 1 muss ein Text sein oder ein Objekt mit „text“.`,
  "neuere-formatversion.json":
    "Diese Datei stammt von einer neueren App-Version. Lade die App neu, um sie zu importieren.",
  "notiz-zahl.json": `${at}: Die Notiz („notes“) muss ein Text sein.`,
  "notiz-zu-lang.json": "Set-Angaben: Die Notiz („notes“) ist länger als 2.000 Zeichen.",
  "pruefstatus-ungueltig.json": `${at}: Der Prüfstatus („reviewStatus“) muss „unchecked“ oder „checked“ sein.`,
  "rev-ungueltig.json": `${at}: Der Prüfwert („rev“) ist ungültig.`,
  "scope-ungueltig.json": "Der Umfang („scope“) ist ungültig.",
  "sectionIds-doppelt.json":
    "Der Umfang („scope“) muss die Sektionen als Liste verschiedener Kennungen nennen („sectionIds“).",
  "sektionen-fehlen.json": "Es fehlen die Sektionen („sections“).",
  "sektionen-leer.json": "Das Set braucht mindestens eine Sektion.",
  "sektionstitel-fehlt.json": "Sektion 1: Es fehlt der Titel („title“).",
  "set-fehlt.json": "Es fehlen die Angaben zum Set („set“).",
  "sprachcode-ungueltig.json":
    "Set-Angaben: Die Lernsprache „Englisch“ ist kein gültiger Sprachcode, z. B. „en“ oder „en-GB“.",
  "titel-fehlt.json": "Set-Angaben: Es fehlt der Titel („title“).",
  "titel-leer.json": "Set-Angaben: Es fehlt der Titel („title“).",
  "titel-zu-lang.json": "Set-Angaben: Der Titel („title“) ist länger als 200 Zeichen.",
  "uebersetzung-zahl.json": `${at}, Beispiel 1: Die Übersetzung („translation“) muss ein Text sein.`,
  "variante-leer.json": `${at}: Die Varianten („acceptedVariants“) von Bedeutung 1 müssen eine Liste nichtleerer Texte sein.`,
  "wort-fehlt.json": "Sektion 1 „Wetter“, Eintrag 1: Es fehlt das Wort („term“).",
  "wort-null.json": "Sektion 1 „Wetter“, Eintrag 1: Es fehlt das Wort („term“).",
  "wortform-leer.json": `${at}, Grammatik: Die Wortformen („forms“) müssen eine Liste nichtleerer Texte sein.`,
};

/** Regeln, die das Schema nicht ausdrücken kann (TDD 8.3): Das Schema akzeptiert, der Validator nicht. */
const VALIDATOR_ONLY: Record<string, string> = {
  "doppelte-ids-ebenen.json":
    "Die Kennung „q7h3kd“ kommt mehrfach vor. Jede Kennung darf in einem Set nur einmal vorkommen.",
  "doppelte-ids.json":
    "Die Kennung „a8f2kc“ kommt mehrfach vor. Jede Kennung darf in einem Set nur einmal vorkommen.",
  "sprachcode-unbekannt.json":
    "Set-Angaben: Die Lernsprache „en-x“ ist kein gültiger Sprachcode, z. B. „en“ oder „en-GB“.",
};

describe("Fixtures für Vokabelset-Dateien", () => {
  it.each([
    ["valid", VALID],
    ["llm", LLM],
    ["invalid", INVALID],
    ["invalid-validator-only", VALIDATOR_ONLY],
  ])("haben in %s alle eine Erwartung", (dir, expected) => {
    expect(files(dir)).toEqual(Object.keys(expected).sort());
  });

  describe.each([
    ["valid", VALID],
    ["llm", LLM],
  ])("%s: Validator und Schema akzeptieren", (dir, expected) => {
    it.each(Object.entries(expected))("%s", (file, warnings) => {
      const result = judge(dir, file);
      expect(result.validator).toEqual({ ok: true, file: expect.anything(), warnings });
      expect(result.schema, result.schemaErrors).toBe(true);
    });
  });

  describe("invalid: Validator und Schema lehnen ab", () => {
    it.each(Object.entries(INVALID))("%s", (file, error) => {
      const result = judge("invalid", file);
      expect(result.validator).toMatchObject({ ok: false, errors: [error] });
      expect(result.schema).toBe(false);
    });
  });

  describe("invalid-validator-only: nur der Validator lehnt ab", () => {
    it.each(Object.entries(VALIDATOR_ONLY))("%s", (file, error) => {
      const result = judge("invalid-validator-only", file);
      expect(result.validator).toMatchObject({ ok: false, errors: [error] });
      expect(result.schema, result.schemaErrors).toBe(true);
    });
  });
});

describe("Beispielset (TDD 13.2, FR-32)", () => {
  const text = readFileSync(new URL("../../src/content/beispielset.json", import.meta.url), "utf8");
  const extracted = extractJson(text);
  if (!extracted.ok) throw new Error(extracted.error);
  const file = extracted.value as {
    set: Record<string, unknown>;
    sections: { title: string; entries: Record<string, unknown>[] }[];
  } & Record<string, unknown>;
  const entries = file.sections.flatMap((section) => section.entries);
  const hasVariants = (answer: unknown) =>
    typeof answer === "object" && answer !== null && "acceptedVariants" in answer;

  it("ist ohne Warnungen gültig und als neues Set importierbar", () => {
    expect(validateSetFile(file)).toEqual({ ok: true, file: expect.anything(), warnings: [] });
    expect(schemaAccepts(file), ajv.errorsText(schemaAccepts.errors)).toBe(true);
    const prepared = prepareNewSet(text, {
      now: "2026-10-22T00:00:00.000Z",
      randomBytes: (count) => new Uint8Array(randomBytes(count)),
    });
    expect(prepared).toMatchObject({ ok: true, warnings: [], trimmed: false });
  });

  it("nennt Sprachen, Lernstufe, Herkunft und Lizenz", () => {
    expect(file.set).toMatchObject({
      termLanguage: "en",
      meaningLanguage: "de",
      level: "Klasse 6",
      source: "Eigene Zusammenstellung",
      license: "CC0",
    });
  });

  it("hat 3 bis 5 Sektionen mit je 10 bis 20 Einträgen und keine Kennungen", () => {
    expect(file.sections.length).toBeGreaterThanOrEqual(3);
    expect(file.sections.length).toBeLessThanOrEqual(5);
    for (const section of file.sections) {
      expect(section.entries.length, section.title).toBeGreaterThanOrEqual(10);
      expect(section.entries.length, section.title).toBeLessThanOrEqual(20);
    }
    // Ohne IDs wie ein neu erstelltes Set; die App vergibt sie beim Laden (TDD 13.2).
    expect(text).not.toMatch(/"(id|rev)"\s*:/);
    expect(file).not.toHaveProperty("scope");
  });

  it("zeigt Varianten, mehrere Bedeutungen und optionale Angaben", () => {
    const meanings = (entry: Record<string, unknown>) => entry.meanings as unknown[];
    const grammar = (entry: Record<string, unknown>) =>
      (entry.grammar ?? {}) as Record<string, unknown>;
    const examples = entries.flatMap((entry) => (entry.examples ?? []) as unknown[]);
    expect(entries.some((entry) => hasVariants(entry.term))).toBe(true);
    expect(entries.some((entry) => meanings(entry).some(hasVariants))).toBe(true);
    expect(entries.some((entry) => meanings(entry).length >= 2)).toBe(true);
    expect(entries.some((entry) => "forms" in grammar(entry))).toBe(true);
    expect(entries.some((entry) => "plural" in grammar(entry))).toBe(true);
    expect(examples.some((example) => typeof example === "string")).toBe(true);
    expect(examples.some((example) => typeof example === "object")).toBe(true);
    expect(entries.some((entry) => "notes" in entry)).toBe(true);
  });
});

describe("JSON Schema", () => {
  it("kennt auf jeder Ebene dieselben Felder wie der Validator", () => {
    const defs = schema.$defs;
    const levels: Record<keyof typeof KNOWN_FIELDS, Schema | undefined> = {
      file: schema,
      scope: defs.scope,
      set: defs.set,
      section: defs.section,
      entry: defs.entry,
      answer: defs.answerObject,
      example: defs.exampleObject,
      grammar: defs.grammar,
    };
    for (const [level, definition] of Object.entries(levels)) {
      const known = KNOWN_FIELDS[level as keyof typeof KNOWN_FIELDS];
      expect(Object.keys(definition!.properties).sort(), level).toEqual([...known].sort());
    }
  });
});
