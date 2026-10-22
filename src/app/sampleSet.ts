// Beispielset laden (TDD 13.2, FR-32): über denselben Weg wie ein eingefügter Text, ohne Sonderlogik.
// Die Vorschau entfällt; den Knopf gibt es nur bei leerer Bibliothek, Duplikate sind dort nicht zu
// erwarten.
import sampleText from "../content/beispielset.json?raw";
import { previewImport, saveImport } from "./importText";

export type SampleOutcome = { ok: true; id: string } | { ok: false; error: string };

const FAILED =
  "Das Beispielset konnte nicht geladen werden. Lade die Seite neu und versuche es noch einmal.";

export async function loadSampleSet(db: IDBDatabase): Promise<SampleOutcome> {
  const preview = await previewImport(db, sampleText);
  if (!preview.ok) {
    console.error("Beispielset nicht importierbar", preview.errors);
    return { ok: false, error: FAILED };
  }
  const saved = await saveImport(db, preview.set);
  return saved.ok ? { ok: true, id: preview.set.id } : saved;
}
