// Ordnen der Bibliothek (TDD 13.1, D-72): Sets archivieren und zurückholen, mehreren Sets eine
// Lernstufe geben und die Wahl der Sprachfilter merken. Die Regeln liegen in domain/library.ts, das
// Speichern in storage/archive.ts und storage/sets.ts.
import { LANGUAGE_FILTER_KEY, withLevel } from "../domain/library";
import { readArchived, setArchived } from "../storage/archive";
import { getSet, updateSets } from "../storage/sets";
import { getSetting, setSetting } from "../storage/settings";
import { failureMessage, SET_MISSING, storageMessage } from "./storageMessages";

export type ArrangeOutcome = { ok: true; message: string } | { ok: false; error: string };

const sets = (count: number) => (count === 1 ? "1 Set" : `${count} Sets`);

export { readArchived };

/** Archiviert die Sets oder holt sie zurück; `title` nennt ein einzelnes Set in der Meldung. */
export async function archiveSets(
  db: IDBDatabase,
  setIds: readonly string[],
  archived: boolean,
  title?: string,
): Promise<ArrangeOutcome> {
  const result = await setArchived(db, setIds, archived);
  if (!result.ok)
    return {
      ok: false,
      error: storageMessage(
        result.reason,
        archived ? "Nichts wurde archiviert." : "Nichts wurde zurückgeholt.",
      ),
    };
  if (result.count === 0) return { ok: false, error: SET_MISSING };
  const one = setIds.length === 1 && title !== undefined;
  if (archived)
    return {
      ok: true,
      message: one
        ? `„${title}“ liegt jetzt im Archiv.`
        : `${sets(result.count)} archiviert. Du findest ${result.count === 1 ? "es" : "sie"} unter „Archiv“.`,
    };
  return {
    ok: true,
    message: one
      ? `„${title}“ ist wieder in der Bibliothek.`
      : `${sets(result.count)} ${result.count === 1 ? "ist" : "sind"} wieder in der Bibliothek.`,
  };
}

const LEVEL_NOT_SAVED = "Die Lernstufe wurde bei keinem Set geändert.";

/**
 * Gibt den Sets dieselbe Lernstufe oder entfernt sie (`undefined`), alle oder keines (D-72). Liest die
 * Sets frisch, damit der Vergleich von `editCount` nur Änderungen seit eben erkennt.
 */
export async function setLevel(
  db: IDBDatabase,
  setIds: readonly string[],
  level: string | undefined,
): Promise<ArrangeOutcome> {
  try {
    const found = await Promise.all(setIds.map((id) => getSet(db, id)));
    if (found.some((set) => set === undefined))
      return { ok: false, error: `${SET_MISSING} ${LEVEL_NOT_SAVED}` };
    const changes = found.map((set) => ({
      set: withLevel(set!, level),
      expectedEditCount: set!.editCount,
    }));
    const result = await updateSets(db, changes, new Date().toISOString());
    if (!result.ok)
      return {
        ok: false,
        error:
          result.reason === "missing"
            ? `${SET_MISSING} ${LEVEL_NOT_SAVED}`
            : result.reason === "changed"
              ? `Ein Set wurde inzwischen geändert. ${LEVEL_NOT_SAVED} Versuch es noch einmal.`
              : storageMessage(result.reason, LEVEL_NOT_SAVED),
      };
  } catch (error) {
    console.error("Sets nicht lesbar", error);
    return { ok: false, error: failureMessage(error, LEVEL_NOT_SAVED) };
  }
  const count = sets(setIds.length);
  return {
    ok: true,
    message:
      level === undefined ? `Lernstufe bei ${count} entfernt.` : `${count} jetzt in „${level}“.`,
  };
}

/** Die gemerkte Sprache der Filter; geprüft wird sie erst gegen die vorhandenen Sprachen. */
export async function loadLanguageFilter(db: IDBDatabase): Promise<unknown> {
  return getSetting(db, LANGUAGE_FILTER_KEY);
}

/** `null` steht für „Alle“. */
export function saveLanguageFilter(db: IDBDatabase, language: string | null): Promise<void> {
  return setSetting(db, { key: LANGUAGE_FILTER_KEY, value: language });
}
