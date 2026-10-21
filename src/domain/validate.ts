// Validierung einer Vokabelset-Datei (TDD 8.3, Formatspezifikation 2–8) mit deutschen Meldungen und
// Fundstelle. Geprüft wird die Datei unabhängig vom Ziel; ob sie zu einem neuen oder vorhandenen Set
// passt (z. B. Teil-Export), prüft der Importablauf.
import type { ReviewStatus } from "./model";

/** Antwort in Kurz- (String) oder Langform (Formatspezifikation 5.2). */
export type FileAnswer = string | { text: string; acceptedVariants?: string[] | null };

/** Beispielsatz in Kurz- (String) oder Langform (Formatspezifikation 5.1). */
export type FileExample = string | { text: string; translation?: string | null };

// Optionale Felder dürfen `null` sein (Löschmarkierung beim Aktualisieren, D-10).
export interface FileEntry {
  id?: string;
  term: FileAnswer;
  /** Fehlt genau dann, wenn `meaning` (Einzahl) angegeben ist. */
  meanings?: FileAnswer[];
  meaning?: FileAnswer;
  notes?: string | null;
  examples?: FileExample[] | null;
  grammar?: {
    partOfSpeech?: string | null;
    gender?: string | null;
    plural?: string | null;
    forms?: string[] | null;
  } | null;
  reviewStatus?: ReviewStatus | null;
}

export interface FileSection {
  id?: string;
  title: string;
  entries: FileEntry[];
}

export interface FileSetInfo {
  id?: string;
  title: string;
  termLanguage: string;
  meaningLanguage: string;
  level?: string | null;
  textbook?: string | null;
  edition?: string | null;
  source?: string | null;
  license?: string | null;
  notes?: string | null;
  reviewStatus?: ReviewStatus | null;
}

/** Eine geprüfte Datei; unbekannte Felder können vorhanden sein und werden nicht übernommen. */
export interface SetFile {
  scope?: { type: "set" } | { type: "sections"; sectionIds: string[] };
  set: FileSetInfo;
  sections: FileSection[];
}

export type ValidationResult =
  | { ok: true; file: SetFile; warnings: string[] }
  | { ok: false; errors: string[]; warnings: string[] };

/** Schutz vor Blockade (TDD 8.3, DF-08). */
export const MAX_SECTIONS = 500;
export const MAX_ENTRIES = 20_000;

/** Höchstlängen in Zeichen nach Trimmen und NFC (Formatspezifikation 8.4). */
export const MAX_LENGTH = { short: 200, answer: 500, notes: 2000 } as const;

interface OptionalText {
  field: string;
  /** Mit Artikel, z. B. „die Lernstufe“. */
  name: string;
  max: number;
}

const NOTES: OptionalText = { field: "notes", name: "die Notiz", max: MAX_LENGTH.notes };

const SET_TEXTS: OptionalText[] = [
  { field: "level", name: "die Lernstufe", max: MAX_LENGTH.short },
  { field: "textbook", name: "das Lehrwerk", max: MAX_LENGTH.short },
  { field: "edition", name: "die Ausgabe", max: MAX_LENGTH.short },
  { field: "source", name: "die Herkunft", max: MAX_LENGTH.short },
  { field: "license", name: "die Lizenz", max: MAX_LENGTH.short },
  NOTES,
];

const GRAMMAR_TEXTS: OptionalText[] = [
  { field: "partOfSpeech", name: "die Wortart", max: MAX_LENGTH.short },
  { field: "gender", name: "das Genus", max: MAX_LENGTH.short },
  { field: "plural", name: "der Plural", max: MAX_LENGTH.short },
];

const TRANSLATION: OptionalText = {
  field: "translation",
  name: "die Übersetzung",
  max: MAX_LENGTH.answer,
};

/**
 * Bekannte Felder pro Ebene (TDD 8.3). Andere Felder werden ignoriert und gemeldet; der Schemaabgleich
 * prüft, dass das JSON Schema dieselben Felder kennt.
 */
