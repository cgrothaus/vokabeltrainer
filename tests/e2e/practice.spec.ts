// Lernsitzung (S-08, S-18): E2E-01 (AK-01, AK-09), das Ende einer Sitzung (TDD 12.2, 12.5) und die
// Bedienwege der Karteikarte (TDD 12.3, FR-09).
import { expect, type Page, test } from "@playwright/test";
import type { ReviewEvent, Session } from "../../src/domain/model";
import {
  collectErrors,
  goToSetup,
  importSet,
  importText,
  librarySets,
  MEANINGS,
  readStore,
  startLearning,
  swipe,
} from "./support";

/** Vorderseite der noch nicht aufgedeckten Karte; nach dem Aufdecken wendet sich die Karte (TDD 12.3). */
const card = (page: Page) => page.locator(".flash:not(.flipped) .front");
const promptText = (page: Page) => page.locator(".flash .front .prompt");
const answerSide = (page: Page) => page.locator(".flash.flipped");
const answerText = (page: Page) => page.locator(".flash.flipped .answer");

/** Deckt die aktuelle Karte auf, prüft die Antwort zur Frage und bewertet sie. */
async function rate(page: Page, button: "Nochmal" | "Gewusst"): Promise<void> {
  await card(page).click();
  const prompt = await promptText(page).textContent();
  await expect(answerText(page)).toHaveText(MEANINGS[prompt!]!);
  await page.getByRole("button", { name: button, exact: true }).click();
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

  await page.getByRole("link", { name: "Zur Bibliothek" }).click();
  await page.reload();
  await expect(librarySets(page)).toHaveText(["Englisch – Wetter 3 Einträge"]);
  expect(await events(page)).toEqual(answers);
  expect((await sessions(page))[0]).toMatchObject({
    status: "completed",
    endedAt: expect.any(String),
  });
  expect(errors, "Fehler in der Konsole").toEqual([]);
});

/** Der Zwischenstand ist ein Blatt über der Karte (D-51). */
const pause = (page: Page) => page.getByRole("dialog", { name: "Zwischenstand" });
const mistakes = (page: Page) => page.locator(".mistakes li");
const statuses = async (page: Page) => (await sessions(page)).map((s) => s.status).sort();

test("Beenden zeigt den Zwischenstand als Blatt; Weiterlernen setzt dieselbe Sitzung fort", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await startPractice(page, "Englisch – Zwischenstand");
  const missed = (await promptText(page).textContent())!;
  await rate(page, "Nochmal");
  await rate(page, "Gewusst");
  await expect(page.getByText("1 von 3 geschafft")).toBeVisible();

  await page.getByRole("button", { name: "Beenden" }).click();
  // Den Fokus bekommt der Satz mit dem Stand; die Fehler stehen erst im Ergebnis.
  await expect(pause(page).getByText("1 von 2 beim ersten Mal gewusst.")).toBeFocused();
  await expect(pause(page).getByText("Noch offen: 2 von 3 Vokabeln.")).toBeVisible();
  await expect(
    pause(page).getByText("Was du schon beantwortet hast, ist gespeichert."),
  ).toBeVisible();
  await expect(pause(page).getByRole("button", { name: /Nur Fehler/ })).toHaveCount(0);
  expect(await statuses(page)).toEqual(["active"]);

  await pause(page).getByRole("button", { name: "Weiterlernen (2 offen)" }).click();
  await expect(pause(page)).toHaveCount(0);
  await expect(page.getByText("1 von 3 geschafft")).toBeVisible();
  await rate(page, "Gewusst");
  await rate(page, "Gewusst");
  await expect(page.getByRole("heading", { name: "Geschafft" })).toBeVisible();
  await expect(page.getByText("2 von 3 beim ersten Mal gewusst.")).toBeVisible();
  await expect(mistakes(page)).toHaveText([`${missed} – ${MEANINGS[missed]}`]);
  await expect(mistakes(page).locator("span").first()).toHaveAttribute("lang", "en");
  await expect.poll(() => statuses(page)).toEqual(["completed"]);
  expect(await events(page)).toHaveLength(4);
  expect(errors, "Fehler in der Konsole").toEqual([]);
});

test("Zwischenstand → Bibliothek beendet die Sitzung; ohne Antwort führt Beenden gleich dorthin", async ({
  page,
}) => {
  await startPractice(page, "Englisch – Beenden");
  await rate(page, "Gewusst");
  await page.getByRole("button", { name: "Beenden" }).click();
  await expect(pause(page)).toBeVisible();
  await pause(page).getByRole("link", { name: "Zur Bibliothek" }).click();
  await expect(librarySets(page)).toHaveText(["Englisch – Beenden 3 Einträge"]);
  await expect.poll(() => statuses(page)).toEqual(["ended"]);
  expect(await events(page)).toHaveLength(1);

  await startLearning(page, "Englisch – Beenden");
  await page.getByRole("button", { name: "Beenden" }).click();
  await expect(librarySets(page)).toHaveText(["Englisch – Beenden 3 Einträge"]);
  await expect.poll(() => statuses(page)).toEqual(["ended", "ended"]);
});

