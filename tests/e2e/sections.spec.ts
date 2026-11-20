// Sets und Sektionen verwalten (S-31, S-45): E2E-24 – leeres Set anlegen, Sektionen anlegen, umbenennen
// (Feld am Ort), verschieben und löschen, Einträge verschieben, Angaben bearbeiten; die Reihenfolge
// bleibt nach dem Neuladen (FR-02, FR-03, AK-25, TDD 10, D-41, D-54).
import { expect, type Page, test } from "@playwright/test";
import type { StoredSet } from "../../src/domain/model";
import { backButton, collectErrors, readStore } from "./support";

const heading = (page: Page) => page.getByRole("heading", { level: 1 });
const sectionTitles = (page: Page) => page.locator(".edit-section summary");
const entryLinks = (page: Page) => page.locator(".edit-entries a");
const status = (page: Page) => page.locator("main p[aria-live]");
const menu = (page: Page, section: string) =>
  page.getByRole("button", { name: `Sektion „${section}“: weitere Aktionen` });

async function addSection(page: Page, title: string): Promise<void> {
  await page.getByRole("button", { name: "Sektion hinzufügen" }).click();
  await expect(page.getByLabel("Name der neuen Sektion")).toBeFocused();
  await page.getByLabel("Name der neuen Sektion").fill(title);
  await page.getByRole("button", { name: "Hinzufügen", exact: true }).click();
  await expect(status(page)).toHaveText(`Sektion „${title}“ hinzugefügt.`);
}

async function addEntry(page: Page, section: string, term: string, meaning: string) {
  await page.getByRole("link", { name: `Eintrag hinzufügen zu „${section}“` }).click();
  await page.getByRole("group", { name: "Wort", exact: true }).getByLabel("Text").fill(term);
  await page.getByRole("group", { name: "Bedeutung" }).getByLabel("Text").fill(meaning);
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(heading(page)).toHaveText(/bearbeiten$/);
}

