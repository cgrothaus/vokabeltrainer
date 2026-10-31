// Set- und Sektionsexport (S-32): E2E-25 (FR-18). Teilen-Menü und Zwischenablage werden per
// Init-Skript ersetzt: Ob Chromium und WebKit sie anbieten, hängt sonst vom Betriebssystem ab.
import { readFile } from "node:fs/promises";
import { type Browser, expect, type Page, test, type TestInfo } from "@playwright/test";
import type { StoredSet } from "../../src/domain/model";
import { collectErrors, importText, readStore } from "./support";

const TITLE = "Englisch – Stadt";

/** Zwei Sektionen, damit sich ein Teil wählen lässt. */
const twoSections = JSON.stringify({
  format: "vokabeltrainer-set",
  formatVersion: 1,
  set: { title: TITLE, termLanguage: "en", meaningLanguage: "de", level: "Klasse 6" },
  sections: [
    {
      title: "Unterwegs",
      entries: [
        { term: "bus stop", meanings: ["Bushaltestelle"] },
        { term: { text: "autumn", acceptedVariants: ["fall"] }, meanings: ["Herbst"] },
      ],
    },
    {
      title: "Einkaufen",
      entries: [
        { term: "money", meanings: ["Geld"] },
        { term: "apple", meanings: ["Apfel"] },
      ],
    },
  ],
});

interface ExportedFile {
  exportedAt: string;
  scope: { type: string; sectionIds?: string[] };
  set: { id: string; rev: string; title: string };
  sections: { id: string; rev: string; title: string; entries: { id: string; rev: string }[] }[];
}

type Shared = { name: string; type: string; text: string } | null;

/** Teilen-Menü-Attrappe; hält die geteilte Datei fest. */
const withShare = (page: Page) =>
  page.addInitScript(() => {
    const w = window as unknown as { shared: Shared };
    w.shared = null;
    Object.defineProperty(Navigator.prototype, "canShare", { value: () => true });
    Object.defineProperty(Navigator.prototype, "share", {
      value: async ({ files }: { files: File[] }) => {
        const file = files[0]!;
        w.shared = { name: file.name, type: file.type, text: await file.text() };
      },
    });
  });

/** Ohne Teilen-Menü; die Zwischenablage nimmt Text an oder lehnt ab. */
const withClipboard = (page: Page, accepts: boolean) =>
  page.addInitScript((accepts) => {
    const w = window as unknown as { copied: string | null };
    w.copied = null;
    Object.defineProperty(Navigator.prototype, "canShare", { value: undefined });
    Object.defineProperty(Navigator.prototype, "clipboard", {
      configurable: true,
      get: () => ({
        writeText: async (text: string) => {
          if (!accepts) throw new DOMException("Abgelehnt", "NotAllowedError");
          w.copied = text;
        },
      }),
    });
  }, accepts);

const SAVED = `„${TITLE}“ mit 4 Einträgen gespeichert.`;

async function openExport(page: Page): Promise<void> {
  await page.getByRole("link", { name: TITLE, exact: true }).click();
  await page.getByRole("link", { name: "Exportieren" }).click();
  await expect(page.getByRole("heading", { level: 1, name: TITLE })).toBeVisible();
}

/** Neuer Browserkontext mit demselben Gerät: wie ein anderes Gerät. */
async function freshPage(browser: Browser, testInfo: TestInfo): Promise<Page> {
  const { defaultBrowserType: _, ...device } = testInfo.project.use as Record<string, unknown>;
  const context = await browser.newContext(device);
  return context.newPage();
}

