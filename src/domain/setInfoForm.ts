// Formular für die Angaben eines Sets (TDD 10, FR-02, D-41): beim Anlegen eines leeren Sets und beim
// Bearbeiten. Geprüft wird mit Meldungen ohne Feldnamen, normalisiert wie beim Import (normalize.ts).
import type { SetInfo } from "./editSet";
import type { FormError } from "./entryForm";
import type { ReviewStatus, StoredSet } from "./model";
import { normalizeSetFile } from "./normalize";
import { canonicalLanguage, MAX_LENGTH } from "./validate";

export interface SetInfoForm {
  title: string;
  /** Sprachcode, z. B. „en“; die Oberfläche zeigt ihn als Namen (D-41). */
  termLanguage: string;
  meaningLanguage: string;
  level: string;
  textbook: string;
  edition: string;
  source: string;
  license: string;
  notes: string;
  checked: boolean;
}

export type SetInfoResult = { ok: true; info: SetInfo } | { ok: false; errors: FormError[] };

type OptionalField = "level" | "textbook" | "edition" | "source" | "license" | "notes";

/** Optionale Angaben mit ihrem Namen in Meldungen und ihrer Höchstlänge (Formatspezifikation 8.4). */
const OPTIONAL: [OptionalField, string, number][] = [
  ["level", "Die Lernstufe", MAX_LENGTH.short],
  ["textbook", "Das Lehrwerk", MAX_LENGTH.short],
  ["edition", "Die Ausgabe", MAX_LENGTH.short],
  ["source", "Die Herkunft", MAX_LENGTH.short],
  ["license", "Die Lizenz", MAX_LENGTH.short],
  ["notes", "Die Notiz", MAX_LENGTH.notes],
];

/** Vorbelegung beim Anlegen: Englisch → Deutsch, der häufigste Fall (D-41). */
export function emptySetInfoForm(): SetInfoForm {
  return {
    title: "",
    termLanguage: "en",
    meaningLanguage: "de",
    level: "",
    textbook: "",
    edition: "",
    source: "",
    license: "",
    notes: "",
    checked: false,
  };
}

export function setInfoToForm(set: StoredSet): SetInfoForm {
  return {
    title: set.title,
    termLanguage: set.termLanguage,
    meaningLanguage: set.meaningLanguage,
    level: set.level ?? "",
    textbook: set.textbook ?? "",
    edition: set.edition ?? "",
    source: set.source ?? "",
    license: set.license ?? "",
    notes: set.notes ?? "",
    checked: set.reviewStatus === "checked",
  };
}

const isBlank = (value: string) => value.trim() === "";

/** Zeichen (Codepoints) nach Trimmen und NFC, so wie der Text gespeichert wird. */
const length = (value: string) => [...value.trim().normalize("NFC")].length;

const count = (value: number) => value.toLocaleString("de-DE");

/**
 * Prüft das Formular und liefert die Angaben. `previous` ist das bisherige Set: Ohne Haken bei
 * „geprüft“ wird es „ungeprüft“, außer es hatte vorher keinen Prüfstatus.
 */
export function formToSetInfo(form: SetInfoForm, previous?: StoredSet): SetInfoResult {
  const errors: FormError[] = [];
  if (isBlank(form.title)) errors.push({ field: "title", message: "Der Titel fehlt." });
  else if (length(form.title) > MAX_LENGTH.short)
    errors.push({
      field: "title",
      message: `Der Titel ist länger als ${count(MAX_LENGTH.short)} Zeichen.`,
    });
  for (const [field, name] of [
    ["termLanguage", "Die Lernsprache"],
    ["meaningLanguage", "Die Bedeutungssprache"],
  ] as const) {
    const code = form[field].trim();
    if (code === "") errors.push({ field, message: `${name} fehlt.` });
    else if (canonicalLanguage(code) === null)
      errors.push({
        field,
        message: `„${code}“ ist kein gültiger Sprachcode, z. B. „en“ oder „en-GB“.`,
      });
  }
  for (const [field, name, max] of OPTIONAL) {
    if (length(form[field]) > max)
      errors.push({ field, message: `${name} ist länger als ${count(max)} Zeichen.` });
  }
  if (errors.length > 0) return { ok: false, errors };

  // Dieselbe Normalisierung wie beim Import; ohne Sektionen bleiben nur die Angaben.
  const {
    sections: _sections,
    id: _id,
    ...info
  } = normalizeSetFile({
    set: {
      title: form.title,
      termLanguage: form.termLanguage,
      meaningLanguage: form.meaningLanguage,
      level: form.level,
      textbook: form.textbook,
      edition: form.edition,
      source: form.source,
      license: form.license,
      notes: form.notes,
      reviewStatus: reviewStatus(form.checked, previous?.reviewStatus),
    },
    sections: [],
  });
  return { ok: true, info };
}

function reviewStatus(checked: boolean, previous: ReviewStatus | undefined): ReviewStatus | null {
  if (checked) return "checked";
  return previous ? "unchecked" : null;
}

/** Ob sich das Formular gegenüber `original` geändert hat; Leerraum am Rand zählt nicht. */
export function setInfoChanged(form: SetInfoForm, original: SetInfoForm): boolean {
  const canonical = (value: SetInfoForm) =>
    JSON.stringify(
      Object.entries(value).map(([key, item]) =>
        typeof item === "string" ? [key, item.trim().normalize("NFC")] : [key, item],
      ),
    );
  return canonical(form) !== canonical(original);
}

export type SectionTitleResult = { ok: true; title: string } | { ok: false; error: string };

/** Titel einer neuen oder umbenannten Sektion: Pflicht, getrimmt und in NFC. */
export function checkSectionTitle(title: string): SectionTitleResult {
  const text = title.trim().normalize("NFC");
  if (text === "") return { ok: false, error: "Der Titel der Sektion fehlt." };
  if (length(text) > MAX_LENGTH.short)
    return {
      ok: false,
      error: `Der Titel der Sektion ist länger als ${count(MAX_LENGTH.short)} Zeichen.`,
    };
  return { ok: true, title: text };
}
