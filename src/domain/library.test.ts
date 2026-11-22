import { describe, expect, it } from "vitest";
import {
  archiveKey,
  archivedSetIds,
  groupByLevel,
  groupSets,
  joinTitles,
  knownLevels,
  languageFilter,
  levelFromInput,
  pairsToCombine,
  setSize,
  splitRecent,
  suggestedLevel,
  withLevel,
} from "./library";
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

describe("pairsToCombine (TDD 12.10)", () => {
  const filled = {
    sections: [
      {
        id: "s1",
        title: "S",
        entries: [{ id: "e1", term: { text: "a" }, meanings: [{ text: "b" }] }],
      },
    ],
  };

  it("bietet je Sprachpaar mit mindestens zwei Sets mit Einträgen an, in der Reihenfolge der Gruppe", () => {
    const a = set("A", filled);
    const b = set("B", filled);
    const french = set("C", { ...filled, meaningLanguage: "fr" });
    const empty = set("D", { meaningLanguage: "fr" });
    const [group] = groupSets([a, b, french, empty], languageName);
    expect(pairsToCombine(group!)).toEqual([
      { termLanguage: "en", meaningLanguage: "de", sets: [a, b] },
    ]);
  });

  it("bietet nichts an, wenn kein Paar zwei Sets hat", () => {
    const [group] = groupSets(
      [set("A", filled), set("B", { ...filled, meaningLanguage: "fr" })],
      languageName,
    );
    expect(pairsToCombine(group!)).toEqual([]);
  });
});

describe("joinTitles", () => {
  it("zählt die Titel auf", () => {
    expect(joinTitles([set("A")])).toBe("A");
    expect(joinTitles([set("A"), set("B"), set("C")])).toBe("A, B und C");
  });
});

describe("Archiv (D-72)", () => {
  it("legt den Schlüssel pro Set unter `archived:` ab", () => {
    expect(archiveKey("m4x8c2r9tw")).toBe("archived:m4x8c2r9tw");
  });

  it("liest archivierte Sets tolerant aus den Einstellungen", () => {
    const ids = archivedSetIds([
      { key: "archived:aaaaaaaaaa", value: true },
      { key: "archived:bbbbbbbbbb", value: "ja" },
      { key: "practice:cccccccccc", value: true },
      { key: "theme", value: "dark" },
    ]);
    expect([...ids]).toEqual(["aaaaaaaaaa"]);
  });
});

describe("languageFilter", () => {
  it("nimmt die gemerkte Sprache nur, wenn es sie in der Bibliothek noch gibt", () => {
    expect(languageFilter("fr", ["en", "fr"])).toBe("fr");
    expect(languageFilter("es", ["en", "fr"])).toBeNull();
    expect(languageFilter(42, ["en", "fr"])).toBeNull();
    expect(languageFilter(undefined, ["en", "fr"])).toBeNull();
  });
});

describe("splitRecent", () => {
  const five = ["A", "B", "C", "D", "E"].map((title) => set(title));
  const ids = (sets: StoredSet[]) => sets.map((s) => s.id);

  it("stellt ab fünf Sets die drei zuletzt gelernten voran, die übrigen bleiben geordnet", () => {
    const order = [five[3]!.id, "fremd00000", five[0]!.id, five[4]!.id, five[1]!.id];
    const { recent, rest } = splitRecent(five, order);
    expect(ids(recent)).toEqual([five[3]!.id, five[0]!.id, five[4]!.id]);
    expect(titles(rest)).toEqual(["B", "C"]);
  });

  it("teilt unter fünf Sets nicht auf", () => {
    const four = five.slice(0, 4);
    expect(splitRecent(four, [four[2]!.id])).toEqual({ recent: [], rest: four });
  });

  it("nimmt nur gelernte Sets nach oben", () => {
    const { recent, rest } = splitRecent(five, [five[2]!.id]);
    expect(titles(recent)).toEqual(["C"]);
    expect(titles(rest)).toEqual(["A", "B", "D", "E"]);
  });
});

describe("Lernstufen", () => {
  it("kennt die vorhandenen Lernstufen, Zahlen der Größe nach", () => {
    const sets = [
      set("A", { level: "Klasse 10" }),
      set("B", { level: "Klasse 9" }),
      set("C"),
      set("D", { level: "Klasse 10" }),
    ];
    expect(knownLevels(sets)).toEqual(["Klasse 9", "Klasse 10"]);
  });

  it("schlägt die Lernstufe des zuletzt hinzugefügten Sets mit Lernstufe vor", () => {
    const sets = [
      set("A", { level: "Klasse 10", createdAt: "2026-09-01T08:00:00.000Z" }),
      set("B", { level: "Klasse 11", createdAt: "2026-11-01T08:00:00.000Z" }),
      set("C", { createdAt: "2026-11-20T08:00:00.000Z" }),
      set("D", { level: "Klasse 9", createdAt: "2026-10-01T08:00:00.000Z" }),
    ];
    expect(suggestedLevel(sets)).toBe("Klasse 11");
    expect(suggestedLevel([set("E")])).toBeUndefined();
  });

  it("prüft eine eingegebene Lernstufe wie das Formular", () => {
    expect(levelFromInput("  Kursstufe 1 ")).toEqual({ ok: true, level: "Kursstufe 1" });
    expect(levelFromInput("   ")).toEqual({
      ok: false,
      error: "Gib einen Namen für die Lernstufe ein.",
    });
    expect(levelFromInput("x".repeat(201))).toEqual({
      ok: false,
      error: "Die Lernstufe ist länger als 200 Zeichen.",
    });
  });

  it("setzt oder entfernt die Lernstufe, ohne das Set zu verändern", () => {
    const original = set("A", { level: "Klasse 9" });
    expect(withLevel(original, "Klasse 10").level).toBe("Klasse 10");
    const without = withLevel(original, undefined);
    expect("level" in without).toBe(false);
    expect(original.level).toBe("Klasse 9");
  });

  it("gruppiert das Archiv nach Lernstufe, ohne Lernstufe zuletzt, darin nach Sprache und Titel", () => {
    const a = set("Unité 2", { termLanguage: "fr", level: "Klasse 10" });
    const b = set("Unit 2", { level: "Klasse 10" });
    const c = set("Unit 1", { level: "Klasse 10" });
    const d = set("Phrasal verbs");
    const e = set("Unit 3", { level: "Klasse 9" });
    const groups = groupByLevel([a, b, c, d, e], languageName);
    expect(groups.map((group) => [group.level, titles(group.sets)])).toEqual([
      ["Klasse 9", ["Unit 3"]],
      ["Klasse 10", ["Unit 1", "Unit 2", "Unité 2"]],
      [undefined, ["Phrasal verbs"]],
    ]);
  });
});
