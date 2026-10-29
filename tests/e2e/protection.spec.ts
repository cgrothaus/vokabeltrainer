// E2E-22 Speicherschutz (S-26, TDD 6.6, FR-31, AK-20): Hinweise in der Bibliothek, Stand in den
// Einstellungen, Anfragen nach dauerhaftem Speicher. Gerät und `persist()` werden gespielt
// (`fakeDevice`); ob Safari und Chrome sich so verhalten, prüft der Gerätecheck (15.5).
import { readFile } from "node:fs/promises";
import { type Browser, expect, type Page, test, type TestInfo } from "@playwright/test";
import {
  changeDevice,
  collectErrors,
  fakeDevice,
  importSet,
  libraryMessage,
  readDevice,
} from "./support";

const hint = (page: Page) => page.locator(".hint");
const installSteps = (page: Page) => hint(page).getByRole("listitem");

async function openSettings(page: Page): Promise<void> {
  await page.getByRole("link", { name: "Einstellungen" }).click();
  await expect(page.getByRole("heading", { name: "Einstellungen", level: 1 })).toBeVisible();
}

test("E2E-22 iOS im Browser: Anleitung schon im Empty State, mit Sets samt Umzug per Backup", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await fakeDevice(page, { ios: true });
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "Noch keine Vokabelsets" })).toBeVisible();
  await expect(hint(page)).toContainText(
    "Im Browser kann iOS deine Daten löschen, wenn du die App einige Tage nicht nutzt.",
  );
  await page.getByText("So kommt die App auf den Home-Bildschirm").click();
  await expect(installSteps(page)).toHaveText([
    "Tippe auf „Teilen“ (je nach Ansicht hinter „…“) und wähle „Zum Home-Bildschirm“, dann „Hinzufügen“.",
    "Öffne die App über das neue Symbol auf dem Home-Bildschirm.",
  ]);

  await importSet(page, "Englisch – Wetter");
  await page.getByText("So kommt die App auf den Home-Bildschirm").click();
  await expect(installSteps(page)).toHaveCount(4);
  await expect(installSteps(page).first()).toContainText("eigenen Speicher");
  await hint(page).getByRole("link", { name: "Backup" }).click();
  await expect(page.getByRole("heading", { name: "Backup und Wiederherstellung" })).toBeVisible();
  expect(errors, "Fehler in der Konsole").toEqual([]);
});

test("E2E-22 Ohne dauerhaften Speicher: Hinweis auf Backups erst mit Sets, Einstellungen nennen den Stand", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await fakeDevice(page, {});
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "Noch keine Vokabelsets" })).toBeVisible();
  await expect(hint(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Dauerhaften Speicher anfordern" })).toHaveCount(0);

  await importSet(page, "Englisch – Wetter");
  // Nach dem ersten Set einmal angefragt (6.6), hier abgelehnt.
  await expect.poll(async () => (await readDevice(page)).asked).toBe(1);
  await expect(hint(page)).toHaveText(
    "Deine Daten sind auf diesem Gerät nicht dauerhaft geschützt. Speichere deshalb regelmäßig ein Backup.",
  );
  await openSettings(page);
  await expect(
    page.getByText("Deine Daten sind auf diesem Gerät nicht dauerhaft geschützt."),
  ).toBeVisible();

  // Im Browser-Tab wird nicht erneut gefragt.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Einstellungen", level: 1 })).toBeVisible();
  expect((await readDevice(page)).asked).toBe(1);
  expect(errors, "Fehler in der Konsole").toEqual([]);
});

test("E2E-22 Gewährter Speicher: kein Hinweis, auch nicht auf iOS", async ({ page }) => {
  await fakeDevice(page, { ios: true, granted: true });
  await importSet(page, "Englisch – Wetter");
  await expect(libraryMessage(page)).toBeVisible();
  await expect(hint(page)).toHaveCount(0);
  await openSettings(page);
  await expect(
    page.getByText("Deine Daten sind auf diesem Gerät dauerhaft geschützt."),
  ).toBeVisible();
});

test("E2E-22 Installiert: Beim Start wird erneut gefragt, danach kein Hinweis", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await fakeDevice(page, { grantsWhenInstalled: true });
  await importSet(page, "Englisch – Wetter");
  await expect.poll(async () => (await readDevice(page)).asked).toBe(1);
  await expect(hint(page)).toBeVisible();

  await changeDevice(page, { installed: true });
  await page.reload();
  await expect.poll(async () => (await readDevice(page)).asked).toBe(2);
  await openSettings(page);
  await expect(
    page.getByText("Deine Daten sind auf diesem Gerät dauerhaft geschützt."),
  ).toBeVisible();
  await page.getByRole("link", { name: "Zurück zur Bibliothek" }).click();
  await expect(page.getByRole("link", { name: "Englisch – Wetter", exact: true })).toBeVisible();
  await expect(hint(page)).toHaveCount(0);
  expect(errors, "Fehler in der Konsole").toEqual([]);
});

/** Neuer Browserkontext mit demselben Gerät: wie die frisch installierte App mit eigenem Speicher. */
async function freshPage(browser: Browser, testInfo: TestInfo): Promise<Page> {
  const { defaultBrowserType: _, ...device } = testInfo.project.use as Record<string, unknown>;
  const context = await browser.newContext(device);
  return context.newPage();
}

test("E2E-22 Umzug auf den Home-Bildschirm: Nach dem Wiederherstellen wird gefragt", async ({
  page,
  browser,
}, testInfo) => {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, "canShare", { value: undefined });
  });
  await fakeDevice(page, { ios: true });
  await importSet(page, "Englisch – Wetter");
  // Im Safari-Tab gewährt iOS nichts (S-11).
  await expect.poll(() => readDevice(page)).toMatchObject({ asked: 1, granted: false });
  await page.goto("./#/backup");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Backup speichern" }).click(),
  ]);
  const content = await readFile(await download.path(), "utf8");

  const app = await freshPage(browser, testInfo);
  const errors = collectErrors(app);
  await fakeDevice(app, { ios: true, installed: true, grantsWhenInstalled: true });
  await app.goto("./");
  await expect(app.getByRole("heading", { name: "Noch keine Vokabelsets" })).toBeVisible();
  await expect(hint(app)).toHaveCount(0);
  await app.goto("./#/backup");
  await app.getByLabel("Backup-Datei auswählen").setInputFiles({
    name: "Vokabeltrainer-Backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(content),
  });
  await app.getByRole("button", { name: "Wiederherstellen", exact: true }).click();
  await expect(app.getByText("Backup wiederhergestellt.")).toBeFocused();
  await expect.poll(async () => readDevice(app)).toMatchObject({ asked: 1, granted: true });
  await app.getByRole("link", { name: "Zurück zur Bibliothek" }).click();
  await expect(app.getByRole("link", { name: "Englisch – Wetter", exact: true })).toBeVisible();
  await expect(hint(app)).toHaveCount(0);
  expect(errors, "Fehler in der Konsole").toEqual([]);
  await app.context().close();
});
