// Normalisierung einer geprüften Datei (TDD 8.4): Kurzformen in Langform, Texte getrimmt und in NFC,
// Sprachcodes kanonisiert. Es werden neue Objekte aufgebaut, unbekannte Felder fallen dadurch weg;
// leere optionale Felder ebenso (D-24). Für ein neues Set entfällt auch `null`; für den Abgleich mit
// einem bekannten Set bleibt es als Löschmarkierung stehen (D-10).
import type { Answer, ReviewStatus, StoredEntry, StoredSection, StoredSet } from "./model";
import {
  canonicalLanguage,
  type FileAnswer,
  type FileEntry,
  type FileSetInfo,
  type SetFile,
} from "./validate";

/** Ein Set vor der ID-Vergabe; IDs aus der Datei bleiben erhalten. */
export type NewSet = Omit<
  StoredSet,
  "id" | "editCount" | "createdAt" | "updatedAt" | "sections"
> & {
  id?: string;
  sections: NewSection[];
};

export type NewSection = Omit<StoredSection, "id" | "entries"> & {
  id?: string;
  entries: NewEntry[];
};

export type NewEntry = Omit<StoredEntry, "id"> & { id?: string };

type Example = NonNullable<StoredEntry["examples"]>[number];
type Grammar = NonNullable<StoredEntry["grammar"]>;

/** Angaben zum Set ohne Verwaltungsfelder und Sektionen, wie sie `setRev` erfasst. */
export type SetInfo = Omit<StoredSet, "id" | "editCount" | "createdAt" | "updatedAt" | "sections">;

/** Optionale Felder dürfen `null` sein: Sie löschen beim Aktualisieren das Feld (TDD 9.3). */
type Deletable<T, Required extends keyof T> = { [K in Required]: T[K] } & {
  [K in Exclude<keyof T, Required>]?: NonNullable<T[K]> | null;
};

export type GrammarPatch = Deletable<Grammar, never>;

export type EntryPatch = Deletable<Omit<StoredEntry, "id" | "grammar">, "term" | "meanings"> & {
  id?: string;
  rev?: string;
  grammar?: GrammarPatch | null;
};

export interface SectionPatch {
  id?: string;
  rev?: string;
  title: string;
  entries: EntryPatch[];
}

export type SetInfoPatch = Deletable<SetInfo, "title" | "termLanguage" | "meaningLanguage"> & {
  id?: string;
  rev?: string;
};

/** Eine Datei für den Abgleich mit einem bekannten Set (TDD 9.3–9.6). */
export interface ImportFile {
  /** Ohne Angabe in der Datei das ganze Set (Formatspezifikation 7). */
  scope: NonNullable<SetFile["scope"]>;
  set: SetInfoPatch;
  sections: SectionPatch[];
}

/** `null` behalten (Datei für ein bekanntes Set) oder wie ein fehlendes Feld behandeln (neues Set). */
type Deletion = null | undefined;

export function normalizeSetFile(file: SetFile): NewSet {
  return compact({
    id: file.set.id,
    ...setInfo(file.set, undefined),
    sections: file.sections.map((section) =>
      compact({
        id: section.id,
        title: text(section.title),
        entries: section.entries.map(normalizeEntry),
      }),
    ),
  }) as NewSet;
}

/** Ein Eintrag aus einer Datei oder aus dem Formular des Editors (TDD 10). */
export function normalizeEntry(value: FileEntry): NewEntry {
  return compact({ id: value.id, ...entry(value, undefined) }) as NewEntry;
}

export function normalizeImportFile(file: SetFile): ImportFile {
  return {
    scope: file.scope ?? { type: "set" },
    set: compact({
      id: file.set.id,
      rev: file.set.rev,
      ...setInfo(file.set, null),
    }) as SetInfoPatch,
    sections: file.sections.map((section) =>
      compact({
        id: section.id,
        rev: section.rev,
        title: text(section.title),
        entries: section.entries.map(
          (value) => compact({ id: value.id, rev: value.rev, ...entry(value, null) }) as EntryPatch,
        ),
      }),
    ),
  };
}

function setInfo(set: FileSetInfo, deletion: Deletion) {
  return {
    title: text(set.title),
    termLanguage: language(set.termLanguage),
    meaningLanguage: language(set.meaningLanguage),
    level: optionalText(set.level, deletion),
    textbook: optionalText(set.textbook, deletion),
    edition: optionalText(set.edition, deletion),
    source: optionalText(set.source, deletion),
    license: optionalText(set.license, deletion),
    notes: optionalText(set.notes, deletion),
    reviewStatus: status(set.reviewStatus, deletion),
  };
}

function entry(value: FileEntry, deletion: Deletion) {
  return {
    term: answer(value.term),
    meanings: (value.meanings ?? [value.meaning!]).map(answer),
    notes: optionalText(value.notes, deletion),
    examples: value.examples === null ? deletion : nonEmpty(value.examples?.map(example)),
    grammar: grammar(value.grammar, deletion),
    reviewStatus: status(value.reviewStatus, deletion),
  };
}

/** Entfernt Felder mit dem Wert `undefined`, damit sie weder gespeichert noch exportiert werden. */
function compact<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}

const nonEmpty = <T>(items: T[] | undefined) => (items && items.length > 0 ? items : undefined);

const text = (value: string) => value.trim().normalize("NFC");

/** Leer gilt als nicht angegeben (D-24), `null` je nach Ziel als Löschmarkierung. */
function optionalText<D extends Deletion>(
  value: string | null | undefined,
  deletion: D,
): string | undefined | D {
  if (value === null) return deletion;
  if (value === undefined) return undefined;
  const result = text(value);
  return result === "" ? undefined : result;
}

const status = (value: ReviewStatus | null | undefined, deletion: Deletion) =>
  value === null ? deletion : value;

/** Die Validierung hat den Code schon geprüft. */
const language = (code: string) => canonicalLanguage(code) ?? code;

function answer(value: FileAnswer): Answer {
  if (typeof value === "string") return { text: text(value) };
  return compact({
    text: text(value.text),
    acceptedVariants: nonEmpty(value.acceptedVariants?.map(text)),
  });
}

function example(value: NonNullable<FileEntry["examples"]>[number]): Example {
  if (typeof value === "string") return { text: text(value) };
  return compact({
    text: text(value.text),
    translation: optionalText(value.translation, undefined),
  });
}

function grammar(value: FileEntry["grammar"], deletion: Deletion): GrammarPatch | null | undefined {
  if (value === null) return deletion;
  if (value === undefined) return undefined;
  const result = compact({
    partOfSpeech: optionalText(value.partOfSpeech, deletion),
    gender: optionalText(value.gender, deletion),
    plural: optionalText(value.plural, deletion),
    forms: value.forms === null ? deletion : nonEmpty(value.forms?.map(text)),
  });
  return Object.keys(result).length > 0 ? result : undefined;
}
