// Import (S-07, S-12, S-13) mit Vorschau, E2E-06 (AK-01), E2E-13 (AK-07) und E2E-15 (AK-19).
// Import → Lernen → Neuladen prüft E2E-01 in practice.spec.ts. Die Zwischenablage wird per Init-Skript
// ersetzt: Ob Chromium und WebKit sie lesen lassen, hängt sonst von Berechtigungen ab.
import { expect, type Page, test } from "@playwright/test";
import type { StoredSet } from "../../src/domain/model";
import {
  collectErrors,
  librarySets as library,
  libraryMessage as message,
  readStore,
  setFile,
} from "./support";

/** Zwischenablage-Attrappe: liefert den Text, lehnt ab (`null`) oder fehlt ganz (`"missing"`). */
const withClipboard = (page: Page, content: string | null | "missing") =>
  page.addInitScript((content) => {
    Object.defineProperty(Navigator.prototype, "clipboard", {
      configurable: true,
      get: () =>
        content === "missing"
          ? undefined
          : {
              readText: async () => {
                if (content === null) throw new DOMException("Abgelehnt", "NotAllowedError");
                return content;
              },
            },
    });
  }, content);

test("Import (Text) mit Begleittext → Vorschau → Bibliothek → Neuladen → Set ist noch da", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto("./");
  await expect(page.getByText("Noch keine Vokabelsets vorhanden.")).toBeVisible();
  await page.getByRole("link", { name: "Vokabelset importieren" }).click();

  const answer = `Hier ist dein Set:\n\n\`\`\`json\n${setFile("Englisch – Wetter")}\n\`\`\`\n\nViel Spaß!`;
  await page.getByLabel("Text einfügen").fill(answer);
  await page.getByRole("button", { name: "Prüfen" }).click();

  const preview = page.getByRole("region", { name: "Vorschau" });
  await expect(preview.getByRole("heading", { name: "Vorschau" })).toBeFocused();
  await expect(preview).toContainText("Englisch – Wetter");
  await expect(preview).toContainText("Englisch → Deutsch");
  await expect(preview).toContainText("1 Sektion mit 3 Einträgen");
  await expect(preview.getByRole("listitem")).toHaveText(["Wetter 3 Einträge"]);
  await expect(
    preview.getByText("Text vor und nach dem Vokabelset wurde weggelassen."),
  ).toBeVisible();
  await expect(page.getByLabel("Text einfügen")).toBeHidden();
  expect(await readStore(page, "sets")).toEqual([]);

  await preview.getByRole("button", { name: "Importieren" }).click();
  await expect(message(page)).toHaveText("„Englisch – Wetter“ mit 3 Einträgen gespeichert.");
  await expect(message(page)).toBeFocused();
  await expect(library(page)).toHaveText(["Englisch – Wetter 3 Einträge"]);
  await page.reload();
  await expect(library(page)).toHaveText(["Englisch – Wetter 3 Einträge"]);
  await expect(message(page)).toHaveCount(0);
  expect(errors, "Fehler in der Konsole").toEqual([]);
});

test("Abbrechen in der Vorschau speichert nichts, der Text bleibt stehen", async ({ page }) => {
  await page.goto("./#/import");
  const text = page.getByLabel("Text einfügen");
  await text.fill(setFile("Englisch – Abgebrochen"));
  await page.getByRole("button", { name: "Prüfen" }).click();
  await page.getByRole("button", { name: "Abbrechen" }).click();
  await expect(page.getByRole("region", { name: "Vorschau" })).toHaveCount(0);
  await expect(text).toBeFocused();
  await expect(text).toHaveValue(setFile("Englisch – Abgebrochen"));
  expect(await readStore(page, "sets")).toEqual([]);
});

test("Import (Datei) zeigt die Vorschau und speichert das Set", async ({ page }) => {
  await page.goto("./#/import");
  await page.getByLabel("Oder eine Datei auswählen").setInputFiles({
    name: "wetter.json",
    mimeType: "application/json",
    buffer: Buffer.from(setFile("Englisch – aus Datei")),
  });
  await page.getByRole("button", { name: "Importieren" }).click();
  await expect(message(page)).toHaveText("„Englisch – aus Datei“ mit 3 Einträgen gespeichert.");
  await expect(library(page)).toHaveText(["Englisch – aus Datei 3 Einträge"]);
});

test("Aus Zwischenablage einfügen prüft sofort", async ({ page }) => {
  await withClipboard(page, setFile("Englisch – Zwischenablage"));
  await page.goto("./#/import");
  await page.getByRole("button", { name: "Aus Zwischenablage einfügen" }).click();
  const preview = page.getByRole("region", { name: "Vorschau" });
  await expect(preview).toContainText("Englisch – Zwischenablage");
  await preview.getByRole("button", { name: "Abbrechen" }).click();
  await expect(page.getByLabel("Text einfügen")).toHaveValue(setFile("Englisch – Zwischenablage"));
});

test("Abgelehnte oder leere Zwischenablage zeigt einen Hinweis", async ({ page }) => {
  await withClipboard(page, null);
  await page.goto("./#/import");
  await page.getByRole("button", { name: "Aus Zwischenablage einfügen" }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "Die Zwischenablage konnte nicht gelesen werden. Füge den Text stattdessen in das Feld ein.",
  );
  await expect(page.getByRole("button", { name: "Prüfen" })).toBeEnabled();
});

