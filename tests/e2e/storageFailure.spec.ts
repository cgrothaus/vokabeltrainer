// Speicherfehler (S-22): E2E-19 (AK-26, FR-23, TDD 6.5, D-32). Der Speicher wird über ein Init-Skript
// gestört (`breakableStorage`); gemeldet wird verständlich, als gespeichert gilt nur, was gespeichert ist.
import { expect, type Page, test } from "@playwright/test";
import type { ReviewEvent, Session, StoredSet } from "../../src/domain/model";
import {
  breakableStorage,
  collectErrors,
  failWrites,
  importSet,
  libraryMessage,
  loseConnection,
  readStore,
  setFile,
  startLearning,
} from "./support";

const FULL = "QuotaExceededError";
const notice = (page: Page) => page.locator("#storage-notice");
const alert = (page: Page) => page.getByRole("main").getByRole("alert");

async function answerKnown(page: Page, done: number): Promise<void> {
  await page.getByRole("button", { name: /Tippen zum Aufdecken/ }).click();
  await page.getByRole("button", { name: "Gewusst" }).click();
  await expect(page.getByText(`${done} von 3 geschafft`)).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await breakableStorage(page);
});

test("E2E-19 Voller Speicher beim Import: Meldung, nichts gespeichert, neuer Versuch klappt", async ({
  page,
}) => {
  await page.goto("./#/import");
  await page.getByLabel("Text einfügen").fill(setFile("Englisch – Voll"));
  await page.getByRole("button", { name: "Prüfen" }).click();
  await failWrites(page, FULL);
  await page.getByRole("button", { name: "Importieren" }).click();
  await expect(alert(page)).toContainText(
    "Der Speicher auf diesem Gerät ist voll. Das Set wurde nicht gespeichert. Mach auf dem Gerät Platz",
  );
  expect(await readStore<StoredSet>(page, "sets")).toEqual([]);

  await failWrites(page, null);
  await page.getByRole("button", { name: "Importieren" }).click();
  await expect(libraryMessage(page)).toHaveText("„Englisch – Voll“ mit 3 Einträgen gespeichert.");
  expect(await readStore<StoredSet>(page, "sets")).toHaveLength(1);
});

test("E2E-19 Echt voller Speicher: Der Browser bricht ab, die App meldet es", async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "Das Kontingent lässt sich nur in Chromium festlegen");
  // Ohne Störung durch das Init-Skript: Der Fehler kommt beim Abschluss über `transaction.error`.
  // Chromium prüft das Kontingent nicht bei jedem kleinen Schreibvorgang, daher ein großes Set.
  const entries = Array.from({ length: 2000 }, (_, i) => ({
    term: `word number ${i}`,
    meanings: [`Wort Nummer ${i}`],
    notes: "Eine etwas längere Notiz, damit das Set groß genug für das Kontingent wird.",
  }));
  const text = JSON.stringify({
    format: "vokabeltrainer-set",
    formatVersion: 1,
    set: { title: "Englisch – Groß", termLanguage: "en", meaningLanguage: "de" },
    sections: [{ title: "Viel", entries }],
  });
  await page.goto("./#/import");
  const cdp = await page.context().newCDPSession(page);
  const origin = new URL(page.url()).origin;
  await cdp.send("Storage.overrideQuotaForOrigin", { origin, quotaSize: 1000 });
  await page.getByLabel("Text einfügen").fill(text);
  await page.getByRole("button", { name: "Prüfen" }).click();
  await page.getByRole("button", { name: "Importieren" }).click();
  await expect(alert(page)).toContainText(
    "Der Speicher auf diesem Gerät ist voll. Das Set wurde nicht gespeichert.",
  );
  expect(await readStore<StoredSet>(page, "sets")).toEqual([]);
});

test("Voller Speicher beim Beispielset: Meldung im Empty State", async ({ page }) => {
  await page.goto("./");
  await failWrites(page, FULL);
  const button = page.getByRole("button", { name: "Beispielset ausprobieren" });
  await button.click();
  await expect(alert(page)).toContainText(
    "Der Speicher auf diesem Gerät ist voll. Das Set wurde nicht gespeichert.",
  );
  await expect(button).toBeEnabled();
  expect(await readStore<StoredSet>(page, "sets")).toEqual([]);
});

