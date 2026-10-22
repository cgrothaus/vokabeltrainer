// Grammatik, Beispiele und Notiz eines Eintrags (TDD 12.3, 13.1): in der Set-Ansicht und auf der
// Rückseite einer Karte. Fehlende Angaben entfallen.
import type { StoredEntry, StoredSet } from "../../domain/model";
import { type Child, h } from "../dom";

export function entryDetails(entry: StoredEntry, set: StoredSet): Child[] {
  const { grammar, examples = [] } = entry;
  const grammarParts = grammar
    ? [
        grammar.partOfSpeech && `Wortart: ${grammar.partOfSpeech}`,
        grammar.gender && `Genus: ${grammar.gender}`,
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
