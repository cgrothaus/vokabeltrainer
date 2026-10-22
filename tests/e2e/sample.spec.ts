// Beispielset (S-16): aus dem Empty State laden und üben (FR-32, AK-23, TDD 13.2). Vorläufer von E2E-05;
// Multiple Choice und Ergebnis ergänzt S-18.
import { expect, test } from "@playwright/test";
import type { StoredSet } from "../../src/domain/model";
import { collectErrors, importSet, libraryMessage, readStore } from "./support";

const TITLE = "Englisch – Grundwortschatz (Beispielset)";

test("Empty State → Beispielset ausprobieren → Set-Ansicht → Lernen", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("./");
  await page.getByRole("button", { name: "Beispielset ausprobieren" }).click();

  await expect(page).toHaveURL(/#\/set\/[2-9a-hjkmnp-z]{10}$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(TITLE);
  // Die Notiz des Sets nennt die Herkunft auch; deshalb genau.
  await expect(page.getByText("Eigene Zusammenstellung", { exact: true })).toBeVisible();
  await expect(page.getByText("CC0", { exact: true })).toBeVisible();
  await expect(page.locator("summary")).toHaveText([
    "In der Schule 15 Einträge",
    "Freizeit und Sport 14 Einträge",
    "Essen und Trinken 14 Einträge",
    "Unterwegs 14 Einträge",
  ]);
  const [set] = await readStore<StoredSet>(page, "sets");
  expect(set).toMatchObject({ title: TITLE, source: "Eigene Zusammenstellung", license: "CC0" });
  expect(set!.sections.flatMap((section) => section.entries.map((entry) => entry.id))).toHaveLength(
    57,
  );

  await page.getByRole("button", { name: `${TITLE} lernen` }).click();
  await expect(page.getByText("0 von 57 geschafft")).toBeVisible();
  expect(errors, "Fehler in der Konsole").toEqual([]);
});

test("Beispielset gibt es nur bei leerer Bibliothek, nach dem Löschen wieder", async ({ page }) => {
  const errors = collectErrors(page);
  await importSet(page, "Englisch – Wetter");
  await expect(page.getByRole("button", { name: "Beispielset ausprobieren" })).toHaveCount(0);

  await page.getByRole("link", { name: "Englisch – Wetter" }).click();
  await page.getByRole("button", { name: "Set löschen" }).click();
  await page.getByRole("button", { name: "Set mit 3 Einträgen löschen" }).click();
  await expect(libraryMessage(page)).toHaveText("„Englisch – Wetter“ gelöscht.");
  await expect(page.getByRole("button", { name: "Beispielset ausprobieren" })).toBeVisible();
  expect(errors, "Fehler in der Konsole").toEqual([]);
});
