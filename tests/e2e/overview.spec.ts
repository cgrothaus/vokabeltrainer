// Lernüberblick (S-20): Die Set-Ansicht zeigt für das Set und jede Sektion Sitzungen, letzte Sitzung
// und Erstversuchsquote, berechnet aus den gespeicherten Antworten (TDD 12.6, FR-11, AK-17).
import { expect, type Page, test } from "@playwright/test";
import type { StoredSet } from "../../src/domain/model";
import { collectErrors, importText, readStore } from "./support";

const TITLE = "Englisch – Wetter und Tiere";

async function importTwoSections(page: Page): Promise<StoredSet> {
  const file = {
    format: "vokabeltrainer-set",
    formatVersion: 1,
    set: { title: TITLE, termLanguage: "en", meaningLanguage: "de" },
    sections: [
      {
        title: "Wetter",
        entries: [
          ["rain", "Regen"],
          ["sun", "Sonne"],
          ["snow", "Schnee"],
        ],
      },
      {
        title: "Tiere",
        entries: [
          ["cat", "Katze"],
          ["dog", "Hund"],
        ],
      },
    ].map(({ title, entries }) => ({
      title,
      entries: entries.map(([term, meaning]) => ({ term, meanings: [meaning] })),
    })),
  };
  await importText(page, JSON.stringify(file), `„${TITLE}“ mit 5 Einträgen gespeichert.`);
  const [set] = await readStore<StoredSet>(page, "sets");
  return set!;
}

/** Lernt genau eine Sektion mit Karteikarten; `ratings` gilt der Reihe nach für jede Karte. */
async function learnSection(page: Page, only: string, ratings: ("Nochmal" | "Gewusst")[]) {
  await page.getByRole("link", { name: `${TITLE} lernen` }).click();
  for (const title of ["Wetter", "Tiere"]) {
    const box = page.getByRole("checkbox", { name: new RegExp(`^${title}`) });
    if (title === only) await box.check();
    else await box.uncheck();
  }
  await page.getByRole("slider", { name: "Multiple Choice" }).fill("0");
  await page.getByRole("button", { name: /^\d+ Vokabeln? lernen$/ }).click();
  for (const rating of ratings) {
    await page.getByRole("button", { name: /tipp zum Aufdecken/ }).click();
    await page.getByRole("button", { name: rating }).click();
  }
  await expect(page.getByRole("heading", { name: "Geschafft" })).toBeVisible();
}

const overview = (page: Page) => page.locator(".overview");
/** Kacheln (D-50): Beschriftung und Wert je Kachel, dazu die erklärende Zeile. */
async function expectTiles(page: Page, values: string[], note: string): Promise<void> {
  await expect(overview(page).locator("dt")).toHaveText(
    ["Sitzungen", "beim 1. Mal", "zuletzt"].map((label, index) =>
      index === 0 && values[0] === "1" ? "Sitzung" : label,
    ),
  );
  await expect(overview(page).locator("dd")).toHaveText(values);
  await expect(overview(page).locator(".note")).toHaveText(note);
}
const sectionLine = (page: Page, title: string) =>
  page.locator(".section summary", { hasText: title }).locator(".stats");

test("Set-Ansicht zeigt den Lernstand für Set und Sektionen, auch nach dem Neuladen", async ({
  page,
}) => {
  const errors = collectErrors(page);
  const set = await importTwoSections(page);
  const openSet = () => page.goto(`./#/set/${set.id}`);

  await openSet();
  await expect(overview(page)).toHaveText("Mit diesem Set hast du noch nicht gelernt.");
  await expect(sectionLine(page, "Wetter")).toHaveText("noch nicht gelernt");
  await expect(sectionLine(page, "Tiere")).toHaveText("noch nicht gelernt");

  // Die erste Karte kommt als letzte wieder, zweimal (FR-10): zwei von drei beim ersten Mal gewusst.
  await learnSection(page, "Wetter", ["Nochmal", "Gewusst", "Gewusst", "Gewusst", "Gewusst"]);
  await openSet();
  await expectTiles(
    page,
    ["1", "67 %", "heute"],
    "Beim ersten Mal gewusst, in der letzten Sitzung",
  );
  await expect(sectionLine(page, "Wetter")).toHaveText("1 Sitzung · zuletzt heute · 67 %");
  await expect(sectionLine(page, "Tiere")).toHaveText("noch nicht gelernt");

  await learnSection(page, "Tiere", ["Gewusst", "Gewusst"]);
  await openSet();
  await page.reload();
  await expectTiles(
    page,
    ["2", "80 %", "heute"],
    "Beim ersten Mal gewusst, in den letzten 2 Sitzungen",
  );
  await expect(sectionLine(page, "Wetter")).toHaveText("1 Sitzung · zuletzt heute · 67 %");
  await expect(sectionLine(page, "Tiere")).toHaveText("1 Sitzung · zuletzt heute · 100 %");
  expect(errors).toEqual([]);
});
