// Hilfe und Formatspezifikation (TDD 13.1, 15.7, D-35): Das Beispiel der App steht wörtlich in der
// Spezifikation, die App verweist auf die Datei, die der Build veröffentlicht, und die Spezifikation
// steht als ausgeliefertes Dokument für sich: ohne Vorlage und ohne Verweise auf Projektdokumente.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PUBLISHED_DOCS } from "../../scripts/precache";
import { validateSetFile } from "../../src/domain/validate";
import {
  FORMAT_EXAMPLE,
  LINK_PLACEHOLDER,
  NEW_SET_PROMPT,
  SPEC_FILE,
} from "../../src/content/help";

const spec = readFileSync(
  new URL("../../docs/Formatspezifikation_Vokabelset_v1.md", import.meta.url),
  "utf8",
);

/** Inhalt des ersten Codeblocks der Sprache `lang` nach der Überschrift `heading`. */
function codeBlock(heading: string, lang: string): string {
  const section = spec.indexOf(`\n${heading}\n`);
  expect(section, heading).toBeGreaterThan(-1);
  const fence = "```" + lang + "\n";
  const start = spec.indexOf(fence, section) + fence.length;
  return spec.slice(start, spec.indexOf("\n```", start));
}

describe("Hilfe", () => {
  it("zeigt das Beispiel aus Kapitel 1 der Formatspezifikation", () => {
    expect(FORMAT_EXAMPLE).toBe(codeBlock("## 1. Das Wichtigste in Kürze", "json"));
  });

  it("das Beispiel ist ein gültiges Set ohne Warnungen", () => {
    expect(validateSetFile(JSON.parse(FORMAT_EXAMPLE))).toMatchObject({ ok: true, warnings: [] });
  });

  it("die Vorlage enthält den Platzhalter für den Link genau einmal", () => {
    expect(NEW_SET_PROMPT.split(LINK_PLACEHOLDER)).toHaveLength(2);
  });

  it("verweist auf die veröffentlichte Formatspezifikation", () => {
    expect(PUBLISHED_DOCS[SPEC_FILE]).toBe("docs/Formatspezifikation_Vokabelset_v1.md");
  });
});

describe("Formatspezifikation", () => {
  it("verweist nicht auf Projektdokumente oder deren Nummern", () => {
    expect(spec).not.toMatch(/\b(PRD|TDD)\b/);
    expect(spec).not.toMatch(/\b(FR|NFR|DF|AK|TAK|PI|D|S|T|F|O|R|Z)-\d+/);
  });

  it("enthält keine Vorlage für den KI-Chat", () => {
    expect(spec).not.toContain(LINK_PLACEHOLDER);
    expect(spec).not.toContain(NEW_SET_PROMPT.split("\n")[1]);
  });
});
