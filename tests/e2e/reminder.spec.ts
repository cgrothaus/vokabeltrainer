// E2E-23 Backup-Erinnerung (S-27, S-43, TDD 6.6, FR-31, AK-20, D-39, D-46): erst, wenn ungesicherte
// Antworten an drei Tagen entstanden sind oder die erste davon 7 Tage zurückliegt; als ruhige Zeile unter
// der Liste. „Später“ stellt um drei Tage zurück, „Sichern“ liefert direkt aus; nach einem Backup
// erinnert die App nur, wenn es seither neue Antworten gibt. Die Uhr steht per
// `page.clock.setFixedTime`, Timer laufen weiter.
import { expect, type Page, test } from "@playwright/test";
import {
  collectErrors,
  endPractice,
  fakeDevice,
  importSet,
  readStore,
  startLearning,
} from "./support";

const TITLE = "Englisch – Wetter";
/** Die Zeile mit Satz, „Sichern“ und „Später“; ihr Satz nennt den Grund. */
const reminder = (page: Page) => page.locator(".reminder");
const reminderText = (page: Page) => reminder(page).locator("p").first();
/** Ein Tag um 10 Uhr UTC; so liegen die Lerntage auch in Ortszeit auf verschiedenen Tagen. */
const day = (date: string) => new Date(`${date}T10:00:00.000Z`);

/** Teilen-Menü-Attrappe, die die Datei annimmt. */
const withShare = (page: Page) =>
  page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, "canShare", { value: () => true });
    Object.defineProperty(Navigator.prototype, "share", { value: async () => undefined });
  });

const meta = async (page: Page, key: string) =>
  (await readStore<{ key: string; value: unknown }>(page, "meta")).find(
    (record) => record.key === key,
  )?.value;

/** Eine Antwort „Gewusst“, dann über den Zwischenstand zurück in die Bibliothek. */
async function answerOnce(page: Page): Promise<void> {
  await startLearning(page, TITLE);
  await page.locator(".flash .front").click();
  await page.getByRole("button", { name: "Gewusst", exact: true }).click();
  await expect(page.getByText("1 von 3 geschafft")).toBeVisible();
  await endPractice(page);
}

/** Neu laden und warten, bis die Bibliothek ihre Hinweise geprüft hat. */
async function reopen(page: Page): Promise<void> {
  await page.reload();
  await expect(page.getByRole("link", { name: TITLE, exact: true })).toBeVisible();
  // Bis die Hinweise geprüft sind, ist ihr Bereich als beschäftigt markiert.
  await expect(page.locator(".hints")).not.toHaveAttribute("aria-busy");
}

test("E2E-23 Erinnerung erst nach drei Lerntagen, unter der Liste, zurückstellen, sichern, wieder nach 7 Tagen", async ({
  page,
}) => {
  const errors = collectErrors(page);
  // Gewährter Speicher: kein Speicherschutz-Hinweis neben der Erinnerung.
  await fakeDevice(page, { granted: true });
  await withShare(page);
  await page.clock.setFixedTime(day("2026-11-01"));

  await importSet(page, TITLE);
  await reopen(page);
  await expect(reminder(page)).toHaveCount(0);

  // Nach dem ersten Ausprobieren noch nicht, auch nicht am zweiten Lerntag (D-46).
  await answerOnce(page);
  await reopen(page);
  await expect(reminder(page)).toHaveCount(0);
  await page.clock.setFixedTime(day("2026-11-02"));
  await answerOnce(page);
  await reopen(page);
  await expect(reminder(page)).toHaveCount(0);

  await page.clock.setFixedTime(day("2026-11-03"));
  await answerOnce(page);
  await reopen(page);
  await expect(reminderText(page)).toHaveText("An 3 Tagen gelernt und noch nicht gesichert.");
  // Unter der Liste, nach „Vokabelset hinzufügen“, nicht darüber.
  await expect(page.locator(".more .reminder")).toBeVisible();
  await expect(page.locator(".hints .reminder")).toHaveCount(0);

  await reminder(page).getByRole("button", { name: "Später" }).click();
  await expect(reminder(page)).toHaveCount(0);
  await expect
    .poll(() => meta(page, "backupReminderSnoozedUntil"))
    .toBe("2026-11-06T10:00:00.000Z");
  await reopen(page);
  await expect(reminder(page)).toHaveCount(0);

  await page.clock.setFixedTime(day("2026-11-06"));
  await reopen(page);
  await expect(reminder(page)).toBeVisible();
  await reminder(page).getByRole("button", { name: "Sichern" }).click();
  await expect(page.getByText("Backup gespeichert.", { exact: true })).toBeVisible();
  await expect(reminderText(page)).toHaveText("Backup gespeichert.");
  expect(await meta(page, "lastBackupAt")).toBe("2026-11-06T10:00:00.000Z");

  // 15 Tage später ohne Lernen: nichts Neues zu sichern (F-5).
  await page.clock.setFixedTime(day("2026-11-21"));
  await reopen(page);
  await expect(reminder(page)).toHaveCount(0);

  // Eine neue Antwort allein genügt nicht; 7 Tage später schon (D-46).
  await answerOnce(page);
  await reopen(page);
  await expect(reminder(page)).toHaveCount(0);
  await page.clock.setFixedTime(day("2026-11-28"));
  await reopen(page);
  await expect(reminderText(page)).toHaveText("Dein letztes Backup ist 22 Tage alt.");
  expect(errors, "Fehler in der Konsole").toEqual([]);
});
