// Ablauf des Imports (TDD 9.1–9.7) in zwei Schritten: Die Vorschau prüft und schreibt nichts, gespeichert
// wird erst nach Bestätigung. Ein neues Set wird angelegt, ein bekanntes mit dem Bestand abgeglichen und
// aktualisiert oder ersetzt. Die Fachlogik liegt in domain/importSet.ts, domain/duplicates.ts,
// domain/diff.ts und domain/merge.ts, das Speichern in storage/sets.ts. Hier werden sie verbunden.
import { diffImport, type ImportDiff, type ImportMode } from "../domain/diff";
import { duplicateMessage, findDuplicates } from "../domain/duplicates";
import { newSetFromFile, readSetFile } from "../domain/importSet";
import { applyImport, type ImportDecisions } from "../domain/merge";
import type { StoredSet } from "../domain/model";
import type { SetFile } from "../domain/validate";
import { randomBytes } from "../platform/random";
import { addSet, getSet, listSets, updateSet } from "../storage/sets";
import { failureMessage, storageMessage } from "./storageMessages";

export interface ImportPreview {
  kind: "new";
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

/** Eine Datei zu einem Set, das es schon gibt (TDD 9.3–9.7). */
export interface KnownPreview {
  kind: "known";
  /** Das Set beim Öffnen der Vorschau; sein `editCount` wird beim Speichern verglichen (TAK-07). */
  local: StoredSet;
  file: SetFile;
  /** Beide Arten sind schon berechnet, damit das Umschalten nichts mehr liest. */
  diffs: Record<ImportMode, ImportDiff>;
  warnings: string[];
  trimmed: boolean;
  /** Warum die Vorschau neu berechnet wurde. */
  notice?: string;
}

export type PreviewOutcome =
  ({ ok: true } & ImportPreview) | ({ ok: true } & KnownPreview) | { ok: false; errors: string[] };

export type SaveOutcome =
  { ok: true; title: string; entryCount: number } | { ok: false; error: string };

export type KnownSaveOutcome =
  | { ok: true; setId: string; message: string }
  | { ok: false; error: string }
  /** Das Set wurde inzwischen geändert; nichts gespeichert, die Vorschau ist neu berechnet. */
  | { ok: false; stale: KnownPreview };

const EXISTS = "Dieses Set ist inzwischen vorhanden. Prüfe die Datei noch einmal.";
const STALE = "Das Set wurde inzwischen geändert. Prüfe die Vorschau noch einmal.";
const GONE =
  "Das Set gibt es inzwischen nicht mehr. Prüfe die Datei noch einmal, um sie als neues Set zu importieren.";
const UNREADABLE = "Deine vorhandenen Vokabelsets konnten nicht gelesen werden.";

const countEntries = (set: StoredSet) =>
  set.sections.reduce((sum, section) => sum + section.entries.length, 0);

export async function previewImport(db: IDBDatabase, text: string): Promise<PreviewOutcome> {
  const read = readSetFile(text);
  if (!read.ok) return read;
  const { file, warnings, trimmed } = read;
  let local: StoredSet | undefined;
  try {
    local = file.set.id === undefined ? undefined : await getSet(db, file.set.id);
  } catch (error) {
    console.error("Sets nicht lesbar", error);
    return { ok: false, errors: [failureMessage(error, UNREADABLE)] };
  }
  if (local) return knownPreview(local, file, warnings, trimmed);

  const prepared = newSetFromFile(read, { now: new Date().toISOString(), randomBytes });
  if (!prepared.ok) return prepared;
  const { set } = prepared;
  let existing: StoredSet[];
  try {
    existing = await listSets(db);
  } catch (error) {
    console.error("Sets nicht lesbar", error);
    return { ok: false, errors: [failureMessage(error, UNREADABLE)] };
  }
  return {
    ok: true,
    kind: "new",
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

function knownPreview(
  local: StoredSet,
  file: SetFile,
  warnings: string[],
  trimmed: boolean,
): ({ ok: true } & KnownPreview) | { ok: false; errors: string[] } {
  const update = diffImport(local, file, "update");
  const replace = diffImport(local, file, "replace");
  if (!update.ok) return update;
  if (!replace.ok) return replace;
  return {
    ok: true,
    kind: "known",
    local,
    file,
    diffs: { update: update.diff, replace: replace.diff },
    warnings,
    trimmed,
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

/**
 * Übernimmt die Datei in einer Transaktion, aber nur, wenn das Set seit der Vorschau unverändert ist
 * (TAK-07). Sonst wird nichts geschrieben und die Vorschau neu berechnet.
 */
export async function saveKnownImport(
  db: IDBDatabase,
  preview: KnownPreview,
  mode: ImportMode,
  decisions: ImportDecisions,
): Promise<KnownSaveOutcome> {
  const diff = preview.diffs[mode];
  const set = applyImport(preview.local, diff, decisions, randomBytes);
  const saved = await updateSet(db, set, preview.local.editCount, new Date().toISOString());
  if (saved.ok) return { ok: true, setId: set.id, message: savedMessage(set, diff, decisions) };
  if (saved.reason === "missing") return { ok: false, error: GONE };
  if (saved.reason !== "changed")
    return {
      ok: false,
      error: storageMessage(saved.reason, "Die Änderungen wurden nicht gespeichert."),
    };
  let current: StoredSet | undefined;
  try {
    current = await getSet(db, set.id);
  } catch (error) {
    console.error("Set nicht lesbar", error);
    return { ok: false, error: failureMessage(error, UNREADABLE) };
  }
  if (!current) return { ok: false, error: GONE };
  const fresh = knownPreview(current, preview.file, preview.warnings, preview.trimmed);
  if (!fresh.ok) return { ok: false, error: fresh.errors.join(" ") };
  const { ok: _ok, ...stale } = fresh;
  return { ok: false, stale: { ...stale, notice: STALE } };
}

/** „„Lektion 4“ aktualisiert: 2 geändert, 1 neu.“ – gezählt wird, was tatsächlich übernommen wurde. */
export function savedMessage(set: StoredSet, diff: ImportDiff, decisions: ImportDecisions): string {
  let changed = diff.counts.changed;
  let added = diff.counts.added;
  for (const entry of diff.entries) {
    if (entry.kind === "conflict" && decisions.takeFile.has(entry.key)) changed++;
    if (entry.kind === "missingLocally" && decisions.adopt.has(entry.key)) added++;
  }
  const parts = [
    changed > 0 && `${changed} geändert`,
    added > 0 && `${added} neu`,
    diff.counts.moved > 0 && `${diff.counts.moved} verschoben`,
    diff.counts.removed > 0 && `${diff.counts.removed} gelöscht`,
  ].filter((part): part is string => !!part);
  const verb = diff.mode === "update" ? "aktualisiert" : "ersetzt";
  return parts.length > 0
    ? `„${set.title}“ ${verb}: ${parts.join(", ")}.`
    : `„${set.title}“ ${verb}.`;
}
