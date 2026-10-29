// Inhalte der Hilfe „Wie bekomme ich ein Vokabelset?“ (TDD 13.1). Das Beispiel steht auch in der
// Formatspezifikation (Kapitel 1), tests/format/help.test.ts hält beide gleich. Die Vorlage gehört nur
// der App: Die Spezifikation beschreibt den Ablauf, enthält aber keine Vorlage (D-35).

/** Unter diesem Namen liegt die Formatspezifikation neben der App (D-26, `scripts/precache.ts`). */
export const SPEC_FILE = "formatspezifikation.md";

/** Platzhalter in der Vorlage; die App setzt die Adresse der veröffentlichten Spezifikation ein. */
export const LINK_PLACEHOLDER = "[Link zur Formatbeschreibung]";

/** Vorlage für ein neues Set aus Fotos. Die Korrekturvorlage folgt mit dem Set-Export (S-32). */
export const NEW_SET_PROMPT = `Hier ist die Formatbeschreibung für meinen Vokabeltrainer: ${LINK_PLACEHOLDER}
Mach aus den Vokabeln auf den angehängten Fotos ein Vokabelset in diesem Format.`;

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
