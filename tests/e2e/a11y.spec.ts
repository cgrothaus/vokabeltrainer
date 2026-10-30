// E2E-20 Durchsicht Mobile und Barrierearmut (S-23, TDD 13.4, FR-24, NFR-09–NFR-13): jede Ansicht und
// jeder wichtige Zustand bei 320 CSS-Pixeln, hell und dunkel. Geprüft werden die WCAG-Regeln von axe
// (u. a. Kontrast, Namen, Rollen), horizontales Scrollen auch bei 200 % Schrift, Zielgrößen ab 44 × 44
// und genau eine `h1`; dazu Fokus und Seitentitel nach einem Seitenwechsel.
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import {
  changeDevice,
  collectErrors,
  fakeDevice,
  importSet,
  libraryMessage,
  setFile,
} from "./support";

test.use({ viewport: { width: 320, height: 640 } });
// axe braucht pro Zustand und Farbschema bis zu einer Sekunde; unter Last reichen 30 s nicht.
test.describe.configure({ timeout: 90_000 });

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
/** Designziel aus TDD 13.4; WCAG 2.2 AA verlangt 24 × 24. */
const TARGET = 44;

/** Breite, Zielgrößen und Überschrift; läuft in der Seite. */
function checkLayout(target: number): string[] {
  const found: string[] = [];
  const root = document.documentElement;
  if (root.scrollWidth > root.clientWidth)
    found.push(`horizontal scrollbar (${root.scrollWidth} px)`);
  // Doppelte Schriftgröße (WCAG 1.4.4), wie bei vergrößerter Schrift im Browser oder System.
  root.style.fontSize = "200%";
  const zoomed = root.scrollWidth;
  root.style.fontSize = "";
  if (zoomed > root.clientWidth) found.push(`bei 200 % Schrift ${zoomed} px breit`);
  const headings = document.querySelectorAll("h1").length;
  if (headings !== 1) found.push(`${headings} h1`);
  const name = (el: Element) =>
    `${el.tagName.toLowerCase()} „${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 40)}“`;
  const controls =
    "a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex='-1'])";
  for (const el of document.querySelectorAll<HTMLElement>(controls)) {
    if (el.closest("[hidden]") || el.closest("[inert]")) continue;
    const style = getComputedStyle(el);
    if (style.visibility === "hidden" || style.display === "none") continue;
    // Links im Fließtext sind ausgenommen (WCAG 2.5.8).
    if (el.tagName === "A" && style.display === "inline") continue;
    // Ein Eingabefeld in seinem Label wird über das Label getroffen.
    const label = el.matches("input") ? el.closest("label") : null;
    const box = (label ?? el).getBoundingClientRect();
    if (box.width === 0 && box.height === 0) continue;
    if (box.width < target || box.height < target)
      found.push(`Ziel ${Math.round(box.width)} × ${Math.round(box.height)}: ${name(el)}`);
  }
  return found;
}

/** Prüft den aktuellen Zustand hell und dunkel und liefert die Befunde mit Zustandsnamen. */
async function audit(page: Page, state: string): Promise<string[]> {
  const findings: string[] = [];
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    const where = `${state} (${colorScheme === "light" ? "hell" : "dunkel"})`;
    const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
    for (const violation of violations) {
      const targets = violation.nodes.map((node) => node.target.join(" ")).join(", ");
      findings.push(`${where}: axe ${violation.id} – ${targets}`);
    }
    for (const finding of await page.evaluate(checkLayout, TARGET))
      findings.push(`${where}: ${finding}`);
  }
  return findings;
}

const emptyBackup = JSON.stringify({
  format: "vokabeltrainer-backup",
  formatVersion: 1,
  dataVersion: 1,
  appVersion: "0.1.0+test",
  exportedAt: "2026-10-20T18:00:00.000Z",
  data: { sets: [], reviewEvents: [], sessions: [], settings: [] },
});

test("Ohne Sets: Bibliothek, Hilfe, Import, Backup, Einstellungen, unbekannte Adresse", async ({
  page,
}) => {
  const errors = collectErrors(page);
  const findings: string[] = [];
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "Noch keine Vokabelsets" })).toBeVisible();
  findings.push(...(await audit(page, "Bibliothek leer")));

  await page.goto("./#/help");
  await page.locator("summary").first().click();
  findings.push(...(await audit(page, "Hilfe")));

  await page.goto("./#/import");
  findings.push(...(await audit(page, "Import")));
  await page.getByLabel("Text einfügen").fill("Das ist keine Vokabelliste.");
  await page.getByRole("button", { name: "Prüfen" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  findings.push(...(await audit(page, "Import mit Fehler")));
  await page.getByLabel("Text einfügen").fill(`Hier ist dein Set:\n${setFile("Wetter")}`);
  await page.getByRole("button", { name: "Prüfen" }).click();
  await expect(page.getByRole("heading", { name: "Vorschau" })).toBeVisible();
  findings.push(...(await audit(page, "Import-Vorschau")));

  await page.goto("./#/backup");
  findings.push(...(await audit(page, "Backup")));
  await page.getByLabel("Backup-Datei auswählen").setInputFiles({
    name: "Vokabeltrainer-Backup_2026-10-20.json",
    mimeType: "application/json",
    buffer: Buffer.from(emptyBackup),
  });
  await expect(page.getByRole("button", { name: "Wiederherstellen", exact: true })).toBeVisible();
  findings.push(...(await audit(page, "Backup-Vorschau")));

  await page.goto("./#/settings");
  findings.push(...(await audit(page, "Einstellungen")));

  await page.goto("./#/gibt-es-nicht");
  findings.push(...(await audit(page, "Seite nicht gefunden")));

  expect(findings).toEqual([]);
  expect(errors).toEqual([]);
});

