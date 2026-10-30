import { describe, expect, it } from "vitest";
import { addEntry, deleteEntry, findEntry, newEntryId, replaceEntry } from "./editSet";
import type { RandomBytes } from "./ids";
import type { StoredEntry, StoredSet } from "./model";

const entry = (id: string, term: string): StoredEntry => ({
  id,
  term: { text: term },
  meanings: [{ text: term.toUpperCase() }],
});

const set: StoredSet = {
  id: "m4x8c2r9tw",
  editCount: 3,
  createdAt: "2026-10-20T18:00:00.000Z",
  updatedAt: "2026-10-21T18:00:00.000Z",
  title: "Englisch – Wetter",
  termLanguage: "en",
  meaningLanguage: "de",
  sections: [
    { id: "s1s1s1", title: "Wetter", entries: [entry("e1e1e1", "rain"), entry("e2e2e2", "sun")] },
    { id: "s2s2s2", title: "Kleidung", entries: [entry("e3e3e3", "coat")] },
  ],
};

/** Reihenfolge der Einträge je Sektion. */
const order = (value: StoredSet | undefined) =>
  value?.sections.map((section) => section.entries.map((item) => item.id));

describe("findEntry", () => {
  it("liefert Eintrag und Sektion", () => {
    expect(findEntry(set, "e3e3e3")).toEqual({
      section: set.sections[1],
      entry: set.sections[1]!.entries[0],
    });
    expect(findEntry(set, "fehlt")).toBeUndefined();
  });
});

describe("replaceEntry", () => {
  it("ersetzt einen Eintrag an seiner Stelle und lässt das Übrige unverändert", () => {
    const changed = { ...entry("e1e1e1", "drizzle"), notes: "leicht" };
    const result = replaceEntry(set, changed, "s1s1s1");
    expect(result?.sections[0]!.entries[0]).toEqual(changed);
    expect(order(result)).toEqual(order(set));
    expect(result?.editCount).toBe(3);
    expect(set.sections[0]!.entries[0]!.term.text).toBe("rain");
  });

  it("verschiebt einen Eintrag ans Ende einer anderen Sektion", () => {
    const result = replaceEntry(set, entry("e1e1e1", "rain"), "s2s2s2");
    expect(order(result)).toEqual([["e2e2e2"], ["e3e3e3", "e1e1e1"]]);
  });

  it("liefert nichts, wenn Eintrag oder Sektion fehlen", () => {
    expect(replaceEntry(set, entry("fehlt", "x"), "s1s1s1")).toBeUndefined();
    expect(replaceEntry(set, entry("e1e1e1", "x"), "fehlt")).toBeUndefined();
  });
});

describe("addEntry", () => {
  it("hängt den Eintrag ans Ende der Sektion", () => {
    expect(order(addEntry(set, "s1s1s1", entry("e4e4e4", "wind")))).toEqual([
      ["e1e1e1", "e2e2e2", "e4e4e4"],
      ["e3e3e3"],
    ]);
    expect(addEntry(set, "fehlt", entry("e4e4e4", "wind"))).toBeUndefined();
  });
});

describe("deleteEntry", () => {
  it("entfernt nur diesen Eintrag", () => {
    expect(order(deleteEntry(set, "e2e2e2"))).toEqual([["e1e1e1"], ["e3e3e3"]]);
    expect(deleteEntry(set, "fehlt")).toBeUndefined();
  });
});

describe("newEntryId", () => {
  it("vergibt eine freie Eintrags-ID mit 6 Zeichen", () => {
    // „e“ steht im Alphabet an Index 12, „2“ an 0: Erst „e2e2e2“ (vergeben), dann „222222“.
    const values = [12, 0, 12, 0, 12, 0, 0, 0, 0, 0, 0, 0];
    let next = 0;
    const random: RandomBytes = (count) =>
      Uint8Array.from({ length: count }, () => values[next++ % values.length]!);
    expect(newEntryId(set, random)).toBe("222222");
  });
});
