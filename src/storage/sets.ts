// Sets speichern und lesen (TDD 6.1, 6.2, 6.5). Ein Set ist ein Dokument im Store `sets`.
import type { StoredSet } from "../domain/model";
import { settingKey } from "../domain/practiceSetup";
import type { StoreName } from "./schema";
import { runTransaction } from "./transaction";

export type AddSetResult =
  | { ok: true }
  /** `exists`: Es gibt schon ein Set mit dieser ID; es bleibt unverändert. */
  | { ok: false; reason: "exists" | "quota" | "failed" };

/** Legt ein neues Set an. `add` statt `put`: Ein vorhandenes Set wird nie überschrieben. */
export async function addSet(db: IDBDatabase, set: StoredSet): Promise<AddSetResult> {
  try {
    await runTransaction(db, "sets", "readwrite", (transaction) => {
      transaction.objectStore("sets").add(set);
    });
    return { ok: true };
  } catch (error) {
    const name = (error as { name?: unknown } | null)?.name;
    if (name === "ConstraintError") return { ok: false, reason: "exists" };
    if (name === "QuotaExceededError") return { ok: false, reason: "quota" };
    console.error("Set nicht gespeichert", error);
    return { ok: false, reason: "failed" };
  }
}

export async function getSet(db: IDBDatabase, id: string): Promise<StoredSet | undefined> {
  let set: StoredSet | undefined;
  await runTransaction(db, "sets", "readonly", (transaction) => {
    const request = transaction.objectStore("sets").get(id);
    request.onsuccess = () => (set = request.result as StoredSet | undefined);
  });
  return set;
}

export type DeleteSetResult = { ok: true } | { ok: false; reason: "missing" | "failed" };

/** Lernstand eines Sets für die Ankündigung vor dem Löschen (FR-02). */
export async function countSetActivity(
  db: IDBDatabase,
  setId: string,
): Promise<{ sessions: number; events: number }> {
  const counts = { sessions: 0, events: 0 };
  await runTransaction(db, ["sessions", "reviewEvents"], "readonly", (transaction) => {
    const sessions = transaction.objectStore("sessions").index("setId").count(setId);
    sessions.onsuccess = () => (counts.sessions = sessions.result);
    const events = transaction.objectStore("reviewEvents").index("setId").count(setId);
    events.onsuccess = () => (counts.events = events.result);
  });
  return counts;
}

/**
 * Löscht das Set mit seinen Sitzungen, Antworten und der gemerkten Einrichtung in einer Transaktion
 * (D-25): Verweise auf ein fehlendes Set machten jedes spätere Backup ungültig (TDD 11.4).
 */
export async function deleteSet(db: IDBDatabase, id: string): Promise<DeleteSetResult> {
  let missing = false;
  try {
    const stores: StoreName[] = ["sets", "sessions", "reviewEvents", "settings"];
    await runTransaction(db, stores, "readwrite", (transaction) => {
      const sets = transaction.objectStore("sets");
      const request = sets.getKey(id);
      request.onsuccess = () => {
        if (request.result === undefined) {
          missing = true;
          return transaction.abort();
        }
        sets.delete(id);
        transaction.objectStore("settings").delete(settingKey(id));
        for (const name of ["sessions", "reviewEvents"] as const) {
          const store = transaction.objectStore(name);
          const keys = store.index("setId").getAllKeys(id);
          keys.onsuccess = () => {
            for (const key of keys.result) store.delete(key);
          };
        }
      };
    });
    return { ok: true };
  } catch (error) {
    if (missing) return { ok: false, reason: "missing" };
    console.error("Set nicht gelöscht", error);
    return { ok: false, reason: "failed" };
  }
}

/** Alle Sets in der Reihenfolge ihrer IDs; die Bibliothek sortiert selbst. */
export async function listSets(db: IDBDatabase): Promise<StoredSet[]> {
  let sets: StoredSet[] = [];
  await runTransaction(db, "sets", "readonly", (transaction) => {
    const request = transaction.objectStore("sets").getAll();
    request.onsuccess = () => (sets = request.result as StoredSet[]);
  });
  return sets;
}
