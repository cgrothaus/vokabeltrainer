// Formular des Eintragseditors (TDD 10, FR-04, FR-05): Eintrag ↔ Formularzustand, Prüfen mit Meldungen
// ohne Feldnamen und Erkennen ungespeicherter Änderungen. Leere Zeilen fallen still weg; normalisiert
// wird wie beim Import (normalize.ts), damit Formular und Datei dieselben Daten ergeben.
import type { ReviewStatus, StoredEntry } from "./model";
import { normalizeEntry } from "./normalize";
import { type FileEntry, MAX_LENGTH } from "./validate";

export interface AnswerForm {
  text: string;
  variants: string[];
}

/** Nur Texte und Listen, so wie sie in den Feldern stehen. */
export interface EntryForm {
  /** Ziel-Sektion; eine andere als bisher verschiebt den Eintrag (TDD 10). */
  sectionId: string;
  term: AnswerForm;
  meanings: AnswerForm[];
  partOfSpeech: string;
  gender: string;
  plural: string;
  forms: string[];
  examples: { text: string; translation: string }[];
  notes: string;
  checked: boolean;
}

/** `field` benennt das Feld im Formular, z. B. `term`, `meanings.1` oder `notes`. */
export interface FormError {
  field: string;
  message: string;
}

export type FormResult = { ok: true; entry: StoredEntry } | { ok: false; errors: FormError[] };

export function emptyEntryForm(sectionId: string): EntryForm {
  return {
    sectionId,
    term: { text: "", variants: [] },
    meanings: [{ text: "", variants: [] }],
    partOfSpeech: "",
    gender: "",
    plural: "",
    forms: [],
    examples: [],
    notes: "",
    checked: false,
  };
}

export function entryToForm(entry: StoredEntry, sectionId: string): EntryForm {
  const answer = (value: StoredEntry["term"]): AnswerForm => ({
    text: value.text,
    variants: [...(value.acceptedVariants ?? [])],
  });
  return {
    sectionId,
    term: answer(entry.term),
    meanings: entry.meanings.map(answer),
    partOfSpeech: entry.grammar?.partOfSpeech ?? "",
    gender: entry.grammar?.gender ?? "",
    plural: entry.grammar?.plural ?? "",
    forms: [...(entry.grammar?.forms ?? [])],
    examples: (entry.examples ?? []).map((example) => ({
      text: example.text,
      translation: example.translation ?? "",
    })),
    notes: entry.notes ?? "",
    checked: entry.reviewStatus === "checked",
  };
}

const isBlank = (value: string) => value.trim() === "";

/** Zeichen (Codepoints) nach Trimmen und NFC, so wie der Text gespeichert wird. */
const length = (value: string) => [...value.trim().normalize("NFC")].length;

const count = (value: number) => value.toLocaleString("de-DE");

const filled = (values: string[]) => values.filter((value) => !isBlank(value));

/**
 * Prüft das Formular und baut den Eintrag. `previous` ist der bisherige Eintrag: Ohne Haken bei
 * „geprüft“ wird er „ungeprüft“, außer er hatte vorher keinen Prüfstatus.
 */
