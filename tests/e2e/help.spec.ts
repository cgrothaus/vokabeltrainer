// E2E-16 (TDD 15.4): Empty State und „Vokabelset hinzufügen“ mit Schritten und Vorlage samt
// Formatbeschreibung – AK-14, FR-20, FR-28, D-26, D-65, D-71.
import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { collectErrors, importSet } from "./support";

const spec = readFileSync(
  new URL("../../docs/Formatspezifikation_Vokabelset_v1.md", import.meta.url),
  "utf8",
);

type Recorded = { copied: string | null };

/** Zwischenablage als Attrappe: Chromium und WebKit bieten sie je nach System an. */
const withStubs = (page: Page, copy: "ok" | "fail") =>
  page.addInitScript((copy) => {
    const w = window as unknown as { recorded: Recorded };
    w.recorded = { copied: null };
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async (text: string) => {
          if (copy === "fail") throw new DOMException("Nicht erlaubt", "NotAllowedError");
          w.recorded.copied = text;
        },
      },
    });
  }, copy);

/** Die Vorlage, wie sie im Chat landet: Begleittext, ganze Spezifikation, Auftrag (D-65). */
const NEW_SET_PROMPT = `Hier ist die Formatbeschreibung für meinen Vokabeltrainer:\n\n${spec.trimEnd()}\n\nMach aus den Vokabeln auf den angehängten Fotos oder Seiten ein Vokabelset in diesem Format.`;

const recorded = (page: Page) =>
  page.evaluate(() => (window as unknown as { recorded: Recorded }).recorded);

test("E2E-16 Empty State → Vokabelset hinzufügen → Vorlage mit Formatbeschreibung kopieren", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await withStubs(page, "ok");
  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: "Lerne Vokabeln mit Karteikarten" }),
  ).toBeVisible();
  // Die Wege unter der Liste stecken bei leerer Bibliothek im Empty State; die Anleitung steht im
  // Hinzufügen selbst (D-71).
  await expect(page.getByRole("link", { name: "Vokabelset hinzufügen", exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByRole("link", { name: "Wie bekomme ich ein Vokabelset?" })).toHaveCount(0);

  await page.getByRole("link", { name: "Erstes Vokabelset hinzufügen" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Vokabelset hinzufügen" }),
  ).toBeVisible();
  // Die Schritte in der Reihenfolge des Wegs: erst die Vorlage, dann die Antwort.
  const steps = page.locator(".steps > li");
  await expect(steps).toHaveCount(3);
  await expect(
    steps.nth(1).getByRole("button", { name: "Vorlage kopieren", exact: true }),
  ).toBeVisible();
  await expect(steps.nth(2).getByText("Datei auswählen")).toBeVisible();

  // Die Vorlage zeigt zugeklappt Begleittext und Auftrag, kopiert wird sie mit der ganzen
  // Formatbeschreibung.
  const prompt = page.locator("#import-prompt");
  await expect(prompt).toBeHidden();
  await page.getByText("Was wird kopiert?").click();
  await expect(prompt).toContainText("Formatbeschreibung der App – wird mitkopiert");
  await expect(prompt).not.toContainText("formatspezifikation.md");

  await page.getByRole("button", { name: "Vorlage kopieren", exact: true }).click();
  await expect(page.getByText("Vorlage kopiert.", { exact: true })).toBeVisible();
  expect((await recorded(page)).copied).toBe(NEW_SET_PROMPT);

  // Zugeklappt darunter der Weg zur Korrektur über „Exportieren“ (D-44, D-53, D-65), ohne Vorlage.
  await page.getByText("Ein Set korrigieren").click();
  await expect(page.getByText(/im Menü „Exportieren“/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Korrekturvorlage kopieren" })).toHaveCount(0);

  await page.getByText("So sieht ein Vokabelset aus").click();
  await expect(page.getByText('"format": "vokabeltrainer-set"')).toBeVisible();
  expect(errors, "Fehler in der Konsole").toEqual([]);
});

test("Kopieren scheitert → Hinweis, ganze Vorlage steht markiert im Feld", async ({ page }) => {
  await withStubs(page, "fail");
  await page.goto("./#/import");
  await page.getByRole("button", { name: "Vorlage kopieren", exact: true }).click();
  await expect(page.getByText(/^Kopieren hat nicht geklappt\./)).toBeVisible();
  const area = page.getByRole("textbox", { name: "Vorlage zum Kopieren" });
  await expect(area).toBeFocused();
  expect(await area.inputValue()).toBe(NEW_SET_PROMPT);
  expect(
    await area.evaluate(
      (element: HTMLTextAreaElement) => element.selectionEnd - element.selectionStart,
    ),
  ).toBe(NEW_SET_PROMPT.length);
});

test("Formatbeschreibung liegt neben der App, auch offline und im Browser mit der App", async ({
  page,
  context,
}) => {
  await page.goto("./");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // Über den Service Worker: Ein Link auf die Datei zeigt die Datei, nicht die App.
  await page.goto("./formatspezifikation.md");
  expect(await page.locator("body").textContent()).toBe(spec);

  await context.setOffline(true);
  await page.goto("./formatspezifikation.md");
  expect(await page.locator("body").textContent()).toBe(spec);
});

test("Bibliothek mit Sets ohne eigene Hilfe, die alte Adresse führt zum Hinzufügen", async ({
  page,
}) => {
  await importSet(page, "Englisch – Wetter");
  await expect(
    page.getByRole("link", { name: "Vokabelset hinzufügen", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Wie bekomme ich ein Vokabelset?" })).toHaveCount(0);
  // Lesezeichen auf die frühere Hilfe (D-71); ersetzt im Verlauf, Zurück führt nicht in die Umleitung.
  await page.goto("./#/help");
  await expect(
    page.getByRole("heading", { level: 1, name: "Vokabelset hinzufügen" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/#\/import$/);
});
