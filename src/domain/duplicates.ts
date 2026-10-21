// Duplikaterkennung beim Import neuer Sets (TDD 9.2, FR-30, D-16). Zuordnung über Inhalte ist hier
// erlaubt, weil nur ein Hinweis entsteht; übernommen wird nie über Worttexte (TDD 9.6).
import type { StoredSet } from "./model";

export interface DuplicateMatch {
  setId: string;
  title: string;
  edition?: string;
  sameTitle: boolean;
  /** |A ∩ B| / min(|A|, |B|) über die Eintragsschlüssel; 0 bei einem leeren Set. */
  overlap: number;
}

const SEPARATOR = String.fromCharCode(0);

const comparable = (text: string) => text.normalize("NFC").toLowerCase();

/** Wort und erste Bedeutung; weitere Bedeutungen und Varianten zählen nicht. */
function entryKeys(set: StoredSet): Set<string> {
  const keys = new Set<string>();
  for (const section of set.sections) {
    for (const entry of section.entries) {
      keys.add(comparable(entry.term.text + SEPARATOR + (entry.meanings[0]?.text ?? "")));
    }
  }
  return keys;
}

/** Vorhandene Sets, die dem neuen offensichtlich entsprechen, nach Überschneidung absteigend. */
export function findDuplicates(candidate: StoredSet, existing: StoredSet[]): DuplicateMatch[] {
  const keys = entryKeys(candidate);
  const title = comparable(candidate.title);
  const matches: DuplicateMatch[] = [];
  for (const local of existing) {
    if (local.termLanguage !== candidate.termLanguage) continue;
    if (local.meaningLanguage !== candidate.meaningLanguage) continue;
    const localKeys = entryKeys(local);
    let common = 0;
    for (const key of keys) if (localKeys.has(key)) common++;
    const smaller = Math.min(keys.size, localKeys.size);
    const overlap = smaller === 0 ? 0 : common / smaller;
    const sameTitle = comparable(local.title) === title;
    // Ganzzahlig verglichen, damit 0,8 nicht an der Gleitkommadarstellung scheitert.
    if (!sameTitle && (smaller === 0 || 5 * common < 4 * smaller)) continue;
    matches.push({
      setId: local.id,
      title: local.title,
      ...(local.edition !== undefined && { edition: local.edition }),
      sameTitle,
      overlap,
    });
  }
  return matches.sort((a, b) => b.overlap - a.overlap);
}

/** Hinweis für die Vorschau; `edition` ist die Ausgabe des neuen Sets. */
export function duplicateMessage(match: DuplicateMatch, edition: string | undefined): string {
  const message = `Dieses Set sieht aus wie „${match.title}“, das du schon hast.`;
  const same =
    match.edition === edition ||
    (match.edition !== undefined &&
      edition !== undefined &&
      comparable(match.edition) === comparable(edition));
  if (same) return message;
  const describe = (value: string | undefined) =>
    value === undefined ? "ohne Angabe" : `„${value}“`;
  return `${message} Die Ausgabe unterscheidet sich: dort ${describe(match.edition)}, hier ${describe(edition)}.`;
}
