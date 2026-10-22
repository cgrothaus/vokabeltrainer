import { describe, expect, it } from "vitest";
import type { StoredSection, StoredSet } from "./model";
import {
  countOptions,
  defaultSetup,
  effectiveCount,
  fitCount,
  pickEntries,
  type PracticeSetup,
  restoreSetup,
  selectedEntryCount,
  settingKey,
  storedSetup,
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
  it("wählt alle Sektionen, Lernsprache → Muttersprache und alle Einträge", () => {
    expect(defaultSetup(set)).toEqual({
      sectionIds: ["a", "b", "c"],
      direction: "termToMeaning",
      count: "all",
      mcShare: 25,
    });
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
      count: "all",
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
