// Smoke-Test des gebauten Artefakts; die fachlichen Tests E2E-01 bis E2E-04 folgen mit S-10.
import { expect, test } from "@playwright/test";

test("Startseite zeigt die Bibliothek ohne fremde Anfragen und Fehler", async ({
  page,
  baseURL,
}) => {
  const origin = new URL(baseURL!).origin;
  const foreign: string[] = [];
  const errors: string[] = [];
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

  expect(foreign, "Anfragen an fremde Adressen (TAK-02)").toEqual([]);
  expect(errors, "Fehler in der Konsole").toEqual([]);
});

test("Unbekannte Route zeigt einen Hinweis mit Weg zurück", async ({ page }) => {
  await page.goto("./#/unbekannt");
  await expect(page.getByRole("heading", { name: "Seite nicht gefunden" })).toBeVisible();
  await page.getByRole("link", { name: "Zur Bibliothek" }).click();
  await expect(page.getByRole("heading", { name: "Vokabeltrainer" })).toBeVisible();
});
