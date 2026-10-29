// E2E-23 Backup-Erinnerung (S-27, TDD 6.6, FR-31, AK-20, D-39): erst mit Antworten, „Später“ stellt
// um drei Tage zurück, „Backup speichern“ liefert direkt aus; nach einem Backup erinnert die App nur,
// wenn es seither neue Antworten gibt. Die Uhr steht per `page.clock.setFixedTime`, Timer laufen weiter.
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
const reminder = (page: Page) => page.getByText(/Sichere deinen Lernstand/);

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
  await page.getByRole("button", { name: /Tippen zum Aufdecken/ }).click();
  await page.getByRole("button", { name: "Gewusst" }).click();
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

test("E2E-23 Erinnerung erst mit Antworten, zurückstellen, speichern, wieder nur bei neuen Antworten", async ({
  page,
}) => {
  const errors = collectErrors(page);
  // Gewährter Speicher: kein Speicherschutz-Hinweis neben der Erinnerung.
  await fakeDevice(page, { granted: true });
  await withShare(page);
  await page.clock.setFixedTime(new Date("2026-11-01T10:00:00.000Z"));

  await importSet(page, TITLE);
  await reopen(page);
  await expect(reminder(page)).toHaveCount(0);

  await answerOnce(page);
  await expect(reminder(page)).toHaveText(
    "Du hast noch kein Backup gespeichert. Sichere deinen Lernstand, damit er nicht verloren geht.",
  );

  await page.getByRole("button", { name: "Später" }).click();
  await expect(reminder(page)).toHaveCount(0);
  await expect
    .poll(() => meta(page, "backupReminderSnoozedUntil"))
    .toBe("2026-11-04T10:00:00.000Z");
  await reopen(page);
  await expect(reminder(page)).toHaveCount(0);

  await page.clock.setFixedTime(new Date("2026-11-04T10:00:00.000Z"));
  await reopen(page);
  await expect(reminder(page)).toBeVisible();
  await page.getByRole("button", { name: "Backup speichern" }).click();
  await expect(page.getByText("Backup gespeichert.", { exact: true })).toBeVisible();
  await expect(reminder(page)).toHaveCount(0);
  expect(await meta(page, "lastBackupAt")).toBe("2026-11-04T10:00:00.000Z");

  // 15 Tage später ohne Lernen: nichts Neues zu sichern (F-5).
  await page.clock.setFixedTime(new Date("2026-11-19T10:00:00.000Z"));
  await reopen(page);
  await expect(reminder(page)).toHaveCount(0);

  await answerOnce(page);
  await expect(reminder(page)).toHaveText(
    "Dein letztes Backup ist 15 Tage alt. Sichere deinen Lernstand, damit er nicht verloren geht.",
  );
  expect(errors, "Fehler in der Konsole").toEqual([]);
});
