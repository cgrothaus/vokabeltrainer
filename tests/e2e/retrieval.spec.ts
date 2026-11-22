// Abrufüben in der Sitzung (S-47, AK-29): Fehler kommen erst nach sechs anderen Karten wieder und
// müssen zweimal gewusst werden (FR-10), Multiple Choice bietet falsche Antworten derselben Wortart
// und zeigt sie erst nach einer Pause zum Erinnern (FR-09, TDD 12.2, 12.3, D-60).
import { expect, type Page, test } from "@playwright/test";
import type { ReviewEvent } from "../../src/domain/model";
import { cardReady, collectErrors, goToSetup, importText, readStore, stopClock } from "./support";

const TITLE = "Englisch – Verben und Nomen";
const VERBS: Record<string, string> = {
  "to go": "gehen",
  "to run": "laufen",
  "to eat": "essen",
  "to read": "lesen",
};
const NOUNS: Record<string, string> = { house: "Haus", tree: "Baum", dog: "Hund", car: "Auto" };
const MEANING: Record<string, string> = { ...VERBS, ...NOUNS };

async function importWords(page: Page): Promise<void> {
  const entries = (words: Record<string, string>, partOfSpeech: string) =>
    Object.entries(words).map(([term, meaning]) => ({
      term,
      meanings: [meaning],
      grammar: { partOfSpeech },
    }));
  const file = {
    format: "vokabeltrainer-set",
    formatVersion: 1,
    set: { title: TITLE, termLanguage: "en", meaningLanguage: "de" },
    sections: [
      { title: "Verben", entries: entries(VERBS, "verb") },
      { title: "Nomen", entries: entries(NOUNS, "noun") },
    ],
  };
  await importText(page, JSON.stringify(file), `„${TITLE}“ mit 8 Einträgen gespeichert.`);
}

/** Alle acht Einträge, Lernsprache → Muttersprache, mit dem gegebenen Anteil an Multiple Choice. */
async function start(page: Page, mcShare: string): Promise<void> {
  await importWords(page);
  await goToSetup(page, TITLE);
  await page.getByRole("slider", { name: "Multiple Choice" }).fill(mcShare);
  await page.getByRole("radio", { name: /^alle/ }).check();
  await page.getByRole("button", { name: "8 Vokabeln lernen" }).click();
  await expect(page.getByText("0 von 8 geschafft")).toBeVisible();
}

const prompt = (page: Page) => page.locator(".flash .front .prompt, .question .prompt");

test("E2E-30 Ein Fehler kommt erst nach sechs anderen Karten wieder und muss zweimal gewusst werden", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await start(page, "0");
  const asked: string[] = [];
  const rate = async (rating: "Nochmal" | "Gewusst") => {
    await expect(page.locator(".flash:not(.flipped) .front")).toBeVisible();
    asked.push((await prompt(page).textContent())!);
    await page.getByRole("button", { name: /tipp zum Aufdecken/ }).click();
    await page.getByRole("button", { name: rating, exact: true }).click();
  };

  await rate("Nochmal");
  for (let i = 0; i < 7; i++) await rate("Gewusst");
  // Sechs andere dazwischen, dann der Fehler; einmal gewusst zählt er noch nicht.
  expect(asked[7]).toBe(asked[0]);
  expect(new Set(asked.slice(1, 7)).size).toBe(6);
  expect(asked.slice(1, 7)).not.toContain(asked[0]);
  await expect(page.getByText("6 von 8 geschafft")).toBeVisible();
  await rate("Gewusst");
  await rate("Gewusst");
  expect(asked[9]).toBe(asked[0]);
  await expect(page.getByRole("heading", { name: "Geschafft" })).toBeVisible();
  await expect(page.getByText("7 von 8 beim ersten Mal gewusst.")).toBeVisible();

  const answers = await readStore<ReviewEvent>(page, "reviewEvents");
  expect(answers).toHaveLength(10);
  expect(answers.filter((event) => event.firstAttempt)).toHaveLength(8);
  expect(errors, "Fehler in der Konsole").toEqual([]);
});

