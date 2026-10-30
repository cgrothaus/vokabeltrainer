// Speicherfehler einordnen (TDD 6.5, AK-26): Die App braucht nur drei Fälle, um verständlich zu melden,
// was passiert ist und was als Nächstes hilft. Die Texte stehen in app/storageMessages.ts.

/**
 * `quota`: Der Speicher des Geräts ist voll. `connection`: Die Verbindung zur Datenbank ist verloren,
 * ein neuer Versuch verbindet neu (storage/connection.ts). `failed`: alles andere.
 */
export type StorageFailure = "quota" | "connection" | "failed";

const errorName = (error: unknown): unknown => (error as { name?: unknown } | null)?.name;

/**
 * `InvalidStateError`: Die Verbindung ist geschlossen. `UnknownError`: Safari auf iOS verliert die
 * Verbindung zum Datenbankprozess, z. B. nach längerer Zeit im Hintergrund.
 */
export function isConnectionLost(error: unknown): boolean {
  const name = errorName(error);
  return name === "InvalidStateError" || name === "UnknownError";
}

/**
 * Kein Speicherfehler: Das Set, zu dem geschrieben werden sollte, gibt es nicht mehr, z. B. weil es in
 * einem anderen Tab gelöscht wurde (TDD 3.4). Geschrieben wurde nichts.
 */
export class SetMissingError extends Error {
  constructor() {
    super("Set nicht mehr vorhanden");
    this.name = "SetMissingError";
  }
}

export const isSetMissing = (error: unknown): boolean => error instanceof SetMissingError;

export function storageFailure(error: unknown): StorageFailure {
  if (errorName(error) === "QuotaExceededError") return "quota";
  return isConnectionLost(error) ? "connection" : "failed";
}