export const KNOWN_FIELDS = {
  file: ["format", "formatVersion", "exportedAt", "scope", "set", "sections"],
  scope: ["type", "sectionIds"],
  set: [
    "id",
    "rev",
    "title",
    "termLanguage",
    "meaningLanguage",
    ...SET_TEXTS.map((text) => text.field),
    "reviewStatus",
  ],
  section: ["id", "rev", "title", "entries"],
  entry: [
    "id",
    "rev",
    "term",
    "meanings",
    "meaning",
    "notes",
    "examples",
    "grammar",
    "reviewStatus",
  ],
  answer: ["text", "acceptedVariants"],
  example: ["text", "translation"],
  grammar: [...GRAMMAR_TEXTS.map((text) => text.field), "forms"],
} satisfies Record<string, string[]>;

type Level = keyof typeof KNOWN_FIELDS;

const ENTRY_WITHOUT_MEANING = KNOWN_FIELDS.entry.filter((field) => field !== "meaning");

/** Auch fremde IDs, z. B. ältere UUIDs (TDD 6.3); `rev` hat dieselbe Form. */
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const LABEL_LENGTH = 40;

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isBlank = (value: string) => value.trim() === "";

/** Zeichen (Codepoints) nach Trimmen und NFC, so wie der Text gespeichert wird. */
const length = (value: string) => [...value.trim().normalize("NFC")].length;

const count = (value: number) => value.toLocaleString("de-DE");

/** Sammelt Fehler und gebündelte Warnungen zu unbekannten Feldern. */
class Findings {
  readonly errors: string[] = [];
  private readonly ignored = new Map<string, { field: string; where: string; count: number }>();

  error(message: string): void {
    this.errors.push(message);
  }

  /** Merkt unbekannte Felder pro Ebene und Feldname, mit der ersten Fundstelle. */
  ignoreUnknown(value: Json, level: Level, where: string, known: string[] = KNOWN_FIELDS[level]) {
    for (const field of Object.keys(value)) {
      if (known.includes(field)) continue;
      const key = `${level} ${field}`;
      const seen = this.ignored.get(key);
      if (seen) seen.count++;
      else this.ignored.set(key, { field, where, count: 1 });
    }
  }

  ignoredWarnings(): string[] {
    return [...this.ignored.values()].map(({ field, where, count: n }) => {
      const more =
        n === 1 ? "" : n === 2 ? " und 1 weitere Stelle" : ` und ${n - 1} weitere Stellen`;
      return `Das Feld „${field}“ wird ignoriert (${where}${more}).`;
    });
  }
}

