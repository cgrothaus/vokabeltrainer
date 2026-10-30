// Sets bearbeiten (TDD 10, FR-02–FR-04): leeres Set anlegen, Formular prüfen, Änderung auf das geladene
// Set anwenden und speichern. Gespeichert wird nur, wenn das Set seit dem Laden unverändert ist
// (`editCount`, TAK-07); erst nach Abschluss der Transaktion gilt die Änderung als gespeichert (TDD 6.5).
import {
  addEntry,
  addSection,
  createEmptySet,
  deleteEntry,
  deleteSection,
  findEntry,
  moveEntry,
  moveSection,
  newEntryId,
  renameSection,
  replaceEntry,
  updateSetInfo,
} from "../domain/editSet";
import { type EntryForm, type FormError, formToEntry } from "../domain/entryForm";
import type { StoredSet } from "../domain/model";
import { checkSectionTitle, formToSetInfo, type SetInfoForm } from "../domain/setInfoForm";
import { randomBytes } from "../platform/random";
import { addSet, updateSet } from "../storage/sets";
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
const LAST_SECTION =
  "Die einzige Sektion lässt sich nicht löschen. Um alles zu löschen, lösche das ganze Set.";

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

/** Mit Fehlern im Formular der Angaben; dann ist nichts gespeichert. */
export type InfoOutcome = EditOutcome | { ok: false; errors: FormError[] };

/** Legt ein leeres Set mit einer Sektion an (FR-02, D-41). */
export async function createSet(
  db: IDBDatabase,
  form: SetInfoForm,
  sectionTitle: string,
): Promise<InfoOutcome> {
  const info = formToSetInfo(form);
  const section = checkSectionTitle(sectionTitle);
  const errors = [
    ...(info.ok ? [] : info.errors),
    ...(section.ok ? [] : [{ field: "section", message: section.error }]),
  ];
  if (!info.ok || !section.ok) return { ok: false, errors };
  const set = createEmptySet(info.info, section.title, new Date().toISOString(), randomBytes);
  const result = await addSet(db, set);
  if (result.ok) return { ok: true, set };
  // Eine schon vergebene neue ID ist praktisch ausgeschlossen; dann hilft ein neuer Versuch.
  const reason = result.reason === "exists" ? "failed" : result.reason;
  return { ok: false, error: storageMessage(reason, "Das Set wurde nicht angelegt.") };
}

export async function saveSetInfo(
  db: IDBDatabase,
  set: StoredSet,
  form: SetInfoForm,
): Promise<InfoOutcome> {
  const info = formToSetInfo(form, set);
  if (!info.ok) return info;
  return save(
    db,
    updateSetInfo(set, info.info),
    set.editCount,
    "Die Angaben wurden nicht gespeichert.",
  );
}

export async function addSectionTo(
  db: IDBDatabase,
  set: StoredSet,
  title: string,
): Promise<EditOutcome> {
  const checked = checkSectionTitle(title);
  if (!checked.ok) return { ok: false, error: checked.error };
  const changed = addSection(set, checked.title, randomBytes);
  return save(db, changed, set.editCount, "Die Sektion wurde nicht angelegt.");
}

export async function renameSectionIn(
  db: IDBDatabase,
  set: StoredSet,
  sectionId: string,
  title: string,
): Promise<EditOutcome> {
  const checked = checkSectionTitle(title);
  if (!checked.ok) return { ok: false, error: checked.error };
  const changed = renameSection(set, sectionId, checked.title);
  if (!changed) return { ok: false, error: MISSING_SECTION };
  return save(db, changed, set.editCount, "Die Sektion wurde nicht umbenannt.");
}

/** Löscht die Sektion samt Einträgen; deren Antworten bleiben, zählen aber nicht mehr (TDD 10, 12.6). */
export async function removeSection(
  db: IDBDatabase,
  set: StoredSet,
  sectionId: string,
): Promise<EditOutcome> {
  if (set.sections.length <= 1) return { ok: false, error: LAST_SECTION };
  const changed = deleteSection(set, sectionId);
  if (!changed) return { ok: false, error: MISSING_SECTION };
  return save(db, changed, set.editCount, "Die Sektion wurde nicht gelöscht.");
}

/** Um eine Stelle nach oben (`-1`) oder unten (`1`); am Rand ändert sich nichts. */
export async function moveSectionIn(
  db: IDBDatabase,
  set: StoredSet,
  sectionId: string,
  step: -1 | 1,
): Promise<EditOutcome> {
  return reorder(db, set, moveSection(set, sectionId, step), MISSING_SECTION);
}

export async function moveEntryIn(
  db: IDBDatabase,
  set: StoredSet,
  entryId: string,
  step: -1 | 1,
): Promise<EditOutcome> {
  return reorder(db, set, moveEntry(set, entryId, step), MISSING_ENTRY);
}

async function reorder(
  db: IDBDatabase,
  set: StoredSet,
  changed: StoredSet | undefined,
  missing: string,
): Promise<EditOutcome> {
  if (!changed) return { ok: false, error: missing };
  if (changed === set) return { ok: true, set };
  return save(db, changed, set.editCount, "Die Reihenfolge wurde nicht gespeichert.");
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
