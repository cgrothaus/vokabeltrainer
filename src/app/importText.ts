// Ablauf des Imports eines neuen Sets (TDD 9.1, 9.2) in zwei Schritten: Die Vorschau prüft und schreibt
// nichts, gespeichert wird erst nach Bestätigung. Die Fachlogik liegt in domain/importSet.ts und
// domain/duplicates.ts, das Speichern in storage/sets.ts. Hier werden sie verbunden.
import { duplicateMessage, findDuplicates } from "../domain/duplicates";
import { prepareNewSet } from "../domain/importSet";
import type { StoredSet } from "../domain/model";
import { randomBytes } from "../platform/random";
import { addSet, getSet, listSets } from "../storage/sets";

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

const ERRORS = {
  // Aktualisieren bekannter Sets folgt mit M4 (S-34 bis S-36).
  exists: "Dieses Set ist schon vorhanden. Aktualisieren ist noch nicht möglich.",
  quota:
    "Der Speicher auf diesem Gerät ist voll. Das Set wurde nicht gespeichert. Gib Speicherplatz frei und versuche es noch einmal.",
  failed:
    "Das Set konnte nicht gespeichert werden. Lade die Seite neu und versuche es noch einmal.",
  unreadable:
    "Deine vorhandenen Vokabelsets konnten nicht gelesen werden. Lade die Seite neu und versuche es noch einmal.",
} as const;

const countEntries = (set: StoredSet) =>
  set.sections.reduce((sum, section) => sum + section.entries.length, 0);

export async function previewImport(db: IDBDatabase, text: string): Promise<PreviewOutcome> {
  const prepared = prepareNewSet(text, { now: new Date().toISOString(), randomBytes });
  if (!prepared.ok) return prepared;
  const { set, warnings, trimmed } = prepared;
  let existing: StoredSet[];
  try {
    // Eine bekannte Set-ID schon hier ablehnen, nicht erst beim Speichern.
    if (await getSet(db, set.id)) return { ok: false, errors: [ERRORS.exists] };
    existing = await listSets(db);
  } catch (error) {
    console.error("Sets nicht lesbar", error);
    return { ok: false, errors: [ERRORS.unreadable] };
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
  if (!saved.ok) return { ok: false, error: ERRORS[saved.reason] };
  return { ok: true, title: set.title, entryCount: countEntries(set) };
}