test("Mit Set: Bibliothek, Set-Ansicht, Löschen, Einrichtung, Karteikarten, Zwischenstand, Ergebnis", async ({
  page,
}) => {
  const errors = collectErrors(page);
  const findings: string[] = [];
  await importSet(page, "Wetter");
  findings.push(...(await audit(page, "Bibliothek mit Meldung")));

  await page.getByRole("link", { name: "Wetter", exact: true }).click();
  await expect(page.getByText("Mit diesem Set hast du noch nicht gelernt.")).toBeVisible();
  findings.push(...(await audit(page, "Set-Ansicht")));
  await page.locator("summary").first().click();
  findings.push(...(await audit(page, "Set-Ansicht aufgeklappt")));
  await page.getByRole("button", { name: "Set löschen" }).click();
  findings.push(...(await audit(page, "Set löschen, Ankündigung")));
  await page.getByRole("button", { name: "Abbrechen" }).click();

  await page.getByRole("link", { name: "Wetter lernen" }).click();
  const start = page.getByRole("button", { name: "3 Vokabeln lernen" });
  await expect(start).toBeVisible();
  findings.push(...(await audit(page, "Einrichtung")));
  await start.click();

  const front = page.getByRole("button", { name: /Tippen zum Aufdecken/ });
  await expect(front).toBeVisible();
  findings.push(...(await audit(page, "Karteikarte vorn")));
  await front.click();
  findings.push(...(await audit(page, "Karteikarte hinten")));
  await page.getByRole("button", { name: "Nochmal" }).click();
  await expect(page.locator(".rating")).toBeHidden();
  await page.getByRole("button", { name: "Beenden" }).click();
  await expect(page.getByRole("heading", { name: "Zwischenstand" })).toBeVisible();
  findings.push(...(await audit(page, "Zwischenstand")));
  await page.getByRole("button", { name: "Weiterlernen" }).click();

  // Alle übrigen Karten als gewusst bewerten, bis das Ergebnis erscheint.
  const done = page.getByRole("heading", { name: /Geschafft/ });
  for (;;) {
    await expect(front.or(done)).toBeVisible();
    if (await done.isVisible()) break;
    await front.click();
    await page.getByRole("button", { name: "Gewusst" }).click();
    await expect(page.locator(".rating")).toBeHidden();
  }
  findings.push(...(await audit(page, "Ergebnis")));

  // Mit Antworten und ohne Backup erinnert die Bibliothek daran (TDD 6.6).
  await page.goto("./");
  await expect(page.getByRole("button", { name: "Backup speichern" })).toBeEnabled();
  findings.push(...(await audit(page, "Bibliothek mit Backup-Erinnerung")));

  await page.goto("./#/backup");
  await page.getByLabel("Backup-Datei auswählen").setInputFiles({
    name: "Vokabeltrainer-Backup_2026-10-20.json",
    mimeType: "application/json",
    buffer: Buffer.from(emptyBackup),
  });
  await expect(page.getByRole("button", { name: "Vorher Backup speichern" })).toBeVisible();
  findings.push(...(await audit(page, "Backup-Vorschau mit Warnung")));

  await page.goto("./#/settings");
  await page.getByRole("button", { name: "Alle Daten löschen" }).click();
  findings.push(...(await audit(page, "Alle Daten löschen, Ankündigung")));

  expect(findings).toEqual([]);
  expect(errors).toEqual([]);
});

test("Speicherschutz: Anleitung zum Home-Bildschirm und Hinweis auf Backups", async ({ page }) => {
  const errors = collectErrors(page);
  const findings: string[] = [];
  await fakeDevice(page, { ios: true });
  await importSet(page, "Wetter");
  await page.getByText("So kommt die App auf den Home-Bildschirm").click();
  await expect(page.locator(".hint").getByRole("listitem")).toHaveCount(4);
  findings.push(...(await audit(page, "Bibliothek mit Anleitung zum Home-Bildschirm")));

  await changeDevice(page, { ios: false });
  await page.reload();
  await expect(page.locator(".hint")).toContainText("nicht dauerhaft geschützt");
  findings.push(...(await audit(page, "Bibliothek mit Hinweis auf Backups")));

  expect(findings).toEqual([]);
  expect(errors).toEqual([]);
});

