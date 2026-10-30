// Set bearbeiten (TDD 10, 13.1, D-41): eigene Ansicht neben der Set-Ansicht, die reine Leseansicht
// bleibt. Zeigt je Sektion die Einträge zum Bearbeiten und „Eintrag hinzufügen“; Sektionen verwalten
// und Reihenfolge ändern folgen mit S-31.
import type { StoredEntry, StoredSection, StoredSet } from "../../domain/model";
import { type Child, h } from "../dom";

export interface EditSetContext {
  /** `undefined`, wenn es das Set nicht gibt. */
  loadSet: () => Promise<StoredSet | undefined>;
}

const NOT_LOADED = "Das Vokabelset konnte nicht geladen werden. Lade die Seite neu.";

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const back = () => h("p", null, h("a", { href: "#/" }, "Zurück zur Bibliothek"));

export function editSetView(context: EditSetContext): Node {
  const main = h("main", { class: "edit-set" });
  void context.loadSet().then(
    (set) => {
      if (set) return main.replaceWith(h("main", { class: "edit-set" }, content(set)));
      main.replaceChildren(
        h("h1", null, "Set nicht gefunden"),
        h("p", null, "Dieses Vokabelset gibt es nicht (mehr)."),
        back(),
      );
    },
    (error: unknown) => {
      console.error("Set nicht lesbar", error);
      main.replaceChildren(
        h("h1", null, "Set bearbeiten"),
        h("p", { role: "alert" }, NOT_LOADED),
        back(),
      );
    },
  );
  return main;
}

function content(set: StoredSet): Child[] {
  const setPath = encodeURIComponent(set.id);
  return [
    h("h1", { class: "set-title" }, `${set.title} bearbeiten`),
    h("p", null, "Tippe auf einen Eintrag, um ihn zu ändern oder zu löschen."),
    set.sections.map((section) => sectionView(set, section)),
    h("p", null, h("a", { href: `#/set/${setPath}`, class: "action" }, "Fertig")),
  ];
}

function sectionView(set: StoredSet, section: StoredSection): Node {
  const setPath = encodeURIComponent(set.id);
  return h(
    "section",
    { class: "edit-section" },
    h(
      "h2",
      null,
      section.title,
      " ",
      h("span", { class: "count" }, count(section.entries.length, "Eintrag", "Einträge")),
    ),
    section.entries.length === 0
      ? h("p", null, "Diese Sektion hat noch keine Einträge.")
      : h(
          "ul",
          { class: "edit-entries" },
          section.entries.map((entry) =>
            h(
              "li",
              null,
              h(
                "a",
                { href: `#/entry/${setPath}/${encodeURIComponent(entry.id)}` },
                // Ein Element, sonst verschluckt der Flex-Container die Leerzeichen um den Strich.
                h("span", null, pair(entry, set)),
              ),
            ),
          ),
        ),
    h(
      "p",
      null,
      h(
        "a",
        {
          href: `#/new-entry/${setPath}/${encodeURIComponent(section.id)}`,
          class: "action secondary",
          // Der sichtbare Text steckt im Namen, damit auch Sprachsteuerung ihn findet.
          "aria-label": `Eintrag hinzufügen zu „${section.title}“`,
        },
        "Eintrag hinzufügen",
      ),
    ),
  );
}

/** „autumn – Herbst; Spätzeit“, Wort und Bedeutungen in ihrer Sprache. */
function pair(entry: StoredEntry, set: StoredSet): Child[] {
  return [
    h("span", { lang: set.termLanguage }, entry.term.text),
    " – ",
    h(
      "span",
      { lang: set.meaningLanguage },
      entry.meanings.map((meaning) => meaning.text).join("; "),
    ),
  ];
}