test("E2E-24: Leeres Set anlegen, Sektionen und Einträge ordnen – nach dem Neuladen erhalten", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto("./");
  await page.getByRole("link", { name: "Leeres Set anlegen" }).click();
  await expect(heading(page)).toHaveText("Leeres Set anlegen");

  // Ohne Titel wird nichts angelegt.
  await page.getByRole("button", { name: "Set anlegen" }).click();
  await expect(page.getByRole("main").getByRole("alert").first()).toContainText("Der Titel fehlt.");
  expect(await readStore<StoredSet>(page, "sets")).toEqual([]);

  await page.getByLabel("Titel", { exact: true }).fill("Spanisch – Farben");
  await page.getByLabel("Lernsprache", { exact: true }).selectOption({ label: "Spanisch" });
  await expect(page.getByLabel("Bedeutungssprache", { exact: true })).toHaveValue("de");
  await expect(page.getByLabel("Erste Sektion")).toHaveValue("Sektion 1");
  await page.getByRole("button", { name: "Set anlegen" }).click();
  await expect(heading(page)).toHaveText("Spanisch – Farben bearbeiten");
  await expect(page.getByText("Spanisch → Deutsch")).toBeVisible();
  await expect(sectionTitles(page)).toHaveText(["Sektion 1 0 Einträge"]);
  // Die einzige Sektion lässt sich nicht löschen.
  await menu(page, "Sektion 1").click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByText("Die einzige Sektion lässt sich nicht löschen")).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Sektion löschen" })).toHaveCount(0);

  // Umbenennen am Ort; Escape bricht ab, Enter speichert.
  await sheet.getByRole("button", { name: "Umbenennen" }).click();
  const name = page.getByLabel("Name der Sektion");
  await expect(name).toBeFocused();
  await name.press("Escape");
  await expect(menu(page, "Sektion 1")).toBeFocused();
  await menu(page, "Sektion 1").click();
  await page.getByRole("dialog").getByRole("button", { name: "Umbenennen" }).click();
  await name.fill("Grundfarben");
  await name.press("Enter");
  await expect(status(page)).toHaveText("Sektion umbenannt.");
  await expect(sectionTitles(page).first()).toBeFocused();

  await addSection(page, "Mischfarben");
  // Denselben Namen gibt es schon, auch in anderer Großschreibung.
  await page.getByRole("button", { name: "Sektion hinzufügen" }).click();
  await page.getByLabel("Name der neuen Sektion").fill("mischfarben");
  await page.getByRole("button", { name: "Hinzufügen", exact: true }).click();
  await expect(
    page.getByText("Eine Sektion „mischfarben“ gibt es in diesem Set schon."),
  ).toBeVisible();
  await expect(page.getByLabel("Name der neuen Sektion")).toHaveAttribute("aria-invalid", "true");
  await page.getByRole("button", { name: "Abbrechen" }).click();
  await addSection(page, "Sonstiges");

  await addEntry(page, "Grundfarben", "rojo", "rot");
  await addEntry(page, "Grundfarben", "azul", "blau");

  // Reihenfolge im eigenen Modus (D-54).
  await page.getByRole("button", { name: "Reihenfolge ändern" }).click();
  await expect(heading(page)).toHaveText("Reihenfolge ändern");
  await page.getByRole("button", { name: "Sektion „Sonstiges“ nach oben" }).click();
  await expect(page.getByRole("button", { name: "Sektion „Sonstiges“ nach oben" })).toBeFocused();
  await page.getByRole("button", { name: "„azul“ verschieben", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Nach oben" }).click();
  await expect(status(page)).toHaveText("„azul“ verschoben.");
  await expect(page.getByRole("button", { name: "„azul“ verschieben", exact: true })).toBeFocused();
  // Ganz oben im Set ist „Nach oben“ gesperrt.
  await page.getByRole("button", { name: "„azul“ verschieben", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("button", { name: "Nach oben" })).toBeDisabled();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Fertig" }).click();
  await expect(heading(page)).toHaveText("Spanisch – Farben bearbeiten");

  await page.reload();
  await expect(sectionTitles(page)).toHaveText([
    "Grundfarben 2 Einträge",
    "Sonstiges 0 Einträge",
    "Mischfarben 0 Einträge",
  ]);
  await expect(entryLinks(page)).toHaveText(["azul – blau", "rojo – rot"]);

  const [set] = await readStore<StoredSet>(page, "sets");
  expect(set).toMatchObject({
    title: "Spanisch – Farben",
    termLanguage: "es",
    meaningLanguage: "de",
  });
  expect(set!.sections.map((section) => section.title)).toEqual([
    "Grundfarben",
    "Sonstiges",
    "Mischfarben",
  ]);

  // Zurück führt zur Bibliothek, nicht noch einmal ins Anlegen.
  await backButton(page).click();
  await expect(heading(page)).toHaveText("Vokabeltrainer");
  expect(errors).toEqual([]);
});

test("E2E-24: Sektion löschen – mit Einträgen erst nach Ankündigung", async ({ page }) => {
  await page.goto("./#/new-set");
  await page.getByLabel("Titel", { exact: true }).fill("Französisch – Tiere");
  await page.getByLabel("Lernsprache", { exact: true }).selectOption({ label: "Französisch" });
  await page.getByLabel("Erste Sektion").fill("Haustiere");
  await page.getByRole("button", { name: "Set anlegen" }).click();
  await expect(heading(page)).toHaveText("Französisch – Tiere bearbeiten");
  await addSection(page, "Leer");
  await addEntry(page, "Haustiere", "le chat", "die Katze");
  await addEntry(page, "Haustiere", "le chien", "der Hund");

  // Eine leere Sektion verschwindet ohne Rückfrage.
  await menu(page, "Leer").click();
  await page.getByRole("dialog").getByRole("button", { name: "Sektion löschen" }).click();
  await expect(status(page)).toHaveText("Sektion „Leer“ gelöscht.");
  await expect(sectionTitles(page)).toHaveText(["Haustiere 2 Einträge"]);

  await addSection(page, "Wildtiere");
  await menu(page, "Haustiere").click();
  await page.getByRole("dialog").getByRole("button", { name: "Sektion löschen" }).click();
  const announcement = page.getByText(
    "Gelöscht werden die Sektion „Haustiere“ und 2 Einträge. Dein Lernstand zu diesen Einträgen zählt danach nicht mehr.",
  );
  await expect(announcement).toBeFocused();
  await page.getByRole("dialog").getByRole("button", { name: "Abbrechen" }).click();
  await expect(announcement).toBeHidden();
  await expect(menu(page, "Haustiere")).toBeFocused();
  await expect(sectionTitles(page)).toHaveText(["Haustiere 2 Einträge", "Wildtiere 0 Einträge"]);

  await menu(page, "Haustiere").click();
  await page.getByRole("dialog").getByRole("button", { name: "Sektion löschen" }).click();
  await page.getByRole("button", { name: "Sektion mit 2 Einträgen löschen" }).click();
  await expect(sectionTitles(page)).toHaveText(["Wildtiere 0 Einträge"]);
  await page.reload();
  await expect(sectionTitles(page)).toHaveText(["Wildtiere 0 Einträge"]);
});

test("E2E-24: Angaben bearbeiten, Sprache über den Sprachcode", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("./#/new-set");
  await page.getByLabel("Titel", { exact: true }).fill("Wörter");
  await page.getByRole("button", { name: "Set anlegen" }).click();
  await expect(heading(page)).toHaveText("Wörter bearbeiten");

  await page.getByRole("link", { name: "Angaben bearbeiten" }).click();
  await expect(heading(page)).toHaveText("Angaben bearbeiten");
  await page.getByLabel("Titel", { exact: true }).fill("Koreanisch – Grundwörter");
  await page.getByLabel("Lernsprache", { exact: true }).selectOption({ label: "Andere Sprache …" });
  const code = page.getByLabel("Sprachcode der Lernsprache");
  await expect(code).toBeFocused();
  await code.fill("koreanisch");
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert").first()).toContainText(
    "„koreanisch“ ist kein gültiger Sprachcode",
  );
  await expect(code).toHaveAttribute("aria-invalid", "true");

  await code.fill("ko");
  await page.getByText("Weitere Angaben").click();
  await page.getByLabel("Lernstufe").fill("Anfänger");
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(heading(page)).toHaveText("Koreanisch – Grundwörter bearbeiten");
  await expect(page.getByText("Koreanisch → Deutsch")).toBeVisible();

  // Die Sprache steht danach in der Auswahl; Zurück ohne Änderung fragt nicht.
  await page.getByRole("link", { name: "Angaben bearbeiten" }).click();
  await expect(page.getByLabel("Lernsprache", { exact: true })).toHaveValue("ko");
  await page.goBack();
  await expect(heading(page)).toHaveText("Koreanisch – Grundwörter bearbeiten");

  const [set] = await readStore<StoredSet>(page, "sets");
  expect(set).toMatchObject({
    title: "Koreanisch – Grundwörter",
    termLanguage: "ko",
    level: "Anfänger",
  });
  expect(errors).toEqual([]);
});
