// Installationsangebot in der Bibliothek (TDD 5.1, FR-35): einmal als ruhige Zeile, „Später“ blendet
// es dauerhaft aus. Gemerkt in `meta` (D-52), also nicht im Backup und ohne Änderung am Datenmodell.
import { getMeta, setMeta } from "../storage/meta";
import { reportStorageProblem } from "./components/storageNotice";

/** Jeder gespeicherte Wert gilt als „Später“; ist `meta` nicht lesbar, bleibt das Angebot weg. */
export async function installOfferDismissed(db: IDBDatabase): Promise<boolean> {
  try {
    return (await getMeta(db, "installOfferDismissedAt")) !== undefined;
  } catch (error) {
    console.warn("Installationsangebot nicht lesbar", error);
    return true;
  }
}

/** „Später“: Schreibvorgang im Hintergrund, ein Fehler erscheint im Speicherhinweis (D-32). */
export async function dismissInstallOffer(db: IDBDatabase, now = new Date()): Promise<void> {
  await setMeta(db, "installOfferDismissedAt", now.toISOString()).catch((error: unknown) => {
    console.warn("Installationsangebot nicht zurückgestellt", error);
    reportStorageProblem(
      error,
      "Das Angebot ließ sich nicht ausblenden; es erscheint beim nächsten Öffnen wieder.",
    );
  });
}
