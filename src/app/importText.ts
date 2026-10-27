// Ablauf des Imports eines neuen Sets (TDD 9.1, 9.2) in zwei Schritten: Die Vorschau prüft und schreibt
// nichts, gespeichert wird erst nach Bestätigung. Die Fachlogik liegt in domain/importSet.ts und
// domain/duplicates.ts, das Speichern in storage/sets.ts. Hier werden sie verbunden.
import { duplicateMessage, findDuplicates } from "../domain/duplicates";
import { prepareNewSet } from "../domain/importSet";
import type { StoredSet } from "../domain/model";
import { randomBytes } from "../platform/random";
import { addSet, getSet, listSets } from "../storage/sets";
import { failureMessage, storageMessage } from "./storageMessages";

export interface ImportPreview {
  /** Fertig mit IDs; wird beim Bestätigen so gespeichert. */
  set: StoredSet;
  warnings: string[];
  /** Begleittext oder Codeblock wurde entfernt (TDD 8.2). */
  trimmed: boolean;
  /** Hinweise auf vorhandene Sets, die diesem offensichtlich entsprechen (FR-30). */
  duplicates: string[];
  sections: { title: string; entryCount: number }[];
  entryCount: number;
}

export type PreviewOutcome = ({ ok: true } & ImportPreview) | { ok: false; errors: string[] };

export type SaveOutcome =
  { ok: true; title: string; entryCount: number } | { ok: false; error: string };

// Aktualisieren bekannter Sets folgt mit M4 (S-34 bis S-36).
const EXISTS = "Dieses Set ist schon vorhanden. Aktualisieren ist noch nicht möglich.";

const countEntries = (set: StoredSet) =>
  set.sections.reduce((sum, section) => sum + section.entries.length, 0);

export async function previewImport(db: IDBDatabase, text: string): Promise<PreviewOutcome> {
  const prepared = prepareNewSet(text, { now: new Date().toISOString(), randomBytes });
  if (!prepared.ok) return prepared;
  const { set, warnings, trimmed } = prepared;
  let existing: StoredSet[];
  try {
    // Eine bekannte Set-ID schon hier ablehnen, nicht erst beim Speichern.
    if (await getSet(db, set.id)) return { ok: false, errors: [EXISTS] };
    existing = await listSets(db);
  } catch (error) {
    console.error("Sets nicht lesbar", error);
    return {
      ok: false,
      errors: [
        failureMessage(error, "Deine vorhandenen Vokabelsets konnten nicht gelesen werden."),
      ],
    };
  }
  return {
    ok: true,
    set,
    warnings,
    trimmed,
    duplicates: findDuplicates(set, existing).map((match) => duplicateMessage(match, set.edition)),
    sections: set.sections.map((section) => ({
      title: section.title,
      entryCount: section.entries.length,
    })),
    entryCount: countEntries(set),
  };
}

/** Gespeichert ist das Set erst, wenn die Transaktion abgeschlossen ist (TDD 6.5). */
export async function saveImport(db: IDBDatabase, set: StoredSet): Promise<SaveOutcome> {
  const now = new Date().toISOString();
  const saved = await addSet(db, { ...set, createdAt: now, updatedAt: now });
  if (!saved.ok) {
    const error =
      saved.reason === "exists"
        ? EXISTS
        : storageMessage(saved.reason, "Das Set wurde nicht gespeichert.");
    return { ok: false, error };
  }
  return { ok: true, title: set.title, entryCount: countEntries(set) };
}
