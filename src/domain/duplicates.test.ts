import { describe, expect, it } from "vitest";
import { duplicateMessage, findDuplicates } from "./duplicates";
import type { StoredSet } from "./model";

let nextId = 0;

/** Ein Set mit einer Sektion; Einträge als Paare aus Wort und Bedeutungen. */
function set(
  title: string,
  pairs: [string, ...string[]][],
  extra: Partial<StoredSet> = {},
): StoredSet {
  return {
    id: `set${nextId++}`.padEnd(10, "x"),
    editCount: 0,
    createdAt: "2026-10-21T08:00:00.000Z",
    updatedAt: "2026-10-21T08:00:00.000Z",
    title,
    termLanguage: "en",
    meaningLanguage: "de",
    sections: [
      {
        id: "sec001",
        title: "Sektion",
        entries: pairs.map(([term, ...meanings], index) => ({
          id: `e${index}`.padEnd(6, "x"),
          term: { text: term },
          meanings: meanings.map((text) => ({ text })),
        })),
      },
    ],
    ...extra,
  };
}

/** Zehn Paare `w0`–`w9` mit Bedeutung `b0`–`b9`; `changed` ersetzt die Bedeutung der ersten Einträge. */
function pairs(count = 10, changed = 0): [string, string][] {
  return Array.from({ length: count }, (_, index) => [
    `w${index}`,
    index < changed ? `anders${index}` : `b${index}`,
  ]);
}

describe("findDuplicates", () => {
  it("meldet ein Set mit genau 80 % gemeinsamen Einträgen", () => {
    const local = set("Alt", pairs());
    const matches = findDuplicates(set("Neu", pairs(10, 2)), [local]);
    expect(matches).toEqual([{ setId: local.id, title: "Alt", sameTitle: false, overlap: 0.8 }]);
  });

  it("meldet nichts knapp unter 80 %", () => {
    expect(findDuplicates(set("Neu", pairs(10, 3)), [set("Alt", pairs())])).toEqual([]);
  });

  it("bezieht die Überschneidung auf das kleinere Set", () => {
    // Das neue Set ist ein Ausschnitt des vorhandenen (oder umgekehrt) – beides zählt.
    const local = set("Alt", pairs(20));
    expect(findDuplicates(set("Neu", pairs(5)), [local])).toMatchObject([{ overlap: 1 }]);
    expect(findDuplicates(set("Neu", pairs(20)), [set("Alt", pairs(5))])).toMatchObject([
      { overlap: 1 },
    ]);
  });

  it("meldet einen gleichen Titel auch ohne gemeinsame Einträge", () => {
    const local = set("Englisch – Wetter", [["rain", "Regen"]]);
    expect(findDuplicates(set("Englisch – Wetter", [["sun", "Sonne"]]), [local])).toEqual([
      { setId: local.id, title: "Englisch – Wetter", sameTitle: true, overlap: 0 },
    ]);
  });

  it("vergleicht Titel ohne Groß-/Kleinschreibung und in NFC", () => {
    const decomposed = "Franz" + String.fromCharCode(0x6f, 0x308) + "sisch"; // o + Trema
    const local = set("Französisch – Wetter", [["pluie", "Regen"]]);
    const candidate = set(`${decomposed.toUpperCase()} – WETTER`, [["soleil", "Sonne"]]);
    expect(findDuplicates(candidate, [local])).toMatchObject([{ sameTitle: true }]);
  });

  it("vergleicht Einträge ohne Groß-/Kleinschreibung und in NFC", () => {
    const local = set("Alt", [["Café", "Kaffee"]]);
    const candidate = set("Neu", [["CAFE" + String.fromCharCode(0x301), "kaffee"]]);
    expect(findDuplicates(candidate, [local])).toMatchObject([{ overlap: 1 }]);
  });

  it("vergleicht nur die erste Bedeutung", () => {
    const local = set("Alt", [["rain", "Regen", "regnen"]]);
    expect(findDuplicates(set("Neu", [["rain", "Regen"]]), [local])).toMatchObject([
      { overlap: 1 },
    ]);
    expect(findDuplicates(set("Neu", [["rain", "regnen", "Regen"]]), [local])).toEqual([]);
  });

  it("berücksichtigt nur Sets mit gleichem Sprachpaar in gleicher Richtung", () => {
    const candidate = set("Wetter", pairs());
    const french = set("Wetter", pairs(), { termLanguage: "fr" });
    const reversed = set("Wetter", pairs(), { termLanguage: "de", meaningLanguage: "en" });
    expect(findDuplicates(candidate, [french, reversed])).toEqual([]);
  });

  it("zählt doppelte Einträge innerhalb eines Sets einmal", () => {
    // Pro Eintrag gezählt wären es 4 von 5 (80 %); als Mengen 1 gemeinsamer von min(2, 5).
    const local = set("Alt", pairs(5));
    const candidate = set("Neu", [
      ["w0", "b0"],
      ["w0", "b0"],
      ["w0", "b0"],
      ["w0", "b0"],
      ["x", "y"],
    ]);
    expect(findDuplicates(candidate, [local])).toEqual([]);
  });

  it("zählt Einträge über alle Sektionen", () => {
    const local = set("Alt", pairs());
    const candidate = set("Neu", []);
    candidate.sections = [
      { id: "secaaa", title: "A", entries: local.sections[0]!.entries.slice(0, 5) },
      { id: "secbbb", title: "B", entries: local.sections[0]!.entries.slice(5) },
    ];
    expect(findDuplicates(candidate, [local])).toMatchObject([{ overlap: 1 }]);
  });

  it("meldet ein leeres Set nur bei gleichem Titel", () => {
    expect(findDuplicates(set("Neu", pairs()), [set("Leer", [])])).toEqual([]);
    expect(findDuplicates(set("Leer", pairs()), [set("Leer", [])])).toMatchObject([
      { sameTitle: true, overlap: 0 },
    ]);
  });

  it("sortiert mehrere Treffer nach Überschneidung", () => {
    const half = set("Wetter", pairs(10, 5));
    const most = set("Alt 1", pairs(10, 1));
    const all = set("Alt 2", pairs());
    const matches = findDuplicates(set("Wetter", pairs()), [half, most, all]);
    expect(matches.map((match) => match.title)).toEqual(["Alt 2", "Alt 1", "Wetter"]);
  });

  it("übernimmt die Ausgabe des vorhandenen Sets", () => {
    const local = set("Alt", pairs(), { edition: "2019" });
    expect(findDuplicates(set("Neu", pairs()), [local])).toMatchObject([{ edition: "2019" }]);
  });
});

