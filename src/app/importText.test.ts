import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { exportSetFile } from "../domain/exportSet";
import { NO_DECISIONS } from "../domain/merge";
import type { ReviewEvent, StoredSet } from "../domain/model";
import { type StoreRecords, validateRecords } from "../domain/validateRecords";
import { readStores } from "../storage/backup";
import { openDatabase } from "../storage/database";
import { recordAnswer, startSession } from "../storage/sessions";
import { addSet, getSet, updateSet } from "../storage/sets";
import { type KnownPreview, previewImport, saveKnownImport } from "./importText";

let db: IDBDatabase;

const set: StoredSet = {
  id: "m4x8c2r9tw",
  editCount: 2,
  createdAt: "2026-10-20T18:00:00.000Z",
  updatedAt: "2026-10-21T18:00:00.000Z",
  title: "Englisch – Wetter",
  termLanguage: "en",
  meaningLanguage: "de",
  sections: [
    {
      id: "q7h3kd",
      title: "Wetter",
      entries: [
        { id: "a8f2kc", term: { text: "rain" }, meanings: [{ text: "Regen" }] },
        { id: "b3c4d5", term: { text: "snow" }, meanings: [{ text: "Schnee" }] },
      ],
    },
  ],
};

type Json = Record<string, any>;
const exported = (): Json =>
  JSON.parse(JSON.stringify(exportSetFile(set, { type: "set" }, new Date("2026-10-30T12:00:00Z"))));

const STORES = ["sets", "reviewEvents", "sessions", "settings"] as const;
const readAll = () => readStores(db, STORES) as Promise<StoreRecords>;

async function known(text: string): Promise<KnownPreview> {
  const outcome = await previewImport(db, text);
  if (!outcome.ok || outcome.kind !== "known")
    throw new Error("keine Vorschau für ein bekanntes Set");
  return outcome;
}

beforeEach(async () => {
  indexedDB = new IDBFactory();
  const opened = await openDatabase({ appVersion: "test" });
  if (!opened.ok) throw new Error(opened.reason);
  db = opened.db;
  await addSet(db, set);
});

afterEach(() => db.close());

describe("previewImport für ein bekanntes Set", () => {
  it("vergleicht mit dem Bestand und schreibt nichts (TAK-06)", async () => {
    const file = exported();
    file.sections[0].entries[0].notes = "neu";
    const before = await readAll();
    const preview = await known(JSON.stringify(file));
    expect(preview.local).toEqual(set);
    expect(preview.diffs.update.counts.changed).toBe(1);
    expect(preview.diffs.replace.counts.changed).toBe(1);
    expect(await readAll()).toEqual(before);
  });

  it("lehnt einen widersprüchlichen Scope ab", async () => {
    const file = exported();
    file.scope = { type: "sections", sectionIds: ["zzzzzz"] };
    const outcome = await previewImport(db, JSON.stringify(file));
    expect(outcome.ok).toBe(false);
  });
});

describe("saveKnownImport", () => {
  it("speichert das Ergebnis mit erhöhtem editCount und meldet, was übernommen wurde", async () => {
    const file = exported();
    file.sections[0].entries[0].notes = "neu";
    file.sections[0].entries.push({ term: "fog", meanings: ["Nebel"] });
    const preview = await known(JSON.stringify(file));
    const outcome = await saveKnownImport(db, preview, "update", NO_DECISIONS);
    expect(outcome).toEqual({
      ok: true,
      setId: set.id,
      message: "„Englisch – Wetter“ aktualisiert: 1 geändert, 1 neu.",
    });
    const saved = await getSet(db, set.id);
    expect(saved?.editCount).toBe(3);
    expect(saved?.sections[0]!.entries.map((entry) => entry.term.text)).toEqual([
      "rain",
      "snow",
      "fog",
    ]);
    expect(saved?.sections[0]!.entries[0]!.notes).toBe("neu");
  });

  it("schreibt nichts, wenn das Set seit der Vorschau geändert wurde, und rechnet neu (TAK-07)", async () => {
    const file = exported();
    file.sections[0].entries[0].notes = "aus der Datei";
    const preview = await known(JSON.stringify(file));
    const edited: StoredSet = {
      ...set,
      sections: [
        {
          ...set.sections[0]!,
          entries: [
            { ...set.sections[0]!.entries[0]!, notes: "aus einem anderen Tab" },
            set.sections[0]!.entries[1]!,
          ],
        },
      ],
    };
    expect((await updateSet(db, edited, 2, "2026-10-31T00:00:00.000Z")).ok).toBe(true);
    const before = await readAll();

    const outcome = await saveKnownImport(db, preview, "update", NO_DECISIONS);
    if (outcome.ok || !("stale" in outcome)) throw new Error("keine neue Vorschau");
    expect(outcome.stale.notice).toBe(
      "Das Set wurde inzwischen geändert. Prüfe die Vorschau noch einmal.",
    );
    expect(outcome.stale.local.editCount).toBe(3);
    expect(outcome.stale.diffs.update.counts.conflict).toBe(1);
    expect(await readAll()).toEqual(before);
  });

  it("meldet ein inzwischen gelöschtes Set, ohne etwas zu schreiben", async () => {
    const preview = await known(JSON.stringify(exported()));
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("sets", "readwrite");
      transaction.objectStore("sets").delete(set.id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    const outcome = await saveKnownImport(db, preview, "replace", NO_DECISIONS);
    expect(outcome.ok).toBe(false);
    expect(await getSet(db, set.id)).toBeUndefined();
  });

  it("behält beim Ersetzen die Antworten gelöschter Einträge; der Bestand bleibt gültig", async () => {
    await startSession(db, {
      id: "s2345678abcd",
      setId: set.id,
      sectionIds: ["q7h3kd"],
      startedAt: "2026-10-22T18:00:00.000Z",
      status: "active",
      config: { direction: "termToMeaning", count: 2, mcShare: 0 },
    });
    const answer: ReviewEvent = {
      id: "e23456789abc",
      sessionId: "s2345678abcd",
      setId: set.id,
      entryId: "b3c4d5",
      entryRev: "xq6g2dsd",
      occurredAt: "2026-10-22T18:01:00.000Z",
      direction: "termToMeaning",
      mode: "flashcard",
      result: "correct",
      firstAttempt: true,
    };
    await recordAnswer(db, answer);
    const file = exported();
    file.sections[0].entries.splice(1, 1);
    const preview = await known(JSON.stringify(file));
    expect(preview.diffs.replace.counts.removed).toBe(1);

    const outcome = await saveKnownImport(db, preview, "replace", NO_DECISIONS);
    expect(outcome).toMatchObject({
      ok: true,
      message: "„Englisch – Wetter“ ersetzt: 1 gelöscht.",
    });
    const records = await readAll();
    expect(records.reviewEvents).toEqual([answer]);
    expect(validateRecords(records)).toEqual([]);
  });
});
