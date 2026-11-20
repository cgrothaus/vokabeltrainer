// App-Rahmen (S-40): E2E-27 – „Zurück“ in der App-Leiste geht wie der Browser im Verlauf zurück, ohne
// vorige Ansicht zur übergeordneten; der Abschluss eines Ablaufs ersetzt den Verlaufseintrag; das Blatt
// schließt mit Escape und Tippen daneben; Hinweisleiste über der Aktionsleiste; breitere Spalte auf
// Tablets (TDD 3.2, 13.7, D-45).
import { readFile } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";
import type { StoredSet } from "../../src/domain/model";
import {
  checkText,
  backButton,
  collectErrors,
  importSet,
  libraryMessage,
  readStore,
  setAction,
} from "./support";

const TITLE = "Englisch – Rahmen";

const heading = (page: Page) => page.getByRole("heading", { level: 1 });

async function openSet(page: Page): Promise<void> {
  await page.getByRole("link", { name: TITLE, exact: true }).click();
  await expect(heading(page)).toHaveText(TITLE);
}

test("E2E-27 Zurück geht im Verlauf zurück, Vorwärts wieder hin", async ({ page }) => {
  const errors = collectErrors(page);
  await importSet(page, TITLE);
  await openSet(page);
  await setAction(page, "Exportieren");
  await expect(page.getByText("Exportieren", { exact: true })).toBeVisible();

  await backButton(page).click();
  await expect(heading(page)).toHaveText(TITLE);
  await backButton(page).click();
  await expect(heading(page)).toHaveText("Vokabeltrainer");
  // Die Bibliothek hat kein „Zurück“.
  await expect(backButton(page)).toHaveCount(0);
  await page.goForward();
  await expect(heading(page)).toHaveText(TITLE);
  expect(errors, "Fehler in der Konsole").toEqual([]);
});

test("E2E-27 Einstieg per Link: Zurück führt zur übergeordneten Ansicht und bleibt in der App", async ({
  page,
}) => {
  await importSet(page, TITLE);
  const [set] = await readStore<StoredSet>(page, "sets");
  const id = encodeURIComponent(set!.id);
  // Eine neue Seite ohne Verlauf in der App, wie nach dem Öffnen eines Links.
  const fresh = await page.context().newPage();
  const errors = collectErrors(fresh);
  await fresh.goto(`./#/export/${id}`);
  await expect(fresh.getByText("Exportieren", { exact: true })).toBeVisible();

  await backButton(fresh).click();
  await expect(heading(fresh)).toHaveText(TITLE);
  expect(new URL(fresh.url()).hash).toBe(`#/set/${id}`);
  // Auch nach dem Neuladen weiß die App, dass es davor nichts gibt.
  await fresh.reload();
  await expect(heading(fresh)).toHaveText(TITLE);
  await backButton(fresh).click();
  await expect(heading(fresh)).toHaveText("Vokabeltrainer");
  expect(new URL(fresh.url()).hash).toBe("#/");
  expect(errors, "Fehler in der Konsole").toEqual([]);
});

test("E2E-27 Nach dem Abgleich eines bekannten Sets führt Zurück zur Bibliothek, nicht zum Import", async ({
  page,
}) => {
  // Ohne Teilen-Menü, damit der Export als Download kommt.
  await page.addInitScript(() =>
    Object.defineProperty(Navigator.prototype, "canShare", { value: undefined }),
  );
  const errors = collectErrors(page);
  await importSet(page, TITLE);
  await openSet(page);
  await setAction(page, "Exportieren");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Datei speichern" }).click(),
  ]);
  const file = JSON.parse(await readFile(await download.path(), "utf8"));
  file.sections[0].entries[0].meanings = ["Nieselregen"];

  await page.goto("./");
  await page.getByRole("link", { name: "Vokabelset hinzufügen" }).click();
  await checkText(page, JSON.stringify(file, null, 2));
  await page.getByRole("button", { name: "Übernehmen" }).click();
  await expect(heading(page)).toHaveText(TITLE);
  await expect(page.getByRole("main").getByRole("status")).toHaveText(
    `„${TITLE}“ aktualisiert: 1 geändert.`,
  );

  await backButton(page).click();
  await expect(heading(page)).toHaveText("Vokabeltrainer");
  expect(errors, "Fehler in der Konsole").toEqual([]);
});

test("E2E-27 Blatt: Escape, Tippen daneben und Abbrechen schließen, der Fokus kehrt zurück", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await importSet(page, TITLE);
  await openSet(page);
  // Gelöscht wird über das Menü „···“; dorthin kehrt der Fokus zurück (TDD 13.7).
  const start = page.getByRole("banner").getByRole("button", { name: "Weitere Aktionen" });
  const sheet = page.getByRole("dialog", { name: "Set löschen?" });

  await setAction(page, "Set löschen");
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText(/^Gelöscht werden 1 Sektion mit 3 Einträgen/)).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  await expect(start).toBeFocused();

  await setAction(page, "Set löschen");
  await expect(sheet).toBeVisible();
  // Oben links liegt nur der abgedunkelte Rand.
  await page.mouse.click(5, 5);
  await expect(sheet).toHaveCount(0);
  await expect(start).toBeFocused();

  await setAction(page, "Set löschen");
  await sheet.getByRole("button", { name: "Abbrechen" }).click();
  await expect(sheet).toHaveCount(0);
  await expect(start).toBeEnabled();
  await expect(start).toBeFocused();
  expect(await readStore(page, "sets")).toHaveLength(1);

  await setAction(page, "Set löschen");
  await sheet.getByRole("button", { name: "Set mit 3 Einträgen löschen" }).click();
  await expect(libraryMessage(page)).toHaveText(`„${TITLE}“ gelöscht.`);
  expect(errors, "Fehler in der Konsole").toEqual([]);
});

test("E2E-27 Hinweisleiste über der Aktionsleiste; auf Tablets breitere Spalte", async ({
  page,
}) => {
  await importSet(page, TITLE);
  await openSet(page);
  const dock = page.locator(".dock");
  await expect(dock.getByRole("link", { name: `${TITLE} frei lernen` })).toBeVisible();

  // Wie eine Meldung nach einem Speicherfehler (TDD 6.5); hier geht es nur um die Lage.
  await page.evaluate(() => {
    const paragraph = document.createElement("p");
    paragraph.textContent = "Probe für die Lage der Hinweisleiste.";
    document.getElementById("storage-notice")!.append(paragraph);
  });
  const notice = page.locator("#storage-notice");
  await expect(notice).not.toBeEmpty();
  // Die Leiste misst die Aktionsleiste erst nach dem nächsten Zeichnen.
  await expect
    .poll(async () => (await notice.boundingBox())!.y + (await notice.boundingBox())!.height)
    .toBeLessThanOrEqual((await dock.boundingBox())!.y + 1);

  await page.setViewportSize({ width: 768, height: 1024 });
  const main = await page.getByRole("main").boundingBox();
  expect(main!.width).toBeGreaterThan(600);
  const bar = await dock.locator(".bar").boundingBox();
  expect(Math.abs(bar!.x + bar!.width / 2 - 384)).toBeLessThan(2);
  expect(bar!.width).toBeLessThan(main!.width);
});
