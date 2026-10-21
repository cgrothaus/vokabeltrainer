// Backup und Wiederherstellung (S-09): E2E-02 (AK-10, TAK-09), Teilen-Menü (D-17) und Ablehnungen.
// Das Teilen-Menü wird per Init-Skript ersetzt oder entfernt: Ob Chromium und WebKit es anbieten,
// hängt sonst vom Betriebssystem ab (macOS lokal, Linux in der CI).
import { readFile } from "node:fs/promises";
import { type Browser, expect, type Page, test, type TestInfo } from "@playwright/test";
import { collectErrors, importSet, librarySets, readStore, setFile } from "./support";

const STORES = ["sets", "reviewEvents", "sessions", "settings"] as const;

type Shared = { name: string; type: string; text: string } | null;

/** Ohne Teilen-Menü: Das Backup wird heruntergeladen. */
const withoutShare = (page: Page) =>
  page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, "canShare", { value: undefined });
  });

/** Teilen-Menü-Attrappe; hält die geteilte Datei fest oder bricht ab wie beim Schließen des Menüs. */
const withShare = (page: Page, outcome: "share" | "cancel") =>
  page.addInitScript((outcome) => {
    const w = window as unknown as { shared: Shared };
    w.shared = null;
    Object.defineProperty(Navigator.prototype, "canShare", { value: () => true });
    Object.defineProperty(Navigator.prototype, "share", {
      value: async ({ files }: { files: File[] }) => {
        if (outcome === "cancel") throw new DOMException("Abgebrochen", "AbortError");
        const file = files[0]!;
        w.shared = { name: file.name, type: file.type, text: await file.text() };
      },
    });
  }, outcome);

const shared = (page: Page) =>
  page.evaluate(() => (window as unknown as { shared: Shared }).shared);

const lastBackupAt = async (page: Page) =>
  (await readStore<{ key: string; value: unknown }>(page, "meta")).find(
    (record) => record.key === "lastBackupAt",
  )?.value;

const readAll = async (page: Page) =>
  Object.fromEntries(await Promise.all(STORES.map(async (s) => [s, await readStore(page, s)])));

/** Neuer Browserkontext mit demselben Gerät: wie eine frische Installation. */
async function freshPage(browser: Browser, testInfo: TestInfo): Promise<Page> {
  const { defaultBrowserType: _, ...device } = testInfo.project.use as Record<string, unknown>;
  const context = await browser.newContext(device);
  return context.newPage();
}

const emptyBackup = JSON.stringify({
  format: "vokabeltrainer-backup",
  formatVersion: 1,
  dataVersion: 1,
  appVersion: "0.1.0+test",
  exportedAt: "2026-10-20T18:00:00.000Z",
  data: { sets: [], reviewEvents: [], sessions: [], settings: [] },
});

const chooseBackup = (page: Page, content: string) =>
  page.getByLabel("Backup-Datei auswählen").setInputFiles({
    name: "Vokabeltrainer-Backup_2026-10-20.json",
    mimeType: "application/json",
    buffer: Buffer.from(content),
  });

