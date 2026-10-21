// Minimale Lernsitzung (S-08): E2E-01 (AK-01, AK-09) und das Ende einer Sitzung (TDD 12.2, 12.5).
import { expect, type Page, test } from "@playwright/test";
import type { ReviewEvent, Session } from "../../src/domain/model";
import { collectErrors, importSet, librarySets, MEANINGS, readStore } from "./support";

const card = (page: Page) => page.getByRole("button", { name: /Tippen zum Aufdecken/ });

/** Deckt die aktuelle Karte auf, prüft die Antwort zur Frage und bewertet sie. */
async function rate(page: Page, button: "Nochmal" | "Gewusst"): Promise<void> {
  await card(page).click();
  const prompt = await page.locator(".card .prompt").textContent();
  await expect(page.locator(".card .answer")).toHaveText(MEANINGS[prompt!]!);
  await page.getByRole("button", { name: button }).click();
}

async function startPractice(page: Page, title: string): Promise<void> {
  await importSet(page, title);
  await page.getByRole("button", { name: `${title} lernen` }).click();
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
