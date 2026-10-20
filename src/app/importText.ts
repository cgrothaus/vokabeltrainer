// Ablauf des Imports eines neuen Sets ohne Vorschau (TDD 9.1, 9.2): Die Fachlogik liegt in
// domain/importSet.ts, das Speichern in storage/sets.ts. Hier werden beide verbunden.
import { prepareNewSet } from "../domain/importSet";
import { addSet } from "../storage/sets";

export type ImportOutcome =
  | { ok: true; title: string; entryCount: number; warnings: string[] }
  | { ok: false; errors: string[] };

const SAVE_ERRORS = {
  // Aktualisieren bekannter Sets folgt mit M4 (S-34 bis S-36).
  exists: "Dieses Set ist schon vorhanden. Aktualisieren ist noch nicht möglich.",
  quota:
    "Der Speicher auf diesem Gerät ist voll. Das Set wurde nicht gespeichert. Gib Speicherplatz frei und versuche es noch einmal.",
  failed:
    "Das Set konnte nicht gespeichert werden. Lade die Seite neu und versuche es noch einmal.",
} as const;

const randomBytes = (count: number) => crypto.getRandomValues(new Uint8Array(count));

/** Gespeichert ist das Set erst, wenn die Transaktion abgeschlossen ist (TDD 6.5). */
export async function importText(db: IDBDatabase, text: string): Promise<ImportOutcome> {
  const prepared = prepareNewSet(text, { now: new Date().toISOString(), randomBytes });
  if (!prepared.ok) return prepared;
  const { set, warnings } = prepared;
  const saved = await addSet(db, set);
  if (!saved.ok) return { ok: false, errors: [SAVE_ERRORS[saved.reason]] };
  const entryCount = set.sections.reduce((sum, section) => sum + section.entries.length, 0);
  return { ok: true, title: set.title, entryCount, warnings };
}
