// „Automatisch vorlesen“ (TDD 12.11, 13.6, D-61): gespeichert in `settings` unter `speakAloud`,
// anfangs aus. Gelesen wird beim Start und nach dem Wiederherstellen; die Sitzung fragt den Wert ab.
import { readSpeakAloud, SPEAK_ALOUD_KEY } from "../domain/speech";
import { getSetting, setSetting } from "../storage/settings";
import { failureMessage } from "./storageMessages";

export type SaveSpeakAloudOutcome = { ok: true } | { ok: false; error: string };

/** Ist der Wert nicht lesbar, bleibt das Vorlesen aus; das Lernen hängt nicht davon ab. */
export async function loadSpeakAloud(db: IDBDatabase): Promise<boolean> {
  try {
    return readSpeakAloud(await getSetting(db, SPEAK_ALOUD_KEY));
  } catch (error) {
    console.warn("Vorliebe zum Vorlesen nicht lesbar", error);
    return false;
  }
}

export async function saveSpeakAloud(db: IDBDatabase, on: boolean): Promise<SaveSpeakAloudOutcome> {
  try {
    await setSetting(db, { key: SPEAK_ALOUD_KEY, value: on });
    return { ok: true };
  } catch (error) {
    console.error("Vorliebe zum Vorlesen nicht gespeichert", error);
    return {
      ok: false,
      error: failureMessage(
        error,
        "Die Einstellung wurde nicht gespeichert; sie gilt nur, bis du die App schließt.",
      ),
    };
  }
}
