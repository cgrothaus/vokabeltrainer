// Verbindung halten (TDD 6.5, D-32): Schließt der Browser die Verbindung zur Datenbank – Safari auf iOS
// z. B. nach längerer Zeit im Hintergrund –, öffnet `runTransaction` sie beim nächsten Zugriff neu.
// Das alte Handle bleibt gültig: Es führt über die WeakMap zur aktuellen Verbindung, damit Abläufe,
// die `db` festhalten (z. B. eine laufende Lernsitzung), weiterarbeiten.
import type { OpenResult } from "./database";
import { isConnectionLost } from "./errors";

export interface KeepConnectedOptions {
  /** Öffnet die Datenbank wie beim Start, mit denselben Rückrufen. */
  reopen: () => Promise<OpenResult>;
  /** Das erneute Öffnen ist gescheitert; der Zugriff, der es auslöste, scheitert mit. */
  onReopenFailed?: (result: Extract<OpenResult, { ok: false }>) => void;
  /** Nach jeder abgeschlossenen Schreibtransaktion: Der Speicher funktioniert (wieder). */
  onSaved?: () => void;
}

interface Connection {
  current: IDBDatabase;
  /** Der Browser hat die Verbindung geschlossen oder eine Transaktion verlor sie. */
  lost: boolean;
  /** Eine neuere App-Version hat übernommen (TDD 3.4); dann wird nie neu verbunden. */
  ended: boolean;
  reopening: Promise<IDBDatabase> | null;
  readonly options: KeepConnectedOptions;
}

const connections = new WeakMap<IDBDatabase, Connection>();

/** Ohne Anmeldung scheitert eine geschlossene Verbindung wie bisher (für Tests mit `db.close()`). */
export function keepConnected(db: IDBDatabase, options: KeepConnectedOptions): void {
  watch({ current: db, lost: false, ended: false, reopening: null, options }, db);
}

function watch(connection: Connection, db: IDBDatabase): void {
  connections.set(db, connection);
  connection.current = db;
  connection.lost = false;
  db.addEventListener("close", () => {
    if (connection.current === db) connection.lost = true;
  });
  // Geschlossen wird in openDatabase; hier nur vermerken, dass es dabei bleibt.
  db.addEventListener("versionchange", () => (connection.ended = true));
}

function reopen(connection: Connection): Promise<IDBDatabase> {
  connection.reopening ??= connection.options.reopen().then((result) => {
    connection.reopening = null;
    if (!result.ok) {
      connection.options.onReopenFailed?.(result);
      throw new DOMException("Datenbank nicht wieder geöffnet", "InvalidStateError");
    }
    connection.current.close();
    watch(connection, result.db);
    return result.db;
  });
  return connection.reopening;
}

const markLost = (connection: Connection, db: IDBDatabase, error: unknown) => {
  if (isConnectionLost(error) && connection.current === db) connection.lost = true;
};

/**
 * Führt `start` mit der aktuellen Verbindung aus. `start` legt die Transaktion synchron an und wirft,
 * wenn das nicht geht. Nur dann wird neu verbunden und wiederholt: Die Arbeit hat noch nicht begonnen.
 * Bricht eine Transaktion später ab, hat sie nichts übernommen (TAK-05); sie scheitert, und erst der
 * nächste Zugriff verbindet neu. Solange nichts verloren ist, läuft `start` ohne Warten.
 */
export async function withConnection(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  start: (db: IDBDatabase) => Promise<void>,
): Promise<void> {
  const connection = connections.get(db);
  if (!connection) return start(db);
  let current =
    (connection.lost || connection.reopening) && !connection.ended
      ? await reopen(connection)
      : connection.current;
  let running: Promise<void>;
  try {
    running = start(current);
  } catch (error) {
    if (connection.ended || !isConnectionLost(error)) throw error;
    current = await reopen(connection);
    try {
      running = start(current);
    } catch (again) {
      markLost(connection, current, again);
      throw again;
    }
  }
  try {
    await running;
  } catch (error) {
    markLost(connection, current, error);
    throw error;
  }
  if (mode === "readwrite") connection.options.onSaved?.();
}