export function validateSetFile(value: unknown): ValidationResult {
  const findings = new Findings();
  const warnings: string[] = [];
  const result = (): ValidationResult => {
    const all = [...warnings, ...findings.ignoredWarnings()];
    return findings.errors.length > 0
      ? { ok: false, errors: findings.errors, warnings: all }
      : { ok: true, file: value as SetFile, warnings: all };
  };

  if (!isObject(value))
    return { ok: false, errors: ["Das Vokabelset muss ein JSON-Objekt sein."], warnings };
  if (!checkFormat(value, findings, warnings)) return result();
  findings.ignoreUnknown(value, "file", "oberste Ebene");
  if (value.exportedAt !== undefined && typeof value.exportedAt !== "string")
    findings.error("Der Exportzeitpunkt („exportedAt“) muss ein Text sein.");
  checkScope(value.scope, findings);

  const ids = new Map<string, number>();
  const checkIds = (item: Json, where: string) => {
    if (item.id !== undefined) {
      if (typeof item.id !== "string" || !ID_PATTERN.test(item.id))
        findings.error(`${where}: Die Kennung ist ungültig.`);
      else ids.set(item.id, (ids.get(item.id) ?? 0) + 1);
    }
    if (item.rev !== undefined && (typeof item.rev !== "string" || !ID_PATTERN.test(item.rev)))
      findings.error(`${where}: Der Prüfwert („rev“) ist ungültig.`);
  };

  const set = value.set;
  if (!isObject(set)) {
    findings.error("Es fehlen die Angaben zum Set („set“).");
  } else {
    const where = "Set-Angaben";
    findings.ignoreUnknown(set, "set", where);
    checkIds(set, where);
    checkText(set.title, where, "der Titel", "title", findings, MAX_LENGTH.short);
    checkLanguage(set.termLanguage, where, "die Lernsprache", "termLanguage", findings);
    checkLanguage(set.meaningLanguage, where, "die Bedeutungssprache", "meaningLanguage", findings);
    for (const text of SET_TEXTS) checkOptionalText(set[text.field], where, text, findings);
    checkReviewStatus(set.reviewStatus, where, findings);
  }

  const sections = value.sections;
  if (!Array.isArray(sections)) {
    findings.error("Es fehlen die Sektionen („sections“).");
    return result();
  }
  if (sections.length === 0) findings.error("Das Set braucht mindestens eine Sektion.");
  if (sections.length > MAX_SECTIONS) {
    findings.error(`Das Set hat mehr als ${MAX_SECTIONS} Sektionen.`);
    return result();
  }
  const entryCount = sections.reduce<number>(
    (sum, section) =>
      sum + (isObject(section) && Array.isArray(section.entries) ? section.entries.length : 0),
    0,
  );
  if (entryCount > MAX_ENTRIES) {
    findings.error(`Das Set hat mehr als ${count(MAX_ENTRIES)} Einträge.`);
    return result();
  }

  let singularMeanings = 0;
  sections.forEach((section: unknown, s) => {
    if (!isObject(section)) return findings.error(`Sektion ${s + 1}: Die Angaben sind ungültig.`);
    const where = `Sektion ${s + 1}${label(section.title)}`;
    findings.ignoreUnknown(section, "section", where);
    checkIds(section, where);
    checkText(section.title, where, "der Titel", "title", findings, MAX_LENGTH.short);
    if (!Array.isArray(section.entries))
      return findings.error(`${where}: Es fehlt die Liste der Einträge („entries“).`);

    section.entries.forEach((entry: unknown, e) => {
      const at = `${where}, Eintrag ${e + 1}`;
      if (!isObject(entry)) return findings.error(`${at}: Die Angaben sind ungültig.`);
      const term = answerText(entry.term);
      const whereEntry = term ? `${at} (${label(term).trim()})` : at;
      const singular = entry.meanings === undefined && entry.meaning !== undefined;
      findings.ignoreUnknown(
        entry,
        "entry",
        whereEntry,
        entry.meanings === undefined ? KNOWN_FIELDS.entry : ENTRY_WITHOUT_MEANING,
      );
      checkIds(entry, whereEntry);
      checkAnswer(entry.term, whereEntry, TERM, findings);

      if (singular) {
        singularMeanings++;
        checkAnswer(entry.meaning, whereEntry, meaningMessages(1), findings);
      } else if (entry.meanings == null) {
        findings.error(`${whereEntry}: Es fehlt die Bedeutung („meanings“).`);
      } else if (!Array.isArray(entry.meanings)) {
        findings.error(`${whereEntry}: Die Bedeutungen („meanings“) müssen eine Liste sein.`);
      } else if (entry.meanings.length === 0) {
        findings.error(`${whereEntry}: Es fehlt die Bedeutung („meanings“).`);
      } else {
        entry.meanings.forEach((meaning: unknown, m) =>
          checkAnswer(meaning, whereEntry, meaningMessages(m + 1), findings),
        );
      }

      checkOptionalText(entry.notes, whereEntry, NOTES, findings);
      checkExamples(entry.examples, whereEntry, findings);
      checkGrammar(entry.grammar, whereEntry, findings);
      checkReviewStatus(entry.reviewStatus, whereEntry, findings);
    });
  });

  for (const [id, n] of ids) {
    if (n > 1)
      findings.error(
        `Die Kennung „${id}“ kommt mehrfach vor. Jede Kennung darf in einem Set nur einmal vorkommen.`,
      );
  }
  if (singularMeanings > 0) {
    const entries = singularMeanings === 1 ? "1 Eintrag" : `${singularMeanings} Einträgen`;
    warnings.push(
      `Bei ${entries} steht „meaning“ statt „meanings“; das wurde als eine Bedeutung übernommen.`,
    );
  }

  return result();
}

/** Liefert `false`, wenn die übrige Prüfung keinen Sinn ergibt (fremdes oder neueres Format). */
function checkFormat(value: Json, findings: Findings, warnings: string[]): boolean {
  const { format, formatVersion } = value;
  if (format === "vokabeltrainer-backup") {
    findings.error(
      "Das ist ein Backup, kein Vokabelset. Ein Backup wird nicht importiert, sondern wiederhergestellt.",
    );
    return false;
  }
  if (format !== undefined && format !== "vokabeltrainer-set") {
    findings.error(
      "Die Datei ist kein Vokabelset: Die Formatkennung („format“) muss „vokabeltrainer-set“ lauten.",
    );
    return false;
  }
  if (formatVersion === undefined) {
    // Formatspezifikation 2, Fußnote 1: tolerant Version 1 annehmen.
    warnings.push("Die Formatversion fehlt; die App nimmt Version 1 an.");
  } else if (
    typeof formatVersion !== "number" ||
    !Number.isInteger(formatVersion) ||
    formatVersion < 1
  ) {
    findings.error("Die Formatversion („formatVersion“) muss eine ganze Zahl ab 1 sein.");
  } else if (formatVersion > 1) {
    findings.error(
      "Diese Datei stammt von einer neueren App-Version. Lade die App neu, um sie zu importieren.",
    );
    return false;
  }
  return true;
}

