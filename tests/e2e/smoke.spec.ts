// Smoke-Test des gebauten Artefakts; die fachlichen Tests E2E-01 bis E2E-04 folgen mit S-10.
import { expect, test } from "@playwright/test";

test("Startseite zeigt die Bibliothek ohne fremde oder fehlgeschlagene Anfragen und Fehler", async ({
  page,
  baseURL,
}) => {
  const origin = new URL(baseURL!).origin;
  const foreign: string[] = [];
  const failed: string[] = [];
  const errors: string[] = [];
  page.on("response", (response) => {
    if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`);
  });
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.protocol !== "data:" && url.origin !== origin) foreign.push(request.url());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto("./");
  await expect(page.getByRole("heading", { name: "Vokabeltrainer" })).toBeVisible();
  // Die Statuszeile zum Speicherschutz erscheint erst, wenn die Datenbank offen ist (FR-22).
  await expect(page.getByText(/dauerhaft/)).toBeVisible();
  // Icons und Manifest lädt der Browser nachgelagert, z. B. favicon.ico ohne <link rel="icon">.
  await page.waitForLoadState("networkidle");

  expect(failed, "Fehlgeschlagene Anfragen").toEqual([]);
  expect(foreign, "Anfragen an fremde Adressen (TAK-02)").toEqual([]);
  expect(errors, "Fehler in der Konsole").toEqual([]);
});

test("Unbekannte Route zeigt einen Hinweis mit Weg zurück", async ({ page }) => {
  await page.goto("./#/unbekannt");
  await expect(page.getByRole("heading", { name: "Seite nicht gefunden" })).toBeVisible();
  await page.getByRole("link", { name: "Zur Bibliothek" }).click();
  await expect(page.getByRole("heading", { name: "Vokabeltrainer" })).toBeVisible();
});
