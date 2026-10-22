// Einstellungen (S-21): E2E-17 Darstellung (FR-25, TDD 13.5), E2E-18 Alle Daten löschen (TDD 10),
// App-Version und Wege. Das Farbschema des Geräts wird mit `emulateMedia` umgestellt.
import { expect, type Page, test } from "@playwright/test";
import {
  collectErrors,
  endPractice,
  importSet,
  libraryMessage,
  readStore,
  startLearning,
} from "./support";

type Colors = Record<string, string>;

const STORES = ["sets", "reviewEvents", "sessions", "settings"] as const;

/**
 * Namen der Farbvariablen aus dem dunklen Block für „wie auf dem Gerät“. Lightningcss ergänzt dort
 * eigene Hilfsvariablen für `color-scheme`; sie gehören nicht zu den Farben.
 */
const darkVariables = (page: Page) =>
  page.evaluate(() => {
    const names = new Set<string>();
    for (const sheet of document.styleSheets)
      for (const rule of sheet.cssRules)
        if (rule instanceof CSSMediaRule && /prefers-color-scheme:\s*dark/.test(rule.conditionText))
          for (const inner of rule.cssRules)
            for (const name of (inner as CSSStyleRule).style)
              if (name.startsWith("--") && !name.startsWith("--lightningcss")) names.add(name);
    return [...names];
  });

const colors = (page: Page, names: string[]): Promise<Colors> =>
  page.evaluate((names) => {
    const style = getComputedStyle(document.documentElement);
    return Object.fromEntries(names.map((name) => [name, style.getPropertyValue(name).trim()]));
  }, names);

const themeColors = (page: Page) =>
  page
    .locator('meta[name="theme-color"]')
    .evaluateAll((metas) => metas.map((meta) => meta.getAttribute("content")));

const colorScheme = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.documentElement).colorScheme);

const storedTheme = async (page: Page) =>
  (await readStore<{ key: string; value: unknown }>(page, "settings")).find(
    (record) => record.key === "theme",
  )?.value;

/** Farben bei hellem und dunklem Gerät, ohne eigene Wahl. */
async function deviceColors(page: Page): Promise<{ names: string[]; light: Colors; dark: Colors }> {
  const names = await darkVariables(page);
  expect(names.length).toBeGreaterThan(0);
  await page.emulateMedia({ colorScheme: "dark" });
  const dark = await colors(page, names);
  await page.emulateMedia({ colorScheme: "light" });
  const light = await colors(page, names);
  expect(dark["--bg"]).not.toBe(light["--bg"]);
  return { names, light, dark };
}

const openSettings = async (page: Page) => {
  await page.getByRole("link", { name: "Einstellungen" }).click();
  await expect(page.getByRole("heading", { name: "Einstellungen", level: 1 })).toBeFocused();
};

test("Einstellungen aus dem Empty State mit Version und Weg zum Backup", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "Noch keine Vokabelsets" })).toBeVisible();
  await openSettings(page);
  await expect(page.getByText(/^Version \d+\.\d+\.\d+\+\w+$/)).toBeVisible();

  // Ohne Sets bleiben nur die Einstellungen zum Löschen.
  await page.getByRole("button", { name: "Alle Daten löschen" }).click();
  await expect(
    page.getByText(
      "Es sind keine Vokabelsets gespeichert. Gelöscht werden nur deine Einstellungen.",
    ),
  ).toBeFocused();
  await expect(page.getByRole("button", { name: "Einstellungen zurücksetzen" })).toBeVisible();
  await page.getByRole("button", { name: "Abbrechen" }).click();

  await page.getByRole("link", { name: "Backup und Wiederherstellung" }).click();
  await expect(page.getByRole("heading", { name: "Backup und Wiederherstellung" })).toBeVisible();
  expect(errors, "Fehler in der Konsole").toEqual([]);
});