test("E2E-30 Multiple Choice: Antworten nach einer Pause oder auf Tippen, falsche derselben Wortart", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await start(page, "100");
  const options = page.locator(".options button");
  const show = page.getByRole("button", { name: "Antworten zeigen" });

  // Erste Frage: Die Antworten erscheinen ohne Tippen nach der Pause (TDD 12.3).
  await expect(options.first()).toBeHidden();
  await expect(page.locator(".question")).toBeFocused();
  await expect(options.first()).toBeVisible({ timeout: 6000 });
  await expect(show).toHaveCount(0);

  for (let question = 0; question < 8; question++) {
    if (question > 0) {
      await expect(options.first()).toBeHidden();
      // Die Eingabetaste zeigt sie wie „Antworten zeigen“ sofort, nach der Sperre.
      if (question % 2) {
        await cardReady(page);
        await page.keyboard.press("Enter");
      } else await show.click();
    }
    await expect(options).toHaveCount(4);
    const term = (await prompt(page).textContent())!;
    const texts = await options.allTextContents();
    const sameKind = Object.values(term in VERBS ? VERBS : NOUNS);
    expect(texts.toSorted()).toEqual(sameKind.toSorted());
    // Richtig: Es geht von selbst weiter (D-67).
    await options.nth(texts.indexOf(MEANING[term]!)).click();
  }
  await expect(page.getByRole("heading", { name: "Geschafft" })).toBeVisible();
  expect(errors, "Fehler in der Konsole").toEqual([]);
});

test("E2E-30 Multiple Choice: Nach einer richtigen Antwort geht es nach 1 s von selbst weiter, nach einer falschen nicht", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await importWords(page);
  await goToSetup(page, TITLE);
  await page.getByRole("slider", { name: "Multiple Choice" }).fill("100");
  await page.getByRole("radio", { name: /^alle/ }).check();
  await stopClock(page);
  await page.getByRole("button", { name: "8 Vokabeln lernen" }).click();

  const show = page.getByRole("button", { name: "Antworten zeigen" });
  const options = page.locator(".options button");
  const next = page.getByRole("button", { name: "Weiter" });
  const answer = async (right: boolean) => {
    // Erst wenn die Karte steht, läuft ihre Sperre.
    await expect(show).toHaveAttribute("aria-disabled", "true");
    await page.clock.runFor(1220);
    await show.click();
    const term = (await prompt(page).textContent())!;
    const texts = await options.allTextContents();
    const correct = texts.indexOf(MEANING[term]!);
    await options.nth(right ? correct : (correct + 1) % texts.length).click();
    // „Weiter“ erscheint erst nach dem Speichern; ab dann läuft die Zeit.
    await expect(next).toBeFocused();
    return term;
  };

  const first = await answer(true);
  await expect(page.getByText("Richtig.", { exact: true })).toBeVisible();
  await page.clock.runFor(900);
  await expect(prompt(page)).toHaveText(first);
  await expect(next).toBeVisible();
  await page.clock.runFor(100);
  await expect(next).toHaveCount(0);
  await expect(options.first()).toBeHidden();
  await expect(prompt(page)).not.toHaveText(first);

  const second = await answer(false);
  await expect(page.getByText(/^Leider falsch/)).toBeVisible();
  await page.clock.runFor(3000);
  await expect(prompt(page)).toHaveText(second);
  await next.click();
  await expect(prompt(page)).not.toHaveText(second);
  expect(errors, "Fehler in der Konsole").toEqual([]);
});

