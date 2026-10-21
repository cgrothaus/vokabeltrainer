// Inhalte der Hilfe „Wie bekomme ich ein Vokabelset?“ (TDD 13.1). Beispiel und Vorlage stehen auch in
// der Formatspezifikation (Kapitel 1 und 11.1); tests/format/help.test.ts hält beide gleich.

/** Unter diesem Namen liegt die Formatspezifikation neben der App (D-26, `scripts/precache.ts`). */
export const SPEC_FILE = "formatspezifikation.md";

/** Platzhalter in der Vorlage; die App setzt die Adresse der veröffentlichten Spezifikation ein. */
export const LINK_PLACEHOLDER = "[Link zur Formatbeschreibung]";

/** Formatspezifikation 11.1. Die Korrekturvorlage (11.2) folgt mit dem Set-Export (S-32). */
export const NEW_SET_PROMPT = `Hier ist die Formatbeschreibung für meinen Vokabeltrainer: ${LINK_PLACEHOLDER}
Mach aus den Vokabeln auf den angehängten Fotos ein Vokabelset in diesem Format.`;

/** Formatspezifikation Kapitel 1. */
export const FORMAT_EXAMPLE = `{
  "format": "vokabeltrainer-set",
  "formatVersion": 1,
  "set": {
    "title": "Englisch – Freizeit und Essen",
    "termLanguage": "en",
    "meaningLanguage": "de",
    "level": "Klasse 6"
  },
  "sections": [
    {
      "title": "Essen und Trinken",
      "entries": [
        { "term": "apple", "meanings": ["Apfel"] },
        { "term": "breakfast", "meanings": ["Frühstück"] }
      ]
    },
    {
      "title": "Freizeit",
      "entries": [
        { "term": "to miss", "meanings": ["vermissen", "verpassen"] },
        { "term": "football", "meanings": ["Fußball"] }
      ]
    }
  ]
}`;
