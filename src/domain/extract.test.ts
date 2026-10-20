import { describe, expect, it } from "vitest";
import { extractJson } from "./extract";

const set = { set: { title: "Test" }, sections: [] };
const json = JSON.stringify(set, null, 2);

function error(text: string): string {
  const result = extractJson(text);
  if (result.ok) throw new Error("Fehler erwartet");
  return result.error;
}

describe("extractJson – Herauslösen", () => {
  it("liest reines JSON", () => {
    expect(extractJson(json)).toEqual({ ok: true, value: set, trimmed: false });
  });

  it("entfernt Byte-Order-Mark und Leerraum am Rand, ohne das als Kürzung zu melden", () => {
    expect(extractJson(`\uFEFF\n  ${json}\n\n`)).toEqual({ ok: true, value: set, trimmed: false });
  });

  it("nimmt den Inhalt eines Codeblocks mit Sprachangabe", () => {
    const text = `Hier ist dein Set:\n\n\`\`\`json\n${json}\n\`\`\`\n\nViel Spaß beim Lernen!`;
    expect(extractJson(text)).toEqual({ ok: true, value: set, trimmed: true });
  });

  it("nimmt den Inhalt eines Codeblocks ohne Sprachangabe", () => {
    expect(extractJson(`\`\`\`\n${json}\n\`\`\``)).toEqual({ ok: true, value: set, trimmed: true });
  });

  it("überspringt Codeblöcke, die nicht mit { beginnen", () => {
    const text = `\`\`\`text\nZuerst eine Erklärung {mit Klammern}\n\`\`\`\n\`\`\`json\n${json}\n\`\`\``;
    expect(extractJson(text)).toEqual({ ok: true, value: set, trimmed: true });
  });

  it("nimmt ohne Codeblock den Bereich vom ersten { bis zum letzten }", () => {
    const text = `Gern! Hier ist das Set: ${json} Sag Bescheid, wenn du mehr brauchst.`;
    expect(extractJson(text)).toEqual({ ok: true, value: set, trimmed: true });
  });

  it("meldet Text ohne {", () => {
    expect(error("Ich kann das Foto leider nicht lesen.")).toBe(
      "Im Text wurde kein Vokabelset gefunden. Füge die vollständige Antwort mit dem JSON-Codeblock ein.",
    );
  });

  it("meldet leeren Text", () => {
    expect(error("  \n ")).toMatch(/^Im Text wurde kein Vokabelset gefunden/);
  });
});

describe("extractJson – Fundstelle bei ungültigem JSON", () => {
  it("zeigt ein abschließendes Komma an der Stelle des Kommas", () => {
    expect(error('{\n  "a": 1,\n}')).toBe(
      "Fehler im JSON in Zeile 2, Spalte 9: Nach dem letzten Element steht ein Komma zu viel.",
    );
  });

  it("zeigt ein abschließendes Komma in einer Liste", () => {
    expect(error('{ "a": [1, 2, ] }')).toBe(
      "Fehler im JSON in Zeile 1, Spalte 13: Nach dem letzten Element steht ein Komma zu viel.",
    );
  });

  it("zeigt ein fehlendes Komma direkt hinter dem vorigen Wert", () => {
    expect(error('{\n  "a": 1\n  "b": 2\n}')).toBe(
      "Fehler im JSON in Zeile 2, Spalte 9: Hier fehlt ein Komma oder eine schließende Klammer.",
    );
  });

  it("meldet Feldnamen ohne Anführungszeichen", () => {
    expect(error('{ title: "x" }')).toBe(
      'Fehler im JSON in Zeile 1, Spalte 3: Feldnamen müssen in geraden doppelten Anführungszeichen (") stehen.',
    );
  });

  it("meldet einen fehlenden Doppelpunkt", () => {
    expect(error('{ "title" "x" }')).toBe(
      "Fehler im JSON in Zeile 1, Spalte 10: Nach dem Feldnamen fehlt ein Doppelpunkt.",
    );
  });

  it("meldet Texte ohne Anführungszeichen", () => {
    expect(error('{"a": apple}')).toBe(
      'Fehler im JSON in Zeile 1, Spalte 7: Hier wird ein Wert erwartet, zum Beispiel ein Text in geraden doppelten Anführungszeichen (").',
    );
  });

  it("meldet einfache Anführungszeichen", () => {
    expect(error("{ 'title': \"x\" }")).toBe(
      "Fehler im JSON in Zeile 1, Spalte 3: Texte und Feldnamen müssen in doppelten statt einfachen Anführungszeichen stehen.",
    );
  });

  it.each(["„", "“", "”"])("meldet typografische Anführungszeichen %s", (quote) => {
    expect(error(`{ "title": ${quote}Essen" }`)).toBe(
      'Fehler im JSON in Zeile 1, Spalte 12: Typografische Anführungszeichen sind nicht erlaubt. Verwende gerade doppelte Anführungszeichen (").',
    );
  });

  it("meldet einen Zeilenumbruch innerhalb eines Textes", () => {
    expect(error('{"a": "zwei\nZeilen"}')).toBe(
      "Fehler im JSON in Zeile 1, Spalte 12: Ein Text ist nicht abgeschlossen oder enthält einen Zeilenumbruch.",
    );
  });

  it("meldet ungültige Zeichen nach einem umgekehrten Schrägstrich", () => {
    expect(error('{"a": "C:\\Daten"}')).toBe(
      "Fehler im JSON in Zeile 1, Spalte 10: Nach einem umgekehrten Schrägstrich (\\) steht ein ungültiges Zeichen.",
    );
  });

  it("meldet weiteren Inhalt nach dem Ende des Objekts", () => {
    expect(error('{"a": 1} und {"b": 2}')).toBe(
      "Fehler im JSON in Zeile 1, Spalte 10: Nach dem Ende des Vokabelsets folgt weiterer Inhalt.",
    );
  });

  it("meldet abgeschnittenen Text ohne Fundstelle", () => {
    expect(error('```json\n{"a": [1, 2')).toBe(
      "Der Text endet, bevor das Vokabelset vollständig ist. Wurde die Antwort ganz kopiert?",
    );
  });

  it("zählt Zeile und Spalte im eingefügten Text, nicht im herausgelösten", () => {
    const text = 'Hier ist dein Set:\n\n```json\n{\n  "a": 1\n  "b": 2\n}\n```\nViel Spaß!';
    expect(error(text)).toBe(
      "Fehler im JSON in Zeile 5, Spalte 9: Hier fehlt ein Komma oder eine schließende Klammer.",
    );
  });

  it("zählt Zeilen mit Windows-Zeilenenden richtig", () => {
    expect(error('{\r\n  "a": 1\r\n  "b": 2\r\n}')).toMatch(
      /^Fehler im JSON in Zeile 2, Spalte 9:/,
    );
  });

  it("bleibt bei sehr tiefer Verschachtelung ohne Stapelüberlauf", () => {
    expect(error(`{"a": ${"[".repeat(100_000)}x`)).toMatch(/^Fehler im JSON in Zeile 1, Spalte /);
  });
});
