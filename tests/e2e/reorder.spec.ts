// Reihenfolge ändern (S-45): E2E-29 – im eigenen Modus von „Set bearbeiten“ Einträge mit Pfeiltasten am
// Griff, über das Menü „···“ und per Ziehen verschieben, auch in eine andere Sektion; Zurück beendet den
// Modus, die Reihenfolge bleibt nach dem Neuladen (TDD 10, D-54, FR-03, AK-25).
import { expect, type Page, test } from "@playwright/test";
import type { StoredSet } from "../../src/domain/model";
import { backButton, collectErrors, importText, readStore, setAction } from "./support";

const TITLE = "Englisch – Alltag";

const FILE = JSON.stringify({
  format: "vokabeltrainer-set",
  formatVersion: 1,
  set: { title: TITLE, termLanguage: "en", meaningLanguage: "de" },
  sections: [
    {
      title: "Wetter",
      entries: [
        { term: "rain", meanings: ["Regen"] },
        { term: "sun", meanings: ["Sonne"] },
      ],
    },
    { title: "Kleidung", entries: [{ term: "coat", meanings: ["Mantel"] }] },
  ],
});

const heading = (page: Page) => page.getByRole("heading", { level: 1 });
const status = (page: Page) => page.locator("main p[aria-live]");
const grip = (page: Page, term: string) =>
  page.getByRole("button", { name: `„${term}“ verschieben: ziehen oder Pfeiltasten` });

/** Begriffe je Sektion, wie sie im Sortiermodus stehen. */
const order = (page: Page) =>
  page
    .locator(".sort-list")
    .evaluateAll((lists) =>
      lists.map((list) =>
        [...list.querySelectorAll("li[data-entry-id] .pair > span:first-child")].map(
          (term) => term.textContent,
        ),
      ),
    );

const stored = async (page: Page) =>
  (await readStore<StoredSet>(page, "sets"))[0]!.sections.map((section) =>
    section.entries.map((entry) => entry.term.text),
  );

async function openSorting(page: Page): Promise<void> {
  await importText(page, FILE, `„${TITLE}“ mit 3 Einträgen gespeichert.`);
  await page.getByRole("link", { name: TITLE, exact: true }).click();
  await setAction(page, "Bearbeiten");
  await page.getByRole("button", { name: "Reihenfolge ändern" }).click();
  await expect(heading(page)).toHaveText("Reihenfolge ändern");
}

/**
 * Zieht den Griff von `term` in Schritten zum Ziel und lässt sofort los, ohne auf ein Bild zu warten:
 * Die Lücke muss dann an der Stelle des letzten Zeigers stehen.
 */
