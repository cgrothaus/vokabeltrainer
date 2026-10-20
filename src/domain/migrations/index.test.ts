import { describe, expect, it } from "vitest";
import { type DataMigration, migrateRecord, storesToMigrate } from "./index";

const chain: DataMigration[] = [
  { version: 2, stores: { sets: (r) => ({ ...(r as object), a: 1 }) } },
  { version: 3, stores: {} },
  {
    version: 4,
    stores: {
      sets: (r) => {
        const { a, ...rest } = r as { a: number };
        return { ...rest, b: a + 1 };
      },
      sessions: (r) => ({ ...(r as object), c: true }),
    },
  },
];

describe("migrateRecord", () => {
  it("lässt den Datensatz unverändert, wenn die Version schon stimmt", () => {
    const record = { id: "x" };
    expect(migrateRecord(chain, "sets", record, 4, 4)).toBe(record);
  });

  it("wendet die Schritte in aufsteigender Reihenfolge an", () => {
    expect(migrateRecord(chain, "sets", { id: "x" }, 1, 4)).toEqual({ id: "x", b: 2 });
  });

  it("beginnt beim Schritt nach der Ausgangsversion", () => {
    expect(migrateRecord(chain, "sets", { id: "x", a: 5 }, 2, 4)).toEqual({ id: "x", b: 6 });
  });

  it("lässt Stores ohne Migration unverändert", () => {
    const record = { key: "theme" };
    expect(migrateRecord(chain, "settings", record, 1, 4)).toBe(record);
  });

  it("findet Schritte unabhängig von ihrer Reihenfolge in der Kette", () => {
    const reversed = [...chain].reverse();
    expect(migrateRecord(reversed, "sets", { id: "x" }, 1, 4)).toEqual({ id: "x", b: 2 });
  });

  it("verlangt für jede Version einen Schritt, auch ohne Datenänderung", () => {
    expect(() => migrateRecord(chain, "sets", {}, 1, 5)).toThrow("Version 5");
  });

  it("lehnt Daten einer neueren Version ab", () => {
    expect(() => migrateRecord(chain, "sets", {}, 4, 2)).toThrow("neuer");
  });

  it("gibt Fehler einer Migration weiter", () => {
    const failing: DataMigration[] = [
      {
        version: 2,
        stores: {
          sets: () => {
            throw new Error("kaputt");
          },
        },
      },
    ];
    expect(() => migrateRecord(failing, "sets", {}, 1, 2)).toThrow("kaputt");
  });
});

describe("storesToMigrate", () => {
  it("nennt alle Stores mit Migrationen im Bereich, jeden einmal", () => {
    expect(storesToMigrate(chain, 1, 4).sort()).toEqual(["sessions", "sets"]);
  });

  it("berücksichtigt nur Schritte nach der Ausgangsversion", () => {
    expect(storesToMigrate(chain, 2, 3)).toEqual([]);
  });

  it("prüft die Vollständigkeit der Kette", () => {
    expect(() => storesToMigrate(chain, 1, 5)).toThrow("Version 5");
  });
});
