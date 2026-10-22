// Lernsitzung (S-08, S-18): E2E-01 (AK-01, AK-09), das Ende einer Sitzung (TDD 12.2, 12.5) und die
// Bedienwege der Karteikarte (TDD 12.3, FR-09).
import { expect, type Page, test } from "@playwright/test";
import type { ReviewEvent, Session } from "../../src/domain/model";
import {
  collectErrors,
  importSet,
  librarySets,
  MEANINGS,
  importText,
  readStore,
  startLearning,
  swipe,
} from "./support";

const card = (page: Page) => page.getByRole("button", { name: /Tippen zum Aufdecken/ });
const answerSide = (page: Page) => page.locator(".card.swipeable");
const answerText = (page: Page) => page.locator(".card .answer");

/** Deckt die aktuelle Karte auf, prüft die Antwort zur Frage und bewertet sie. */
async function rate(page: Page, button: "Nochmal" | "Gewusst"): Promise<void> {
  await card(page).click();
  const prompt = await page.locator(".card .prompt").textContent();
  await expect(page.locator(".card .answer")).toHaveText(MEANINGS[prompt!]!);
  await page.getByRole("button", { name: button }).click();
}

async function startPractice(page: Page, title: string): Promise<void> {
  await importSet(page, title);
  await startLearning(page, title);
  await expect(page.getByText("0 von 3 geschafft")).toBeVisible();
}

const sessions = (page: Page) => readStore<Session>(page, "sessions");
const events = (page: Page) => readStore<ReviewEvent>(page, "reviewEvents");

test("E2E-01 Import (Text) → Lernen → Neuladen → Daten da", async ({ page }) => {
  const errors = collectErrors(page);
  await startPractice(page, "Englisch – Wetter");

  // Die erste Karte kommt wieder, weil die Warteschlange kürzer als vier ist, als letzte.
  await rate(page, "Nochmal");
  await expect(page.getByText("0 von 3 geschafft")).toBeVisible();
  await rate(page, "Gewusst");
  await expect(page.getByText("1 von 3 geschafft")).toBeVisible();
  await rate(page, "Gewusst");
  await rate(page, "Gewusst");
  await expect(page.getByRole("heading", { name: "Geschafft" })).toBeVisible();
  await expect(page.getByText("2 von 3 beim ersten Mal gewusst.")).toBeVisible();

  const answers = await events(page);
  expect(answers).toHaveLength(4);
  expect(answers.filter((event) => event.firstAttempt)).toHaveLength(3);
  expect(new Set(answers.map((event) => event.entryId)).size).toBe(3);
  for (const event of answers) {
    expect(event).toMatchObject({ mode: "flashcard", direction: "termToMeaning" });
    expect(event.entryRev).toMatch(/^[2-9a-hjkmnp-z]{8}$/);
    expect(event.id).toMatch(/^[2-9a-hjkmnp-z]{12}$/);
  }
  const missed = answers.find((event) => event.result === "incorrect")!;
  expect(missed.firstAttempt).toBe(true);
  expect(answers.filter((event) => event.entryId === missed.entryId)).toHaveLength(2);
  await expect.poll(async () => (await sessions(page)).map((s) => s.status)).toEqual(["completed"]);

  await page.getByRole("link", { name: "Zurück zur Bibliothek" }).click();
  await page.reload();
  await expect(librarySets(page)).toHaveText(["Englisch – Wetter 3 Einträge"]);
  expect(await events(page)).toEqual(answers);
  expect((await sessions(page))[0]).toMatchObject({
    status: "completed",
    endedAt: expect.any(String),
  });
  expect(errors, "Fehler in der Konsole").toEqual([]);
});

test("Beenden schließt die Sitzung ab; gespeicherte Antworten bleiben", async ({ page }) => {
  await startPractice(page, "Englisch – Beenden");
  await rate(page, "Gewusst");
  await expect(page.getByText("1 von 3 geschafft")).toBeVisible();
  await page.getByRole("button", { name: "Beenden" }).click();

  await expect(librarySets(page)).toHaveText(["Englisch – Beenden 3 Einträge"]);
  await expect.poll(async () => (await sessions(page)).map((s) => s.status)).toEqual(["ended"]);
  expect(await events(page)).toHaveLength(1);
});

