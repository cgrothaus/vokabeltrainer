// Kurz-IDs (TDD 6.3, D-08). Die Zufallsquelle wird übergeben: domain/ kennt kein `crypto` (TAK-04),
// die App übergibt `crypto.getRandomValues`, Tests eine feste Folge.
import type { StoredSet } from "./model";
import type { NewSet } from "./normalize";

/** Ohne leicht verwechselbare Zeichen `0 1 i l o`. */
export const ID_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";

export const ID_LENGTH = { set: 10, section: 6, entry: 6, reviewEvent: 12, session: 12 } as const;

export type RandomBytes = (count: number) => Uint8Array;

// 248 = 8 × 31: Größere Bytes werden verworfen, sonst kämen die ersten Zeichen häufiger vor.
const LIMIT = 256 - (256 % ID_ALPHABET.length);

export function createId(length: number, randomBytes: RandomBytes): string {
  let id = "";
  while (id.length < length) {
    for (const byte of randomBytes(length - id.length)) {
      if (byte < LIMIT) id += ID_ALPHABET[byte % ID_ALPHABET.length];
    }
  }
  return id;
}

export type SetWithIds = Omit<StoredSet, "editCount" | "createdAt" | "updatedAt">;

/** Behält IDs aus der Datei; neue Sektions- und Eintrags-IDs werden gegen alle IDs des Sets geprüft. */
export function assignIds(set: NewSet, randomBytes: RandomBytes): SetWithIds {
  const used = new Set<string>();
  for (const section of set.sections) {
    if (section.id !== undefined) used.add(section.id);
    for (const entry of section.entries) if (entry.id !== undefined) used.add(entry.id);
  }
  const fresh = (length: number) => {
    let id: string;
    do id = createId(length, randomBytes);
    while (used.has(id));
    used.add(id);
    return id;
  };

  return {
    ...set,
    id: set.id ?? createId(ID_LENGTH.set, randomBytes),
    sections: set.sections.map((section) => ({
      ...section,
      id: section.id ?? fresh(ID_LENGTH.section),
      entries: section.entries.map((entry) => ({
        ...entry,
        id: entry.id ?? fresh(ID_LENGTH.entry),
      })),
    })),
  };
}
