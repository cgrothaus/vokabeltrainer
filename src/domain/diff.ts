// Abgleich einer Datei mit einem bekannten Set (TDD 9.3–9.7): Was ändert sich je Objekt, wo gibt es
// Konflikte seit dem Export, und wie sieht das Set danach aus? Zugeordnet wird nur über IDs, nie über
// Texte. Das Ergebnis zeigt die Vorschau; `applyImport` (merge.ts) setzt es mit den Entscheidungen um.
import { contentRev } from "./hash";
import {
  type EntryContent,
  type ImportMode,
  mergeEntry,
  entryFromFile,
  mergeSetInfo,
  setInfoOf,
} from "./merge";
import type { StoredEntry, StoredSection, StoredSet } from "./model";
import { type EntryPatch, normalizeImportFile, type SectionPatch, type SetInfo } from "./normalize";
import type { SetFile } from "./validate";

export type { ImportMode } from "./merge";

/** Ergebnis der Tabelle in TDD 9.5 für ein Objekt mit bekannter ID. */
export type Comparison = "unchanged" | "changed" | "conflict";

export interface EntryChange {
  kind: Comparison | "added" | "removed" | "missingLocally" | "notApplicable";
  /** Für Entscheidungen: `entry:<ID aus der Datei>`, neue Einträge `new-entry:<n>`. */
  key: string;
  /** Sektion, in der der Eintrag danach steht; bei `removed` und `notApplicable` die bisherige. */
  section: string;
  /** Bisherige Sektion, wenn der Eintrag in eine andere wandert (TDD 9.6). */
  movedFrom?: string;
  /** Der Eintrag in der App, sofern es ihn dort gibt. */
  local?: StoredEntry;
  /** Die Fassung der Datei, beim Aktualisieren mit dem lokalen Stand zusammengeführt. */
  file?: EntryContent;
}

export interface SectionChange {
  kind: Comparison | "added" | "removed" | "missingLocally";
  /** `section:<ID>`, neue Sektionen `new-section:<n>`. */
  key: string;
  /** Titel in der App, bei neuen und lokal gelöschten Sektionen der aus der Datei. */
  title: string;
  /** Titel aus der Datei bei bekannten Sektionen. */
  fileTitle?: string;
  /** Einträge, die in der Sektion bleiben, stehen danach in anderer Reihenfolge (D-44). */
  reordered: boolean;
}

/** Aufbau des Ergebnisses für `applyImport`, in der Reihenfolge der Sektionen danach. */
export type PlannedSection =
  | { kind: "untouched"; local: StoredSection }
  | { kind: "planned"; change: SectionChange; id?: string; entries: EntryChange[] };

export type EntryCounts = Record<EntryChange["kind"] | "moved", number>;

export interface ImportDiff {
  mode: ImportMode;
  scope: NonNullable<SetFile["scope"]>;
  /** Nur beim ganzen Set; ein Teil-Export ändert die Set-Angaben nicht (TDD 9.3). */
  setInfo?: { kind: Comparison; local: SetInfo; file: SetInfo };
  /** In der Reihenfolge danach, gelöschte Sektionen am Ende. */
  sections: SectionChange[];
  /** Nach Sektionen geordnet, gelöschte Einträge nach den übrigen ihrer Sektion. */
  entries: EntryChange[];
  /** Die Sektionen stehen danach in anderer Reihenfolge (nur beim Ersetzen des ganzen Sets). */
  sectionsReordered: boolean;
  counts: EntryCounts;
  warnings: string[];
  /** Gibt es etwas zu übernehmen oder zu entscheiden? */
  hasChanges: boolean;
  layout: PlannedSection[];
}

export type DiffResult = { ok: true; diff: ImportDiff } | { ok: false; errors: string[] };

const SET_INFO_IN_PART =
  "Die Angaben zum Set wurden in der Datei geändert. Die Datei enthält nur einen Teil des Sets, deshalb werden sie nicht übernommen.";

/** Schritte 1–4 aus TDD 9.5; `result` ist `lokal ⊕ Datei` bzw. beim Ersetzen das Dateiobjekt. */
function compare(
  local: unknown,
  fileContent: unknown,
  rev: string | undefined,
  result: unknown,
): Comparison {
  if (rev !== undefined && contentRev(fileContent) === rev) return "unchanged";
  const localRev = contentRev(local);
  if (contentRev(result) === localRev) return "unchanged";
  if (rev !== undefined && localRev === rev) return "changed";
  return "conflict";
}

const withoutIds = ({ id: _id, rev: _rev, ...content }: { id?: string; rev?: string }) => content;