test("Neuladen beendet die Sitzung als unterbrochen", async ({ page }) => {
  await startPractice(page, "Englisch – Neuladen");
  await rate(page, "Nochmal");
  await expect.poll(async () => (await events(page)).length).toBe(1);

  await page.reload();
  // Ohne Sitzung im Arbeitsspeicher geht es zur Bibliothek.
  await expect(librarySets(page)).toHaveText(["Englisch – Neuladen 3 Einträge"]);
  await expect(page).toHaveURL(/#\/$/);
  await expect
    .poll(async () => (await sessions(page)).map((s) => s.status))
    .toEqual(["interrupted"]);
  expect(await events(page)).toHaveLength(1);
});

test("Tastatur: Enter deckt auf, Pfeile bewerten erst danach, gehaltene Tasten nur einmal", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await startPractice(page, "Englisch – Tastatur");

  // Vor dem Aufdecken bewerten Pfeile nicht.
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowLeft");
  await expect(card(page)).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(answerText(page)).toBeVisible();
  expect(await events(page)).toHaveLength(0);

  // Gehalten: Die Wiederholungen der Taste lösen nichts mehr aus.
  await page.keyboard.down("ArrowRight");
  await expect(page.getByText("1 von 3 geschafft")).toBeVisible();
  await page.keyboard.down("ArrowRight");
  await page.keyboard.down("ArrowRight");
  await page.keyboard.up("ArrowRight");
  await expect(card(page)).toBeVisible();

  await page.keyboard.press(" ");
  await expect(answerText(page)).toBeVisible();
  await page.keyboard.press("ArrowLeft");
  await expect(card(page)).toBeVisible();
  await expect(page.getByText("1 von 3 geschafft")).toBeVisible();
  await expect
    // Nach zufälliger ID gespeichert, also ohne Reihenfolge.
    .poll(async () => (await events(page)).map((event) => event.result).sort())
    .toEqual(["correct", "incorrect"]);
  expect(errors, "Fehler in der Konsole").toEqual([]);
});

test("Wischen: vor dem Aufdecken nur aufdecken, danach bewerten", async ({ page }) => {
  const errors = collectErrors(page);
  await startPractice(page, "Englisch – Wischen");

  await swipe(page, card(page), 120);
  await expect(answerText(page)).toBeVisible();
  await expect(page.getByRole("button", { name: "Gewusst" })).toBeVisible();
  expect(await events(page)).toHaveLength(0);

  // Zu kurz oder senkrecht: keine Bewertung.
  await swipe(page, answerSide(page), 40);
  await expect(answerText(page)).toBeVisible();
  expect(await events(page)).toHaveLength(0);

  await swipe(page, answerSide(page), 120);
  await expect(page.getByText("1 von 3 geschafft")).toBeVisible();
  await card(page).click();
  await swipe(page, answerSide(page), -120);
  await expect(card(page)).toBeVisible();
  await expect
    // Nach zufälliger ID gespeichert, also ohne Reihenfolge.
    .poll(async () => (await events(page)).map((event) => event.result).sort())
    .toEqual(["correct", "incorrect"]);
  expect(errors, "Fehler in der Konsole").toEqual([]);
});

test("Rückseite zeigt Grammatik, Beispiele und Notiz", async ({ page }) => {
  const errors = collectErrors(page);
  const title = "Englisch – Spielzeug";
  const entry = (term: string, meaning: string) => ({
    term,
    meanings: [meaning],
    grammar: { partOfSpeech: "noun", plural: `${term}s` },
    examples: [{ text: `My ${term} is new.`, translation: `Mein ${meaning} ist neu.` }],
    notes: `Notiz zu ${term}`,
  });
  const file = {
    format: "vokabeltrainer-set",
    formatVersion: 1,
    set: { title, termLanguage: "en", meaningLanguage: "de" },
    sections: [
      {
        title: "Spielzeug",
        entries: [entry("kite", "Drachen"), entry("ball", "Ball"), entry("doll", "Puppe")],
      },
    ],
  };
  await importText(page, JSON.stringify(file), `„${title}“ mit 3 Einträgen gespeichert.`);
  await startLearning(page, title);

  const term = (await page.locator(".card .prompt").textContent())!;
  await card(page).click();
  const details = page.locator(".details");
  await expect(details.getByText("Wortart: noun · Plural: " + term + "s")).toBeVisible();
  await expect(details.getByText(`My ${term} is new.`)).toHaveAttribute("lang", "en");
  await expect(details.getByText(`Notiz: Notiz zu ${term}`)).toBeVisible();
  expect(errors, "Fehler in der Konsole").toEqual([]);
});

test("Zu wenige Einträge für Multiple Choice: Die Karten kommen als Karteikarten", async ({
  page,
}) => {
  const errors = collectErrors(page);
  const title = "Englisch – Rückfall";
  await importSet(page, title);
  await page.getByRole("link", { name: `${title} lernen` }).click();
  await page.getByRole("slider", { name: "Multiple Choice" }).fill("100");
  await page.getByRole("button", { name: "3 Vokabeln lernen" }).click();

  for (let i = 0; i < 3; i++) await rate(page, "Gewusst");
  await expect(page.getByRole("heading", { name: "Geschafft" })).toBeVisible();
  expect((await events(page)).map((event) => event.mode)).toEqual([
    "flashcard",
    "flashcard",
    "flashcard",
  ]);
  expect((await sessions(page))[0]!.config.mcShare).toBe(100);
  expect(errors, "Fehler in der Konsole").toEqual([]);
});
