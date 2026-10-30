// Transaktionen (TDD 6.5): Eine fachliche Änderung läuft in genau einer Transaktion und gilt erst nach
// `complete` als gespeichert. Scheitert ein Teil, wird nichts übernommen (TAK-05). Ist die Verbindung
// verloren, verbindet storage/connection.ts vorher neu.
import { withConnection } from "./connection";
import type { StoreName } from "./schema";

/**
 * Führt `work` synchron in einer Transaktion aus. Ergebnisse von Leseanfragen sammelt `work` in eigenen
 * Variablen; sie sind nach dem Erfüllen des Versprechens vollständig.
 */
export function runTransaction(
  db: IDBDatabase,
  stores: StoreName | StoreName[],
  mode: IDBTransactionMode,
  work: (transaction: IDBTransaction) => void,
): Promise<void> {
  const names = Array.isArray(stores) ? stores : [stores];
  return withConnection(db, names, mode, (current) => attempt(current, names, mode, work));
}

/** Wirft synchron, wenn die Transaktion nicht beginnen kann (z. B. `InvalidStateError`). */
function attempt(
  db: IDBDatabase,
  stores: StoreName | StoreName[],
  mode: IDBTransactionMode,
  work: (transaction: IDBTransaction) => void,
): Promise<void> {
  const transaction = db.transaction(stores, mode);
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    // Auch Fehler einzelner Anfragen landen hier: Sie brechen die Transaktion ab.
    transaction.onabort = () =>
      reject(transaction.error ?? new DOMException("Transaktion abgebrochen", "AbortError"));
    try {
      work(transaction);
    } catch (error) {
      transaction.abort();
      reject(error);
    }
  });
}