/** Nur die Form; ob `sectionIds` zu den Sektionen passt, prüft der Abgleich mit dem Set (S-34). */
function checkScope(scope: unknown, findings: Findings): void {
  if (scope === undefined) return;
  if (!isObject(scope) || (scope.type !== "set" && scope.type !== "sections"))
    return findings.error("Der Umfang („scope“) ist ungültig.");
  findings.ignoreUnknown(scope, "scope", "Umfang");
  if (scope.type === "set") return;
  const ids = scope.sectionIds;
  if (
    !Array.isArray(ids) ||
    ids.length === 0 ||
    !ids.every((id) => typeof id === "string" && ID_PATTERN.test(id)) ||
    new Set(ids).size !== ids.length
  )
    findings.error(
      "Der Umfang („scope“) muss die Sektionen als Liste verschiedener Kennungen nennen („sectionIds“).",
    );
}

/** Pflichttext; `null` gilt als fehlend. */
function checkText(
  value: unknown,
  where: string,
  name: string,
  field: string,
  findings: Findings,
  max?: number,
): value is string {
  if (value == null || (typeof value === "string" && isBlank(value))) {
    findings.error(`${where}: Es fehlt ${name} („${field}“).`);
    return false;
  }
  if (typeof value !== "string") {
    findings.error(`${where}: ${capitalize(name)} („${field}“) muss ein Text sein.`);
    return false;
  }
  if (max !== undefined && length(value) > max)
    findings.error(
      `${where}: ${capitalize(name)} („${field}“) ist länger als ${count(max)} Zeichen.`,
    );
  return true;
}

/** Optionaler Text: fehlend, `null` und leer sind erlaubt (D-24). */
function checkOptionalText(value: unknown, where: string, text: OptionalText, findings: Findings) {
  if (value == null) return;
  const name = `${capitalize(text.name)} („${text.field}“)`;
  if (typeof value !== "string") findings.error(`${where}: ${name} muss ein Text sein.`);
  else if (length(value) > text.max)
    findings.error(`${where}: ${name} ist länger als ${count(text.max)} Zeichen.`);
}

function checkReviewStatus(value: unknown, where: string, findings: Findings): void {
  if (value == null || value === "unchecked" || value === "checked") return;
  findings.error(`${where}: Der Prüfstatus („reviewStatus“) muss „unchecked“ oder „checked“ sein.`);
}

function checkExamples(value: unknown, where: string, findings: Findings): void {
  if (value == null) return;
  if (!Array.isArray(value))
    return findings.error(`${where}: Die Beispiele („examples“) müssen eine Liste sein.`);
  value.forEach((example: unknown, i) => {
    const name = `Beispiel ${i + 1}`;
    const text = isObject(example) ? example.text : example;
    if (typeof text !== "string")
      return findings.error(`${where}: ${name} muss ein Text sein oder ein Objekt mit „text“.`);
    if (isBlank(text)) findings.error(`${where}: ${name} ist leer.`);
    else if (length(text) > MAX_LENGTH.answer)
      findings.error(`${where}: ${name} ist länger als ${MAX_LENGTH.answer} Zeichen.`);
    if (isObject(example)) {
      checkOptionalText(example.translation, `${where}, ${name}`, TRANSLATION, findings);
      findings.ignoreUnknown(example, "example", `${where}, ${name}`);
    }
  });
}

