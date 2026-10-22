// Bibliothek und Set-Ansicht (S-14): Gruppierung nach Lernsprache, Angaben und Einträge, Löschen mit
// Ankündigung des Umfangs (FR-01–FR-03, TDD 13.1, 10) sowie E2E-10 (TAK-03).
import { expect, type Page, test } from "@playwright/test";
import type { ReviewEvent, Session, StoredSet } from "../../src/domain/model";
import {
  collectErrors,
  endPractice,
  importSet,
  importText,
  libraryMessage,
  readStore,
  startLearning,
} from "./support";

/** Französisch mit allen optionalen Angaben; frei gewählter Grundwortschatz. */
const FRENCH = JSON.stringify({
  format: "vokabeltrainer-set",
  formatVersion: 1,
  set: {
    title: "Französisch – Tiere und Farben",
    termLanguage: "fr",
    meaningLanguage: "de",
    level: "Klasse 7",
    textbook: "Eigenes Heft",
    edition: "2. Auflage",
    source: "Eigene Zusammenstellung",
    license: "CC0",
    notes: "Für die Probe",
    reviewStatus: "checked",
  },
  sections: [
    {
      title: "Tiere",
      entries: [
        {
          term: "le chat",
          meanings: ["die Katze"],
          grammar: { partOfSpeech: "noun", gender: "m", plural: "les chats" },
          examples: [{ text: "Le chat dort.", translation: "Die Katze schläft." }],
          notes: "Aussprache beachten",
          reviewStatus: "unchecked",
        },
        { term: { text: "le chien", acceptedVariants: ["un chien"] }, meanings: ["der Hund"] },
      ],
    },
    { title: "Farben", entries: [{ term: "rouge", meanings: ["rot"] }] },
  ],
});

const importFrench = (page: Page) =>
  importText(page, FRENCH, "„Französisch – Tiere und Farben“ mit 3 Einträgen gespeichert.");

const sets = (page: Page) => page.getByRole("region", { name: "Vokabelsets" });

test("Bibliothek gruppiert nach Lernsprache und zeigt die Lernstufe", async ({ page }) => {
  const errors = collectErrors(page);
  await importFrench(page);
  await importSet(page, "Englisch – Wetter");

  await expect(sets(page).getByRole("heading")).toHaveText(["Englisch", "Französisch"]);
  await expect(sets(page).getByRole("listitem").locator("div")).toHaveText([
    "Englisch – Wetter 3 Einträge",
    "Französisch – Tiere und Farben Klasse 7 · 3 Einträge",
  ]);
  expect(errors, "Fehler in der Konsole").toEqual([]);
});

test("Set-Ansicht zeigt Angaben, Sektionen und Einträge", async ({ page }) => {
  const errors = collectErrors(page);
  await importFrench(page);
  await page.getByRole("link", { name: "Französisch – Tiere und Farben", exact: true }).click();

  await expect(page).toHaveURL(/#\/set\/[2-9a-hjkmnp-z]{10}$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Französisch – Tiere und Farben",
  );
  await expect(page.getByText("Französisch → Deutsch · 3 Einträge")).toBeVisible();
  await expect(page.locator(".details dt")).toHaveText([
    "Lernstufe",
    "Lehrwerk",
    "Herkunft",
    "Lizenz",
    "Notiz",
    "Prüfstatus",
  ]);
  await expect(page.locator(".details dd")).toHaveText([
    "Klasse 7",
    "Eigenes Heft, 2. Auflage",
    "Eigene Zusammenstellung",
    "CC0",
    "Für die Probe",
    "geprüft",
  ]);
  await expect(page.locator("summary")).toHaveText(["Tiere 2 Einträge", "Farben 1 Eintrag"]);

  // Sektionen sind zugeklappt, bis man sie öffnet.
  const cat = page.locator(".entries > li").first();
  await expect(cat).toBeHidden();
  await page.getByText("Tiere 2 Einträge").click();
  await expect(cat.locator(".pair")).toHaveText("le chat – die Katze ungeprüft");
  await expect(cat.locator(".pair [lang=fr]")).toHaveText("le chat");
  await expect(cat.getByText("Wortart: noun · Genus: m · Plural: les chats")).toBeVisible();
  await expect(cat.getByRole("list", { name: "Beispiele" })).toHaveText(
    "Le chat dort. – Die Katze schläft.",
  );
  await expect(cat.getByText("Notiz: Aussprache beachten")).toBeVisible();
  await expect(page.locator(".entries > li").nth(1).locator(".pair")).toHaveText(
    "le chien (auch: un chien) – der Hund",
  );
  await expect(page.getByText("rouge")).toBeHidden();

  // Lernen geht auch von hier aus.
  await startLearning(page, "Französisch – Tiere und Farben");
  await expect(page.getByText("0 von 3 geschafft")).toBeVisible();
  expect(errors, "Fehler in der Konsole").toEqual([]);
});

