import { describe, expect, it } from "vitest";
import type { StoredSection, StoredSet } from "./model";
import {
  countOptions,
  defaultSetup,
  describeSetup,
  effectiveCount,
  fitCount,
  pickAcross,
  pickEntries,
  type PracticeSetup,
  restoreSetup,
  restoreTogether,
  selectedEntryCount,
  settingKey,
  storedSetup,
  togetherEntryCount,
  togetherSetIds,
} from "./practiceSetup";

/** Liefert die angegebenen Werte der Reihe nach und danach immer wieder von vorn. */
function sequence(...values: number[]): () => number {
  let next = 0;
  return () => values[next++ % values.length]!;
}

function section(id: string, entries: number): StoredSection {
  return {
    id,
    title: `Sektion ${id}`,
    entries: Array.from({ length: entries }, (_, index) => ({
      id: `${id}${index}`,
      term: { text: `${id} ${index}` },
      meanings: [{ text: `Bedeutung ${index}` }],
    })),
  };
}

function storedSet(...sections: StoredSection[]): StoredSet {
  return {
    id: "m4x8c2r9tw",
    editCount: 0,
    createdAt: "2026-10-22T08:00:00.000Z",
    updatedAt: "2026-10-22T08:00:00.000Z",
    title: "Englisch – Alltag",
    termLanguage: "en",
    meaningLanguage: "de",
    sections,
  };
}

const set = storedSet(section("a", 12), section("b", 8), section("c", 5));

describe("settingKey", () => {
  it("legt die Einrichtung pro Set ab", () => {
    expect(settingKey("m4x8c2r9tw")).toBe("practice:m4x8c2r9tw");
  });
});

describe("defaultSetup", () => {
  it("wählt alle Sektionen, Lernsprache → Muttersprache und 20 Vokabeln", () => {
    expect(defaultSetup(set)).toEqual({
      sectionIds: ["a", "b", "c"],
      direction: "termToMeaning",
      count: 20,
      mcShare: 25,
    });
  });

  it("ergibt bei weniger Einträgen alle", () => {
    const small = storedSet(section("a", 12));
    expect(fitCount(defaultSetup(small).count, 12)).toBe("all");
    expect(effectiveCount(defaultSetup(small).count, 12)).toBe(12);
  });
});

describe("restoreSetup", () => {
  it("nimmt ohne gemerkte Einrichtung die Voreinstellung", () => {
    expect(restoreSetup(set, undefined)).toEqual(defaultSetup(set));
  });

  it("übernimmt eine gemerkte Einrichtung", () => {
    const stored = { sections: ["c", "a"], direction: "mixed", count: 20, mcShare: 40 };
    expect(restoreSetup(set, stored)).toEqual({
      // Reihenfolge wie im Set, nicht wie gemerkt.
      sectionIds: ["a", "c"],
      direction: "mixed",
      count: 20,
      mcShare: 40,
    });
    expect(restoreSetup(set, { ...stored, mcShare: 0 }).mcShare).toBe(0);
    expect(restoreSetup(set, { ...stored, mcShare: 100 }).mcShare).toBe(100);
  });

  it("wählt bei „alle Sektionen“ auch später hinzugekommene", () => {
    const stored = { sections: "all", direction: "meaningToTerm", count: "all" };
    const grown = storedSet(section("a", 12), section("b", 8), section("c", 5), section("d", 3));
    expect(restoreSetup(grown, stored).sectionIds).toEqual(["a", "b", "c", "d"]);
  });

  it("lässt Sektionen weg, die es nicht mehr gibt, und Doppelte", () => {
    const stored = { sections: ["x", "b", "b"], direction: "termToMeaning", count: 10 };
    expect(restoreSetup(set, stored).sectionIds).toEqual(["b"]);
  });

  it("wählt alle Sektionen, wenn keine gemerkte mehr existiert", () => {
    const stored = { sections: ["x", "y"], direction: "termToMeaning", count: 10 };
    expect(restoreSetup(set, stored).sectionIds).toEqual(["a", "b", "c"]);
  });

  it("ersetzt unbrauchbare Teile einzeln durch die Voreinstellung", () => {
    expect(restoreSetup(set, { sections: 3, direction: "sideways", count: 15 })).toEqual(
      defaultSetup(set),
    );
    expect(restoreSetup(set, { sections: ["b"], direction: "sideways" })).toEqual({
      sectionIds: ["b"],
      direction: "termToMeaning",
      count: 20,
      mcShare: 25,
    });
    // Nur ganze Prozent in Schritten des Reglers.
    for (const mcShare of [-5, 105, 33, 12.5, "25", null, Number.NaN]) {
      expect(restoreSetup(set, { sections: "all", mcShare }).mcShare).toBe(25);
    }
    for (const broken of [null, "practice", 42, [], { sections: [1, null] }]) {
      expect(restoreSetup(set, broken)).toEqual(defaultSetup(set));
    }
  });
});

