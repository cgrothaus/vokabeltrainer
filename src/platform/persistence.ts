// Dauerhafter Speicher (TDD 6.6, FR-22): schützt die Daten davor, dass der Browser sie bei Platzmangel
// oder längerer Nichtnutzung löscht. Das Verhalten in Safari wird in S-11 auf echten Geräten gemessen.

export type PersistenceState = "granted" | "not-granted" | "unsupported";

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