test("E2E-19 Antwort nicht gespeichert: Sitzung läuft weiter, Ergebnis nennt es", async ({
  page,
}) => {
  await importSet(page, "Englisch – Wetter");
  await startLearning(page, "Englisch – Wetter");

  await failWrites(page, FULL, "reviewEvents");
  await answerKnown(page, 1);
  await expect(alert(page)).toHaveText(
    "Der Speicher auf diesem Gerät ist voll. Die Antwort wurde nicht gespeichert. Du kannst trotzdem weiterlernen.",
  );

  await failWrites(page, null);
  await answerKnown(page, 2);
  await expect(alert(page)).toBeEmpty();
  await page.getByRole("button", { name: /Tippen zum Aufdecken/ }).click();
  await page.getByRole("button", { name: "Gewusst" }).click();

  await expect(page.getByRole("heading", { name: "Geschafft" })).toBeVisible();
  await expect(page.getByText("3 von 3 beim ersten Mal gewusst.")).toBeVisible();
  await expect(
    page.getByText("1 Antwort wurde nicht gespeichert und zählt nicht zum Lernstand."),
  ).toBeVisible();
  expect(await readStore<ReviewEvent>(page, "reviewEvents")).toHaveLength(2);
});

test("Zwischenstand nennt nicht gespeicherte Antworten", async ({ page }) => {
  await importSet(page, "Englisch – Wetter");
  await startLearning(page, "Englisch – Wetter");
  await failWrites(page, FULL, "reviewEvents");
  await answerKnown(page, 1);
  await answerKnown(page, 2);
  await page.getByRole("button", { name: "Beenden" }).click();
  await expect(page.getByRole("heading", { name: "Zwischenstand" })).toBeVisible();
  await expect(
    page.getByText("2 Antworten wurden nicht gespeichert und zählen nicht zum Lernstand."),
  ).toBeVisible();
  // Der Hinweis an der Karte erscheint im Zwischenstand nicht noch einmal.
  await expect(alert(page)).toBeEmpty();
});

test("E2E-19 Ende der Sitzung nicht gespeichert: Speicherhinweis bis zum nächsten Speichern", async ({
  page,
}) => {
  await importSet(page, "Englisch – Wetter");
  await startLearning(page, "Englisch – Wetter");
  await expect(notice(page)).toBeEmpty();
  await answerKnown(page, 1);
  await answerKnown(page, 2);

  await failWrites(page, FULL, "sessions");
  await page.getByRole("button", { name: /Tippen zum Aufdecken/ }).click();
  await page.getByRole("button", { name: "Gewusst" }).click();
  await expect(page.getByRole("heading", { name: "Geschafft" })).toBeVisible();
  // Geschrieben wird erst im Erfolgsrückruf des Lesens; der Browser bricht dann mit eigenem Fehler ab.
  await expect(notice(page)).toContainText("Das Ende der Lernsitzung wurde nicht gespeichert.");
  // Die Antworten selbst sind gespeichert; das Ergebnis meldet nichts.
  await expect(page.getByText(/nicht gespeichert und zähl/)).toHaveCount(0);
  expect(await readStore<ReviewEvent>(page, "reviewEvents")).toHaveLength(3);
  expect((await readStore<Session>(page, "sessions"))[0]!.status).toBe("active");

  // Ausblenden geht jederzeit; der nächste erfolgreiche Schreibvorgang räumt ihn sonst selbst ab.
  await notice(page).getByRole("button", { name: "Ausblenden" }).click();
  await expect(notice(page)).toBeEmpty();
  await failWrites(page, null);
  await page.getByRole("link", { name: "Zurück zur Bibliothek" }).click();
  await startLearning(page, "Englisch – Wetter");
  await failWrites(page, FULL, "sessions");
  await page.getByRole("button", { name: "Beenden" }).click();
  await expect(notice(page)).toContainText("Das Ende der Lernsitzung wurde nicht gespeichert.");
  await failWrites(page, null);
  await startLearning(page, "Englisch – Wetter");
  await expect(page.getByText("0 von 3 geschafft")).toBeVisible();
  await expect(notice(page)).toBeEmpty();
});