describe("duplicateMessage", () => {
  const match = { setId: "x", title: "Englisch – Wetter", sameTitle: true, overlap: 1 };

  it("nennt den Titel des vorhandenen Sets", () => {
    expect(duplicateMessage(match, undefined)).toBe(
      "Dieses Set sieht aus wie „Englisch – Wetter“, das du schon hast.",
    );
  });

  it("nennt die Ausgabe nur, wenn sie sich unterscheidet", () => {
    expect(duplicateMessage({ ...match, edition: "2019" }, "2019")).toBe(
      "Dieses Set sieht aus wie „Englisch – Wetter“, das du schon hast.",
    );
    expect(duplicateMessage({ ...match, edition: "2019" }, "2023")).toBe(
      "Dieses Set sieht aus wie „Englisch – Wetter“, das du schon hast. Die Ausgabe unterscheidet sich: dort „2019“, hier „2023“.",
    );
    expect(duplicateMessage(match, "2023")).toBe(
      "Dieses Set sieht aus wie „Englisch – Wetter“, das du schon hast. Die Ausgabe unterscheidet sich: dort ohne Angabe, hier „2023“.",
    );
    expect(duplicateMessage({ ...match, edition: "2019" }, undefined)).toBe(
      "Dieses Set sieht aus wie „Englisch – Wetter“, das du schon hast. Die Ausgabe unterscheidet sich: dort „2019“, hier ohne Angabe.",
    );
  });
});
