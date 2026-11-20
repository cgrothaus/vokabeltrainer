// Eintragseditor (S-30, S-45): E2E-07 – Einträge ändern, ergänzen und löschen; die Änderung
// bleibt nach dem Neuladen. Zurück mit Änderungen fragt nach (TDD 10, FR-04, FR-05, AK-03, D-41).
import { expect, type Page, test } from "@playwright/test";
import type { StoredSet } from "../../src/domain/model";
import { backButton, collectErrors, importSet, readStore, setAction } from "./support";

const TITLE = "Englisch – Wetter";

/** Öffnet „Set bearbeiten“ aus der Bibliothek über die Set-Ansicht. */
async function openEditing(page: Page, title: string): Promise<void> {
  await page.getByRole("link", { name: title, exact: true }).click();
  await setAction(page, "Bearbeiten");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`${title} bearbeiten`);
}

const entryLinks = (page: Page) => page.locator(".edit-entries a");
const field = (page: Page, group: string) =>
  page.getByRole("group", { name: group, exact: true }).getByLabel("Text", { exact: true });

test("E2E-07: Eintrag ändern und ergänzen – nach dem Neuladen da", async ({ page }) => {
  const errors = collectErrors(page);
  await importSet(page, TITLE);
  await openEditing(page, TITLE);

  await entryLinks(page).filter({ hasText: "autumn" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Eintrag bearbeiten");
  await expect(field(page, "Wort")).toHaveValue("autumn");
  await expect(page.getByRole("textbox", { name: "Variante 1 von „Wort“" })).toHaveValue("fall");
  await page.getByRole("button", { name: "Bedeutung hinzufügen" }).click();
  await expect(field(page, "Bedeutung 2")).toBeFocused();
  await field(page, "Bedeutung 2").fill("Spätjahr");
  await page.getByText("Weitere Angaben").click();
  await page.getByLabel("Notiz").fill("amerikanisch: fall");
  await page.getByRole("button", { name: "Speichern", exact: true }).click();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`${TITLE} bearbeiten`);
  await expect(entryLinks(page)).toHaveText([
    "rain – Regen",
    "sun – Sonne",
    "autumn – Herbst; Spätjahr",
  ]);

  // Neue Einträge nacheinander abtippen.
  await page.getByRole("link", { name: "Eintrag hinzufügen zu „Wetter“" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Neuer Eintrag");
  await field(page, "Wort").fill("wind");
  await field(page, "Bedeutung").fill("Wind");
  await page.getByRole("button", { name: "Speichern und nächster Eintrag" }).click();
  await expect(page.getByText("„wind“ gespeichert.", { exact: false })).toBeVisible();
  await expect(field(page, "Wort")).toHaveValue("");
  await expect(field(page, "Wort")).toBeFocused();
  await field(page, "Wort").fill("snow");
  await field(page, "Bedeutung").fill("Schnee");
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(entryLinks(page)).toHaveText([
    "rain – Regen",
    "sun – Sonne",
    "autumn – Herbst; Spätjahr",
    "wind – Wind",
    "snow – Schnee",
  ]);

  await page.reload();
  await expect(entryLinks(page)).toHaveCount(5);
  await backButton(page).click();
  await page.getByText("Wetter", { exact: true }).click();
  await expect(page.getByText("Notiz: amerikanisch: fall")).toBeVisible();
  await expect(page.getByText("autumn (auch: fall) – Herbst; Spätjahr")).toBeVisible();

  const [set] = await readStore<StoredSet>(page, "sets");
  expect(set!.editCount).toBe(3);
  expect(set!.sections[0]!.entries[2]).toMatchObject({
    term: { text: "autumn", acceptedVariants: ["fall"] },
    meanings: [{ text: "Herbst" }, { text: "Spätjahr" }],
    notes: "amerikanisch: fall",
  });
  expect(errors).toEqual([]);
});

test("E2E-07: Pflichtfeld leer – Meldung, nichts gespeichert", async ({ page }) => {
  await importSet(page, TITLE);
  await openEditing(page, TITLE);
  await entryLinks(page).filter({ hasText: "rain" }).click();
  await field(page, "Wort").fill(" ");
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  const alert = page.getByRole("main").getByRole("alert").first();
  await expect(alert).toContainText("Das Wort fehlt.");
  await expect(alert).toBeFocused();
  await expect(field(page, "Wort")).toHaveAttribute("aria-invalid", "true");
  const [set] = await readStore<StoredSet>(page, "sets");
  expect(set!.editCount).toBe(0);
});

test("E2E-07: Zurück mit Änderungen fragt nach; Verwerfen ändert nichts", async ({ page }) => {
  const errors = collectErrors(page);
  await importSet(page, TITLE);
  await openEditing(page, TITLE);

  // Ohne Änderung führt Zurück gleich zurück.
  await entryLinks(page).filter({ hasText: "rain" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Eintrag bearbeiten");
  await page.goBack();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`${TITLE} bearbeiten`);

  await entryLinks(page).filter({ hasText: "sun" }).click();
  await field(page, "Wort").fill("sunshine");
  await page.goBack();
  const question = page.getByText(
    "Deine Änderungen an diesem Eintrag sind noch nicht gespeichert.",
  );
  await expect(question).toBeFocused();
  await page.getByRole("button", { name: "Weiter bearbeiten" }).click();
  await expect(question).toBeHidden();
  await expect(field(page, "Wort")).toHaveValue("sunshine");

  await page.goBack();
  await page.getByRole("dialog").getByRole("button", { name: "Verwerfen" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`${TITLE} bearbeiten`);
  await expect(entryLinks(page)).toHaveText(["rain – Regen", "sun – Sonne", "autumn – Herbst"]);
  // Zurück führt danach zur Set-Ansicht, nicht noch einmal ins Formular.
  await page.goBack();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(TITLE);

  // Speichern aus der Frage heraus.
  await setAction(page, "Bearbeiten");
  await entryLinks(page).filter({ hasText: "sun" }).click();
  await field(page, "Bedeutung").fill("die Sonne");
  await page.goBack();
  await page.getByRole("dialog").getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`${TITLE} bearbeiten`);
  await expect(entryLinks(page)).toHaveText(["rain – Regen", "sun – die Sonne", "autumn – Herbst"]);
  expect(errors).toEqual([]);
});

test("E2E-07: Eintrag löschen mit Ankündigung", async ({ page }) => {
  await importSet(page, TITLE);
  await openEditing(page, TITLE);
  await entryLinks(page).filter({ hasText: "sun" }).click();
  await page.getByRole("button", { name: "Eintrag löschen" }).click();
  const announcement = page.getByText(
    "„sun“ wird gelöscht. Dein Lernstand zu diesem Eintrag zählt danach nicht mehr.",
  );
  await expect(announcement).toBeFocused();
  await page.getByRole("button", { name: "Abbrechen" }).click();
  await expect(announcement).toBeHidden();

  await page.getByRole("button", { name: "Eintrag löschen" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Eintrag löschen" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`${TITLE} bearbeiten`);
  await expect(entryLinks(page)).toHaveText(["rain – Regen", "autumn – Herbst"]);
});
