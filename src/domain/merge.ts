// Übernahme einer Datei in ein bekanntes Set (TDD 9.3, 9.4, 9.7): die Regeln je Objekt für Aktualisieren
// und Ersetzen und das Umsetzen eines Abgleichs (`diff.ts`) mit den Entscheidungen der Nutzenden zum
// neuen Set-Dokument. Geschrieben wird hier nichts; `editCount` und `updatedAt` setzt das Speichern.
import type { EntryChange, ImportDiff, SectionChange } from "./diff";
import { freshId, ID_LENGTH, idsInSet, type RandomBytes } from "./ids";
import type { StoredEntry, StoredSection, StoredSet } from "./model";
import type { EntryPatch, SetInfo, SetInfoPatch } from "./normalize";

export type ImportMode = "update" | "replace";

/** Ein Eintrag ohne ID: was `entryRev` erfasst. */
export type EntryContent = Omit<StoredEntry, "id">;

export interface ImportDecisions {
  /** Konflikte, bei denen die Fassung der Datei gelten soll (Schlüssel aus dem Abgleich). */
  takeFile: ReadonlySet<string>;
  /** Nicht mehr vorhandene Einträge, die als neue Einträge übernommen werden sollen. */
  adopt: ReadonlySet<string>;
}

/** Standard (TDD 9.5, 9.6): Konflikte behalten die App, nicht mehr Vorhandenes wird nicht angelegt. */
export const NO_DECISIONS: ImportDecisions = { takeFile: new Set(), adopt: new Set() };

/** Felder aus der Datei über den lokalen: fehlend bleibt, `null` löscht (TDD 9.3). */
function patchFields<T extends object>(local: T, patch: object): T {
  const result = { ...local } as Record<string, unknown>;
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    if (value === null) delete result[key];
    else result[key] = value;
  }
  return result as T;
}

/** Nur, was in der Datei steht (TDD 9.4); `null` gilt wie ein fehlendes Feld. */
const present = <T>(patch: object): T =>
  Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== null && value !== undefined),
  ) as T;

/** Ein Eintrag nach den Regeln der gewählten Art, ohne ID. Listen werden als Ganzes ersetzt. */
export function mergeEntry(local: StoredEntry, patch: EntryPatch, mode: ImportMode): EntryContent {
  if (mode === "replace") return entryFromFile(patch);
  const { id: _id, rev: _rev, grammar, ...fields } = patch;
  const { id: _localId, ...content } = local;
  const merged = patchFields(content, fields);
  if (grammar === null) delete merged.grammar;
  else if (grammar !== undefined) {
    const result = patchFields(local.grammar ?? {}, grammar);
    if (Object.keys(result).length > 0) merged.grammar = result;
    else delete merged.grammar;
  }
  return merged;
}

/** Ein Eintrag genau wie in der Datei, z. B. ein neuer oder ein ersetzter. */
export function entryFromFile(patch: EntryPatch): EntryContent {
  const { id: _id, rev: _rev, grammar, ...fields } = patch;
  const content = present<EntryContent>(fields);
  const presentGrammar = grammar ? present<NonNullable<StoredEntry["grammar"]>>(grammar) : {};
  return Object.keys(presentGrammar).length > 0 ? { ...content, grammar: presentGrammar } : content;
}

export function mergeSetInfo(local: SetInfo, patch: SetInfoPatch, mode: ImportMode): SetInfo {
  const { id: _id, rev: _rev, ...fields } = patch;
  return mode === "replace" ? present<SetInfo>(fields) : patchFields(local, fields);
}

/** Angaben zum Set ohne Verwaltungsfelder und Sektionen. */
export function setInfoOf(set: StoredSet): SetInfo {
  const {
    id: _id,
    editCount: _editCount,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    sections: _sections,
    ...info
  } = set;
  return info;
}

/** Das neue Set-Dokument; neue IDs werden gegen alle IDs des Sets geprüft (TDD 6.3). */
export function applyImport(
  local: StoredSet,
  diff: ImportDiff,
  decisions: ImportDecisions,
  randomBytes: RandomBytes,
): StoredSet {
  const used = idsInSet(local);
  const fresh = (length: number) => freshId(used, length, randomBytes);
  const takeFile = (key: string) => decisions.takeFile.has(key);

  const entryAfter = (change: EntryChange): StoredEntry[] => {
    const { local: before, file } = change;
    switch (change.kind) {
      case "unchanged":
        return [before!];
      case "changed":
        return [{ id: before!.id, ...file! }];
      case "conflict":
        return [takeFile(change.key) ? { id: before!.id, ...file! } : before!];
      case "added":
        return [{ id: fresh(ID_LENGTH.entry), ...file! }];
      case "missingLocally":
        return decisions.adopt.has(change.key) ? [{ id: fresh(ID_LENGTH.entry), ...file! }] : [];
      default:
        return [];
    }
  };

  const titleAfter = (change: SectionChange) =>
    change.kind === "changed" || (change.kind === "conflict" && takeFile(change.key))
      ? change.fileTitle!
      : change.title;

  const sections = diff.layout.flatMap((planned): StoredSection[] => {
    if (planned.kind === "untouched") return [planned.local];
    const entries = planned.entries.flatMap(entryAfter);
    // Eine lokal gelöschte Sektion entsteht nur neu, wenn danach etwas darin steht (D-44).
    if (planned.change.kind === "missingLocally" && entries.length === 0) return [];
    return [
      {
        id: planned.id ?? fresh(ID_LENGTH.section),
        title: titleAfter(planned.change),
        entries,
      },
    ];
  });

  const info = diff.setInfo;
  const keepInfo =
    !info || info.kind === "unchanged" || (info.kind === "conflict" && !takeFile("set"));
  return {
    id: local.id,
    editCount: local.editCount,
    createdAt: local.createdAt,
    updatedAt: local.updatedAt,
    ...(keepInfo ? setInfoOf(local) : info.file),
    sections,
  };
}