test("Zurück zeigt den Zwischenstand, ein zweites Zurück verlässt die Sitzung", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await startPractice(page, "Englisch – Zurück");
  await rate(page, "Gewusst");
  await page.goBack();
  await expect(pause(page)).toBeVisible();
  await expect(page).toHaveURL(/#\/practice$/);
  expect(await statuses(page)).toEqual(["active"]);

  // Vorwärts geht es weiter, Zurück wieder zum Zwischenstand.
  await page.goForward();
  await expect(pause(page)).toHaveCount(0);
  await expect(card(page)).toBeVisible();
  await expect(page.getByText("1 von 3 geschafft")).toBeVisible();
  await page.goBack();
  await expect(pause(page)).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/#\/learn\//);
  await expect(page.getByRole("button", { name: "3 Vokabeln lernen" })).toBeVisible();
  await expect.poll(() => statuses(page)).toEqual(["ended"]);

  // Ohne Antwort gibt es keinen Zwischenstand.
  await page.getByRole("button", { name: "3 Vokabeln lernen" }).click();
  await expect(page.getByText("0 von 3 geschafft")).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/#\/learn\//);
  await expect.poll(() => statuses(page)).toEqual(["ended", "ended"]);
  expect(errors, "Fehler in der Konsole").toEqual([]);
});

test("Nur Fehler üben: nur die Fehler, eigene Sitzung mit Verweis, Einrichtung unverändert", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await startPractice(page, "Englisch – Fehler");
  const missed = (await promptText(page).textContent())!;
  await rate(page, "Nochmal");
  for (let i = 0; i < 3; i++) await rate(page, "Gewusst");
  await expect(page.getByRole("heading", { name: "Geschafft" })).toBeVisible();
  const settings = await readStore(page, "settings");

  await page.getByRole("button", { name: "Nur Fehler üben (1)" }).click();
  await expect(page.getByText("0 von 1 geschafft")).toBeVisible();
  await expect(promptText(page)).toHaveText(missed);
  await rate(page, "Gewusst");
  await expect(page.getByRole("heading", { name: "Geschafft" })).toBeVisible();
  await expect(page.getByText("1 von 1 beim ersten Mal gewusst.")).toBeVisible();
  await expect(page.locator(".mistakes")).toHaveCount(0);

  await expect.poll(() => statuses(page)).toEqual(["completed", "completed"]);
  const all = await sessions(page);
  const first = all.find((s) => !s.repeatOf)!;
  const repeat = all.find((s) => s.repeatOf)!;
  expect(repeat).toMatchObject({
    repeatOf: first.id,
    sectionIds: first.sectionIds,
    config: { ...first.config, count: 1 },
  });
  const repeated = (await events(page)).filter((event) => event.sessionId === repeat.id);
  expect(repeated).toMatchObject([{ direction: "termToMeaning", firstAttempt: true }]);
  expect(await readStore(page, "settings")).toEqual(settings);
  expect(errors, "Fehler in der Konsole").toEqual([]);
});

test("Den Zwischenstand ohne Wahl schließen setzt fort; Zurück zeigt ihn wieder", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await startPractice(page, "Englisch – Blatt schließen");
  await rate(page, "Nochmal");
  const beenden = page.getByRole("button", { name: "Beenden" });
  await beenden.click();
  await expect(pause(page)).toBeVisible();

  // Escape wie „Weiterlernen“: die Karte kommt wieder, der Fokus liegt auf ihr.
  await page.keyboard.press("Escape");
  await expect(pause(page)).toHaveCount(0);
  await expect(card(page)).toBeFocused();
  expect(await statuses(page)).toEqual(["active"]);

  // Der Zusatzeintrag im Verlauf ist wieder da: Zurück zeigt erneut den Zwischenstand.
  await page.goBack();
  await expect(pause(page)).toBeVisible();
  await expect(pause(page).getByRole("button", { name: "Weiterlernen (3 offen)" })).toBeVisible();
  await pause(page).getByRole("button", { name: "Weiterlernen (3 offen)" }).click();
  await rate(page, "Gewusst");
  await expect(page.getByText("1 von 3 geschafft")).toBeVisible();
  expect(await statuses(page)).toEqual(["active"]);
  expect(errors, "Fehler in der Konsole").toEqual([]);
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

  const term = (await promptText(page).textContent())!;
  await card(page).click();
  const details = page.locator(".details");
  await expect(details.getByText("Wortart: Nomen · Plural: " + term + "s")).toBeVisible();
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
  await goToSetup(page, title);
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
