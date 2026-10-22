// Gespeicherte Datensätze prüfen (TDD 11.4), z. B. aus einem Backup vor dem Wiederherstellen. Geprüft
// werden Pflichtangaben und Typen nach domain/model.ts, eindeutige Schlüssel und die Verweise von
// Sitzungen und Antworten auf Sets. Die Meldungen nennen nur Positionen, keine Inhalte (TDD 14).

/** Datensätze der Stores, die ein Backup enthält (TDD 11.3); `meta` gehört nicht dazu. */
// Typalias statt Interface: Nur so passt es zu `BackupFile.data` (Record mit Index-Signatur).
export type StoreRecords = {
  sets: unknown[];
  reviewEvents: unknown[];
  sessions: unknown[];
  settings: unknown[];
};

type Json = Record<string, unknown>;
type Check = (value: unknown) => boolean;

const isObject = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const text: Check = (value) => typeof value === "string" && value.trim() !== "";
const string: Check = (value) => typeof value === "string";
const oneOf =
  (...values: string[]): Check =>
  (value) =>
    typeof value === "string" && values.includes(value);
const listOf =
  (item: Check): Check =>
  (value) =>
    Array.isArray(value) && value.every(item);
const optional =
  (check: Check): Check =>
  (value) =>
    value === undefined || check(value);
const count: Check = (value) => Number.isInteger(value) && (value as number) >= 0;
const number: Check = (value) => typeof value === "number" && Number.isFinite(value);

const answer: Check = (value) =>
  isObject(value) && text(value.text) && optional(listOf(text))(value.acceptedVariants);
const reviewStatus = optional(oneOf("unchecked", "checked"));
const direction = oneOf("termToMeaning", "meaningToTerm");

/** Felder pro Datensatzart; die Reihenfolge bestimmt die Reihenfolge der Meldungen. */
const SET_FIELDS: Record<string, Check> = {
  id: text,
  editCount: count,
  createdAt: text,
  updatedAt: text,
  title: text,
  termLanguage: text,
  meaningLanguage: text,
  level: optional(string),
  textbook: optional(string),
  edition: optional(string),
  source: optional(string),
  license: optional(string),
  notes: optional(string),
  reviewStatus,
  sections: Array.isArray,
};

const SECTION_FIELDS: Record<string, Check> = { id: text, title: text, entries: Array.isArray };

const ENTRY_FIELDS: Record<string, Check> = {
  id: text,
  term: answer,
  meanings: (value) => Array.isArray(value) && value.length > 0 && value.every(answer),
  notes: optional(string),
  examples: optional(
    listOf(
      (example) => isObject(example) && text(example.text) && optional(string)(example.translation),
    ),
  ),
  grammar: optional(
    (value) =>
      isObject(value) &&
      optional(string)(value.partOfSpeech) &&
      optional(string)(value.gender) &&
      optional(string)(value.plural) &&
      optional(listOf(string))(value.forms),
  ),
  reviewStatus,
};

const SESSION_FIELDS: Record<string, Check> = {
  id: text,
  setId: text,
  sectionIds: listOf(text),
  startedAt: text,
  endedAt: optional(text),
  status: oneOf("active", "completed", "ended", "interrupted"),
  config: (value) =>
    isObject(value) &&
    (direction(value.direction) || value.direction === "mixed") &&
    count(value.count) &&
    number(value.mcShare),
  // Zeigt auf eine Sitzung desselben Sets; beide werden nur zusammen gelöscht (D-25).
  repeatOf: optional(text),
};

const EVENT_FIELDS: Record<string, Check> = {
  id: text,
  sessionId: text,
  setId: text,
  entryId: text,
  entryRev: text,
  occurredAt: text,
  direction,
  mode: oneOf("flashcard", "multipleChoice"),
  result: oneOf("correct", "incorrect"),
  firstAttempt: (value) => typeof value === "boolean",
};