test("E2E-25 Ganzes Set exportieren → Datei mit Kennungen; ein anderes Gerät übernimmt dasselbe Set", async ({
  page,
  browser,
}, testInfo) => {
  const errors = collectErrors(page);
  await withShare(page);
  await importText(page, twoSections, SAVED);
  await openExport(page);
  await expect(page.getByText("Ganzes Set: 2 Sektionen mit 4 Einträgen.")).toBeVisible();
  await page.getByRole("button", { name: "Datei speichern" }).click();
  await expect(page.getByText("Datei geteilt.")).toBeVisible();

  const shared = await page.evaluate(() => (window as unknown as { shared: Shared }).shared);
  expect(shared?.name).toMatch(/^Englisch – Stadt_\d{4}-\d{2}-\d{2}\.json$/);
  expect(shared?.type).toBe("application/json");
  const file = JSON.parse(shared!.text) as ExportedFile;
  const [stored] = await readStore<StoredSet>(page, "sets");
  expect(file.scope).toEqual({ type: "set" });
  expect(file.set).toMatchObject({ id: stored!.id, title: TITLE, rev: expect.any(String) });
  expect(file.sections.map((section) => section.entries.map((entry) => entry.id))).toEqual(
    stored!.sections.map((section) => section.entries.map((entry) => entry.id)),
  );
  expect(file.sections.flatMap((section) => section.entries).every((entry) => entry.rev)).toBe(
    true,
  );
  expect(shared!.text).not.toMatch(/editCount|createdAt|reviewEvents/);

  // Auf demselben Gerät erkennt die App das Set wieder; unverändert gibt es nichts zu übernehmen.
  await page.goto("./#/import");
  await page.getByLabel("Text einfügen").fill(shared!.text);
  await page.getByRole("button", { name: "Prüfen" }).click();
  await expect(page.getByText("Die Datei enthält keine Änderungen.")).toBeVisible();
  expect(await readStore(page, "sets")).toHaveLength(1);
  expect(errors, "Fehler in der Konsole").toEqual([]);

  const other = await freshPage(browser, testInfo);
  await importText(other, shared!.text, SAVED);
  const [copy] = await readStore<StoredSet>(other, "sets");
  expect(copy).toMatchObject({ id: stored!.id, sections: stored!.sections });
  await other.context().close();
});

test("Einzelne Sektion als Download und als kopierter Text", async ({ page }) => {
  const errors = collectErrors(page);
  await withClipboard(page, true);
  await importText(page, twoSections, SAVED);
  await openExport(page);

  await page.getByRole("radio", { name: "Einzelne Sektionen" }).check();
  await expect(page.getByText("Wähle mindestens eine Sektion.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Datei speichern" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Text kopieren" })).toBeDisabled();
  await expect(page.getByText(/nicht als neues Set importieren/)).toBeVisible();
  await page.getByRole("checkbox", { name: /Einkaufen/ }).check();
  await expect(page.getByText("Ausgewählt: 1 Sektion mit 2 Einträgen.")).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Datei speichern" }).click(),
  ]);
  // WebKit unter Linux (CI) ersetzt Leerzeichen im Namen eines Downloads durch Unterstriche.
  expect(download.suggestedFilename()).toMatch(
    /^Englisch[ _]–[ _]Stadt_Einkaufen_\d{4}-\d{2}-\d{2}\.json$/,
  );
  await expect(page.getByText("Datei gespeichert.")).toBeVisible();
  const file = JSON.parse(await readFile(await download.path(), "utf8")) as ExportedFile;
  const [stored] = await readStore<StoredSet>(page, "sets");
  const shopping = stored!.sections[1]!;
  expect(file.scope).toEqual({ type: "sections", sectionIds: [shopping.id] });
  expect(file.sections.map((section) => section.title)).toEqual(["Einkaufen"]);

  await page.getByRole("button", { name: "Text kopieren" }).click();
  await expect(page.getByText("Text kopiert.")).toBeVisible();
  const copied = await page.evaluate(() => (window as unknown as { copied: string }).copied);
  const { exportedAt: _, ...content } = JSON.parse(copied) as ExportedFile;
  const { exportedAt: __, ...fromFile } = file;
  expect(content).toEqual(fromFile);

  // Darunter die Korrekturvorlage mit dem Link auf die Formatbeschreibung (D-44).
  await page.getByRole("button", { name: "Korrekturvorlage kopieren" }).click();
  await expect(page.getByText("Korrekturvorlage kopiert.", { exact: true })).toBeVisible();
  const prompt = await page.evaluate(() => (window as unknown as { copied: string }).copied);
  expect(prompt).toMatch(/formatspezifikation\.md\n.*korrigiere/);
  expect(errors, "Fehler in der Konsole").toEqual([]);
});

test("Scheitert das Kopieren, steht der Text markiert zum Kopieren da", async ({ page }) => {
  await withClipboard(page, false);
  await importText(page, twoSections, SAVED);
  await openExport(page);
  await page.getByRole("button", { name: "Text kopieren" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Kopieren hat nicht geklappt" }),
  ).toBeVisible();
  const area = page.getByRole("textbox", { name: "Text zum Kopieren" });
  await expect(area).toBeFocused();
  const text = await area.inputValue();
  expect(JSON.parse(text)).toMatchObject({ scope: { type: "set" }, set: { title: TITLE } });
  expect(
    await area.evaluate(
      (element: HTMLTextAreaElement) => element.selectionEnd - element.selectionStart,
    ),
  ).toBe(text.length);
});
