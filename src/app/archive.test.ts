import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StoredSet } from "../domain/model";
import { openDatabase } from "../storage/database";
import { addSet, getSet, updateSet } from "../storage/sets";
import {
  archiveSets,
  loadLanguageFilter,
  readArchived,
  saveLanguageFilter,
  setLevel,
} from "./archive";

let db: IDBDatabase;

function storedSet(id: string, level?: string): StoredSet {
  return {
    id,
    editCount: 0,
    createdAt: "2026-11-22T08:00:00.000Z",
    updatedAt: "2026-11-22T08:00:00.000Z",
    title: `Set ${id}`,
    termLanguage: "en",
    meaningLanguage: "de",
    ...(level !== undefined && { level }),
    sections: [{ id: "q7h3kd", title: "Text A", entries: [] }],
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

describe("archiveSets", () => {
  it("nennt ein einzelnes Set beim Namen und mehrere mit ihrer Zahl", async () => {
    await addSet(db, storedSet("aaaaaaaaaa"));
    await addSet(db, storedSet("bbbbbbbbbb"));
    expect(await archiveSets(db, ["aaaaaaaaaa"], true, "Unit 1")).toEqual({
      ok: true,
      message: "„Unit 1“ liegt jetzt im Archiv.",
    });
    expect(await archiveSets(db, ["aaaaaaaaaa", "bbbbbbbbbb"], true)).toEqual({
      ok: true,
      message: "2 Sets archiviert. Du findest sie unter „Archiv“.",
    });
    expect(await archiveSets(db, ["aaaaaaaaaa", "bbbbbbbbbb"], false)).toEqual({
      ok: true,
      message: "2 Sets sind wieder in der Bibliothek.",
    });
    expect([...(await readArchived(db))]).toEqual([]);
  });

  it("meldet, wenn es keines der Sets mehr gibt", async () => {
    const outcome = await archiveSets(db, ["aaaaaaaaaa"], true, "Unit 1");
    expect(outcome.ok).toBe(false);
  });
});

describe("setLevel", () => {
  it("gibt allen Sets dieselbe Lernstufe und entfernt sie wieder", async () => {
    await addSet(db, storedSet("aaaaaaaaaa", "Klasse 10"));
    await addSet(db, storedSet("bbbbbbbbbb"));
    expect(await setLevel(db, ["aaaaaaaaaa", "bbbbbbbbbb"], "Klasse 11")).toEqual({
      ok: true,
      message: "2 Sets jetzt in „Klasse 11“.",
    });
    expect((await getSet(db, "bbbbbbbbbb"))?.level).toBe("Klasse 11");
    expect(await setLevel(db, ["aaaaaaaaaa"], undefined)).toEqual({
      ok: true,
      message: "Lernstufe bei 1 Set entfernt.",
    });
    expect((await getSet(db, "aaaaaaaaaa"))?.level).toBeUndefined();
  });

  it("ändert nichts, wenn eines der Sets fehlt", async () => {
    await addSet(db, storedSet("aaaaaaaaaa"));
    const outcome = await setLevel(db, ["aaaaaaaaaa", "unbekannt0"], "B1");
    expect(outcome.ok).toBe(false);
    expect((await getSet(db, "aaaaaaaaaa"))?.level).toBeUndefined();
  });

  it("liest die Sets frisch und übernimmt Änderungen aus einem anderen Fenster", async () => {
    const set = storedSet("aaaaaaaaaa");
    await addSet(db, set);
    await updateSet(db, { ...set, title: "Umbenannt" }, 0, "2026-11-22T09:00:00.000Z");
    expect((await setLevel(db, ["aaaaaaaaaa"], "B1")).ok).toBe(true);
    expect(await getSet(db, "aaaaaaaaaa")).toMatchObject({ title: "Umbenannt", level: "B1" });
  });
});

describe("Sprachfilter", () => {
  it("merkt sich die Wahl, „Alle“ als null", async () => {
    expect(await loadLanguageFilter(db)).toBeUndefined();
    await saveLanguageFilter(db, "fr");
    expect(await loadLanguageFilter(db)).toBe("fr");
    await saveLanguageFilter(db, null);
    expect(await loadLanguageFilter(db)).toBeNull();
  });
});