test("Beispielset: Set-Ansicht mit Lernstand, Multiple Choice mit Rückmeldung", async ({
  page,
}) => {
  const errors = collectErrors(page);
  const findings: string[] = [];
  await page.goto("./");
  await page.getByRole("button", { name: "Beispielset ausprobieren" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Beispielset");
  findings.push(...(await audit(page, "Set-Ansicht Beispielset")));

  await page
    .getByRole("link", { name: /lernen$/ })
    .first()
    .click();
  await page.getByRole("slider", { name: "Multiple Choice" }).fill("100");
  await page.getByRole("radio", { name: "10", exact: true }).check();
  await page.getByRole("button", { name: "10 Vokabeln lernen" }).click();
  const options = page.locator(".options button");
  await expect(options).toHaveCount(4);
  findings.push(...(await audit(page, "Multiple Choice")));
  await options.first().click();
  await expect(page.getByRole("button", { name: "Weiter" })).toBeVisible();
  findings.push(...(await audit(page, "Multiple Choice mit Rückmeldung")));

  expect(findings).toEqual([]);
  expect(errors).toEqual([]);
});

test("Bearbeiten: Set bearbeiten, Eintragsformular, Fehler, Frage beim Verlassen", async ({
  page,
}) => {
  const errors = collectErrors(page);
  const findings: string[] = [];
  await page.goto("./");
  await page.getByRole("button", { name: "Beispielset ausprobieren" }).click();
  await page.getByRole("link", { name: "Bearbeiten" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("bearbeiten");
  findings.push(...(await audit(page, "Set bearbeiten")));

  // Ein Eintrag mit Varianten, Grammatik und Beispielen: „Weitere Angaben“ ist dann aufgeklappt.
  const entries = page.locator(".edit-entries a");
  const count = await entries.count();
  for (let index = 0; index < count; index++) {
    await entries.nth(index).click();
    await expect(page.getByRole("heading", { name: "Eintrag bearbeiten" })).toBeVisible();
    if ((await page.locator("details.more[open] .example").count()) > 0) break;
    await page.goBack();
  }
  await expect(page.locator("details.more[open] .example").first()).toBeVisible();
  findings.push(...(await audit(page, "Eintrag bearbeiten")));

  const term = page.getByRole("group", { name: "Wort", exact: true }).getByLabel("Text");
  await term.fill("");
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert").first()).toContainText("Das Wort fehlt.");
  findings.push(...(await audit(page, "Eintrag mit Fehler")));

  await page.goBack();
  await expect(page.getByRole("button", { name: "Weiter bearbeiten" })).toBeVisible();
  findings.push(...(await audit(page, "Frage beim Verlassen")));

  expect(findings).toEqual([]);
  expect(errors).toEqual([]);
});

test("Nach einem Seitenwechsel: Fokus auf der Überschrift, Seitentitel nennt die Ansicht", async ({
  page,
}) => {
  const heading = (name: string) => page.getByRole("heading", { name, level: 1 });
  await page.goto("./");
  await expect(heading("Vokabeltrainer")).toBeFocused();
  await expect(page).toHaveTitle("Vokabeltrainer");

  await page.getByRole("link", { name: "Wie bekomme ich ein Vokabelset?" }).click();
  await expect(heading("Wie bekomme ich ein Vokabelset?")).toBeFocused();
  await expect(page).toHaveTitle("Wie bekomme ich ein Vokabelset? – Vokabeltrainer");
  // Die Tab-Taste geht von der Überschrift aus weiter, nicht vom Seitenanfang.
  await page.keyboard.press("Tab");
  await expect(page.locator("main :focus")).toBeVisible();

  await page.goBack();
  await expect(heading("Vokabeltrainer")).toBeFocused();
  await expect(page).toHaveTitle("Vokabeltrainer");

  // Eine Meldung der Ansicht hat Vorrang vor der Überschrift.
  await importSet(page, "Wetter");
  await expect(libraryMessage(page)).toBeFocused();

  // Die Set-Ansicht lädt nach; der Fokus folgt, sobald die Überschrift da ist.
  await page.getByRole("link", { name: "Wetter", exact: true }).click();
  await expect(heading("Wetter")).toBeFocused();
  await expect(page).toHaveTitle("Wetter – Vokabeltrainer");

  await page.goto("./#/backup");
  await expect(heading("Backup und Wiederherstellung")).toBeFocused();
  await expect(page).toHaveTitle("Backup und Wiederherstellung – Vokabeltrainer");

  // Die Sitzung fokussiert die Karte selbst.
  await page.goto("./");
  await page.getByRole("link", { name: "Wetter lernen" }).click();
  await page.getByRole("button", { name: "3 Vokabeln lernen" }).click();
  await expect(page.getByRole("button", { name: /Tippen zum Aufdecken/ })).toBeFocused();

  await page.goto("./#/gibt-es-nicht");
  await expect(heading("Seite nicht gefunden")).toBeFocused();
  await expect(page).toHaveTitle("Seite nicht gefunden – Vokabeltrainer");
});

test("Speichern nicht möglich", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "indexedDB", { value: undefined });
  });
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "Speichern nicht möglich" })).toBeVisible();
  expect(await audit(page, "Speichern nicht möglich")).toEqual([]);
});