describe("storedSetup", () => {
  it("merkt „alle Sektionen“ als solches, sonst die gewählten", () => {
    const all: PracticeSetup = {
      sectionIds: ["a", "b", "c"],
      direction: "mixed",
      count: 10,
      mcShare: 25,
    };
    expect(storedSetup(set, all)).toEqual({
      sections: "all",
      direction: "mixed",
      count: 10,
      mcShare: 25,
    });
    const some: PracticeSetup = {
      sectionIds: ["b"],
      direction: "termToMeaning",
      count: "all",
      mcShare: 0,
    };
    expect(storedSetup(set, some)).toEqual({
      sections: ["b"],
      direction: "termToMeaning",
      count: "all",
      mcShare: 0,
    });
  });

  it("ergibt beim Wiederherstellen dieselbe Einrichtung", () => {
    const setup: PracticeSetup = {
      sectionIds: ["a", "c"],
      direction: "meaningToTerm",
      count: 30,
      mcShare: 55,
    };
    expect(restoreSetup(set, storedSetup(set, setup))).toEqual(setup);
  });
});

describe("selectedEntryCount", () => {
  it("zählt die Einträge der gewählten Sektionen", () => {
    expect(selectedEntryCount(set, ["a", "c"])).toBe(17);
    expect(selectedEntryCount(set, [])).toBe(0);
  });
});

describe("countOptions und fitCount", () => {
  it("bietet nur Stufen unter der verfügbaren Zahl, dann „alle“", () => {
    expect(countOptions(0)).toEqual(["all"]);
    expect(countOptions(8)).toEqual(["all"]);
    expect(countOptions(10)).toEqual(["all"]);
    expect(countOptions(11)).toEqual([10, "all"]);
    expect(countOptions(25)).toEqual([10, 20, "all"]);
    expect(countOptions(40)).toEqual([10, 20, 30, "all"]);
  });

  it("zeigt eine Stufe, die nicht mehr angeboten wird, als „alle“", () => {
    expect(fitCount(20, 15)).toBe("all");
    expect(fitCount(20, 20)).toBe("all");
    expect(fitCount(20, 21)).toBe(20);
    expect(fitCount("all", 3)).toBe("all");
  });

  it("rechnet die Anzahl der Karten aus", () => {
    expect(effectiveCount("all", 17)).toBe(17);
    expect(effectiveCount(10, 17)).toBe(10);
    expect(effectiveCount(20, 17)).toBe(17);
  });
});

describe("pickEntries", () => {
  const ids = (sectionId: string) =>
    set.sections.find((candidate) => candidate.id === sectionId)!.entries.map((entry) => entry.id);

  it("nimmt bei „alle“ jeden Eintrag der gewählten Sektionen in Set-Reihenfolge", () => {
    const setup: PracticeSetup = {
      sectionIds: ["a", "c"],
      direction: "termToMeaning",
      count: "all",
      mcShare: 25,
    };
    expect(pickEntries(set, setup, sequence(0.5))).toEqual([...ids("a"), ...ids("c")]);
  });

  it("wählt eine zufällige Teilmenge nur aus den gewählten Sektionen, ohne Doppelte", () => {
    const setup: PracticeSetup = {
      sectionIds: ["b", "c"],
      direction: "mixed",
      count: 10,
      mcShare: 25,
    };
    const picked = pickEntries(set, setup, sequence(0.7, 0.1, 0.4, 0.9, 0.3));
    expect(picked).toHaveLength(10);
    expect(new Set(picked).size).toBe(10);
    const allowed = [...ids("b"), ...ids("c")];
    expect(picked.every((id) => allowed.includes(id))).toBe(true);
    // Nicht einfach die ersten zehn.
    expect(picked).not.toEqual(allowed.slice(0, 10));
  });

  it("nimmt alle, wenn die Stufe größer ist als die Auswahl", () => {
    const setup: PracticeSetup = {
      sectionIds: ["c"],
      direction: "termToMeaning",
      count: 10,
      mcShare: 25,
    };
    expect(pickEntries(set, setup, sequence(0.5))).toEqual(ids("c"));
  });
});

