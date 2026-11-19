// E2E-22 Speicherschutz und Installation (S-26, S-43, TDD 5.1, 6.6, FR-31, FR-35, AK-20, AK-28):
// Hinweise in der Bibliothek, Stand in den Einstellungen, Anfragen nach dauerhaftem Speicher, das
// Installationsangebot von Chromium. Gerät, `persist()` und `beforeinstallprompt` werden gespielt
// (`fakeDevice`, `fakeInstallPrompt`); ob Safari und Chrome sich so verhalten, prüft der Gerätecheck (15.5).
import { readFile } from "node:fs/promises";
import { type Browser, expect, type Page, test, type TestInfo } from "@playwright/test";
import {
  backButton,
  changeDevice,
  collectErrors,
  fakeDevice,
  fakeInstallPrompt,
  importSet,
  installPrompts,
  readDevice,
  readStore,
} from "./support";

const hint = (page: Page) => page.locator(".hints .hint");
const emptyHeading = (page: Page) =>
  page.getByRole("heading", { name: "Lerne Vokabeln mit Karteikarten" });

async function openSettings(page: Page): Promise<void> {
  await page.getByRole("link", { name: "Einstellungen" }).click();
  await expect(page.getByRole("heading", { name: "Einstellungen", level: 1 })).toBeVisible();
}

/** Wartet, bis die Bibliothek ihre Hinweise geprüft hat. */
const hintsChecked = (page: Page) =>
  expect(page.locator(".hints")).not.toHaveAttribute("aria-busy");

test("E2E-22 iOS im Browser: Anleitung schon im Empty State, mit Sets „Schützen“ samt Umzug per Backup", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await fakeDevice(page, { ios: true });
  await page.goto("./");
  await expect(emptyHeading(page)).toBeVisible();
  // Die Schritte stehen sichtbar über dem Einstieg, nichts zum Aufklappen.
  const card = page.getByRole("region", { name: "Zuerst auf den Home-Bildschirm" });
  await expect(card).toContainText(
    "Im Browser löscht dein iPhone die Vokabeln, wenn du ein paar Tage nicht lernst.",
  );
  await expect(card.getByRole("listitem")).toHaveText([
    "Tippe in Safari auf Teilen (manchmal hinter „···“) und wähle Zum Home-Bildschirm. „Als Web-App öffnen“ bleibt an.",
    "Öffne den Vokabeltrainer über das neue Symbol und leg dort los.",
  ]);

  await importSet(page, "Englisch – Wetter");
  await expect(hint(page)).toHaveText("Im Browser kann dein iPhone die Vokabeln löschen.Schützen");
  const protect = hint(page).getByRole("button", { name: "Schützen" });
  await protect.click();
  const sheet = page.getByRole("dialog", { name: "Auf den Home-Bildschirm" });
  await expect(sheet.getByRole("listitem")).toHaveCount(3);
  await expect(sheet.getByRole("listitem").first()).toHaveText("Speichere hier ein Backup.");
  await page.keyboard.press("Escape");
  await expect(protect).toBeFocused();
  await protect.click();
  await sheet.getByRole("link", { name: "Erst Backup speichern" }).click();
  await expect(page.getByRole("heading", { name: "Backup und Wiederherstellung" })).toBeVisible();
  expect(errors, "Fehler in der Konsole").toEqual([]);
});

test("E2E-22 Ohne dauerhaften Speicher: Hinweis auf Backups erst mit Sets, Einstellungen nennen den Stand", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await fakeDevice(page, {});
  await page.goto("./");
  await expect(emptyHeading(page)).toBeVisible();
  await hintsChecked(page);
  await expect(hint(page)).toHaveCount(0);

  await importSet(page, "Englisch – Wetter");
  // Nach dem ersten Set einmal angefragt (6.6), hier abgelehnt.
  await expect.poll(async () => (await readDevice(page)).asked).toBe(1);
  await expect(hint(page)).toHaveText(
    "Deine Daten sind auf diesem Gerät nicht dauerhaft geschützt.Backup",
  );
  await openSettings(page);
  await expect(
    page.getByText("Deine Daten sind auf diesem Gerät nicht dauerhaft geschützt."),
  ).toBeVisible();
  // Ohne Angebot des Browsers kein Installieren.
  await expect(page.getByRole("button", { name: "Als App installieren" })).toHaveCount(0);

  // Im Browser-Tab wird nicht erneut gefragt.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Einstellungen", level: 1 })).toBeVisible();
  expect((await readDevice(page)).asked).toBe(1);
  expect(errors, "Fehler in der Konsole").toEqual([]);
});

