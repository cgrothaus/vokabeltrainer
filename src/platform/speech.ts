// Vorlesen über die Web Speech API (TDD 12.11, FR-40, D-59): nur Stimmen des Geräts, kein Dienst
// im Netz. iOS liefert die Liste der Stimmen teils erst verzögert (`voiceschanged`).
import { pickVoice } from "../domain/speech";

/** So lange wartet die Suche höchstens auf eine verzögerte Liste der Stimmen. */
const VOICES_TIMEOUT = 1500;

/** Spricht einen Text in der Sprache der Stimme; ein laufendes Vorlesen bricht ab. */
export type Say = (text: string) => void;

let voices: Promise<readonly SpeechSynthesisVoice[]> | null = null;

const synthesis = (): SpeechSynthesis | undefined =>
  typeof speechSynthesis === "undefined" ? undefined : speechSynthesis;

/** Die Stimmen des Geräts; eine leere Liste wird beim nächsten Aufruf erneut gelesen. */
function loadVoices(): Promise<readonly SpeechSynthesisVoice[]> {
  const engine = synthesis();
  if (!engine) return Promise.resolve([]);
  if (voices) return voices;
  const current = engine.getVoices();
  if (current.length > 0) return (voices = Promise.resolve(current));
  const waiting = new Promise<readonly SpeechSynthesisVoice[]>((resolve) => {
    const done = () => {
      clearTimeout(timer);
      engine.removeEventListener("voiceschanged", done);
      resolve(engine.getVoices());
    };
    const timer = setTimeout(done, VOICES_TIMEOUT);
    engine.addEventListener("voiceschanged", done);
  });
  voices = waiting;
  // Ohne Stimmen später noch einmal fragen: Manche Browser laden sie erst nach.
  void waiting.then((found) => {
    if (found.length === 0 && voices === waiting) voices = null;
  });
  return waiting;
}

/** Früh aufrufen, damit die Stimmen bereitliegen, wenn die erste Karte erscheint. */
export function preloadVoices(): void {
  void loadVoices();
}

/** Vorlesen in der Sprache `lang`, oder `null`, wenn das Gerät keine passende Stimme hat. */
export async function speakerFor(lang: string): Promise<Say | null> {
  const voice = pickVoice(await loadVoices(), lang);
  const engine = synthesis();
  if (!voice || !engine) return null;
  return (text) => {
    engine.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice;
    utterance.lang = voice.lang;
    engine.speak(utterance);
  };
}

/** Beendet ein laufendes Vorlesen, z. B. beim Verlassen der Sitzung. */
export function stopSpeaking(): void {
  synthesis()?.cancel();
}
