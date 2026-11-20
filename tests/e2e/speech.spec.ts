// Vorlesen der Lernsprache (S-48, FR-40, AK-34): Knopf an Wörtern der Lernsprache in Set-Ansicht und
// Lernsitzung, nur mit einer Stimme auf dem Gerät; „Automatisch vorlesen“ in den Einstellungen
// (TDD 12.11, 13.6, D-59, D-61). `speechSynthesis` ist ersetzt; echte Stimmen prüft S-56 auf Geräten.
import { expect, type Page, test } from "@playwright/test";
import {
  collectErrors,
  fakeSpeech,
  goToSetup,
  importSet,
  MEANINGS,
  readStore,
  spoken,
  startLearning,
} from "./support";

const TITLE = "Englisch – Wetter";
const front = (page: Page) => page.locator(".flash:not(.flipped) .front");
const prompt = (page: Page) => page.locator(".flash .front .prompt");
const speakers = (page: Page) => page.getByRole("button", { name: /vorlesen$/ });

test("E2E-31 Mit englischer Stimme: Vorlesen in Set-Ansicht und Sitzung, automatisch nach Einstellung", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await fakeSpeech(page, [{ lang: "de-DE" }, { lang: "en-US" }]);
  await importSet(page, TITLE);

  // Set-Ansicht: ein Knopf je Wort, er liest nur das Wort der Lernsprache.
  await page.getByRole("link", { name: TITLE, exact: true }).click();
  await page.locator(".section summary").first().click();
  await expect(speakers(page)).toHaveCount(3);
  await page.getByRole("button", { name: "„rain“ vorlesen" }).click();
  expect(await spoken(page)).toEqual([{ text: "rain", lang: "en-US" }]);

  // Sitzung: Lernsprache → Muttersprache; ohne Einstellung wird nichts von selbst gesprochen.
  await startLearning(page, TITLE);
  await expect(front(page)).toBeVisible();
  const word = (await prompt(page).textContent())!;
  expect(await spoken(page)).toHaveLength(1);
  // Tippen auf den Lautsprecher liest vor, ohne die Karte aufzudecken.
  await page.getByRole("button", { name: `„${word}“ vorlesen` }).click();
  expect((await spoken(page)).at(-1)).toEqual({ text: word, lang: "en-US" });
  await expect(front(page)).toBeVisible();
  await page.getByRole("button", { name: "Beenden" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Vokabeltrainer");

  // Einstellungen: „Automatisch vorlesen“ ist aus und lässt sich einschalten.
  await page.getByRole("link", { name: "Einstellungen" }).click();
  const auto = page.getByRole("switch", { name: /Automatisch vorlesen/ });
  await expect(auto).not.toBeChecked();
  await auto.check();
  // Global gespeichert, ohne Doppelpunkt im Schlüssel (TDD 13.6).
  await expect
    .poll(() => readStore(page, "settings"))
    .toContainEqual({ key: "speakAloud", value: true });
  await page.reload();
  await expect(page.getByRole("switch", { name: /Automatisch vorlesen/ })).toBeChecked();

  // Jetzt spricht die Sitzung das Wort, sobald es erscheint.
  await page.goto("./");
  const before = (await spoken(page)).length;
  await startLearning(page, TITLE);
  await expect(front(page)).toBeVisible();
  const first = (await prompt(page).textContent())!;
  await expect
    .poll(async () => (await spoken(page)).slice(before))
    .toEqual([{ text: first, lang: "en-US" }]);
  // Die Bedeutungsseite wird nicht gelesen, auch nicht nach dem Aufdecken.
  await front(page).click();
  await expect(page.locator(".flash.flipped .answer")).toHaveText(MEANINGS[first]!);
  expect((await spoken(page)).slice(before)).toHaveLength(1);
  expect(errors, "Fehler in der Konsole").toEqual([]);
});

test("E2E-31 Muttersprache → Lernsprache: Lautsprecher erst nach dem Aufdecken", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await fakeSpeech(page, [{ lang: "en-GB" }]);
  await importSet(page, TITLE);
  await goToSetup(page, TITLE);
  await page.getByRole("radio", { name: "Deutsch → Englisch" }).check();
  await page.getByRole("button", { name: /^\d+ Vokabeln? lernen$/ }).click();
  await expect(front(page)).toBeVisible();
  await expect(speakers(page)).toHaveCount(0);
  await front(page).click();
  const answer = (await page.locator(".flash.flipped .answer").textContent())!;
  await page.getByRole("button", { name: `„${answer}“ vorlesen` }).click();
  expect(await spoken(page)).toEqual([{ text: answer, lang: "en-GB" }]);
  expect(errors, "Fehler in der Konsole").toEqual([]);
});

test("E2E-31 Ohne englische Stimme auf dem Gerät: kein Knopf und keine Einstellung", async ({
  page,
}) => {
  const errors = collectErrors(page);
  // Eine englische Stimme nur im Netz zählt nicht (TDD 14).
  await fakeSpeech(page, [{ lang: "de-DE" }, { lang: "en-US", online: true }]);
  await importSet(page, TITLE);
  await page.getByRole("link", { name: TITLE, exact: true }).click();
  await page.locator(".section summary").first().click();
  await expect(page.getByText("rain")).toBeVisible();
  await startLearning(page, TITLE);
  await expect(front(page)).toBeVisible();
  await expect(speakers(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Beenden" }).click();
  await page.getByRole("link", { name: "Einstellungen" }).click();
  await expect(page.getByRole("heading", { name: "Deine Daten" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Lernen" })).toBeHidden();
  await expect(page.getByRole("switch")).toHaveCount(0);
  expect(await spoken(page)).toEqual([]);
  expect(errors, "Fehler in der Konsole").toEqual([]);
});
