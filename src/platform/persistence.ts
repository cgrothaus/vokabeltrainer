// Dauerhafter Speicher (TDD 6.6, FR-22): schützt die Daten davor, dass der Browser sie bei Platzmangel
// oder längerer Nichtnutzung löscht. Safari gewährt ihn nur der App auf dem Home-Bildschirm (S-11).
import type { PersistenceState } from "../domain/storageProtection";

export type { PersistenceState };

export async function persistenceState(): Promise<PersistenceState> {
  if (!navigator.storage?.persisted) return "unsupported";
  try {
    return (await navigator.storage.persisted()) ? "granted" : "not-granted";
  } catch {
    return "unsupported";
  }
}

export async function requestPersistence(): Promise<PersistenceState> {
  if (!navigator.storage?.persist) return "unsupported";
  try {
    return (await navigator.storage.persist()) ? "granted" : "not-granted";
  } catch {
    return "not-granted";
  }
}
