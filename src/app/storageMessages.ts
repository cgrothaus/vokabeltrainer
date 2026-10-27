// Meldungen bei Speicherfehlern (TDD 6.5, AK-26, FR-27): Ursache, was nicht gespeichert wurde, und
// was als Nächstes hilft – ohne technische Begriffe. Eingeordnet wird in storage/errors.ts.
import { type StorageFailure, storageFailure } from "../storage/errors";

const CAUSE: Record<StorageFailure, string> = {
  quota: "Der Speicher auf diesem Gerät ist voll.",
  connection: "Der Speicher war kurz nicht erreichbar.",
  failed: "",
};

const NEXT: Record<StorageFailure, string> = {
  quota:
    "Mach auf dem Gerät Platz, zum Beispiel indem du alte Fotos oder Apps löschst, und versuche es noch einmal.",
  // Der nächste Versuch verbindet neu (storage/connection.ts).
  connection: "Versuche es noch einmal.",
  failed: "Lade die Seite neu und versuche es noch einmal.",
};

/**
 * `consequence` nennt, was nicht gespeichert wurde und was unverändert bleibt, z. B. „Das Set wurde
 * nicht gespeichert.“ `next` ersetzt den Vorschlag für den nächsten Schritt.
 */
export function storageMessage(
  failure: StorageFailure,
  consequence: string,
  next: string = NEXT[failure],
): string {
  return [CAUSE[failure], consequence, next].filter(Boolean).join(" ");
}

/** Für Abläufe, deren Speichern einen Fehler wirft statt ein Ergebnis zu liefern. */
export function failureMessage(error: unknown, consequence: string, next?: string): string {
  return storageMessage(storageFailure(error), consequence, next);
}
