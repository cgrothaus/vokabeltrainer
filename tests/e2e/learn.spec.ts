// Sitzung einrichten (S-17, S-18): Sektionen, Richtung, Anzahl und Anteil an Multiple Choice bestimmen die
// Sitzung; die Einrichtung wird pro Set gemerkt und mit dem Set gelöscht (TDD 12.1, FR-07, FR-08, FR-21, D-27).
import { expect, type Page, test } from "@playwright/test";
import type { Session, StoredSet } from "../../src/domain/model";
import { collectErrors, importText, readStore } from "./support";

const TITLE = "Englisch – Farben und Zahlen";

const COLOURS: [string, string][] = [
  ["red", "rot"],
  ["blue", "blau"],
  ["green", "grün"],
  ["yellow", "gelb"],
  ["black", "schwarz"],
  ["white", "weiß"],
  ["brown", "braun"],
  ["grey", "grau"],
];
const NUMBERS: [string, string][] = [
  ["one", "eins"],
  ["two", "zwei"],
  ["three", "drei"],
  ["four", "vier"],
  ["five", "fünf"],
  ["six", "sechs"],
  ["seven", "sieben"],
  ["eight", "acht"],
  ["nine", "neun"],
  ["ten", "zehn"],
  ["eleven", "elf"],
  ["twelve", "zwölf"],
];

const entries = (pairs: [string, string][]) =>
  pairs.map(([term, meaning]) => ({ term, meanings: [meaning] }));

async function importTwoSections(page: Page): Promise<StoredSet> {
  const file = {
    format: "vokabeltrainer-set",
    formatVersion: 1,
    set: { title: TITLE, termLanguage: "en", meaningLanguage: "de" },
    sections: [
      { title: "Farben", entries: entries(COLOURS) },
      { title: "Zahlen", entries: entries(NUMBERS) },
    ],
  };
  await importText(page, JSON.stringify(file), `„${TITLE}“ mit 20 Einträgen gespeichert.`);
  const [set] = await readStore<StoredSet>(page, "sets");
  return set!;
}

const openSetup = async (page: Page) => {
  await page.getByRole("link", { name: `${TITLE} lernen` }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(TITLE);
};

const section = (page: Page, title: string) =>
  page.getByRole("checkbox", { name: new RegExp(`^${title}`) });
const radio = (page: Page, name: string) => page.getByRole("radio", { name, exact: true });
const startButton = (page: Page) => page.getByRole("button", { name: /lernen$/i });
const mcShare = (page: Page) => page.getByRole("slider", { name: "Multiple Choice" });

test("Sektion, Richtung, Anzahl und Anteil bestimmen die Sitzung und bleiben gemerkt", async ({
  page,
}) => {
  const errors = collectErrors(page);
  const set = await importTwoSections(page);
  await openSetup(page);

  // Voreinstellung: alles, Lernsprache → Deutsch.
  await expect(section(page, "Farben")).toBeChecked();
  await expect(section(page, "Zahlen")).toBeChecked();
  await expect(radio(page, "Englisch → Deutsch")).toBeChecked();
  await expect(radio(page, "alle (20)")).toBeChecked();
  await expect(page.getByRole("radio")).toHaveCount(5);
  await expect(startButton(page)).toHaveText("20 Vokabeln lernen");
  await expect(mcShare(page)).toHaveValue("25");
  await expect(page.getByText("25 % (Rest: Karteikarten)")).toBeVisible();

  await section(page, "Farben").uncheck();
  await expect(page.getByText("12 Vokabeln ausgewählt.")).toBeVisible();
  await radio(page, "Deutsch → Englisch").check();
  await radio(page, "10").check();
  await mcShare(page).fill("40");
  await expect(page.getByText("40 % (Rest: Karteikarten)")).toBeVisible();
  await startButton(page).click();

  await expect(page.getByText("0 von 10 geschafft")).toBeVisible();
  const prompt = page.locator(".card .prompt");
  await expect(prompt).toHaveAttribute("lang", "de");
  expect(NUMBERS.map(([, meaning]) => meaning)).toContain(await prompt.textContent());

  const [session] = await readStore<Session>(page, "sessions");
  expect(session).toMatchObject({
    sectionIds: [set.sections[1]!.id],
    config: { direction: "meaningToTerm", count: 10, mcShare: 40 },
  });
  expect(await readStore(page, "settings")).toEqual([
    {
      key: `practice:${set.id}`,
      value: {
        sections: [set.sections[1]!.id],
        direction: "meaningToTerm",
        count: 10,
        mcShare: 40,
      },
    },
  ]);

  await page.getByRole("button", { name: "Beenden" }).click();
  await page.reload();
  await openSetup(page);
  await expect(section(page, "Farben")).not.toBeChecked();
  await expect(section(page, "Zahlen")).toBeChecked();
  await expect(radio(page, "Deutsch → Englisch")).toBeChecked();
  await expect(radio(page, "10")).toBeChecked();
  await expect(mcShare(page)).toHaveValue("40");
  await expect(startButton(page)).toHaveText("10 Vokabeln lernen");
  expect(errors, "Fehler in der Konsole").toEqual([]);
});

test("„Keine“ sperrt den Start; eine Stufe über der Auswahl gilt als „alle“", async ({ page }) => {
  const errors = collectErrors(page);
  await importTwoSections(page);
  await openSetup(page);
  await radio(page, "10").check();

  await page.getByRole("button", { name: "Keine", exact: true }).click();
  await expect(page.getByText("Wähle mindestens eine Sektion.")).toBeVisible();
  await expect(startButton(page)).toBeDisabled();

  // Farben hat nur 8 Einträge: Die Stufe 10 wird nicht angeboten.
  await section(page, "Farben").check();
  await expect(page.getByRole("radio", { name: /^(10|20|30)$/ })).toHaveCount(0);
  await expect(radio(page, "alle (8)")).toBeChecked();
  await expect(startButton(page)).toHaveText("8 Vokabeln lernen");

  // Mit allen Sektionen gilt wieder die gewählte Stufe.
  await page.getByRole("button", { name: "Alle", exact: true }).click();
  await expect(radio(page, "10")).toBeChecked();
  await expect(startButton(page)).toHaveText("10 Vokabeln lernen");
  expect(errors, "Fehler in der Konsole").toEqual([]);
});

test("Die gemerkte Einrichtung wird mit dem Set gelöscht", async ({ page }) => {
  const errors = collectErrors(page);
  await importTwoSections(page);
  await openSetup(page);
  await startButton(page).click();
  await page.getByRole("button", { name: "Beenden" }).click();
  await expect.poll(async () => (await readStore(page, "settings")).length).toBe(1);

  await page.getByRole("link", { name: TITLE, exact: true }).click();
  await page.getByRole("button", { name: "Set löschen" }).click();
  await page.getByRole("button", { name: "Set mit 20 Einträgen löschen" }).click();
  await expect(page.getByText(`„${TITLE}“ gelöscht.`)).toBeVisible();
  expect(await readStore(page, "settings")).toEqual([]);
  expect(errors, "Fehler in der Konsole").toEqual([]);
});

test("Unbekanntes Set: Hinweis statt Einrichtung", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("./#/learn/unbekannt");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Set nicht gefunden");
  await expect(page.getByRole("link", { name: "Zurück zur Bibliothek" })).toBeVisible();
  expect(errors, "Fehler in der Konsole").toEqual([]);
});
