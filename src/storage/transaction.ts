// Transaktionen (TDD 6.5): Eine fachliche Änderung läuft in genau einer Transaktion und gilt erst nach
// `complete` als gespeichert. Scheitert ein Teil, wird nichts übernommen (TAK-05).
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
  return new Promise((resolve, reject) => {
    let transaction: IDBTransaction;
    try {
      transaction = db.transaction(stores, mode);
    } catch (error) {
      // z. B. Verbindung schon geschlossen (InvalidStateError).
      return reject(error);
    }
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
