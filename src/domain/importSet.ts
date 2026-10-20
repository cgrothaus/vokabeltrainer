// Import eines neuen Sets (TDD 9.1, 9.2) ohne Vorschau: herauslösen → prüfen → normalisieren → IDs
// ergänzen. Geschrieben wird hier nichts; ob die Set-ID schon bekannt ist, prüft die App beim Speichern.
import { extractJson } from "./extract";
import { assignIds, type RandomBytes } from "./ids";
import type { StoredSet } from "./model";
import { normalizeSetFile } from "./normalize";
import { validateSetFile } from "./validate";

/** Formatspezifikation 8.4: Datei höchstens 10 MiB. Für Text wird die Zahl der Zeichen verglichen. */
export const MAX_IMPORT_SIZE = 10 * 1024 * 1024;

export const TOO_LARGE = "Der Text ist zu groß. Ein Vokabelset darf höchstens 10 MB haben.";

export type PrepareResult =
  /** `trimmed`: Begleittext oder Codeblock wurde entfernt. */
  | { ok: true; set: StoredSet; warnings: string[]; trimmed: boolean }
  | { ok: false; errors: string[] };

export function prepareNewSet(
  text: string,
  options: { now: string; randomBytes: RandomBytes },
): PrepareResult {
  if (text.length > MAX_IMPORT_SIZE) return { ok: false, errors: [TOO_LARGE] };
  const extracted = extractJson(text);
  if (!extracted.ok) return { ok: false, errors: [extracted.error] };
  const validated = validateSetFile(extracted.value);
  if (!validated.ok) return { ok: false, errors: validated.errors };
  const set = assignIds(normalizeSetFile(validated.file), options.randomBytes);
  return {
    ok: true,
    set: { ...set, editCount: 0, createdAt: options.now, updatedAt: options.now },
    warnings: validated.warnings,
    trimmed: extracted.trimmed,
  };
}
