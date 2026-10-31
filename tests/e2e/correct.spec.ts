// Korrigieren und aktualisieren (S-35): E2E-08 und E2E-09 – exportieren, die Datei ändern und wieder
// importieren (TDD 9.3–9.7, FR-14–FR-17, FR-29, AK-04, AK-05, AK-06, AK-18). Ohne Teilen-Menü, damit der
// Export als Download kommt.
import { readFile } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";
import type { StoredSet } from "../../src/domain/model";
import { collectErrors, importText, readStore } from "./support";

const TITLE = "Englisch – Stadt";
const SAVED = `„${TITLE}“ mit 4 Einträgen gespeichert.`;

const twoSections = JSON.stringify({
  format: "vokabeltrainer-set",
  formatVersion: 1,
  set: { title: TITLE, termLanguage: "en", meaningLanguage: "de" },
  sections: [
    {
      title: "Unterwegs",
      entries: [
        { term: "bus stop", meanings: ["Bushaltestelle"] },
        { term: "train", meanings: ["Zug"] },
      ],
    },
    {
      title: "Einkaufen",
      entries: [
        { term: "money", meanings: ["Geld"] },
        { term: "apple", meanings: ["Apfel"] },
      ],
    },
  ],
});

type Json = Record<string, any>;

const withoutShare = (page: Page) =>
  page.addInitScript(() =>
    Object.defineProperty(Navigator.prototype, "canShare", { value: undefined }),
  );

/** Exportiert aus der Set-Ansicht, wahlweise nur eine Sektion, und liest die Datei. */
async function exportFile(page: Page, section?: string): Promise<Json> {
  await page.goto("./");
  await page.getByRole("link", { name: TITLE, exact: true }).click();
  await page.getByRole("link", { name: "Exportieren" }).click();
  if (section) {
    await page.getByRole("radio", { name: "Einzelne Sektionen" }).check();
    await page.getByRole("checkbox", { name: new RegExp(section) }).check();
  }
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Datei speichern" }).click(),
  ]);
  return JSON.parse(await readFile(await download.path(), "utf8")) as Json;
}

async function checkImport(page: Page, file: Json): Promise<void> {
  await page.goto("./#/import");
  await page.getByLabel("Text einfügen").fill(JSON.stringify(file, null, 2));
  await page.getByRole("button", { name: "Prüfen" }).click();
  await expect(page.getByText("Dieses Set hast du schon.", { exact: false })).toBeVisible();
}

const preview = (page: Page) => page.getByRole("region", { name: "Vorschau" });
const setMessage = (page: Page) => page.getByRole("main").getByRole("status");

const entryOf = (file: Json, term: string): Json =>
  file.sections
    .flatMap((section: Json) => section.entries)
    .find((entry: Json) => entry.term === term);

const terms = (set: StoredSet) =>
  set.sections.map((section) => section.entries.map((entry) => entry.term.text));

test("E2E-08 Teil-Export ändern → Aktualisieren und Ersetzen; andere Sektionen bleiben", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await withoutShare(page);
  await importText(page, twoSections, SAVED);
  const [before] = await readStore<StoredSet>(page, "sets");

  // Korrigiert und ergänzt: Aktualisieren übernimmt beides, „Unterwegs“ bleibt, wie es war.
  const part = await exportFile(page, "Einkaufen");
  entryOf(part, "apple").meanings = ["Apfel", "Apfelbaum"];
  part.sections[0].entries.push({ term: "bread", meanings: ["Brot"] });
  await checkImport(page, part);
  await expect(preview(page).getByText("1 Eintrag neu", { exact: true })).toBeVisible();
  await expect(preview(page).getByText("1 Eintrag geändert", { exact: true })).toBeVisible();
  await expect(
    preview(page).getByText("Die Datei enthält 1 Sektion: „Einkaufen“.", { exact: false }),
  ).toBeVisible();
  await preview(page).getByRole("button", { name: "Aktualisieren" }).click();

  await expect(page.getByRole("heading", { level: 1, name: TITLE })).toBeVisible();
  await expect(setMessage(page)).toHaveText(`„${TITLE}“ aktualisiert: 1 geändert, 1 neu.`);
  const [updated] = await readStore<StoredSet>(page, "sets");
  expect(updated!.sections[0]).toEqual(before!.sections[0]);
  expect(terms(updated!)[1]).toEqual(["money", "apple", "bread"]);
  // Dieselbe ID: Der Lernstand bleibt beim korrigierten Eintrag (AK-04).
  const apple = updated!.sections[1]!.entries[1]!;
  expect(apple.id).toBe(before!.sections[1]!.entries[1]!.id);
  expect(apple.meanings).toEqual([{ text: "Apfel" }, { text: "Apfelbaum" }]);
  expect(updated!.editCount).toBe(before!.editCount + 1);

  // Ersetzen: Was in der Datei fehlt, wird gelöscht; die Schaltfläche nennt es (FR-06).
  const again = await exportFile(page, "Einkaufen");
  again.sections[0].entries = again.sections[0].entries.filter(
    (entry: Json) => entry.term !== "bread",
  );
  await checkImport(page, again);
  await expect(preview(page).getByText("Die Datei enthält keine Änderungen.")).toBeVisible();
  await expect(preview(page).getByRole("button", { name: "Aktualisieren" })).toHaveCount(0);
  await preview(page).getByRole("radio", { name: "Ersetzen" }).check();
  await expect(preview(page).getByText("Wird gelöscht (1)")).toBeVisible();
  await expect(preview(page).locator("details").filter({ hasText: "Wird gelöscht" })).toContainText(
    "bread – Brot",
  );
  await preview(page).getByRole("button", { name: "Ersetzen und 1 Eintrag löschen" }).click();
  await expect(setMessage(page)).toHaveText(`„${TITLE}“ ersetzt: 1 gelöscht.`);
  const [replaced] = await readStore<StoredSet>(page, "sets");
  expect(replaced!.sections[0]).toEqual(before!.sections[0]);
  expect(terms(replaced!)[1]).toEqual(["money", "apple"]);
  expect(errors, "Fehler in der Konsole").toEqual([]);
});