test("E2E-19 Wiederherstellen bei vollem Speicher lässt den Bestand unverändert", async ({
  page,
}) => {
  await importSet(page, "Englisch – Wetter");
  await page.goto("./#/backup");
  await failWrites(page, FULL);
  await page.getByLabel("Backup-Datei auswählen").setInputFiles({
    name: "Vokabeltrainer-Backup_2026-10-20.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        format: "vokabeltrainer-backup",
        formatVersion: 1,
        dataVersion: 1,
        appVersion: "0.1.0+test",
        exportedAt: "2026-10-20T18:00:00.000Z",
        data: { sets: [], reviewEvents: [], sessions: [], settings: [] },
      }),
    ),
  });
  await page.getByRole("button", { name: "Alle Daten ersetzen" }).click();
  await expect(
    page.getByRole("region", { name: "Backup wiederherstellen" }).getByRole("alert"),
  ).toContainText(
    "Der Speicher auf diesem Gerät ist voll. Das Backup wurde nicht wiederhergestellt; deine bisherigen Daten sind unverändert.",
  );
  expect(await readStore<StoredSet>(page, "sets")).toHaveLength(1);
});

test("E2E-19 Set löschen scheitert: Meldung, Set bleibt", async ({ page }) => {
  await importSet(page, "Englisch – Wetter");
  await page.getByRole("link", { name: "Englisch – Wetter", exact: true }).click();
  await page.getByRole("button", { name: "Set löschen" }).click();
  await failWrites(page, FULL);
  await page.getByRole("button", { name: "Set mit 3 Einträgen löschen" }).click();
  // Wirft die Anfrage erst im Erfolgsrückruf des Lesens, bricht der Browser mit eigenem Fehler ab.
  await expect(alert(page)).toContainText("Das Set wurde nicht gelöscht; es ist unverändert.");
  expect(await readStore<StoredSet>(page, "sets")).toHaveLength(1);
});

test("E2E-19 Eintrag speichern scheitert: Meldung, Eingabe bleibt, neuer Versuch klappt", async ({
  page,
}) => {
  await importSet(page, "Englisch – Wetter");
  await page.getByRole("link", { name: "Englisch – Wetter", exact: true }).click();
  await page.getByRole("link", { name: "Bearbeiten" }).click();
  await page.locator(".edit-entries a").filter({ hasText: "rain" }).click();
  const term = page.getByRole("group", { name: "Wort", exact: true }).getByLabel("Text");
  await term.fill("drizzle");
  await failWrites(page, FULL);
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(alert(page).first()).toContainText("Der Eintrag wurde nicht gespeichert.");
  await expect(term).toHaveValue("drizzle");
  expect((await readStore<StoredSet>(page, "sets"))[0]!.editCount).toBe(0);

  await failWrites(page, null);
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Englisch – Wetter bearbeiten" })).toBeVisible();
  expect((await readStore<StoredSet>(page, "sets"))[0]!.sections[0]!.entries[0]!.term.text).toBe(
    "drizzle",
  );
});

test("E2E-19 Sektion verschieben scheitert: Meldung, Reihenfolge bleibt", async ({ page }) => {
  await page.goto("./#/new-set");
  await page.getByLabel("Titel", { exact: true }).fill("Englisch – Wetter");
  await page.getByRole("button", { name: "Set anlegen" }).click();
  await page.getByLabel("Titel der neuen Sektion").fill("Jahreszeiten");
  await page.getByRole("button", { name: "Sektion hinzufügen" }).click();
  await expect(page.locator(".edit-section h2")).toHaveCount(2);

  await failWrites(page, FULL);
  await page.getByRole("button", { name: "„Jahreszeiten“ nach oben" }).click();
  await expect(alert(page)).toContainText("Die Reihenfolge wurde nicht gespeichert.");
  await expect(alert(page)).toBeFocused();
  await expect(page.locator(".edit-section h2")).toHaveText([
    "Sektion 1 0 Einträge",
    "Jahreszeiten 0 Einträge",
  ]);
  const [set] = await readStore<StoredSet>(page, "sets");
  expect(set!.sections.map((section) => section.title)).toEqual(["Sektion 1", "Jahreszeiten"]);
});

test("E2E-19 Verlorene Verbindung: Der nächste Zugriff verbindet neu, ohne Meldung", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "Noch keine Vokabelsets" })).toBeVisible();
  await loseConnection(page);
  await importSet(page, "Englisch – Wetter");
  expect(await readStore<StoredSet>(page, "sets")).toHaveLength(1);

  // Auch eine laufende Sitzung, die ihre Verbindung festhält, speichert danach weiter.
  await startLearning(page, "Englisch – Wetter");
  await loseConnection(page);
  await answerKnown(page, 1);
  await expect(alert(page)).toBeEmpty();
  expect(await readStore<ReviewEvent>(page, "reviewEvents")).toHaveLength(1);
  await expect(notice(page)).toBeEmpty();
  expect(errors, "Fehler in der Konsole").toEqual([]);
});
