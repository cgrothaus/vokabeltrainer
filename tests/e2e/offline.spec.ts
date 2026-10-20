// E2E-03 (TDD 15.4): Offline-Start nach dem ersten Laden – AK-21, TAK-11.
import { expect, test } from "@playwright/test";

test("E2E-03 App startet nach dem ersten Laden offline", async ({ page, context }) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "Vokabeltrainer" })).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Vokabeltrainer" })).toBeVisible();

  // Jede Navigation innerhalb der App bekommt die App, auch mit Parametern und Hash-Routen.
  await page.goto("./?quelle=startbildschirm#/unbekannt");
  await expect(page.getByRole("heading", { name: "Seite nicht gefunden" })).toBeVisible();
  await page.getByRole("link", { name: "Zur Bibliothek" }).click();
  await expect(page.getByRole("heading", { name: "Vokabeltrainer" })).toBeVisible();
});