test("E2E-22 Gewährter Speicher: kein Hinweis, auch nicht auf iOS", async ({ page }) => {
  await fakeDevice(page, { ios: true, granted: true });
  await importSet(page, "Englisch – Wetter");
  // Erst wenn die Hinweise geprüft sind, sagt ihr Fehlen etwas.
  await expect(page.locator(".hints")).not.toHaveAttribute("aria-busy", "true");
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
  await backButton(page).click();
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
  await expect(emptyHeading(app)).toBeVisible();
  await hintsChecked(app);
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
  await backButton(app).click();
  await expect(app.getByRole("link", { name: "Englisch – Wetter", exact: true })).toBeVisible();
  await expect(hint(app)).toHaveCount(0);
  expect(errors, "Fehler in der Konsole").toEqual([]);
  await app.context().close();
});

const installRow = (page: Page) =>
  page.locator(".hint", { hasText: "Als App installieren? Deine Vokabeln kommen mit." });

test("E2E-22 Installation anbieten: einmal in der Bibliothek, „Später“ bleibt, auch in den Einstellungen", async ({
  page,
}) => {
  const errors = collectErrors(page);
  // Wie Chrome auf Android: Speicher schon im Browser gewährt, Installation angeboten (S-11, 5.1).
  await fakeDevice(page, { granted: true });
  await fakeInstallPrompt(page);
  await page.goto("./");
  await expect(emptyHeading(page)).toBeVisible();
  await hintsChecked(page);
  // Ohne Set kein Angebot in der Bibliothek.
  await expect(installRow(page)).toHaveCount(0);

  await importSet(page, "Englisch – Wetter");
  await expect(installRow(page)).toBeVisible();
  await installRow(page).getByRole("button", { name: "Installieren" }).click();
  await expect.poll(() => installPrompts(page)).toBe(1);
  // Ein Angebot lässt sich nur einmal zeigen; abgelehnt, kommt es beim nächsten Laden wieder.
  await expect(installRow(page)).toHaveCount(0);
  await page.reload();
  await expect(installRow(page)).toBeVisible();

  await installRow(page).getByRole("button", { name: "Später" }).click();
  await expect(installRow(page)).toHaveCount(0);
  await expect
    .poll(async () => (await readStore<{ key: string }>(page, "meta")).map((m) => m.key))
    .toContain("installOfferDismissedAt");
  await page.reload();
  await hintsChecked(page);
  await page.waitForTimeout(200);
  await expect(installRow(page)).toHaveCount(0);

  // In den Einstellungen bleibt der Weg, auch bei gewährtem Speicher.
  await openSettings(page);
  await page.getByRole("button", { name: "Als App installieren" }).click();
  await expect.poll(() => installPrompts(page)).toBe(1);
  expect(errors, "Fehler in der Konsole").toEqual([]);
});

test("E2E-22 Nicht geschützt mit Angebot: „Installieren“ im Hinweis statt eigener Zeile; nach der Installation nichts", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await fakeDevice(page, {});
  await fakeInstallPrompt(page, "accepted");
  await importSet(page, "Englisch – Wetter");
  await expect(hint(page).getByRole("button", { name: "Installieren" })).toBeVisible();
  await expect(installRow(page)).toHaveCount(0);

  await page.evaluate(() => window.dispatchEvent(new Event("appinstalled")));
  await expect(hint(page).getByRole("button", { name: "Installieren" })).toHaveCount(0);
  await expect(hint(page)).toHaveText(
    "Deine Daten sind auf diesem Gerät nicht dauerhaft geschützt.Backup",
  );
  expect(errors, "Fehler in der Konsole").toEqual([]);
});