test("E2E-02 Backup → frisches Gerät → Wiederherstellen ergibt denselben Bestand", async ({
  page,
  browser,
}, testInfo) => {
  const errors = collectErrors(page);
  await withoutShare(page);
  await importSet(page, "Englisch – Wetter");
  await page.getByRole("button", { name: "Englisch – Wetter lernen" }).click();
  await page.getByRole("button", { name: /Tippen zum Aufdecken/ }).click();
  await page.getByRole("button", { name: "Gewusst" }).click();
  await expect(page.getByText("1 von 3 geschafft")).toBeVisible();
  await page.getByRole("button", { name: "Beenden" }).click();

  await page.getByRole("link", { name: "Backup und Wiederherstellung" }).click();
  await expect(page.getByText("Noch kein Backup gespeichert.")).toBeVisible();
  const before = await readAll(page);
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Backup speichern" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^Vokabeltrainer-Backup_\d{4}-\d{2}-\d{2}\.json$/);
  const content = await readFile(await download.path(), "utf8");
  const file = JSON.parse(content) as { format: string; exportedAt: string; data: object };
  expect(file.format).toBe("vokabeltrainer-backup");
  expect(file.data).not.toHaveProperty("meta");
  // `exact`: Sonst träfe es auch „Noch kein Backup gespeichert.“
  await expect(page.getByText("Backup gespeichert.", { exact: true })).toBeVisible();
  await expect(page.getByText(/^Letztes Backup: /)).toBeVisible();
  expect(await lastBackupAt(page)).toBe(file.exportedAt);
  expect(errors, "Fehler in der Konsole").toEqual([]);

  const fresh = await freshPage(browser, testInfo);
  const freshErrors = collectErrors(fresh);
  await fresh.goto("./");
  await expect(fresh.getByRole("heading", { name: "Noch keine Vokabelsets" })).toBeVisible();
  await fresh.getByRole("link", { name: "Backup und Wiederherstellung" }).click();
  await chooseBackup(fresh, content);
  await expect(
    fresh.getByText(/^Backup vom .+: 1 Set mit 3 Einträgen, 1 Lernsitzung, 1 Antwort\.$/),
  ).toBeFocused();
  await fresh.getByRole("button", { name: "Alle Daten ersetzen" }).click();
  await expect(fresh.getByText("Backup wiederhergestellt.")).toBeFocused();

  expect(await readAll(fresh)).toEqual(before);
  expect(await lastBackupAt(fresh)).toBe(file.exportedAt);
  await expect(fresh.getByText(/^Letztes Backup: /)).toBeVisible();
  await fresh.getByRole("link", { name: "Zurück zur Bibliothek" }).click();
  await expect(librarySets(fresh)).toHaveText(["Englisch – Wetter 3 Einträge"]);
  expect(freshErrors, "Fehler in der Konsole").toEqual([]);
  await fresh.context().close();
});

test("Backup über das Teilen-Menü", async ({ page }) => {
  await withShare(page, "share");
  await importSet(page, "Englisch – Teilen");
  await page.goto("./#/backup");
  await page.getByRole("button", { name: "Backup speichern" }).click();
  await expect(page.getByText("Backup gespeichert.", { exact: true })).toBeVisible();

  const file = (await shared(page))!;
  expect(file.name).toMatch(/^Vokabeltrainer-Backup_\d{4}-\d{2}-\d{2}\.json$/);
  expect(file.type).toBe("application/json");
  const backup = JSON.parse(file.text) as { format: string; exportedAt: string };
  expect(backup.format).toBe("vokabeltrainer-backup");
  expect(await lastBackupAt(page)).toBe(backup.exportedAt);
});

test("Abbrechen im Teilen-Menü gilt nicht als Backup", async ({ page }) => {
  await withShare(page, "cancel");
  await importSet(page, "Englisch – Abbrechen");
  await page.goto("./#/backup");
  await page.getByRole("button", { name: "Backup speichern" }).click();
  await expect(page.getByText("Backup nicht gespeichert.", { exact: true })).toBeVisible();
  await expect(page.getByText("Noch kein Backup gespeichert.")).toBeVisible();
  expect(await lastBackupAt(page)).toBeUndefined();
});

test("Vokabelset statt Backup und Abbrechen ändern nichts", async ({ page }) => {
  const errors = collectErrors(page);
  await importSet(page, "Englisch – Bleibt");
  await page.goto("./#/backup");

  await chooseBackup(page, setFile("Englisch – Falsch"));
  await expect(page.getByRole("alert")).toContainText(
    "Das ist ein Vokabelset, kein Backup. Ein Vokabelset wird importiert, nicht wiederhergestellt.",
  );
  await expect(page.getByRole("button", { name: "Alle Daten ersetzen" })).toHaveCount(0);

  await chooseBackup(page, emptyBackup);
  await expect(page.getByRole("alert")).toBeEmpty();
  await expect(
    page.getByText(
      "Backup vom 20. Oktober 2026: 0 Sets mit 0 Einträgen, 0 Lernsitzungen, 0 Antworten.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Abbrechen" }).click();
  await expect(page.getByRole("button", { name: "Alle Daten ersetzen" })).toHaveCount(0);

  await page.getByRole("link", { name: "Zurück zur Bibliothek" }).click();
  await expect(librarySets(page)).toHaveText(["Englisch – Bleibt 3 Einträge"]);
  expect(errors, "Fehler in der Konsole").toEqual([]);
});