const SETTING_FIELDS: Record<string, Check> = { key: text };

/** Liefert alle Fehler; eine leere Liste heißt, die Datensätze passen zum Datenmodell. */
export function validateRecords(records: StoreRecords): string[] {
  const errors: string[] = [];

  const setIds = new Set<string>();
  eachRecord(records.sets, "Set", SET_FIELDS, "id", errors, (set, where) => {
    if (typeof set.id === "string") setIds.add(set.id);
    checkSections(set, where, errors);
  });

  const sessionSets = new Map<string, unknown>();
  eachRecord(records.sessions, "Lernsitzung", SESSION_FIELDS, "id", errors, (session, where) => {
    if (typeof session.id === "string") sessionSets.set(session.id, session.setId);
    if (typeof session.setId === "string" && !setIds.has(session.setId))
      errors.push(`${where}: Das zugehörige Set fehlt.`);
  });

  eachRecord(records.reviewEvents, "Antwort", EVENT_FIELDS, "id", errors, (event, where) => {
    if (typeof event.setId !== "string" || typeof event.sessionId !== "string") return;
    if (!setIds.has(event.setId)) return errors.push(`${where}: Das zugehörige Set fehlt.`);
    if (!sessionSets.has(event.sessionId))
      return errors.push(`${where}: Die zugehörige Lernsitzung fehlt.`);
    if (sessionSets.get(event.sessionId) !== event.setId)
      errors.push(`${where}: Sie gehört zu einem anderen Set als ihre Lernsitzung.`);
  });

  eachRecord(records.settings, "Einstellung", SETTING_FIELDS, "key", errors, () => {});

  return errors;
}

/** Prüft Felder und eindeutige Schlüssel; `more` folgt für jeden Datensatz, der ein Objekt ist. */
function eachRecord(
  list: unknown[],
  kind: string,
  fields: Record<string, Check>,
  key: string,
  errors: string[],
  more: (record: Json, where: string) => void,
): void {
  const keys = new Set<unknown>();
  list.forEach((record, i) => {
    const where = `${kind} ${i + 1}`;
    if (!isObject(record)) return errors.push(`${where}: Die Angaben sind ungültig.`);
    checkFields(record, fields, where, errors);
    if (keys.has(record[key])) errors.push(`${where}: Die Kennung kommt mehrfach vor.`);
    keys.add(record[key]);
    more(record, where);
  });
}

function checkSections(set: Json, where: string, errors: string[]): void {
  if (!Array.isArray(set.sections)) return;
  // Sektions- und Eintrags-IDs sind innerhalb eines Sets eindeutig (TDD 6.3).
  const ids = new Set<unknown>();
  const checkUnique = (id: unknown, at: string) => {
    if (ids.has(id)) errors.push(`${at}: Die Kennung kommt im Set mehrfach vor.`);
    ids.add(id);
  };
  set.sections.forEach((section: unknown, s) => {
    const atSection = `${where}, Sektion ${s + 1}`;
    if (!isObject(section)) return errors.push(`${atSection}: Die Angaben sind ungültig.`);
    checkFields(section, SECTION_FIELDS, atSection, errors);
    checkUnique(section.id, atSection);
    if (!Array.isArray(section.entries)) return;
    section.entries.forEach((entry: unknown, e) => {
      const atEntry = `${atSection}, Eintrag ${e + 1}`;
      if (!isObject(entry)) return errors.push(`${atEntry}: Die Angaben sind ungültig.`);
      checkFields(entry, ENTRY_FIELDS, atEntry, errors);
      checkUnique(entry.id, atEntry);
    });
  });
}

function checkFields(
  record: Json,
  fields: Record<string, Check>,
  where: string,
  errors: string[],
): void {
  for (const [field, check] of Object.entries(fields)) {
    if (!check(record[field]))
      errors.push(`${where}: Die Angabe „${field}“ fehlt oder ist ungültig.`);
  }
}