export function formToEntry(form: EntryForm, id: string, previous?: StoredEntry): FormResult {
  const errors: FormError[] = [];
  const tooLong = (field: string, value: string, max: number, message: string) => {
    if (length(value) > max)
      errors.push({ field, message: `${message} ist länger als ${count(max)} Zeichen.` });
  };

  if (isBlank(form.term.text)) errors.push({ field: "term", message: "Das Wort fehlt." });
  tooLong("term", form.term.text, MAX_LENGTH.answer, "Das Wort");
  if (filled(form.term.variants).some((variant) => length(variant) > MAX_LENGTH.answer))
    errors.push({
      field: "term",
      message: `Eine Variante des Wortes ist länger als ${count(MAX_LENGTH.answer)} Zeichen.`,
    });

  form.meanings.forEach((meaning, i) => {
    const field = `meanings.${i}`;
    const name = `Bedeutung ${i + 1}`;
    const variants = filled(meaning.variants);
    if (isBlank(meaning.text)) {
      if (variants.length > 0) errors.push({ field, message: `Bei ${name} fehlt der Text.` });
      return;
    }
    tooLong(field, meaning.text, MAX_LENGTH.answer, name);
    if (variants.some((variant) => length(variant) > MAX_LENGTH.answer))
      errors.push({
        field,
        message: `Eine Variante von ${name} ist länger als ${count(MAX_LENGTH.answer)} Zeichen.`,
      });
  });
  if (form.meanings.every((meaning) => isBlank(meaning.text)))
    errors.push({ field: "meanings.0", message: "Es fehlt eine Bedeutung." });

  tooLong("partOfSpeech", form.partOfSpeech, MAX_LENGTH.short, "Die Wortart");
  tooLong("gender", form.gender, MAX_LENGTH.short, "Das Genus");
  tooLong("plural", form.plural, MAX_LENGTH.short, "Der Plural");
  if (filled(form.forms).some((value) => length(value) > MAX_LENGTH.short))
    errors.push({
      field: "forms",
      message: `Eine Wortform ist länger als ${count(MAX_LENGTH.short)} Zeichen.`,
    });

  form.examples.forEach((example, i) => {
    const field = `examples.${i}`;
    const name = `Beispiel ${i + 1}`;
    if (isBlank(example.text)) {
      if (!isBlank(example.translation))
        errors.push({ field, message: `Bei ${name} fehlt der Satz.` });
      return;
    }
    tooLong(field, example.text, MAX_LENGTH.answer, name);
    tooLong(field, example.translation, MAX_LENGTH.answer, `Die Übersetzung von ${name}`);
  });

  tooLong("notes", form.notes, MAX_LENGTH.notes, "Die Notiz");

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, entry: { ...normalizeEntry(toFileEntry(form, previous)), id } };
}

/** Ohne leere Zeilen; leere optionale Felder entfernt erst `normalizeEntry` (D-24). */
function toFileEntry(form: EntryForm, previous?: StoredEntry): FileEntry {
  const answer = (value: AnswerForm) => ({
    text: value.text,
    acceptedVariants: filled(value.variants),
  });
  return {
    term: answer(form.term),
    meanings: form.meanings.filter((meaning) => !isBlank(meaning.text)).map(answer),
    notes: form.notes,
    examples: form.examples
      .filter((example) => !isBlank(example.text))
      .map((example) => ({ text: example.text, translation: example.translation })),
    grammar: {
      partOfSpeech: form.partOfSpeech,
      gender: form.gender,
      plural: form.plural,
      forms: filled(form.forms),
    },
    reviewStatus: reviewStatus(form.checked, previous?.reviewStatus),
  };
}

function reviewStatus(checked: boolean, previous: ReviewStatus | undefined): ReviewStatus | null {
  if (checked) return "checked";
  return previous ? "unchecked" : null;
}

/** Ob sich das Formular gegenüber `original` geändert hat; Leerraum am Rand und leere Zeilen zählen nicht. */
export function formChanged(form: EntryForm, original: EntryForm): boolean {
  return canonical(form) !== canonical(original);
}

function canonical(form: EntryForm): string {
  const text = (value: string) => value.trim().normalize("NFC");
  const texts = (values: string[]) => filled(values).map(text);
  const answer = (value: AnswerForm) => [text(value.text), texts(value.variants)];
  return JSON.stringify([
    form.sectionId,
    answer(form.term),
    form.meanings
      .filter((meaning) => !isBlank(meaning.text) || filled(meaning.variants).length > 0)
      .map(answer),
    text(form.partOfSpeech),
    text(form.gender),
    text(form.plural),
    texts(form.forms),
    form.examples
      .filter((example) => !isBlank(example.text) || !isBlank(example.translation))
      .map((example) => [text(example.text), text(example.translation)]),
    text(form.notes),
    form.checked,
  ]);
}
