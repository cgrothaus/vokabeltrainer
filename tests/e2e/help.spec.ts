// E2E-16 (TDD 15.4): Empty State und Hilfe mit Vorlage und Formatbeschreibung – AK-14, FR-20, FR-28, D-26.
import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { collectErrors, importSet } from "./support";

const spec = readFileSync(
  new URL("../../docs/Formatspezifikation_Vokabelset_v1.md", import.meta.url),
  "utf8",
);

type Recorded = {
  copied: string | null;
  shared: { name: string; type: string; text: string } | null;
};

/** Zwischenablage und Teilen-Menü als Attrappen: Chromium und WebKit bieten sie je nach System an. */
const withStubs = (page: Page, copy: "ok" | "fail") =>
  page.addInitScript((copy) => {
    const w = window as unknown as { recorded: Recorded };
    w.recorded = { copied: null, shared: null };
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async (text: string) => {
          if (copy === "fail") throw new DOMException("Nicht erlaubt", "NotAllowedError");
          w.recorded.copied = text;
        },
      },
    });
    Object.defineProperty(Navigator.prototype, "canShare", { value: () => true });
    Object.defineProperty(Navigator.prototype, "share", {
      value: async ({ files }: { files: File[] }) => {
        const file = files[0]!;
        w.recorded.shared = { name: file.name, type: file.type, text: await file.text() };
      },
    });
  }, copy);

const recorded = (page: Page) =>
  page.evaluate(() => (window as unknown as { recorded: Recorded }).recorded);

test("E2E-16 Empty State → Hilfe → Vorlage kopieren und Formatbeschreibung teilen", async ({
  page,
  baseURL,
}) => {
  const errors = collectErrors(page);
  await withStubs(page, "ok");
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "Noch keine Vokabelsets" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Erstes Vokabelset importieren" })).toBeVisible();
  // Die Wege unter der Liste stecken bei leerer Bibliothek im Empty State.
  await expect(page.getByRole("link", { name: "Vokabelset importieren", exact: true })).toHaveCount(
    0,
  );

  await page.getByRole("link", { name: "Wie bekomme ich ein Vokabelset?" }).click();
  await expect(
    page.getByRole("heading", { name: "Wie bekomme ich ein Vokabelset?" }),
  ).toBeVisible();
  const link = new URL("formatspezifikation.md", baseURL).href;
  const prompt = page.locator("#help-prompt");
  await expect(prompt).toContainText(link);
  await expect(prompt).not.toContainText("[Link zur Formatbeschreibung]");

  await page.getByRole("button", { name: "Vorlage kopieren" }).click();
  await expect(page.getByText("Vorlage kopiert.", { exact: true })).toBeVisible();
  expect((await recorded(page)).copied).toBe(await prompt.textContent());

  await page.getByRole("button", { name: "Formatbeschreibung teilen" }).click();
  await expect(page.getByText("Formatbeschreibung geteilt.", { exact: true })).toBeVisible();
  expect((await recorded(page)).shared).toEqual({
    name: "Formatbeschreibung-Vokabeltrainer.txt",
    type: "text/plain",
    text: spec,
  });

  await page.getByText("So sieht ein Vokabelset aus").click();
  await expect(page.getByText('"format": "vokabeltrainer-set"')).toBeVisible();

  await page.getByRole("link", { name: "Vokabelset importieren" }).first().click();
  await expect(page.getByRole("heading", { name: "Vokabelset importieren" })).toBeVisible();
  expect(errors, "Fehler in der Konsole").toEqual([]);
});

test("Kopieren scheitert → Hinweis, Vorlage ist markiert", async ({ page }) => {
  await withStubs(page, "fail");
  await page.goto("./#/help");
  await page.getByRole("button", { name: "Vorlage kopieren" }).click();
  await expect(page.getByText("Kopieren hat nicht geklappt.")).toBeVisible();
  const selected = await page.evaluate(() => getSelection()?.toString());
  expect(selected).toBe(await page.locator("#help-prompt").textContent());
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
  await page.goto("./#/help");
  await expect(page.getByRole("button", { name: "Formatbeschreibung teilen" })).toBeEnabled();
  await page.goto("./formatspezifikation.md");
  expect(await page.locator("body").textContent()).toBe(spec);
});

test("Hilfe ist aus Bibliothek mit Sets und aus dem Import erreichbar", async ({ page }) => {
  await importSet(page, "Englisch – Wetter");
  await expect(page.getByRole("heading", { name: "Noch keine Vokabelsets" })).toHaveCount(0);
  await page.getByRole("link", { name: "Wie bekomme ich ein Vokabelset?" }).click();
  await expect(
    page.getByRole("heading", { name: "Wie bekomme ich ein Vokabelset?" }),
  ).toBeVisible();
  await page.goto("./#/import");
  await page.getByRole("link", { name: "Wie bekomme ich ein Vokabelset?" }).click();
  await expect(
    page.getByRole("heading", { name: "Wie bekomme ich ein Vokabelset?" }),
  ).toBeVisible();
});
