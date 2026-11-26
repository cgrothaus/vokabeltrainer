// E2E-37 (TDD 15.4): Erklärungen für Kinder und Eltern – Hilfe aus den Einstellungen (Lernplan mit
// Elternabschnitt, „Über den Vokabeltrainer“), Hinweise an Lernstufe, Varianten, Wortformen und Regler,
// Link aus der Einrichtung – FR-44, D-74.
import { expect, test } from "@playwright/test";
import { collectErrors, goToSetup, importSet, setAction } from "./support";

test("E2E-37 Hilfe aus den Einstellungen: Lernplan mit Eltern-Abschnitt und „Über den Vokabeltrainer“", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto("./#/settings");
  await page.getByRole("link", { name: "Wie lerne ich mit dem Plan?" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Wie lerne ich mit dem Plan?");
  await expect(page.getByRole("list", { name: "Pause je Fach" }).getByRole("listitem")).toHaveCount(
    5,
  );
  await expect(
    page.getByRole("heading", { name: "Erst erkennen, dann sagen, dann schreiben" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Für Eltern" })).toBeVisible();
  await expect(page.getByText("Lernkartei nach Leitner")).toBeVisible();

  // Vom Elternabschnitt zur Seite über die App und von dort zurück zum Lernplan.
  await page.getByRole("link", { name: "Über den Vokabeltrainer" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Über den Vokabeltrainer");
  await expect(page.getByRole("heading", { name: "Deine Daten bleiben hier" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Der KI-Chat" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Backup und Wiederherstellung" })).toHaveAttribute(
    "href",
    "#/backup",
  );
  await page.getByRole("link", { name: "Wie lerne ich mit dem Plan?" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Wie lerne ich mit dem Plan?");
  expect(errors).toEqual([]);
});

test("E2E-37 Hinweise: Lernstufe im leeren Set, Varianten und Wortformen im Eintrag, Regler in der Einrichtung", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto("./#/new-set");
  await page.getByText("Weitere Angaben").click();
  await expect(page.getByRole("textbox", { name: "Lernstufe" })).toHaveAccessibleDescription(
    /„Klasse 6“/,
  );

  await importSet(page, "Wetter");
  await goToSetup(page, "Wetter");
  await expect(page.getByRole("slider", { name: "Multiple Choice" })).toHaveAccessibleDescription(
    /Antworten zur Auswahl/,
  );
  await page.getByRole("link", { name: "Wie funktioniert das?" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Wie lerne ich mit dem Plan?");

  // Zurück zur Set-Ansicht, dort über das Menü zum Eintragsformular.
  await page.goBack();
  await page.goBack();
  await setAction(page, "Bearbeiten");
  await page.locator(".edit-entries a").filter({ hasText: "rain" }).click();
  await expect(page.getByRole("group", { name: "Wort", exact: true })).toHaveAccessibleDescription(
    /„grey“ neben „gray“/,
  );
  await page.getByText("Weitere Angaben").click();
  await expect(page.getByRole("group", { name: "Wortformen" })).toHaveAccessibleDescription(
    /go, went, gone/,
  );
  expect(errors).toEqual([]);
});
