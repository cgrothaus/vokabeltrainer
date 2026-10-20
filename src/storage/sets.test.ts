import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StoredSet } from "../domain/model";
import { openDatabase } from "./database";
import { addSet, getSet, listSets } from "./sets";

let db: IDBDatabase;

function storedSet(id: string, title = "Englisch – Wetter"): StoredSet {
  return {
    id,
    editCount: 0,
    createdAt: "2026-10-20T18:00:00.000Z",
    updatedAt: "2026-10-20T18:00:00.000Z",
    title,
    termLanguage: "en",
    meaningLanguage: "de",
    sections: [
      {
        id: "q7h3kd",
        title: "Wetter",
        entries: [
          { id: "a8f2kc", term: { text: "rain" }, meanings: [{ text: "Regen" }] },
          {
            id: "p3z7rn",
            term: { text: "autumn", acceptedVariants: ["fall"] },
            meanings: [{ text: "Herbst" }],
          },
        ],
      },
    ],
  };
}

beforeEach(async () => {
  indexedDB = new IDBFactory();
  const result = await openDatabase({ appVersion: "test" });
  if (!result.ok) throw new Error(result.reason);
  db = result.db;
});

afterEach(() => {
  db.close();
  vi.restoreAllMocks();
});

describe("addSet", () => {
  it("speichert ein Set so, wie es gelesen wird", async () => {
    const set = storedSet("m4x8c2r9tw");
    expect(await addSet(db, set)).toEqual({ ok: true });
    expect(await getSet(db, "m4x8c2r9tw")).toEqual(set);
    expect(await listSets(db)).toEqual([set]);
  });

  it("überschreibt nie ein vorhandenes Set mit derselben ID", async () => {
    await addSet(db, storedSet("m4x8c2r9tw", "Erstes"));
    expect(await addSet(db, storedSet("m4x8c2r9tw", "Zweites"))).toEqual({
      ok: false,
      reason: "exists",
    });
    expect(await listSets(db)).toEqual([storedSet("m4x8c2r9tw", "Erstes")]);
  });

  it("meldet einen vollen Speicher", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const full = {
      transaction: () => {
        throw new DOMException("Speicher voll", "QuotaExceededError");
      },
    } as unknown as IDBDatabase;
    expect(await addSet(full, storedSet("a"))).toEqual({ ok: false, reason: "quota" });
  });

  it("meldet andere Fehler und speichert nichts", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    db.close();
    expect(await addSet(db, storedSet("a"))).toEqual({ ok: false, reason: "failed" });
    expect(error).toHaveBeenCalled();
  });
});

describe("getSet und listSets", () => {
  it("liefert nichts für unbekannte IDs und eine leere Liste ohne Sets", async () => {
    expect(await getSet(db, "unbekannt")).toBeUndefined();
    expect(await listSets(db)).toEqual([]);
  });
});