export function diffImport(local: StoredSet, setFile: SetFile, mode: ImportMode): DiffResult {
  const file = normalizeImportFile(setFile);
  const { scope } = file;
  const localSections = new Map(local.sections.map((section) => [section.id, section]));
  const home = new Map<string, { entry: StoredEntry; section: StoredSection }>();
  for (const section of local.sections)
    for (const entry of section.entries) home.set(entry.id, { entry, section });
  const inScope = (sectionId: string) =>
    scope.type === "set" || scope.sectionIds.includes(sectionId);

  const errors = scopeErrors(local, file.sections, scope);
  if (errors.length > 0) return { ok: false, errors };

  let counter = 0;
  const newKey = (prefix: string) => `${prefix}:${counter++}`;

  /** Lokale Einträge, die die Datei an eine Stelle setzt. */
  const placed = new Set<string>();

  const plannedFromFile = (section: SectionPatch) => {
    const known = section.id !== undefined ? localSections.get(section.id) : undefined;
    const title = known?.title ?? section.title;
    const change: SectionChange = known
      ? {
          kind: compare({ title: known.title }, withoutIds(section), section.rev, {
            title: section.title,
          }),
          key: `section:${known.id}`,
          title: known.title,
          fileTitle: section.title,
          reordered: false,
        }
      : {
          kind: section.id === undefined ? "added" : "missingLocally",
          key: section.id === undefined ? newKey("new-section") : `section:${section.id}`,
          title: section.title,
          reordered: false,
        };
    const entries = section.entries.map((patch): EntryChange => {
      if (patch.id === undefined)
        return {
          kind: "added",
          key: newKey("new-entry"),
          section: title,
          file: entryFromFile(patch),
        };
      const key = `entry:${patch.id}`;
      const found = home.get(patch.id);
      if (!found)
        return { kind: "missingLocally", key, section: title, file: entryFromFile(patch) };
      if (!inScope(found.section.id))
        return {
          kind: "notApplicable",
          key,
          section: found.section.title,
          local: found.entry,
          file: entryFromFile(patch),
        };
      placed.add(patch.id);
      return {
        ...compareEntry(found.entry, patch, mode),
        key,
        section: title,
        ...(found.section.id !== known?.id && { movedFrom: found.section.title }),
      };
    });
    return { change, id: known?.id, entries };
  };

  const fromFile = file.sections.map(plannedFromFile);
  const fileByLocalId = new Map(
    fromFile.filter((item) => item.id !== undefined).map((item) => [item.id!, item]),
  );

  const removedEntries: EntryChange[] = [];
  const removedSections: SectionChange[] = [];

  /** Eine lokale Sektion im Scope: die Einträge der Datei, dazu was nicht in der Datei steht. */
  const plannedLocal = (section: StoredSection): PlannedSection | null => {
    const fromThisFile = fileByLocalId.get(section.id);
    const rest = section.entries.filter((entry) => !placed.has(entry.id));
    const keepRest = mode === "update";
    if (!keepRest)
      for (const entry of rest)
        removedEntries.push({
          kind: "removed",
          key: `entry:${entry.id}`,
          section: section.title,
          local: entry,
        });
    if (!fromThisFile && !keepRest) {
      removedSections.push({
        kind: "removed",
        key: `section:${section.id}`,
        title: section.title,
        reordered: false,
      });
      return null;
    }
    const kept: EntryChange[] = keepRest
      ? rest.map((entry) => ({
          kind: "unchanged",
          key: `entry:${entry.id}`,
          section: section.title,
          local: entry,
        }))
      : [];
    const change: SectionChange = fromThisFile?.change ?? {
      kind: "unchanged",
      key: `section:${section.id}`,
      title: section.title,
      reordered: false,
    };
    const entries = [...(fromThisFile?.entries ?? []), ...kept];
    change.reordered = reordered(section, entries);
    return { kind: "planned", change, id: section.id, entries };
  };

  const fileOrder = mode === "replace" && scope.type === "set";
  const newSections = fromFile.filter((item) => item.id === undefined);
  const layout: PlannedSection[] = [];
  if (fileOrder) {
    for (const item of fromFile) {
      if (item.id === undefined) layout.push({ kind: "planned", ...item });
      else layout.push(plannedLocal(localSections.get(item.id)!)!);
    }
    for (const section of local.sections) if (!fileByLocalId.has(section.id)) plannedLocal(section);
  } else {
    for (const section of local.sections) {
      if (!inScope(section.id)) layout.push({ kind: "untouched", local: section });
      else {
        const planned = plannedLocal(section);
        if (planned) layout.push(planned);
      }
    }
    for (const item of newSections) layout.push({ kind: "planned", ...item });
  }

  // Gelöschte Einträge nach den übrigen ihrer Sektion, die gelöschter Sektionen am Ende.
  const removedIn = (sectionId: string | undefined) =>
    removedEntries.filter((entry) => home.get(entry.local!.id)!.section.id === sectionId);
  const planned = layout.filter((item) => item.kind === "planned");
  const entries = [
    ...planned.flatMap((item) => [...item.entries, ...removedIn(item.id)]),
    ...removedSections.flatMap((section) => removedIn(section.key.slice("section:".length))),
  ];

  const sections = [...planned.map((item) => item.change), ...removedSections];

  const knownOrder = layout.flatMap((item) =>
    item.kind === "untouched" ? [item.local.id] : item.id !== undefined ? [item.id] : [],
  );
  const localOrder = local.sections
    .map((section) => section.id)
    .filter((id) => knownOrder.includes(id));
  const sectionsReordered = knownOrder.join() !== localOrder.join();

  const warnings: string[] = [];
  let setInfo: ImportDiff["setInfo"];
  const localInfo = setInfoOf(local);
  const fileInfo = mergeSetInfo(localInfo, file.set, mode);
  const infoKind = compare(localInfo, withoutIds(file.set), file.set.rev, fileInfo);
  if (scope.type === "set") setInfo = { kind: infoKind, local: localInfo, file: fileInfo };
  else if (infoKind !== "unchanged") warnings.push(SET_INFO_IN_PART);

  const counts = countEntries(entries);
  const hasChanges =
    counts.added + counts.changed + counts.conflict + counts.removed + counts.moved > 0 ||
    counts.missingLocally > 0 ||
    sections.some((item) => item.kind !== "unchanged" && item.kind !== "missingLocally") ||
    sections.some((item) => item.reordered) ||
    sectionsReordered ||
    (setInfo !== undefined && setInfo.kind !== "unchanged");

  return {
    ok: true,
    diff: {
      mode,
      scope,
      setInfo,
      sections,
      entries,
      sectionsReordered,
      counts,
      warnings,
      hasChanges,
      layout,
    },
  };
}