test("E2E-17 Darstellung: eigene Wahl vor dem Gerät, gemerkt nach dem Neuladen", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await importSet(page, "Englisch – Wetter");
  const { names, light, dark } = await deviceColors(page);
  const deviceThemeColors = await themeColors(page);

  await openSettings(page);
  await expect(page.getByRole("radio", { name: "Wie auf dem Gerät" })).toBeChecked();

  // Helles Gerät, dunkle Wahl: dieselben Farben wie bei dunklem Gerät.
  await page.getByRole("radio", { name: "Dunkel" }).check();
  expect(await colors(page, names)).toEqual(dark);
  expect(await colorScheme(page)).toBe("dark");
  expect(await themeColors(page)).toEqual([dark["--bg"], dark["--bg"]]);
  await expect.poll(() => storedTheme(page)).toBe("dark");

  await page.reload();
  await expect(page.getByRole("radio", { name: "Dunkel" })).toBeChecked();
  expect(await colors(page, names)).toEqual(dark);

  // Dunkles Gerät, helle Wahl.
  await page.emulateMedia({ colorScheme: "dark" });
  await page.getByRole("radio", { name: "Hell" }).check();
  expect(await colors(page, names)).toEqual(light);
  expect(await colorScheme(page)).toBe("light");
  expect(await themeColors(page)).toEqual([light["--bg"], light["--bg"]]);
  await expect.poll(() => storedTheme(page)).toBe("light");

  // Wieder wie auf dem Gerät: folgt dessen Wechsel sofort.
  await page.getByRole("radio", { name: "Wie auf dem Gerät" }).check();
  expect(await colors(page, names)).toEqual(dark);
  expect(await themeColors(page)).toEqual(deviceThemeColors);
  await page.emulateMedia({ colorScheme: "light" });
  expect(await colors(page, names)).toEqual(light);
  await expect.poll(() => storedTheme(page)).toBe("system");
  expect(errors, "Fehler in der Konsole").toEqual([]);
});

test("E2E-17 Ein wiederhergestelltes Backup bringt seine Darstellung mit", async ({ page }) => {
  await page.goto("./");
  const { names, dark } = await deviceColors(page);
  await page.goto("./#/backup");
  await page.getByLabel("Backup-Datei auswählen").setInputFiles({
    name: "Vokabeltrainer-Backup_2026-10-22.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        format: "vokabeltrainer-backup",
        formatVersion: 1,
        dataVersion: 1,
        appVersion: "0.1.0+test",
        exportedAt: "2026-10-22T18:00:00.000Z",
        data: {
          sets: [],
          reviewEvents: [],
          sessions: [],
          settings: [{ key: "theme", value: "dark" }],
        },
      }),
    ),
  });
  await page.getByRole("button", { name: "Alle Daten ersetzen" }).click();
  await expect(page.getByText("Backup wiederhergestellt.")).toBeFocused();
  expect(await colors(page, names)).toEqual(dark);

  await page.getByRole("link", { name: "Zurück zur Bibliothek" }).click();
  await openSettings(page);
  await expect(page.getByRole("radio", { name: "Dunkel" })).toBeChecked();
});

test("E2E-18 Alle Daten löschen: Ankündigung, Abbrechen, danach leere Bibliothek", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await importSet(page, "Englisch – Wetter");
  await startLearning(page, "Englisch – Wetter");
  await page.getByRole("button", { name: /Tippen zum Aufdecken/ }).click();
  await page.getByRole("button", { name: "Gewusst" }).click();
  await expect(page.getByText("1 von 3 geschafft")).toBeVisible();
  await endPractice(page);
  const { names, light } = await deviceColors(page);

  await openSettings(page);
  await page.getByRole("radio", { name: "Dunkel" }).check();
  await expect.poll(() => storedTheme(page)).toBe("dark");

  const start = page.getByRole("button", { name: "Alle Daten löschen" });
  await start.click();
  await expect(
    page.getByText(
      "Gelöscht werden 1 Set mit 3 Einträgen und dein Lernstand: 1 Antwort aus 1 Lernsitzung. Deine Einstellungen werden zurückgesetzt.",
    ),
  ).toBeFocused();
  await page.getByRole("button", { name: "Abbrechen" }).click();
  await expect(start).toBeFocused();
  expect(await readStore(page, "sets")).toHaveLength(1);

  await start.click();
  await page.getByRole("button", { name: "1 Set und Lernstand löschen" }).click();
  await expect(libraryMessage(page)).toHaveText("Alle Daten gelöscht.");
  await expect(page.getByRole("heading", { name: "Noch keine Vokabelsets" })).toBeVisible();
  for (const store of STORES) expect(await readStore(page, store), store).toEqual([]);
  const meta = await readStore<{ key: string }>(page, "meta");
  expect(meta.map((record) => record.key)).toContain("persistRequested");
  expect(await colors(page, names)).toEqual(light);
  expect(errors, "Fehler in der Konsole").toEqual([]);
});
