// Prüfwert `rev` (TDD 6.4, D-09): Inhalts-Hash über die kanonische Darstellung, nicht gespeichert.
// Er erkennt Änderungen seit einem Export und ist kein Sicherheitsmerkmal.
import { ID_ALPHABET } from "./ids";
import type { StoredEntry } from "./model";

export const REV_LENGTH = 8;

/** 53-Bit-Hash cyrb53 (bryc, gemeinfrei) über die UTF-16-Codeeinheiten von `text`. */
export function cyrb53(text: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/**
 * Die niederwertigsten acht Stellen zur Basis 31 (Alphabet aus TDD 6.3), die kleinste zuerst.
 * Die höchstwertigen Stellen eines 53-Bit-Werts wären ungleich verteilt.
 */
export function encodeRev(value: number): string {
  let rest = value;
  let rev = "";
  for (let i = 0; i < REV_LENGTH; i++) {
    const digit = rest % ID_ALPHABET.length;
    rev += ID_ALPHABET[digit];
    // Ganzzahlig teilen, ohne Rundung bei großen Werten.
    rest = (rest - digit) / ID_ALPHABET.length;
  }
  return rev;
}

/**
 * JSON mit sortierten Schlüsseln. Fehlende Felder, leere Arrays und leere Objekte entfallen, damit
 * gleiche Inhalte unabhängig von ihrer Schreibweise denselben Prüfwert ergeben.
 */
export function canonicalize(value: unknown): string {
  return write(prune(value) ?? {});
}

function prune(value: unknown): unknown {
  if (Array.isArray(value)) {
    const items = value.map(prune).filter((item) => item !== undefined);
    return items.length > 0 ? items : undefined;
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value)
      .map(([key, item]) => [key, prune(item)] as const)
      .filter(([, item]) => item !== undefined);
    return entries.length > 0 ? Object.fromEntries(entries) : undefined;
  }
  return value;
}

function write(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(write).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const fields = Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${write(record[key])}`);
    return `{${fields.join(",")}}`;
  }
  return JSON.stringify(value);
}

/** Alle Felder außer `id` (TDD 6.4). */
export function entryRev(entry: StoredEntry): string {
  const { id: _id, ...content } = entry;
  return encodeRev(cyrb53(canonicalize(content)));
}
