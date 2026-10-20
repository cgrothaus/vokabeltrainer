import { describe, expect, it } from "vitest";
import { MAX_IMPORT_SIZE, prepareNewSet } from "./importSet";

const now = "2026-10-20T18:00:00.000Z";
// Fortlaufende Bytes ergeben verschiedene IDs.
let counter = 0;
const randomBytes = (count: number) => Uint8Array.from({ length: count }, () => counter++ % 31);

const answer = `Klar, hier ist dein Set:

\`\`\`json
{
  "format": "vokabeltrainer-set",
  "formatVersion": 1,
  "set": { "title": "Englisch – Wetter", "termLanguage": "en", "meaningLanguage": "de" },
  "sections": [
    { "title": "Wetter", "entries": [
      { "term": "rain", "meanings": ["Regen"] },
      { "term": { "text": "autumn", "acceptedVariants": ["fall"] }, "meanings": ["Herbst"] }
    ] }
  ]
}
\`\`\`

Viel Erfolg!`;

describe("prepareNewSet", () => {
  it("macht aus einer LLM-Antwort ein neues Set mit IDs", () => {
    const result = prepareNewSet(answer, { now, randomBytes });
    if (!result.ok) throw new Error(result.errors.join("\n"));
    expect(result.trimmed).toBe(true);
    expect(result.warnings).toEqual([]);
    const { set } = result;
    expect(set).toMatchObject({
      editCount: 0,
      createdAt: now,
      updatedAt: now,
      title: "Englisch – Wetter",
      termLanguage: "en",
      meaningLanguage: "de",
    });
    expect(set.id).toHaveLength(10);
    expect(set.sections).toHaveLength(1);
    expect(set.sections[0]!.id).toHaveLength(6);
    expect(set.sections[0]!.entries).toEqual([
      { id: expect.any(String), term: { text: "rain" }, meanings: [{ text: "Regen" }] },
      {
        id: expect.any(String),
        term: { text: "autumn", acceptedVariants: ["fall"] },
        meanings: [{ text: "Herbst" }],
      },
    ]);
  });

  it("gibt Warnungen der Prüfung weiter", () => {
    const text =
      '{"set": {"title": "T", "termLanguage": "en", "meaningLanguage": "de"}, "sections": [{"title": "S", "entries": []}]}';
    expect(prepareNewSet(text, { now, randomBytes })).toMatchObject({
      ok: true,
      trimmed: false,
      warnings: ["Die Formatversion fehlt; die App nimmt Version 1 an."],
    });
  });

  it("meldet Fehler beim Herauslösen", () => {
    expect(prepareNewSet("Leider kein Set.", { now, randomBytes })).toEqual({
      ok: false,
      errors: [
        "Im Text wurde kein Vokabelset gefunden. Füge die vollständige Antwort mit dem JSON-Codeblock ein.",
      ],
    });
  });

  it("meldet Fehler der Prüfung", () => {
    const result = prepareNewSet('{"set": {}, "sections": []}', { now, randomBytes });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain("Set-Angaben: Es fehlt der Titel („title“).");
  });

  it("lehnt zu große Texte ab, ohne sie zu lesen", () => {
    const text = `{"x": "${"a".repeat(MAX_IMPORT_SIZE)}"}`;
    expect(prepareNewSet(text, { now, randomBytes })).toEqual({
      ok: false,
      errors: ["Der Text ist zu groß. Ein Vokabelset darf höchstens 10 MB haben."],
    });
  });
});