test("Set löschen kündigt den Umfang an und löscht den Lernstand mit", async ({ page }) => {
  const errors = collectErrors(page);
  await importFrench(page);
  await importSet(page, "Englisch – Wetter");
  // Eine Antwort, dann beenden: ein Set mit Lernstand.
  await startLearning(page, "Englisch – Wetter");
  await page.getByRole("button", { name: /Tippen zum Aufdecken/ }).click();
  await page.getByRole("button", { name: "Gewusst" }).click();
  await expect(page.getByText("1 von 3 geschafft")).toBeVisible();
  await endPractice(page);
  await expect
    .poll(async () => (await readStore<ReviewEvent>(page, "reviewEvents")).length)
    .toBe(1);

  await page.getByRole("link", { name: "Englisch – Wetter", exact: true }).click();
  const start = page.getByRole("button", { name: "Set löschen" });
  await start.click();
  await expect(
    page.getByText(
      "Gelöscht werden 1 Sektion mit 3 Einträgen und dein Lernstand dazu: 1 Antwort aus 1 Lernsitzung.",
    ),
  ).toBeFocused();
  await page.getByRole("button", { name: "Abbrechen" }).click();
  await expect(start).toBeFocused();
  await expect(page.getByRole("button", { name: "Set mit 3 Einträgen löschen" })).toHaveCount(0);
  expect(await readStore<StoredSet>(page, "sets")).toHaveLength(2);

  await start.click();
  await page.getByRole("button", { name: "Set mit 3 Einträgen löschen" }).click();
  await expect(libraryMessage(page)).toHaveText("„Englisch – Wetter“ gelöscht.");
  await expect(page).toHaveURL(/#\/$/);
  await expect(sets(page).getByRole("heading")).toHaveText(["Französisch"]);
  const left = await readStore<StoredSet>(page, "sets");
  expect(left.map((set) => set.title)).toEqual(["Französisch – Tiere und Farben"]);
  expect(await readStore<Session>(page, "sessions")).toEqual([]);
  expect(await readStore<ReviewEvent>(page, "reviewEvents")).toEqual([]);

  // Ohne Lernstand nennt die Ankündigung nur den Inhalt; danach ist die Bibliothek leer.
  await page.getByRole("link", { name: "Französisch – Tiere und Farben", exact: true }).click();
  await start.click();
  await expect(
    page.getByText(
      "Gelöscht werden 2 Sektionen mit 3 Einträgen. Mit diesem Set hast du noch nicht gelernt.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Set mit 3 Einträgen löschen" }).click();
  await expect(libraryMessage(page)).toHaveText("„Französisch – Tiere und Farben“ gelöscht.");
  await expect(page.getByRole("heading", { name: "Noch keine Vokabelsets" })).toBeVisible();
  expect(errors, "Fehler in der Konsole").toEqual([]);
});

test("Unbekannte Set-Adresse zeigt einen Hinweis mit Weg zurück", async ({ page }) => {
  await page.goto("./#/set/unbekannt");
  await expect(page.getByRole("heading", { name: "Set nicht gefunden" })).toBeVisible();
  await page.getByRole("link", { name: "Zurück zur Bibliothek" }).click();
  await expect(page.getByRole("heading", { name: "Vokabeltrainer" })).toBeVisible();

  await page.goto("./#/set/");
  await expect(page.getByRole("heading", { name: "Seite nicht gefunden" })).toBeVisible();
});

test("E2E-10 Markup in Daten erscheint als Text", async ({ page }) => {
  const errors = collectErrors(page);
  const markup = '<img src="x" onerror="window.__injected = true">';
  const file = JSON.stringify({
    format: "vokabeltrainer-set",
    formatVersion: 1,
    set: { title: markup, termLanguage: "en", meaningLanguage: "de", notes: markup },
    sections: [
      {
        title: `<b>${markup}</b>`,
        entries: [
          {
            term: markup,
            meanings: [markup],
            notes: markup,
            examples: [{ text: markup, translation: markup }],
            grammar: { forms: [markup] },
          },
        ],
      },
    ],
  });
  await importText(page, file, `„${markup}“ mit 1 Eintrag gespeichert.`);
  await expect(page.getByRole("link", { name: markup, exact: true })).toBeVisible();
  await page.getByRole("link", { name: markup, exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(markup);
  await page.locator("summary").click();
  await expect(page.locator(".pair")).toHaveText(`${markup} – ${markup}`);
  await expect(page.getByText(`Notiz: ${markup}`)).toBeVisible();

  await expect(page.locator("img, b")).toHaveCount(0);
  expect(await page.evaluate(() => "__injected" in window)).toBe(false);
  expect(errors, "Fehler in der Konsole").toEqual([]);
});
