// Inhalte der Hilfe „Wie bekomme ich ein Vokabelset?“ (TDD 13.1). Das Beispiel steht auch in der
// Formatspezifikation (Kapitel 1), tests/format/help.test.ts hält beide gleich. Die Vorlage gehört nur
// der App: Die Spezifikation beschreibt den Ablauf, enthält aber keine Vorlage (D-35).
//
// Die Vorlagen enthalten die ganze Spezifikation statt eines Links (D-65): Manche Chats öffnen keine
// Links oder lesen sie nur oberflächlich. Eingebettet ist dieselbe Datei, die der Build neben der App
// veröffentlicht (D-26); so liegt sie beim Tippen schon vor, und die Nutzergeste bleibt frisch.
import spec from "../../docs/Formatspezifikation_Vokabelset_v1.md?raw";

const INTRO = "Hier ist die Formatbeschreibung für meinen Vokabeltrainer:";

/** Auftrag am Ende der Vorlage für ein neues Set aus Fotos. */
export const NEW_SET_TASK =
  "Mach aus den Vokabeln auf den angehängten Fotos ein Vokabelset in diesem Format.";

/**
 * Auftrag der Korrekturvorlage (D-42, D-44). Kurz wie der erste: Was eine Korrektur erhalten muss
 * (IDs, Prüfwerte, Umfang), erklärt die Spezifikation selbst (D-35). Das Set folgt darunter.
 */
export const CORRECTION_TASK = "Prüf das Vokabelset unten aus der App und korrigiere die Fehler.";

/** Was die Oberfläche statt der Spezifikation und des Sets zeigt; kopiert wird der volle Text. */
export const SPEC_SHOWN = "[Formatbeschreibung der App – wird mitkopiert]";
export const SET_SHOWN = "[Dein Vokabelset – wird mitkopiert]";

export function newSetPrompt(): string {
  return `${INTRO}\n\n${spec.trimEnd()}\n\n${NEW_SET_TASK}`;
}

export const NEW_SET_SHOWN = `${INTRO}\n${SPEC_SHOWN}\n${NEW_SET_TASK}`;

/** `setText`: das exportierte Set bzw. die gewählten Sektionen, wie „Text kopieren“ sie liefert. */
export function correctionPrompt(setText: string): string {
  return `${INTRO}\n\n${spec.trimEnd()}\n\n${CORRECTION_TASK}\n\n${setText}`;
}

export const CORRECTION_SHOWN = `${INTRO}\n${SPEC_SHOWN}\n${CORRECTION_TASK}\n${SET_SHOWN}`;

/** Formatspezifikation Kapitel 1. */
export const FORMAT_EXAMPLE = `{
  "format": "vokabeltrainer-set",
  "formatVersion": 1,
  "set": {
    "title": "Lektion 4 – In der Stadt",
    "termLanguage": "en",
    "meaningLanguage": "de",
    "level": "Klasse 6"
  },
  "sections": [
    {
      "title": "Unterwegs",
      "entries": [
        { "term": "bus stop", "meanings": ["Bushaltestelle"] },
        { "term": "to miss", "meanings": ["vermissen", "verpassen"] }
      ]
    },
    {
      "title": "Einkaufen",
      "entries": [
        { "term": "money", "meanings": ["Geld"] },
        { "term": "apple", "meanings": ["Apfel"] }
      ]
    }
  ]
}`;
