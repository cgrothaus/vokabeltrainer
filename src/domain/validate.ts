// Grundvalidierung einer Vokabelset-Datei (TDD 8.3, Formatspezifikation 2–8) mit deutschen Meldungen und
// Fundstelle. Geprüft wird, was für ein neues Set nötig ist; optionale Felder, Textlängen und unbekannte
// Felder folgen mit S-12.

/** Antwort in Kurz- (String) oder Langform (Formatspezifikation 5.2). */
export type FileAnswer = string | { text: string; acceptedVariants?: string[] };

export interface FileEntry {
  id?: string;
  term: FileAnswer;
  /** Fehlt genau dann, wenn `meaning` (Einzahl) angegeben ist. */
  meanings?: FileAnswer[];
  meaning?: FileAnswer;
}

export interface FileSection {
  id?: string;
  title: string;
  entries: FileEntry[];
}

/** Eine geprüfte Datei; weitere Felder können vorhanden sein und werden nicht übernommen. */
export interface SetFile {
  set: { id?: string; title: string; termLanguage: string; meaningLanguage: string };
  sections: FileSection[];
}

export type ValidationResult =
  | { ok: true; file: SetFile; warnings: string[] }
  | { ok: false; errors: string[]; warnings: string[] };

/** Schutz vor Blockade (TDD 8.3, DF-08). */
export const MAX_SECTIONS = 500;
export const MAX_ENTRIES = 20_000;

/** Auch fremde IDs, z. B. ältere UUIDs (TDD 6.3). */
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const LABEL_LENGTH = 40;

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isBlank = (value: string) => value.trim() === "";

export function validateSetFile(value: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const fail = () => ({ ok: false as const, errors, warnings });

  if (!isObject(value)) return { ...fail(), errors: ["Das Vokabelset muss ein JSON-Objekt sein."] };
  if (!checkFormat(value, errors, warnings)) return fail();
  checkScope(value.scope, errors);

  const ids = new Map<string, number>();
  const checkId = (id: unknown, where: string) => {
    if (id === undefined) return;
    if (typeof id !== "string" || !ID_PATTERN.test(id))
      errors.push(`${where}: Die Kennung ist ungültig.`);
    else ids.set(id, (ids.get(id) ?? 0) + 1);
  };

  const set = value.set;
  if (!isObject(set)) {
    errors.push("Es fehlen die Angaben zum Set („set“).");
  } else {
    const where = "Set-Angaben";
    checkId(set.id, where);
    checkText(set.title, where, "der Titel", "title", errors);
    checkLanguage(set.termLanguage, where, "die Lernsprache", "termLanguage", errors);
    checkLanguage(set.meaningLanguage, where, "die Bedeutungssprache", "meaningLanguage", errors);
  }

  const sections = value.sections;
  if (!Array.isArray(sections)) {
    errors.push("Es fehlen die Sektionen („sections“).");
    return fail();
  }
  if (sections.length === 0) errors.push("Das Set braucht mindestens eine Sektion.");
  if (sections.length > MAX_SECTIONS) {
    errors.push(`Das Set hat mehr als ${MAX_SECTIONS} Sektionen.`);
    return fail();
  }
  const entryCount = sections.reduce<number>(
    (sum, section) =>
      sum + (isObject(section) && Array.isArray(section.entries) ? section.entries.length : 0),
    0,
  );
  if (entryCount > MAX_ENTRIES) {
    errors.push(`Das Set hat mehr als ${MAX_ENTRIES.toLocaleString("de-DE")} Einträge.`);
    return fail();
  }

  let singularMeanings = 0;
  sections.forEach((section: unknown, s) => {
    if (!isObject(section)) return errors.push(`Sektion ${s + 1}: Die Angaben sind ungültig.`);
    const where = `Sektion ${s + 1}${label(section.title)}`;
    checkId(section.id, where);
    checkText(section.title, where, "der Titel", "title", errors);
    if (!Array.isArray(section.entries))
      return errors.push(`${where}: Es fehlt die Liste der Einträge („entries“).`);

    section.entries.forEach((entry: unknown, e) => {
      const at = `${where}, Eintrag ${e + 1}`;
      if (!isObject(entry)) return errors.push(`${at}: Die Angaben sind ungültig.`);
      const term = answerText(entry.term);
      const whereEntry = term ? `${at} (${label(term).trim()})` : at;
      checkId(entry.id, whereEntry);
      checkAnswer(entry.term, whereEntry, TERM, errors);

      if (entry.meanings === undefined && entry.meaning !== undefined) {
        singularMeanings++;
        checkAnswer(entry.meaning, whereEntry, meaningMessages(1), errors);
      } else if (entry.meanings === undefined) {
        errors.push(`${whereEntry}: Es fehlt die Bedeutung („meanings“).`);
      } else if (!Array.isArray(entry.meanings)) {
        errors.push(`${whereEntry}: Die Bedeutungen („meanings“) müssen eine Liste sein.`);
      } else if (entry.meanings.length === 0) {
        errors.push(`${whereEntry}: Es fehlt die Bedeutung („meanings“).`);
      } else {
        entry.meanings.forEach((meaning: unknown, m) =>
          checkAnswer(meaning, whereEntry, meaningMessages(m + 1), errors),
        );
      }
    });
  });

  for (const [id, count] of ids) {
    if (count > 1)
      errors.push(
        `Die Kennung „${id}“ kommt mehrfach vor. Jede Kennung darf in einem Set nur einmal vorkommen.`,
      );
  }
  if (singularMeanings > 0) {
    const entries = singularMeanings === 1 ? "1 Eintrag" : `${singularMeanings} Einträgen`;
    warnings.push(
      `Bei ${entries} steht „meaning“ statt „meanings“; das wurde als eine Bedeutung übernommen.`,
    );
  }

  return errors.length > 0 ? fail() : { ok: true, file: value as unknown as SetFile, warnings };
}

