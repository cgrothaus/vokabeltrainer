// Normalisierung einer geprüften Datei (TDD 8.4): Kurzformen in Langform, Texte getrimmt und in NFC,
// Sprachcodes kanonisiert. Es werden neue Objekte aufgebaut, unbekannte Felder fallen dadurch weg.
// Optionale Felder werden ab S-12 übernommen.
import type { Answer } from "./model";
import { canonicalLanguage, type FileAnswer, type SetFile } from "./validate";

/** Ein Set vor der ID-Vergabe; IDs aus der Datei bleiben erhalten. */
export interface NewSet {
  id?: string;
  title: string;
  termLanguage: string;
  meaningLanguage: string;
  sections: NewSection[];
}

export interface NewSection {
  id?: string;
  title: string;
  entries: NewEntry[];
}

export interface NewEntry {
  id?: string;
  term: Answer;
  meanings: Answer[];
}

export function normalizeSetFile(file: SetFile): NewSet {
  const { set } = file;
  return {
    ...withId(set.id),
    title: text(set.title),
    termLanguage: language(set.termLanguage),
    meaningLanguage: language(set.meaningLanguage),
    sections: file.sections.map((section) => ({
      ...withId(section.id),
      title: text(section.title),
      entries: section.entries.map((entry) => ({
        ...withId(entry.id),
        term: answer(entry.term),
        meanings: (entry.meanings ?? [entry.meaning!]).map(answer),
      })),
    })),
  };
}

const withId = (id: string | undefined) => (id === undefined ? {} : { id });

const text = (value: string) => value.trim().normalize("NFC");

/** Die Validierung hat den Code schon geprüft. */
const language = (code: string) => canonicalLanguage(code) ?? code;

function answer(value: FileAnswer): Answer {
  if (typeof value === "string") return { text: text(value) };
  const variants = value.acceptedVariants?.map(text) ?? [];
  return variants.length > 0
    ? { text: text(value.text), acceptedVariants: variants }
    : { text: text(value.text) };
}
