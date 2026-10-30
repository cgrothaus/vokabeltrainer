// Einträge bearbeiten (TDD 10, FR-04): Formular prüfen, Änderung auf das geladene Set anwenden und
// speichern. Gespeichert wird nur, wenn das Set seit dem Laden unverändert ist (`editCount`, TAK-07);
// erst nach Abschluss der Transaktion gilt die Änderung als gespeichert (TDD 6.5).
import { addEntry, deleteEntry, findEntry, newEntryId, replaceEntry } from "../domain/editSet";
import { type EntryForm, type FormError, formToEntry } from "../domain/entryForm";
import type { StoredSet } from "../domain/model";
import { randomBytes } from "../platform/random";
import { updateSet } from "../storage/sets";
import { storageMessage } from "./storageMessages";

export type EditOutcome =
  /** `set`: so, wie es jetzt gespeichert ist; Grundlage der nächsten Änderung. */
  { ok: true; set: StoredSet } | { ok: false; error: string };

/** Mit Fehlern im Formular; dann ist nichts gespeichert. */
export type EntryOutcome = EditOutcome | { ok: false; errors: FormError[] };

const MISSING_SET =
  "Dieses Set gibt es nicht mehr. Vielleicht wurde es in einem anderen Fenster gelöscht.";
const CHANGED =
  "Das Set wurde inzwischen in einem anderen Fenster geändert. Deine Änderung ist nicht gespeichert. Lade die Seite neu und versuche es noch einmal.";
const MISSING_ENTRY =
  "Diesen Eintrag gibt es nicht mehr. Vielleicht wurde er in einem anderen Fenster gelöscht.";
const MISSING_SECTION =
  "Diese Sektion gibt es nicht mehr. Vielleicht wurde sie in einem anderen Fenster gelöscht.";

/**
 * Speichert das Formular als Änderung des Eintrags `entryId` oder, ohne `entryId`, als neuen Eintrag
 * am Ende der gewählten Sektion.
 */
export async function saveEntry(
  db: IDBDatabase,
  set: StoredSet,
  form: EntryForm,
  entryId?: string,
): Promise<EntryOutcome> {
  const previous = entryId === undefined ? undefined : findEntry(set, entryId);
  if (entryId !== undefined && !previous) return { ok: false, error: MISSING_ENTRY };
  const result = formToEntry(form, entryId ?? newEntryId(set, randomBytes), previous?.entry);
  if (!result.ok) return result;
  const changed = previous
    ? replaceEntry(set, result.entry, form.sectionId)
    : addEntry(set, form.sectionId, result.entry);
  if (!changed) return { ok: false, error: MISSING_SECTION };
  return save(db, changed, set.editCount, "Der Eintrag wurde nicht gespeichert.");
}

/** Löscht den Eintrag; seine Antworten bleiben, zählen aber nicht mehr zum Lernstand (TDD 10, 12.6). */
export async function removeEntry(
  db: IDBDatabase,
  set: StoredSet,
  entryId: string,
): Promise<EditOutcome> {
  const changed = deleteEntry(set, entryId);
  if (!changed) return { ok: false, error: MISSING_ENTRY };
  return save(db, changed, set.editCount, "Der Eintrag wurde nicht gelöscht.");
}

async function save(
  db: IDBDatabase,
  set: StoredSet,
  editCount: number,
  consequence: string,
): Promise<EditOutcome> {
  const result = await updateSet(db, set, editCount, new Date().toISOString());
  if (result.ok) return result;
  if (result.reason === "missing") return { ok: false, error: MISSING_SET };
  if (result.reason === "changed") return { ok: false, error: CHANGED };
  return { ok: false, error: storageMessage(result.reason, consequence) };
}