/** Liefert `false`, wenn die übrige Prüfung keinen Sinn ergibt (fremdes oder neueres Format). */
function checkFormat(value: Json, errors: string[], warnings: string[]): boolean {
  const { format, formatVersion } = value;
  if (format === "vokabeltrainer-backup") {
    errors.push(
      "Das ist ein Backup, kein Vokabelset. Ein Backup wird nicht importiert, sondern wiederhergestellt.",
    );
    return false;
  }
  if (format !== undefined && format !== "vokabeltrainer-set") {
    errors.push(
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
    errors.push("Die Formatversion („formatVersion“) muss eine ganze Zahl ab 1 sein.");
  } else if (formatVersion > 1) {
    errors.push(
      "Diese Datei stammt von einer neueren App-Version. Lade die App neu, um sie zu importieren.",
    );
    return false;
  }
  return true;
}

function checkScope(scope: unknown, errors: string[]): void {
  if (scope === undefined) return;
  const type = isObject(scope) ? scope.type : undefined;
  // Ein neues Set hat keine Sektionen, die ein Teil-Export bezeichnen könnte (TDD 9.6).
  if (type === "sections")
    errors.push(
      "Diese Datei enthält nur einen Teil eines Sets. Ein Teil kann nur in ein vorhandenes Set übernommen werden.",
    );
  else if (type !== "set") errors.push("Der Umfang („scope“) ist ungültig.");
}

function checkText(
  value: unknown,
  where: string,
  name: string,
  field: string,
  errors: string[],
): value is string {
  if (value === undefined || (typeof value === "string" && isBlank(value))) {
    errors.push(`${where}: Es fehlt ${name} („${field}“).`);
    return false;
  }
  if (typeof value !== "string") {
    errors.push(`${where}: ${capitalize(name)} („${field}“) muss ein Text sein.`);
    return false;
  }
  return true;
}

function checkLanguage(
  value: unknown,
  where: string,
  name: string,
  field: string,
  errors: string[],
): void {
  if (!checkText(value, where, name, field, errors)) return;
  if (canonicalLanguage(value) === null)
    errors.push(
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
  missing: string;
  type: string;
  variants: string;
}

const TERM: AnswerMessages = {
  missing: "Es fehlt das Wort („term“).",
  type: "Das Wort („term“) muss ein Text sein oder ein Objekt mit „text“.",
  variants:
    "Die Varianten („acceptedVariants“) des Wortes müssen eine Liste nichtleerer Texte sein.",
};

const meaningMessages = (n: number): AnswerMessages => ({
  missing: `Bedeutung ${n} ist leer.`,
  type: `Bedeutung ${n} muss ein Text sein oder ein Objekt mit „text“.`,
  variants: `Die Varianten („acceptedVariants“) von Bedeutung ${n} müssen eine Liste nichtleerer Texte sein.`,
});

function checkAnswer(answer: unknown, where: string, messages: AnswerMessages, errors: string[]) {
  const problem = answerProblem(answer);
  if (problem) errors.push(`${where}: ${messages[problem]}`);
}

function answerProblem(answer: unknown): keyof AnswerMessages | null {
  if (answer === undefined) return "missing";
  if (typeof answer === "string") return isBlank(answer) ? "missing" : null;
  if (!isObject(answer) || typeof answer.text !== "string") return "type";
  if (isBlank(answer.text)) return "missing";
  const variants = answer.acceptedVariants;
  if (
    variants !== undefined &&
    !(Array.isArray(variants) && variants.every((v) => typeof v === "string" && !isBlank(v)))
  )
    return "variants";
  return null;
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