test("Ohne lesbare Zwischenablage gibt es keine Schaltfläche dafür", async ({ page }) => {
  await withClipboard(page, "missing");
  await page.goto("./#/import");
  await expect(page.getByRole("button", { name: "Prüfen" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Aus Zwischenablage einfügen" })).toHaveCount(0);
});

test("E2E-06 Import (Datei) mit Begleittext und Zusatzfeld zeigt die Warnung", async ({ page }) => {
  const errors = collectErrors(page);
  const file = {
    format: "vokabeltrainer-set",
    formatVersion: 1,
    set: { title: "Englisch – Zusatzfeld", termLanguage: "en", meaningLanguage: "de", level: "" },
    sections: [
      {
        title: "Wetter",
        entries: [
          { term: "rain", meanings: ["Regen"], pronunciation: "reɪn", notes: "auch: regnen" },
          { term: "storm", meanings: ["Sturm"], examples: ["A storm is coming."], grammar: {} },
        ],
      },
    ],
  };
  await page.goto("./#/import");
  await page.getByLabel("Oder eine Datei auswählen").setInputFiles({
    name: "wetter.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(`Hier ist dein Set:\n\n${JSON.stringify(file, null, 2)}\n\nViel Erfolg!`),
  });
  await expect(
    page.getByText(
      "Das Feld „pronunciation“ wird ignoriert (Sektion 1 „Wetter“, Eintrag 1 („rain“)).",
      { exact: true },
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Importieren" }).click();
  await expect(message(page)).toHaveText("„Englisch – Zusatzfeld“ mit 2 Einträgen gespeichert.");

  // Optionale Felder sind übernommen, leere und unbekannte nicht.
  const [set] = await readStore<StoredSet>(page, "sets");
  expect(set).not.toHaveProperty("level");
  const [rain, storm] = set!.sections[0]!.entries;
  expect(rain).toMatchObject({ notes: "auch: regnen" });
  expect(rain).not.toHaveProperty("pronunciation");
  expect(storm).toMatchObject({ examples: [{ text: "A storm is coming." }] });
  expect(storm).not.toHaveProperty("grammar");
  expect(errors, "Fehler in der Konsole").toEqual([]);
});

test("E2E-13 Ungültiger Import und bekanntes Set ändern nichts", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("./#/import");
  const text = page.getByLabel("Text einfügen");
  const check = page.getByRole("button", { name: "Prüfen" });
  const alert = page.getByRole("alert");

  // Kein gültiges JSON: Meldung mit Fundstelle, der Text bleibt zum Korrigieren stehen.
  const broken = '{\n  "set": { "title": "Kaputt" }\n  "sections": []\n}';
  await text.fill(broken);
  await check.click();
  await expect(alert).toContainText(
    "Fehler im JSON in Zeile 2, Spalte 31: Hier fehlt ein Komma oder eine schließende Klammer.",
  );
  await expect(text).toHaveValue(broken);

  // Gültiges JSON, aber unvollständig: alle Fehler mit Fundstelle.
  await text.fill('{"set": {"title": "Unvollständig", "termLanguage": "en"}, "sections": []}');
  await check.click();
  await expect(alert).toContainText(
    "Set-Angaben: Es fehlt die Bedeutungssprache („meaningLanguage“).",
  );
  await expect(alert).toContainText("Das Set braucht mindestens eine Sektion.");

  // Dieselbe Datei mit Set-ID zweimal: Das zweite Mal wird schon beim Prüfen abgelehnt.
  await text.fill(setFile("Englisch – Bekannt", "m4x8c2r9tw"));
  await check.click();
  await page.getByRole("button", { name: "Importieren" }).click();
  await expect(message(page)).toHaveText("„Englisch – Bekannt“ mit 3 Einträgen gespeichert.");
  await page.goto("./#/import");
  await text.fill(setFile("Englisch – Überschrieben?", "m4x8c2r9tw"));
  await check.click();
  await expect(alert).toContainText(
    "Dieses Set ist schon vorhanden. Aktualisieren ist noch nicht möglich.",
  );
  await expect(page.getByRole("region", { name: "Vorschau" })).toHaveCount(0);

  await page.goto("./");
  await expect(library(page)).toHaveText(["Englisch – Bekannt 3 Einträge"]);
  expect(errors, "Fehler in der Konsole").toEqual([]);
});

test("E2E-15 Dieselbe Datei ohne IDs zweimal: Hinweis auf das vorhandene Set", async ({ page }) => {
  const errors = collectErrors(page);
  const importOnce = async () => {
    await page.goto("./#/import");
    await page.getByLabel("Text einfügen").fill(setFile("Englisch – Doppelt"));
    await page.getByRole("button", { name: "Prüfen" }).click();
  };
  const duplicateNotice = page.getByText(
    "Dieses Set sieht aus wie „Englisch – Doppelt“, das du schon hast.",
    { exact: true },
  );

  await importOnce();
  await expect(duplicateNotice).toHaveCount(0);
  await page.getByRole("button", { name: "Importieren" }).click();
  await expect(library(page)).toHaveText(["Englisch – Doppelt 3 Einträge"]);

  // Zweites Mal: Hinweis, Abbrechen lässt den Bestand unverändert.
  await importOnce();
  await expect(duplicateNotice).toBeVisible();
  await expect(page.getByRole("button", { name: "Importieren", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Abbrechen" }).click();
  expect(await readStore(page, "sets")).toHaveLength(1);

  // Drittes Mal: bewusst trotzdem als weiteres Set.
  await importOnce();
  await page.getByRole("button", { name: "Trotzdem als neues Set importieren" }).click();
  await expect(message(page)).toHaveText("„Englisch – Doppelt“ mit 3 Einträgen gespeichert.");
  await expect(library(page)).toHaveText([
    "Englisch – Doppelt 3 Einträge",
    "Englisch – Doppelt 3 Einträge",
  ]);
  expect(errors, "Fehler in der Konsole").toEqual([]);
});
