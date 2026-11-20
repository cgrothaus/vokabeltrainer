// Vorlesen der Lernsprache (TDD 12.11, FR-40, D-59, D-61): Auswahl der Stimme und die Vorliebe
// „Automatisch vorlesen“. Die Stimmen selbst liefert `platform/speech.ts`.

/** Was die Auswahl von einer Stimme braucht; `SpeechSynthesisVoice` passt dazu. */
export interface VoiceInfo {
  readonly lang: string;
  /** Nur Stimmen auf dem Gerät: Es verlässt nichts das Gerät (TDD 14, FR-26). */
  readonly localService: boolean;
}

/** Schlüssel im Store `settings`; gilt für die ganze App, nicht pro Set (13.6). */
export const SPEAK_ALOUD_KEY = "speakAloud";

/** Android liefert Codes teils mit Unterstrich („en_US“). */
const canonical = (lang: string) => lang.replace(/_/g, "-").toLowerCase();
const primary = (lang: string) => canonical(lang).split("-")[0];

/** Erst der genaue BCP-47-Code, dann dieselbe Sprache; nur Stimmen mit `localService`. */
export function pickVoice<V extends VoiceInfo>(voices: readonly V[], lang: string): V | undefined {
  const local = voices.filter((voice) => voice.localService);
  const wanted = canonical(lang);
  return (
    local.find((voice) => canonical(voice.lang) === wanted) ??
    local.find((voice) => primary(voice.lang) === primary(lang))
  );
}

/** Tolerant, weil der Wert auch aus einem Backup stammen kann: Nur `true` schaltet ein. */
export function readSpeakAloud(value: unknown): boolean {
  return value === true;
}
