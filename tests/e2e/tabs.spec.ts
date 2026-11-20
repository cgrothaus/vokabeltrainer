// Mehrere Tabs (S-33): E2E-26 (TDD 3.4, D-43). Zwei Seiten im selben Kontext teilen Datenbank und
// `BroadcastChannel` wie zwei Tabs. Leseansichten zeichnen sich nach einer Änderung im anderen Tab neu,
// Formulare nicht; Antworten verwerfen den Lernstand im Zwischenspeicher des anderen Tabs (S-38); eine
// Sitzung zu einem gelöschten Set speichert nichts mehr.
import { expect, type Page, test } from "@playwright/test";
import type { StoredSet } from "../../src/domain/model";
import {
  collectErrors,
  endPractice,
  goToSetup,
  importSet,
  readStore,
  setAction,
  startLearning,
} from "./support";

const TITLE = "Englisch – Wetter";

const field = (page: Page, group: string) =>
  page.getByRole("group", { name: group, exact: true }).getByLabel("Text", { exact: true });

/** Zweiter Tab derselben App. */
async function secondTab(page: Page, hash: string): Promise<Page> {
  const other = await page.context().newPage();
  await other.goto(`./${hash}`);
  return other;
}

/** Ändert die Bedeutung von „rain“ über Set-Ansicht, „Bearbeiten“ und das Eintragsformular. */
async function renameRain(page: Page, meaning: string): Promise<void> {
  await page.getByRole("link", { name: TITLE, exact: true }).click();
  await setAction(page, "Bearbeiten");
  await page.locator(".edit-entries a").filter({ hasText: "rain" }).click();
  await field(page, "Bedeutung").fill(meaning);
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(page.locator(".edit-entries a").filter({ hasText: "rain" })).toHaveText(
    `rain – ${meaning}`,
  );
}

test("E2E-26 Änderung in einem Tab: Set-Ansicht und Bibliothek im anderen zeichnen sich neu", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await importSet(page, TITLE);
  await page.getByRole("link", { name: TITLE, exact: true }).click();
  await expect(page.locator("main")).toContainText("Regen");
  const section = page.locator("details.section").first();
  await section.locator("summary").click();
  await expect(section).toHaveAttribute("open", "");

  const other = await secondTab(page, "#/");
  await renameRain(other, "Regenschauer");
  await expect(page.locator("main")).toContainText("Regenschauer");
  // Die aufgeklappte Sektion bleibt offen.
  await expect(page.locator("details.section").first()).toHaveAttribute("open", "");
  // Nur neu gezeichnet, nicht neu geladen: Die Seite liegt weiter auf der Set-Ansicht.
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(TITLE);

  await page.goto("./#/");
  await other.goto("./#/");
  await other.getByRole("link", { name: TITLE, exact: true }).click();
  await setAction(other, "Set löschen");
  await other.getByRole("button", { name: "Set mit 3 Einträgen löschen" }).click();
  await expect(
    page.getByRole("heading", { name: "Lerne Vokabeln mit Karteikarten" }),
  ).toBeVisible();
  expect(errors, "Fehler in der Konsole").toEqual([]);
});

test("E2E-26 Gelernt in einem Tab: Der andere zeigt den neuen Lernstand beim nächsten Öffnen", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await importSet(page, TITLE);
  await page.getByRole("link", { name: TITLE, exact: true }).click();
  await expect(page.locator(".overview")).toHaveText("Mit diesem Set hast du noch nicht gelernt.");

  const other = await secondTab(page, "#/");
  await startLearning(other, TITLE);
  await other.getByRole("button", { name: /tipp zum Aufdecken/ }).click();
  await other.getByRole("button", { name: "Gewusst" }).click();
  await expect(other.getByText("1 von 3 geschafft")).toBeVisible();
  await endPractice(other);

  // Antworten zeichnen nichts neu (TDD 3.4); der Lernstand kommt nicht aus dem Zwischenspeicher (S-38).
  await page.goto("./#/");
  await page.getByRole("link", { name: TITLE, exact: true }).click();
  await expect(page.locator(".overview dd")).toHaveText(["1", "100 %", "heute"]);
  expect(errors, "Fehler in der Konsole").toEqual([]);
});

test("E2E-26 Darstellung folgt dem anderen Tab, ein offenes Formular behält seine Eingabe", async ({
  page,
}) => {
  await importSet(page, TITLE);
  await page.getByRole("link", { name: TITLE, exact: true }).click();
  await setAction(page, "Bearbeiten");
  await page.locator(".edit-entries a").filter({ hasText: "sun" }).click();
  await field(page, "Bedeutung").fill("Sonnenschein");

  const other = await secondTab(page, "#/settings");
  await other.getByRole("radio", { name: "Dunkel" }).check();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await other.goto("./#/");
  await renameRain(other, "Regenschauer");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Eintrag bearbeiten");
  await expect(field(page, "Bedeutung")).toHaveValue("Sonnenschein");
});

test("E2E-26 Set in einem anderen Tab gelöscht: Die Sitzung endet, ohne etwas zu speichern", async ({
  page,
}) => {
  await importSet(page, TITLE);
  await goToSetup(page, TITLE);
  await page.getByRole("slider", { name: "Multiple Choice" }).fill("0");
  await page.getByRole("button", { name: /^\d+ Vokabeln? lernen$/ }).click();
  await page.getByRole("button", { name: /tipp zum Aufdecken/ }).click();
  await page.getByRole("button", { name: "Gewusst" }).click();
  await expect(page.getByText("1 von 3 geschafft")).toBeVisible();

  const other = await secondTab(page, "#/");
  await other.getByRole("link", { name: TITLE, exact: true }).click();
  await setAction(other, "Set löschen");
  await other.getByRole("button", { name: "Set mit 3 Einträgen löschen" }).click();
  await expect(
    other.getByRole("heading", { name: "Lerne Vokabeln mit Karteikarten" }),
  ).toBeVisible();

  await page.getByRole("button", { name: /tipp zum Aufdecken/ }).click();
  await page.getByRole("button", { name: "Gewusst" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Lernsitzung beendet");
  await expect(page.getByText(/Dieses Set gibt es nicht mehr/)).toBeVisible();

  // Nichts Verwaistes: Ein Backup bliebe gültig (D-25).
  expect(await readStore<StoredSet>(page, "sets")).toEqual([]);
  expect(await readStore(page, "reviewEvents")).toEqual([]);
  expect(await readStore(page, "sessions")).toEqual([]);
  expect(await readStore(page, "settings")).toEqual([]);

  await page.getByRole("link", { name: "Zur Bibliothek" }).click();
  await expect(
    page.getByRole("heading", { name: "Lerne Vokabeln mit Karteikarten" }),
  ).toBeVisible();
  // Das Ende der Sitzung meldet keinen Speicherfehler.
  await expect(page.locator("#storage-notice")).toBeEmpty();
});
