// Minimaler Import (S-07): Vorstufe von E2E-01 (das Lernen ergänzt S-10) und E2E-13 (AK-07).
// Die Vokabeln sind frei gewählter Grundwortschatz.
import { expect, type Page, test } from "@playwright/test";

function setFile(title: string, id?: string): string {
  return JSON.stringify(
    {
      format: "vokabeltrainer-set",
      formatVersion: 1,
      set: { ...(id && { id }), title, termLanguage: "en", meaningLanguage: "de" },
      sections: [
        {
          title: "Wetter",
          entries: [
            { term: "rain", meanings: ["Regen"] },
            { term: "sun", meanings: ["Sonne"] },
            { term: { text: "autumn", acceptedVariants: ["fall"] }, meanings: ["Herbst"] },
          ],
        },
      ],
    },
    null,
    2,
  );
}

const library = (page: Page) =>
  page.getByRole("region", { name: "Vokabelsets" }).getByRole("listitem");

/** Sammelt Fehler aus der Seite; der Import soll auch im Fehlerfall keine erzeugen. */
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return errors;
}

test("Import (Text) mit Begleittext → Bibliothek → Neuladen → Set ist noch da", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto("./");
  await expect(page.getByText("Noch keine Vokabelsets vorhanden.")).toBeVisible();
  await page.getByRole("link", { name: "Vokabelset importieren" }).click();

  const answer = `Hier ist dein Set:\n\n\`\`\`json\n${setFile("Englisch – Wetter")}\n\`\`\`\n\nViel Spaß!`;
  await page.getByLabel("Text einfügen").fill(answer);
  await page.getByRole("button", { name: "Importieren" }).click();
  await expect(page.getByText("„Englisch – Wetter“ mit 3 Einträgen gespeichert.")).toBeVisible();
  await expect(page.getByLabel("Text einfügen")).toHaveValue("");

  await page.getByRole("link", { name: "Zurück zur Bibliothek" }).click();
  await expect(library(page)).toHaveText(["Englisch – Wetter 3 Einträge"]);
  await page.reload();
  await expect(library(page)).toHaveText(["Englisch – Wetter 3 Einträge"]);
  expect(errors, "Fehler in der Konsole").toEqual([]);
});

test("Import (Datei) speichert das Set", async ({ page }) => {
  await page.goto("./#/import");
  await page.getByLabel("Oder eine Datei auswählen").setInputFiles({
    name: "wetter.json",
    mimeType: "application/json",
    buffer: Buffer.from(setFile("Englisch – aus Datei")),
  });
  await expect(page.getByText("„Englisch – aus Datei“ mit 3 Einträgen gespeichert.")).toBeVisible();
  await page.goto("./");
  await expect(library(page)).toHaveText(["Englisch – aus Datei 3 Einträge"]);
});

test("E2E-13 Ungültiger Import und bekanntes Set ändern nichts", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("./#/import");
  const text = page.getByLabel("Text einfügen");
  const importButton = page.getByRole("button", { name: "Importieren" });
  const alert = page.getByRole("alert");

  // Kein gültiges JSON: Meldung mit Fundstelle, der Text bleibt zum Korrigieren stehen.
  const broken = '{\n  "set": { "title": "Kaputt" }\n  "sections": []\n}';
  await text.fill(broken);
  await importButton.click();
  await expect(alert).toContainText(
    "Fehler im JSON in Zeile 2, Spalte 31: Hier fehlt ein Komma oder eine schließende Klammer.",
  );
  await expect(text).toHaveValue(broken);

  // Gültiges JSON, aber unvollständig: alle Fehler mit Fundstelle.
  await text.fill('{"set": {"title": "Unvollständig", "termLanguage": "en"}, "sections": []}');
  await importButton.click();
  await expect(alert).toContainText(
    "Set-Angaben: Es fehlt die Bedeutungssprache („meaningLanguage“).",
  );
  await expect(alert).toContainText("Das Set braucht mindestens eine Sektion.");

  // Dieselbe Datei mit Set-ID zweimal: Das zweite Mal wird abgelehnt, nichts wird überschrieben.
  await text.fill(setFile("Englisch – Bekannt", "m4x8c2r9tw"));
  await importButton.click();
  await expect(page.getByText("„Englisch – Bekannt“ mit 3 Einträgen gespeichert.")).toBeVisible();
  await expect(alert).toBeEmpty();
  await text.fill(setFile("Englisch – Überschrieben?", "m4x8c2r9tw"));
  await importButton.click();
  await expect(alert).toContainText(
    "Dieses Set ist schon vorhanden. Aktualisieren ist noch nicht möglich.",
  );

  await page.goto("./");
  await expect(library(page)).toHaveText(["Englisch – Bekannt 3 Einträge"]);
  expect(errors, "Fehler in der Konsole").toEqual([]);
});
