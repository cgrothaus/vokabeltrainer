// Grammatik, Beispiele und Notiz eines Eintrags (TDD 12.3, 13.1): in der Set-Ansicht und auf der
// Rückseite einer Karte. Fehlende Angaben entfallen.
import type { StoredEntry, StoredSet } from "../../domain/model";
import { type Child, h } from "../dom";

// Die Formatspezifikation (5.4) nennt englische Beispielwerte; bekannte erscheinen deutsch, alle
// anderen so, wie sie im Set stehen (TDD 13.1).
export const PARTS_OF_SPEECH: Record<string, string> = {
  noun: "Nomen",
  verb: "Verb",
  adjective: "Adjektiv",
  adverb: "Adverb",
  pronoun: "Pronomen",
  preposition: "Präposition",
  conjunction: "Konjunktion",
  interjection: "Interjektion",
  article: "Artikel",
  numeral: "Zahlwort",
  phrase: "Wendung",
};
export const GENDERS: Record<string, string> = { m: "maskulin", f: "feminin", n: "neutrum" };

const translate = (table: Record<string, string>, value: string) =>
  table[value.toLowerCase()] ?? value;

export function entryDetails(entry: StoredEntry, set: StoredSet): Child[] {
  const { grammar, examples = [] } = entry;
  const grammarParts = grammar
    ? [
        grammar.partOfSpeech && `Wortart: ${translate(PARTS_OF_SPEECH, grammar.partOfSpeech)}`,
        grammar.gender && `Genus: ${translate(GENDERS, grammar.gender)}`,
        grammar.plural && `Plural: ${grammar.plural}`,
        grammar.forms && `Formen: ${grammar.forms.join(", ")}`,
      ].filter((part): part is string => !!part)
    : [];
  return [
    grammarParts.length > 0 && h("p", { class: "extra" }, grammarParts.join(" · ")),
    examples.length > 0 &&
      h(
        "ul",
        { class: "examples", "aria-label": "Beispiele" },
        examples.map((example) =>
          h(
            "li",
            null,
            h("span", { lang: set.termLanguage }, example.text),
            example.translation && [
              " – ",
              h("span", { lang: set.meaningLanguage }, example.translation),
            ],
          ),
        ),
      ),
    entry.notes && h("p", { class: "extra" }, `Notiz: ${entry.notes}`),
  ];
}

/** Hat der Eintrag etwas, das `entryDetails` zeigt? */
export function hasDetails(entry: StoredEntry): boolean {
  const { grammar, examples = [], notes } = entry;
  const grammarShown =
    !!grammar && !!(grammar.partOfSpeech || grammar.gender || grammar.plural || grammar.forms);
  return grammarShown || examples.length > 0 || !!notes;
}