async function drag(page: Page, term: string, target: { x: number; y: number }): Promise<void> {
  const box = (await grip(page, term).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  const steps = 12;
  for (let step = 1; step <= steps; step++) {
    await page.mouse.move(
      box.x + box.width / 2 + ((target.x - box.x - box.width / 2) * step) / steps,
      box.y + box.height / 2 + ((target.y - box.y - box.height / 2) * step) / steps,
    );
  }
  await page.mouse.up();
}

test("E2E-29 Pfeiltasten und Menü: über Sektionsgrenzen, Fokus bleibt, Zurück beendet den Modus", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await openSorting(page);

  // Unten am Rand der Sektion wechselt der Eintrag an den Anfang der nächsten.
  await grip(page, "sun").focus();
  await page.keyboard.press("ArrowDown");
  await expect(status(page)).toHaveText("„sun“ steht jetzt in „Kleidung“.");
  await expect(grip(page, "sun")).toBeFocused();
  expect(await order(page)).toEqual([["rain"], ["sun", "coat"]]);
  await page.keyboard.press("ArrowDown");
  await expect(status(page)).toHaveText("„sun“ verschoben.");
  expect(await order(page)).toEqual([["rain"], ["coat", "sun"]]);

  // Über das Menü in eine andere Sektion, ans Ende.
  await page.getByRole("button", { name: "„rain“ verschieben", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "In andere Sektion …" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Kleidung" }).click();
  await expect(status(page)).toHaveText("„rain“ steht jetzt in „Kleidung“.");
  await expect(page.getByRole("button", { name: "„rain“ verschieben", exact: true })).toBeFocused();
  expect(await order(page)).toEqual([[], ["coat", "sun", "rain"]]);
  await expect(page.locator(".drop-empty").first()).toBeVisible();

  // Der Modus liegt auf einem eigenen Verlaufseintrag: Neuladen bleibt darin, Zurück beendet ihn.
  await page.reload();
  await expect(heading(page)).toHaveText("Reihenfolge ändern");
  expect(await order(page)).toEqual([[], ["coat", "sun", "rain"]]);
  await backButton(page).click();
  await expect(heading(page)).toHaveText(`${TITLE} bearbeiten`);
  await page.goForward();
  await expect(heading(page)).toHaveText("Reihenfolge ändern");
  await page.getByRole("button", { name: "Fertig" }).click();
  await expect(heading(page)).toHaveText(`${TITLE} bearbeiten`);
  await page.goBack();
  await expect(heading(page)).toHaveText(TITLE);

  expect(await stored(page)).toEqual([[], ["coat", "sun", "rain"]]);
  expect(errors).toEqual([]);
});

test("E2E-29 Ziehen am Griff: innerhalb der Sektion und in eine andere", async ({ page }) => {
  const errors = collectErrors(page);
  await openSorting(page);

  // „rain“ unter „sun“.
  const sun = (await page.locator("li[data-entry-id]").filter({ hasText: "sun" }).boundingBox())!;
  await drag(page, "rain", { x: sun.x + 60, y: sun.y + sun.height - 2 });
  await expect(status(page)).toHaveText("„rain“ verschoben.");
  expect(await order(page)).toEqual([["sun", "rain"], ["coat"]]);

  // „sun“ über „coat“ in die zweite Sektion.
  const coat = (await page.locator("li[data-entry-id]").filter({ hasText: "coat" }).boundingBox())!;
  await drag(page, "sun", { x: coat.x + 60, y: coat.y + 2 });
  await expect(status(page)).toHaveText("„sun“ steht jetzt in „Kleidung“.");
  expect(await order(page)).toEqual([["rain"], ["sun", "coat"]]);
  await expect(page.locator(".ghost")).toHaveCount(0);

  expect(await stored(page)).toEqual([["rain"], ["sun", "coat"]]);
  expect(errors).toEqual([]);
});

test("E2E-29 Loslassen zählt die Stelle des letzten Zeigers, auch wenn kein Bild dazwischen kam", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await openSorting(page);
  // Ohne Bilder folgt die Lücke dem Zeiger nicht von selbst (so langsam kann ein Gerät sein);
  // beim Loslassen muss die App sie trotzdem an die Stelle des Zeigers setzen.
  await page.evaluate(() => {
    window.requestAnimationFrame = () => 0;
  });
  const sun = (await page.locator("li[data-entry-id]").filter({ hasText: "sun" }).boundingBox())!;
  await drag(page, "rain", { x: sun.x + 60, y: sun.y + sun.height - 2 });
  await expect(status(page)).toHaveText("„rain“ verschoben.");
  expect(await order(page)).toEqual([["sun", "rain"], ["coat"]]);
  expect(await stored(page)).toEqual([["sun", "rain"], ["coat"]]);
  expect(errors).toEqual([]);
});

test("E2E-29 Auf dem Tablet stehen die Sektionen als Spalten", async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 800 });
  await openSorting(page);
  const [first, second] = await page.locator(".sort-section").all();
  const a = (await first!.boundingBox())!;
  const b = (await second!.boundingBox())!;
  expect(b.x).toBeGreaterThan(a.x + a.width - 1);
  expect(Math.abs(b.y - a.y)).toBeLessThan(2);
});