test("E2E-30 Sperre: Die Karteikarte lässt sich erst 1 s nach dem Einblenden aufdecken", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await importWords(page);
  await goToSetup(page, TITLE);
  await page.getByRole("slider", { name: "Multiple Choice" }).fill("0");
  await page.getByRole("radio", { name: /^alle/ }).check();
  // Angehaltene Uhr: Die Sperre läuft erst mit `runFor` ab (TDD 12.3).
  await stopClock(page);
  await page.getByRole("button", { name: "8 Vokabeln lernen" }).click();

  const front = page.getByRole("button", { name: /tipp zum Aufdecken/ });
  const uncover = page.getByRole("button", { name: "Aufdecken", exact: true });
  const flipped = page.locator(".flash.flipped");
  await expect(front).toBeFocused();
  await expect(uncover).toHaveAttribute("aria-disabled", "true");
  // Tippen, Enter und „Aufdecken“ wirken noch nicht.
  await front.click({ force: true });
  await page.keyboard.press("Enter");
  await uncover.click({ force: true });
  await expect(flipped).toHaveCount(0);
  // 1 s ab dem Ende des Einblendens (0,22 s).
  await page.clock.runFor(1219);
  await expect(uncover).toHaveAttribute("aria-disabled", "true");
  await page.clock.runFor(1);
  await expect(uncover).not.toHaveAttribute("aria-disabled");
  await page.keyboard.press("Enter");
  await expect(flipped).toHaveCount(1);
  expect(errors, "Fehler in der Konsole").toEqual([]);
});

test("E2E-30 Sperre vor „Antworten zeigen“", async ({ page }) => {
  const errors = collectErrors(page);
  await importWords(page);
  await goToSetup(page, TITLE);
  await page.getByRole("slider", { name: "Multiple Choice" }).fill("100");
  await page.getByRole("radio", { name: /^alle/ }).check();
  await stopClock(page);
  await page.getByRole("button", { name: "8 Vokabeln lernen" }).click();

  const show = page.getByRole("button", { name: "Antworten zeigen" });
  const options = page.locator(".options button");
  await expect(page.locator(".question")).toBeFocused();
  await expect(show).toHaveAttribute("aria-disabled", "true");
  await show.click({ force: true });
  await page.keyboard.press("Enter");
  await expect(options.first()).toBeHidden();
  await page.clock.runFor(1219);
  await expect(show).toHaveAttribute("aria-disabled", "true");
  await page.clock.runFor(1);
  await show.click();
  await expect(options.first()).toBeVisible();
  expect(errors, "Fehler in der Konsole").toEqual([]);
});

test("E2E-30 Tippen auf die Frage zeigt die Antworten vorzeitig, aber erst nach der Sperre", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await importWords(page);
  await goToSetup(page, TITLE);
  await page.getByRole("slider", { name: "Multiple Choice" }).fill("100");
  await page.getByRole("radio", { name: /^alle/ }).check();
  await stopClock(page);
  await page.getByRole("button", { name: "8 Vokabeln lernen" }).click();

  const show = page.getByRole("button", { name: "Antworten zeigen" });
  const options = page.locator(".options button");
  const question = page.locator(".question .prompt");
  await expect(show).toHaveAttribute("aria-disabled", "true");
  await question.click({ force: true });
  await expect(options.first()).toBeHidden();
  await page.clock.runFor(1220);
  await expect(show).not.toHaveAttribute("aria-disabled");
  await question.click();
  await expect(options.first()).toBeVisible();
  expect(errors, "Fehler in der Konsole").toEqual([]);
});

test("E2E-30 Ohne Eingreifen zeigt Multiple Choice die Antworten nach 2 s", async ({ page }) => {
  const errors = collectErrors(page);
  await importWords(page);
  await goToSetup(page, TITLE);
  await page.getByRole("slider", { name: "Multiple Choice" }).fill("100");
  await page.getByRole("radio", { name: /^alle/ }).check();
  await stopClock(page);
  await page.getByRole("button", { name: "8 Vokabeln lernen" }).click();

  const options = page.locator(".options button");
  await expect(page.getByRole("button", { name: "Antworten zeigen" })).toHaveAttribute(
    "aria-disabled",
    "true",
  );
  // 2 s ab dem Ende des Einblendens (0,22 s).
  await page.clock.runFor(2219);
  await expect(options.first()).toBeHidden();
  await page.clock.runFor(1);
  await expect(options.first()).toBeVisible();
  expect(errors, "Fehler in der Konsole").toEqual([]);
});
