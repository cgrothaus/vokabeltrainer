// Sets speichern und lesen (TDD 6.1, 6.2, 6.5). Ein Set ist ein Dokument im Store `sets`.
import type { StoredSet } from "../domain/model";
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

/** Alle Sets in der Reihenfolge ihrer IDs; die Bibliothek sortiert selbst. */
export async function listSets(db: IDBDatabase): Promise<StoredSet[]> {
  let sets: StoredSet[] = [];
  await runTransaction(db, "sets", "readonly", (transaction) => {
    const request = transaction.objectStore("sets").getAll();
    request.onsuccess = () => (sets = request.result as StoredSet[]);
  });
  return sets;
}