describe("describeSetup", () => {
  const names = (code: string) => ({ en: "Englisch", de: "Deutsch" })[code] ?? code;
  const base: PracticeSetup = {
    sectionIds: ["a", "b", "c"],
    direction: "termToMeaning",
    count: 20,
    mcShare: 25,
  };

  it("fasst die gemerkte Einrichtung zusammen", () => {
    expect(describeSetup(set, base, names)).toEqual([
      "20 Vokabeln",
      "Englisch → Deutsch",
      "alle Sektionen",
      "25 % Multiple Choice",
    ]);
  });

  it("nennt die tatsächliche Anzahl und die gewählten Sektionen", () => {
    expect(
      describeSetup(set, { ...base, sectionIds: ["c"], direction: "meaningToTerm" }, names),
    ).toEqual(["5 Vokabeln", "Deutsch → Englisch", "Sektion c", "25 % Multiple Choice"]);
    expect(
      describeSetup(
        set,
        { ...base, sectionIds: ["a", "c"], count: "all", direction: "mixed", mcShare: 0 },
        names,
      ),
    ).toEqual(["17 Vokabeln", "Gemischt", "2 Sektionen", "nur Karteikarten"]);
    expect(describeSetup(set, { ...base, mcShare: 100 }, names).at(-1)).toBe("nur Multiple Choice");
  });

  it("lässt die Sektionen bei nur einer weg", () => {
    const single = storedSet(section("a", 1));
    expect(describeSetup(single, { ...base, sectionIds: ["a"] }, names)).toEqual([
      "1 Vokabel",
      "Englisch → Deutsch",
      "25 % Multiple Choice",
    ]);
  });
});

describe("Zusammen lernen (TDD 12.10)", () => {
  const first = storedSet(section("a", 3), section("b", 2));
  const second = { ...storedSet(section("a", 4)), id: "p7k2v9q4zd", title: "Zwei" };
  const third = { ...storedSet(section("c", 1)), id: "q3w8e5r1ty", title: "Drei" };
  const candidates = [first, second, third];

  it("liest die gemerkten Sets tolerant", () => {
    expect(togetherSetIds({ setIds: ["x", 3, "y", "x"] })).toEqual(["x", "y"]);
    expect(togetherSetIds({ setIds: "x" })).toEqual([]);
    expect(togetherSetIds(null)).toEqual([]);
  });

  it("wählt die gemerkten Sets in der Reihenfolge der Bibliothek, unbekannte fallen weg", () => {
    const stored = {
      setIds: [third.id, "gelöscht", first.id],
      direction: "mixed",
      count: 10,
      mcShare: 50,
    };
    expect(restoreTogether(candidates, stored)).toEqual({
      setIds: [first.id, third.id],
      direction: "mixed",
      count: 10,
      mcShare: 50,
    });
  });

  it("wählt ohne passende gemerkte Sets alle und ersetzt Unbrauchbares durch die Voreinstellung", () => {
    const stored = { setIds: ["anderes"], direction: "seitwärts", count: 7, mcShare: 33 };
    expect(restoreTogether(candidates, stored)).toEqual({
      setIds: [first.id, second.id, third.id],
      direction: "termToMeaning",
      count: 20,
      mcShare: 25,
    });
    expect(restoreTogether(candidates, undefined).setIds).toHaveLength(3);
  });

  it("zählt und zieht Einträge über die gewählten Sets, gleiche Eintrags-IDs bleiben getrennt", () => {
    const setup = {
      setIds: [first.id, second.id],
      direction: "termToMeaning",
      count: "all",
      mcShare: 0,
    } as const;
    expect(togetherEntryCount(candidates, setup.setIds)).toBe(9);
    const all = pickAcross(candidates, setup, sequence(0.5));
    expect(all).toHaveLength(9);
    expect(all.filter((ref) => ref.entryId === "a0").map((ref) => ref.setId)).toEqual([
      first.id,
      second.id,
    ]);
    // Eine Stufe über der Auswahl nimmt alle.
    expect(pickAcross(candidates, { ...setup, count: 10 }, sequence(0.3))).toHaveLength(9);
  });

  it("zieht bei kleinerer Anzahl eine zufällige Teilmenge", () => {
    const big = { ...storedSet(section("z", 12)), id: "z9z9z9z9z9" };
    const setup = {
      setIds: [big.id, second.id],
      direction: "termToMeaning",
      count: 10,
      mcShare: 0,
    } as const;
    const drawn = pickAcross([big, second], setup, sequence(0.1, 0.9, 0.4));
    expect(drawn).toHaveLength(10);
    expect(new Set(drawn.map((ref) => `${ref.setId}/${ref.entryId}`)).size).toBe(10);
  });
});