test("E2E-09 Konflikt: in App und Datei geändert → beide Fassungen, ohne Wahl bleibt die App", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await withoutShare(page);
  await importText(page, twoSections, SAVED);
  const file = await exportFile(page);

  // In der App geändert …
  await page.goto("./");
  await page.getByRole("link", { name: TITLE, exact: true }).click();
  await page.getByRole("link", { name: "Bearbeiten" }).click();
  await page.locator(".edit-entries a").filter({ hasText: "train" }).click();
  await page
    .getByRole("group", { name: "Bedeutung 1", exact: true })
    .getByLabel("Text", { exact: true })
    .fill("Eisenbahn");
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`${TITLE} bearbeiten`);

  // … und in der Datei.
  entryOf(file, "train").meanings = ["Bahn"];
  await checkImport(page, file);
  await expect(preview(page).getByRole("heading", { name: "Konflikte" })).toBeVisible();
  const conflict = preview(page).getByRole("group", { name: "train" });
  await expect(conflict).toContainText("In der App");
  await expect(conflict).toContainText("train – Eisenbahn");
  await expect(conflict).toContainText("In der Datei");
  await expect(conflict).toContainText("train – Bahn");
  await expect(conflict.getByRole("radio", { name: "In der App behalten" })).toBeChecked();

  // Ohne Wahl bleibt die Fassung der App (AK-18).
  await preview(page).getByRole("button", { name: "Aktualisieren" }).click();
  await expect(setMessage(page)).toHaveText(`„${TITLE}“ aktualisiert.`);
  let [stored] = await readStore<StoredSet>(page, "sets");
  expect(stored!.sections[0]!.entries[1]!.meanings).toEqual([{ text: "Eisenbahn" }]);

  // Mit Wahl gilt die Datei.
  await checkImport(page, file);
  await preview(page)
    .getByRole("group", { name: "train" })
    .getByRole("radio", { name: "Datei übernehmen" })
    .check();
  await preview(page).getByRole("button", { name: "Aktualisieren" }).click();
  await expect(setMessage(page)).toHaveText(`„${TITLE}“ aktualisiert: 1 geändert.`);
  [stored] = await readStore<StoredSet>(page, "sets");
  expect(stored!.sections[0]!.entries[1]!.meanings).toEqual([{ text: "Bahn" }]);
  expect(errors, "Fehler in der Konsole").toEqual([]);
});

test("Veraltete Vorschau: in einem anderen Tab geändert → nichts gespeichert, neue Vorschau", async ({
  page,
}) => {
  await withoutShare(page);
  await importText(page, twoSections, SAVED);
  const file = await exportFile(page);
  entryOf(file, "money").meanings = ["Geld", "Bargeld"];
  await checkImport(page, file);

  const other = await page.context().newPage();
  await other.goto("./");
  await other.getByRole("link", { name: TITLE, exact: true }).click();
  await other.getByRole("link", { name: "Bearbeiten" }).click();
  await other.locator(".edit-entries a").filter({ hasText: "apple" }).click();
  await other.getByText("Weitere Angaben").click();
  await other.getByLabel("Notiz").fill("aus dem anderen Tab");
  await other.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(other.getByRole("heading", { level: 1 })).toHaveText(`${TITLE} bearbeiten`);

  await preview(page).getByRole("button", { name: "Aktualisieren" }).click();
  await expect(
    preview(page).getByText("Das Set wurde inzwischen geändert. Prüfe die Vorschau noch einmal."),
  ).toBeVisible();
  let [stored] = await readStore<StoredSet>(page, "sets");
  expect(stored!.sections[1]!.entries[0]!.meanings).toEqual([{ text: "Geld" }]);
  await preview(page).getByRole("button", { name: "Aktualisieren" }).click();
  await expect(setMessage(page)).toHaveText(`„${TITLE}“ aktualisiert: 1 geändert.`);
  [stored] = await readStore<StoredSet>(page, "sets");
  expect(stored!.sections[1]!.entries[0]!.meanings).toEqual([
    { text: "Geld" },
    { text: "Bargeld" },
  ]);
  expect(stored!.sections[1]!.entries[1]!.notes).toBe("aus dem anderen Tab");
});
