// Normalisierung einer geprüften Datei für ein neues Set (TDD 8.4): Kurzformen in Langform, Texte
// getrimmt und in NFC, Sprachcodes kanonisiert. Es werden neue Objekte aufgebaut, unbekannte Felder
// fallen dadurch weg; leere optionale Felder und `null` ebenso (D-24).
import type { Answer, StoredEntry, StoredSection, StoredSet } from "./model";
import { canonicalLanguage, type FileAnswer, type FileEntry, type SetFile } from "./validate";

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

export function normalizeSetFile(file: SetFile): NewSet {
  const { set } = file;
  return compact({
    id: set.id,
    title: text(set.title),
    termLanguage: language(set.termLanguage),
    meaningLanguage: language(set.meaningLanguage),
    level: optionalText(set.level),
    textbook: optionalText(set.textbook),
    edition: optionalText(set.edition),
    source: optionalText(set.source),
    license: optionalText(set.license),
    notes: optionalText(set.notes),
    reviewStatus: set.reviewStatus ?? undefined,
    sections: file.sections.map((section) =>
      compact({
        id: section.id,
        title: text(section.title),
        entries: section.entries.map(entry),
      }),
    ),
  });
}

function entry(value: FileEntry): NewEntry {
  return compact({
    id: value.id,
    term: answer(value.term),
    meanings: (value.meanings ?? [value.meaning!]).map(answer),
    notes: optionalText(value.notes),
    examples: nonEmpty(value.examples?.map(example)),
    grammar: grammar(value.grammar),
    reviewStatus: value.reviewStatus ?? undefined,
  });
}

/** Entfernt Felder mit dem Wert `undefined`, damit sie weder gespeichert noch exportiert werden. */
function compact<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}

const nonEmpty = <T>(items: T[] | undefined) => (items && items.length > 0 ? items : undefined);

const text = (value: string) => value.trim().normalize("NFC");

/** Leer und `null` gelten als nicht angegeben (D-24). */
function optionalText(value: string | null | undefined): string | undefined {
  if (value == null) return undefined;
  const result = text(value);
  return result === "" ? undefined : result;
}

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
  return compact({ text: text(value.text), translation: optionalText(value.translation) });
}

function grammar(value: FileEntry["grammar"]): Grammar | undefined {
  if (value == null) return undefined;
  const result = compact({
    partOfSpeech: optionalText(value.partOfSpeech),
    gender: optionalText(value.gender),
    plural: optionalText(value.plural),
    forms: nonEmpty(value.forms?.map(text)),
  });
  return Object.keys(result).length > 0 ? result : undefined;
}
