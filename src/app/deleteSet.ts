// Set löschen (TDD 10, FR-02): erst den Umfang ankündigen, dann Set, Sitzungen und Antworten in einer
// Transaktion löschen (D-25). Das Zählen liegt in domain/library.ts und storage/sets.ts.
import { setSize } from "../domain/library";
import type { StoredSet } from "../domain/model";
import { countSetActivity, deleteSet } from "../storage/sets";
import { storageMessage } from "./storageMessages";

export interface DeletionScope {
  sections: number;
  entries: number;
  sessions: number;
  events: number;
}

export type DeleteOutcome = { ok: true } | { ok: false; error: string };

const MISSING =
  "Dieses Set gibt es nicht mehr. Vielleicht wurde es in einem anderen Fenster gelöscht.";

export async function deletionScope(db: IDBDatabase, set: StoredSet): Promise<DeletionScope> {
  return { ...setSize(set), ...(await countSetActivity(db, set.id)) };
}

/** Gelöscht ist das Set erst, wenn die Transaktion abgeschlossen ist (TDD 6.5). */
export async function removeSet(db: IDBDatabase, set: StoredSet): Promise<DeleteOutcome> {
  const result = await deleteSet(db, set.id);
  if (result.ok) return result;
  const error =
    result.reason === "missing"
      ? MISSING
      : storageMessage(result.reason, "Das Set wurde nicht gelöscht; es ist unverändert.");
  return { ok: false, error };
}
