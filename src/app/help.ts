// Hilfe „Wie bekomme ich ein Vokabelset?“ (TDD 13.1, D-26): Vorlage mit Link auf die Formatspezifikation,
// die neben der App liegt, und die Spezifikation als Datei zum Teilen, falls der Chat keine Links öffnet.
import { LINK_PLACEHOLDER, NEW_SET_PROMPT, SPEC_FILE } from "../content/help";
import { type Delivery, deliverFile } from "../platform/deliverFile";

/** `.txt` statt `.md`: Chromium teilt nur Dateien mit bekannten Endungen, Chat-Apps lesen beides. */
const SHARED_NAME = "Formatbeschreibung-Vokabeltrainer.txt";

/** Absolute Adresse relativ zur App, damit sie unter jedem Pfad und jeder Domain stimmt. */
export function specUrl(): string {
  return new URL(SPEC_FILE, document.baseURI).href;
}

export function newSetPrompt(): string {
  return NEW_SET_PROMPT.replace(LINK_PLACEHOLDER, specUrl());
}

/** Liest die Spezifikation vorab (offline aus dem Cache des Service Workers), damit das Teilen sofort startet. */
export async function loadSpec(): Promise<Blob> {
  const response = await fetch(SPEC_FILE);
  if (!response.ok) throw new Error(`Formatspezifikation nicht ladbar: ${response.status}`);
  return new Blob([await response.text()], { type: "text/plain" });
}

/** Muss direkt im Klick aufgerufen werden, sonst öffnet sich das Teilen-Menü nicht. */
export function shareSpec(spec: Blob): Promise<Delivery> {
  return deliverFile(spec, SHARED_NAME);
}
