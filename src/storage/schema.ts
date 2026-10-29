// Datenbankschema (TDD 6.1, D-06). Datenumwandlungen stehen in domain/migrations, hier nur die Struktur.

export const DB_NAME = "vokabeltrainer";
/**
 * Seit der ersten Auslieferung eingefroren: Jede Änderung am gespeicherten Datenmodell erhöht die Version
 * und bringt einen Eintrag in `migrations`, einen Schritt hier und Fixtures vN mit (TDD 7.4, 15.3).
 */
export const DB_VERSION = 1;

export type StoreName = "sets" | "reviewEvents" | "sessions" | "settings" | "meta";

/** Strukturelle Änderungen beim Wechsel auf `version`: neue Stores, Indizes. */
export interface SchemaStep {
  readonly version: number;
  readonly structure: (db: IDBDatabase, transaction: IDBTransaction) => void;
}

export const schema: readonly SchemaStep[] = [
  {
    version: 1,
    structure: (db) => {
      db.createObjectStore("sets", { keyPath: "id" });
      const events = db.createObjectStore("reviewEvents", { keyPath: "id" });
      events.createIndex("setId", "setId");
      events.createIndex("sessionId", "sessionId");
      const sessions = db.createObjectStore("sessions", { keyPath: "id" });
      sessions.createIndex("setId", "setId");
      db.createObjectStore("settings", { keyPath: "key" });
      db.createObjectStore("meta", { keyPath: "key" });
    },
  },
];
