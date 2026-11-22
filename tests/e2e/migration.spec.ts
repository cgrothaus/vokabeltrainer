// Übernahme älterer Stände im gebauten Artefakt (E2E-04, TDD 7.4, 15.4, AK-24, TAK-08): Eine
// Datenbank der Version 1, wie sie die ausgelieferte App hinterlassen hat, und ein Backup der
// Version 1 sind nach dem Update nutzbar. Beides kommt aus den Fixtures v1 (TDD 15.3).
import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import type { ReviewEvent, Session, StoredSet } from "../../src/domain/model";
import { collectErrors, endPractice, readStore, startLearning } from "./support";

interface DbFixture {
  dbVersion: number;
  stores: Record<string, { keyPath: string; indexes: Record<string, string>; records: unknown[] }>;
}

const fixture = (path: string) =>
  readFileSync(new URL(`../fixtures/${path}`, import.meta.url), "utf8");
const dbV1 = JSON.parse(fixture("db/v1.json")) as DbFixture;
const backupV1 = fixture("backup/v1.json");

const SAMPLE = "Englisch – Grundwortschatz (Beispielset)";
const WEATHER = "Englisch – Wetter";

/** Datenbanken der Seite mit Version, z. B. um eine Sicherungskopie zu bemerken. */
const databases = (page: Page) =>
  page.evaluate(async () =>
    (await indexedDB.databases()).map(({ name, version }) => ({ name, version })),
  );

/** Antworten und Sitzungen, die es im Fixture noch nicht gab. */
const added = <T extends { id: string }>(records: T[], store: string) => {
  const known = new Set((dbV1.stores[store]!.records as T[]).map((record) => record.id));
  return records.filter((record) => !known.has(record.id));
};

test("E2E-04 Die App übernimmt eine Datenbank der Version 1", async ({ page }) => {
  const errors = collectErrors(page);
  // Vor dem Code der App: Öffnungsanfragen bearbeitet der Browser der Reihe nach, die App hebt die
  // Datenbank also erst an, wenn sie in Version 1 mit allen Datensätzen besteht. Nur beim ersten Laden.
  await page.addInitScript((fixture: DbFixture) => {
    if (localStorage.getItem("e2e-seeded")) return;
    localStorage.setItem("e2e-seeded", "1");
    const request = indexedDB.open("vokabeltrainer", fixture.dbVersion);
    request.onupgradeneeded = () => {
      for (const [name, store] of Object.entries(fixture.stores)) {
        const objectStore = request.result.createObjectStore(name, { keyPath: store.keyPath });
        for (const [index, keyPath] of Object.entries(store.indexes))
          objectStore.createIndex(index, keyPath);
        for (const record of store.records) objectStore.add(record);
      }
    };
    request.onsuccess = () => request.result.close();
  }, dbV1);
  await page.goto("./");

  // Sets, Lernstand und Darstellung „Dunkel“ aus Version 1 sind da.
  await expect(page.getByRole("link", { name: SAMPLE, exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: WEATHER, exact: true })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await databases(page)).toEqual([{ name: "vokabeltrainer", version: 2 }]);
  // Ohne Datenumwandlung bleiben die Datensätze, wie sie waren (D-68).
  expect(await readStore<StoredSet>(page, "sets")).toEqual(dbV1.stores.sets!.records);
  expect(await readStore<Session>(page, "sessions")).toEqual(dbV1.stores.sessions!.records);
  await page.getByRole("link", { name: WEATHER, exact: true }).click();
  await expect(page.locator(".overview .stages li")).toHaveCount(2);

  // Weiterlernen: Die neue Antwort trägt ihre Dauer, die neue Sitzung ihre Herkunft.
  await startLearning(page, WEATHER);
  await page.locator(".flash:not(.flipped) .front").click();
  await page.getByRole("button", { name: "Gewusst", exact: true }).click();
  await expect(page.getByText("1 von 3 geschafft")).toBeVisible();
  await expect
    .poll(async () => added(await readStore<ReviewEvent>(page, "reviewEvents"), "reviewEvents"))
    .toHaveLength(1);
  const [answer] = added(await readStore<ReviewEvent>(page, "reviewEvents"), "reviewEvents");
  expect(answer!.responseMs).toBeGreaterThanOrEqual(1000);
  const [session] = added(await readStore<Session>(page, "sessions"), "sessions");
  expect(session!.origin).toBe("setup");
  await endPractice(page);
  // Keine Sicherungskopie: Version 2 wandelt nichts um (TDD 7.3).
  expect(await databases(page)).toEqual([{ name: "vokabeltrainer", version: 2 }]);
  expect(errors).toEqual([]);
});

test("E2E-04 Die App stellt ein Backup der Version 1 wieder her", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("./#/backup");
  await page.getByLabel("Backup-Datei auswählen").setInputFiles({
    name: "Vokabeltrainer-Backup_2026-11-02.json",
    mimeType: "application/json",
    buffer: Buffer.from(backupV1),
  });
  await page.getByRole("button", { name: "Wiederherstellen", exact: true }).click();
  await expect(page.getByText("Backup wiederhergestellt.")).toBeFocused();
  const data = (JSON.parse(backupV1) as { data: { sets: StoredSet[] } }).data;
  expect(await readStore<StoredSet>(page, "sets")).toEqual(data.sets);
  await page.goto("./");
  await expect(page.getByRole("link", { name: SAMPLE, exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: WEATHER, exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
