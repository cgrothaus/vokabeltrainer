import { describe, expect, it } from "vitest";
import { groupSets, setSize } from "./library";
import type { StoredSet } from "./model";

let nextId = 0;

function set(title: string, extra: Partial<StoredSet> = {}): StoredSet {
  return {
    id: `set${nextId++}`.padEnd(10, "x"),
    editCount: 0,
    createdAt: "2026-10-21T08:00:00.000Z",
    updatedAt: "2026-10-21T08:00:00.000Z",
    title,
    termLanguage: "en",
    meaningLanguage: "de",
    sections: [],
    ...extra,
  };
}

const NAMES: Record<string, string> = { en: "Englisch", fr: "Französisch", la: "Latein" };
const languageName = (code: string) => NAMES[code] ?? code;

const titles = (sets: StoredSet[]) => sets.map((s) => s.title);

describe("groupSets", () => {
  it("liefert für eine leere Bibliothek keine Gruppen", () => {
    expect(groupSets([], languageName)).toEqual([]);
  });

  it("gruppiert nach Lernsprache und ordnet die Gruppen nach ihrem Namen", () => {
    const latin = set("Lektion 1", { termLanguage: "la" });
    const english = set("Wetter");
    const french = set("Familie", { termLanguage: "fr" });
    const groups = groupSets([latin, english, french], languageName);
    expect(groups.map(({ language, name }) => ({ language, name }))).toEqual([
      { language: "en", name: "Englisch" },
      { language: "fr", name: "Französisch" },
      { language: "la", name: "Latein" },
    ]);
    expect(groups[2]!.sets).toEqual([latin]);
  });

  it("trennt Sprachvarianten, weil die App nur kanonische Codes vergleicht", () => {
    const groups = groupSets([set("A"), set("B", { termLanguage: "en-GB" })], languageName);
    expect(groups.map((group) => group.language).sort()).toEqual(["en", "en-GB"]);
  });

  it("ignoriert die Bedeutungssprache bei der Gruppierung", () => {
    const groups = groupSets([set("A"), set("B", { meaningLanguage: "fr" })], languageName);
    expect(groups).toHaveLength(1);
    expect(titles(groups[0]!.sets)).toEqual(["A", "B"]);
  });

  it("ordnet innerhalb der Gruppe nach Lernstufe, Zahlen der Größe nach", () => {
    const sets = [
      set("Zehn", { level: "Klasse 10" }),
      set("Fünf", { level: "Klasse 5" }),
      set("Sechs", { level: "Klasse 6" }),
    ];
    expect(titles(groupSets(sets, languageName)[0]!.sets)).toEqual(["Fünf", "Sechs", "Zehn"]);
  });

  it("stellt Sets ohne Lernstufe ans Ende", () => {
    const sets = [set("Ohne"), set("Mit", { level: "A2" })];
    expect(titles(groupSets(sets, languageName)[0]!.sets)).toEqual(["Mit", "Ohne"]);
  });

  it("ordnet bei gleicher Lernstufe nach Titel, deutsch sortiert und mit Zahlen der Größe nach", () => {
    const sets = [
      set("Unit 10", { level: "A1" }),
      set("Äpfel", { level: "A1" }),
      set("Unit 2", { level: "A1" }),
      set("Zoo", { level: "A1" }),
    ];
    expect(titles(groupSets(sets, languageName)[0]!.sets)).toEqual([
      "Äpfel",
      "Unit 2",
      "Unit 10",
      "Zoo",
    ]);
  });

  it("verändert die übergebene Liste nicht", () => {
    const sets = [set("B"), set("A")];
    groupSets(sets, languageName);
    expect(titles(sets)).toEqual(["B", "A"]);
  });
});

describe("setSize", () => {
  it("zählt Sektionen und Einträge", () => {
    const entry = (id: string) => ({ id, term: { text: id }, meanings: [{ text: id }] });
    const sized = set("A", {
      sections: [
        { id: "sec001", title: "Eins", entries: [entry("e1"), entry("e2")] },
        { id: "sec002", title: "Leer", entries: [] },
        { id: "sec003", title: "Drei", entries: [entry("e3")] },
      ],
    });
    expect(setSize(sized)).toEqual({ sections: 3, entries: 3 });
  });

  it("zählt ein leeres Set als null", () => {
    expect(setSize(set("A"))).toEqual({ sections: 0, entries: 0 });
  });
});