function compareEntry(local: StoredEntry, patch: EntryPatch, mode: ImportMode) {
  const result = mergeEntry(local, patch, mode);
  const { id: _id, ...content } = local;
  return {
    kind: compare(content, withoutIds(patch), patch.rev, result),
    local,
    file: result,
  };
}

/** Haben die Einträge, die vorher schon in der Sektion standen, danach eine andere Reihenfolge? */
function reordered(section: StoredSection, after: EntryChange[]): boolean {
  const before = new Set(section.entries.map((entry) => entry.id));
  const staying = after
    .map((change) => change.local?.id)
    .filter((id): id is string => id !== undefined && before.has(id));
  const stayingSet = new Set(staying);
  const original = section.entries.map((entry) => entry.id).filter((id) => stayingSet.has(id));
  return staying.join() !== original.join();
}

function countEntries(entries: EntryChange[]): EntryCounts {
  const counts: EntryCounts = {
    unchanged: 0,
    changed: 0,
    conflict: 0,
    added: 0,
    removed: 0,
    moved: 0,
    missingLocally: 0,
    notApplicable: 0,
  };
  for (const entry of entries) {
    counts[entry.kind]++;
    if (entry.movedFrom !== undefined) counts.moved++;
  }
  return counts;
}

/** Widersprüchlicher Scope (TDD 9.6): Der Import wird abgelehnt. */
function scopeErrors(
  local: StoredSet,
  sections: SectionPatch[],
  scope: NonNullable<SetFile["scope"]>,
): string[] {
  if (scope.type === "set") return [];
  const known = new Set(local.sections.map((section) => section.id));
  const errors: string[] = [];
  for (const id of scope.sectionIds) {
    if (known.has(id)) continue;
    const title = sections.find((section) => section.id === id)?.title;
    errors.push(
      title === undefined
        ? `Die Datei bezieht sich auf eine Sektion, die es in „${local.title}“ nicht mehr gibt. Die Datei passt nicht mehr zum Set und wird nicht übernommen.`
        : `Die Sektion „${title}“ gibt es in „${local.title}“ nicht mehr. Die Datei passt nicht mehr zum Set und wird nicht übernommen.`,
    );
  }
  for (const section of sections) {
    if (section.id === undefined || scope.sectionIds.includes(section.id)) continue;
    errors.push(
      `Die Sektion „${section.title}“ steht in der Datei, gehört aber nicht zum exportierten Teil. Die Datei ist widersprüchlich und wird nicht übernommen.`,
    );
  }
  return errors;
}