function checkGrammar(value: unknown, where: string, findings: Findings): void {
  if (value == null) return;
  if (!isObject(value))
    return findings.error(`${where}: Die Grammatikangaben („grammar“) müssen ein Objekt sein.`);
  const at = `${where}, Grammatik`;
  findings.ignoreUnknown(value, "grammar", at);
  for (const text of GRAMMAR_TEXTS) checkOptionalText(value[text.field], at, text, findings);
  const forms = value.forms;
  if (forms == null) return;
  if (!isTextList(forms))
    findings.error(`${at}: Die Wortformen („forms“) müssen eine Liste nichtleerer Texte sein.`);
  else if (forms.some((form) => length(form) > MAX_LENGTH.short))
    findings.error(`${at}: Eine Wortform ist länger als ${MAX_LENGTH.short} Zeichen.`);
}

const isTextList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string" && !isBlank(item));

function checkLanguage(
  value: unknown,
  where: string,
  name: string,
  field: string,
  findings: Findings,
): void {
  if (!checkText(value, where, name, field, findings)) return;
  if (canonicalLanguage(value) === null)
    findings.error(
      `${where}: ${capitalize(name)} „${value}“ ist kein gültiger Sprachcode, z. B. „en“ oder „en-GB“.`,
    );
}

/** BCP 47 kanonisiert, z. B. `EN-gb` → `en-GB`; Sprache mit zwei oder drei Buchstaben (Formatspezifikation 3). */
export function canonicalLanguage(code: string): string | null {
  try {
    const [canonical] = Intl.getCanonicalLocales(code.trim());
    return canonical && /^[a-z]{2,3}(-|$)/.test(canonical) ? canonical : null;
  } catch {
    return null;
  }
}

interface AnswerMessages {
  /** Bezeichnung in Fundstellen unbekannter Felder, z. B. „Bedeutung 2“. */
  label: string;
  missing: string;
  type: string;
  variants: string;
  long: string;
  variantLong: string;
}

const TERM: AnswerMessages = {
  label: "Wort",
  missing: "Es fehlt das Wort („term“).",
  type: "Das Wort („term“) muss ein Text sein oder ein Objekt mit „text“.",
  variants:
    "Die Varianten („acceptedVariants“) des Wortes müssen eine Liste nichtleerer Texte sein.",
  long: `Das Wort („term“) ist länger als ${MAX_LENGTH.answer} Zeichen.`,
  variantLong: `Eine Variante des Wortes ist länger als ${MAX_LENGTH.answer} Zeichen.`,
};

const meaningMessages = (n: number): AnswerMessages => ({
  label: `Bedeutung ${n}`,
  missing: `Bedeutung ${n} ist leer.`,
  type: `Bedeutung ${n} muss ein Text sein oder ein Objekt mit „text“.`,
  variants: `Die Varianten („acceptedVariants“) von Bedeutung ${n} müssen eine Liste nichtleerer Texte sein.`,
  long: `Bedeutung ${n} ist länger als ${MAX_LENGTH.answer} Zeichen.`,
  variantLong: `Eine Variante von Bedeutung ${n} ist länger als ${MAX_LENGTH.answer} Zeichen.`,
});

function checkAnswer(answer: unknown, where: string, messages: AnswerMessages, findings: Findings) {
  const problem = answerProblem(answer);
  if (problem) findings.error(`${where}: ${messages[problem]}`);
  if (isObject(answer)) findings.ignoreUnknown(answer, "answer", `${where}, ${messages.label}`);
}

function answerProblem(answer: unknown): Exclude<keyof AnswerMessages, "label"> | null {
  if (answer == null) return "missing";
  if (typeof answer === "string")
    return isBlank(answer) ? "missing" : length(answer) > MAX_LENGTH.answer ? "long" : null;
  if (!isObject(answer) || typeof answer.text !== "string") return "type";
  if (isBlank(answer.text)) return "missing";
  if (length(answer.text) > MAX_LENGTH.answer) return "long";
  const variants = answer.acceptedVariants;
  if (variants == null) return null;
  if (!isTextList(variants)) return "variants";
  return variants.some((variant) => length(variant) > MAX_LENGTH.answer) ? "variantLong" : null;
}

function answerText(answer: unknown): string | null {
  const text = isObject(answer) ? answer.text : answer;
  return typeof text === "string" && !isBlank(text) ? text : null;
}

/** ` „Titel“` für Fundstellen, gekürzt; leer, wenn kein Text vorliegt. */
function label(value: unknown): string {
  if (typeof value !== "string" || isBlank(value)) return "";
  const text = value.trim();
  return ` „${text.length > LABEL_LENGTH ? `${text.slice(0, LABEL_LENGTH)}…` : text}“`;
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
