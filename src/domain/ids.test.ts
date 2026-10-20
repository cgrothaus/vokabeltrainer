import { describe, expect, it } from "vitest";
import { assignIds, createId, ID_ALPHABET, type RandomBytes } from "./ids";
import type { NewSet } from "./normalize";

/** Liefert die angegebenen Bytes der Reihe nach und danach immer wieder von vorn. */
function bytes(...values: number[]): RandomBytes {
  let next = 0;
  return (count) => Uint8Array.from({ length: count }, () => values[next++ % values.length]!);
}

/** Reproduzierbare Pseudozufallsbytes (mulberry32) in `0 … range-1`; `crypto` kennt domain/ nicht. */
function seeded(seed: number, range = 256): RandomBytes {
  let state = seed;
  const next = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return (count) => Uint8Array.from({ length: count }, () => Math.floor(next() * range));
}

const random = seeded(2026);

describe("createId", () => {
  it("nutzt nur das Alphabet ohne leicht verwechselbare Zeichen", () => {
    expect(ID_ALPHABET).toBe("23456789abcdefghjkmnpqrstuvwxyz");
    expect(ID_ALPHABET).not.toMatch(/[01ilo]/);
    for (let i = 0; i < 200; i++) expect(createId(12, random)).toMatch(/^[2-9a-hjkmnp-z]{12}$/);
  });

  it("bildet Bytes auf das Alphabet ab", () => {
    expect(createId(6, bytes(0, 1, 30, 31, 62, 247))).toBe("23z22z");
  });

  it("verwirft Bytes ab 248, damit alle Zeichen gleich wahrscheinlich sind", () => {
    expect(createId(3, bytes(248, 255, 0, 250, 1, 2))).toBe("234");
  });
});

describe("assignIds", () => {
  const set: NewSet = {
    title: "T",
    termLanguage: "en",
    meaningLanguage: "de",
    sections: [
      { title: "A", entries: [{ term: { text: "a" }, meanings: [{ text: "b" }] }] },
      {
        id: "q7h3kd",
        title: "B",
        entries: [{ id: "a8f2kc", term: { text: "c" }, meanings: [{ text: "d" }] }],
      },
    ],
  };

  it("vergibt fehlende IDs mit 10 bzw. 6 Zeichen und behält vorhandene", () => {
    const result = assignIds(set, random);
    expect(result.id).toMatch(/^[2-9a-hjkmnp-z]{10}$/);
    expect(result.sections[0]!.id).toMatch(/^[2-9a-hjkmnp-z]{6}$/);
    expect(result.sections[0]!.entries[0]!.id).toMatch(/^[2-9a-hjkmnp-z]{6}$/);
    expect(result.sections[1]!.id).toBe("q7h3kd");
    expect(result.sections[1]!.entries[0]!.id).toBe("a8f2kc");
    expect(result.sections[1]!.entries[0]!.term).toEqual({ text: "c" });
  });

  it("behält eine Set-ID aus der Datei", () => {
    expect(assignIds({ ...set, id: "m4x8c2r9tw" }, random).id).toBe("m4x8c2r9tw");
  });

  it("zieht neu, wenn eine ID im Set schon vergeben ist", () => {
    // Index 0 → „2“; erst „222222“ (wie die vorhandene ID), dann „333333“.
    const existing: NewSet = {
      ...set,
      id: "m4x8c2r9tw",
      sections: [
        { id: "222222", title: "A", entries: [{ term: { text: "a" }, meanings: [{ text: "b" }] }] },
      ],
    };
    const result = assignIds(existing, bytes(0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1));
    expect(result.sections[0]!.entries[0]!.id).toBe("333333");
  });

  it("vergibt innerhalb eines Sets keine ID doppelt", () => {
    const many: NewSet = {
      ...set,
      sections: Array.from({ length: 20 }, () => ({
        title: "S",
        entries: Array.from({ length: 50 }, () => ({
          term: { text: "a" },
          meanings: [{ text: "b" }],
        })),
      })),
    };
    // Nur 4 verschiedene Zeichen (4^6 = 4.096 IDs für 1.020 Objekte) erzwingen viele Kollisionen.
    const result = assignIds(many, seeded(7, 4));
    const ids = result.sections.flatMap((s) => [s.id, ...s.entries.map((e) => e.id)]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
