// E2E-20 Durchsicht Mobile und Barrierearmut (S-23, TDD 13.4, FR-24, NFR-09–NFR-13): jede Ansicht und
// jeder wichtige Zustand bei 320 CSS-Pixeln, hell und dunkel. Geprüft werden die WCAG-Regeln von axe
// (u. a. Kontrast, Namen, Rollen), horizontales Scrollen auch bei 200 % Schrift, Zielgrößen ab 44 × 44
// und genau eine `h1`; dazu Fokus und Seitentitel nach einem Seitenwechsel.
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import type { StoredSet } from "../../src/domain/model";
import {
  checkText,
  backButton,
  cardReady,
  changeDevice,
  collectErrors,
  endPractice,
  fakeDevice,
  fakeInstallPrompt,
  fakeSpeech,
  importSet,
  libraryMessage,
  readStore,
  setAction,
  setFile,
  setupLink,
  startLearning,
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
  // Ein Blatt blendet sich ein; mitten in der Bewegung stimmt der Kontrast noch nicht.
  await page.evaluate(() =>
    Promise.all(document.getAnimations().map((animation) => animation.finished)),
  );
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
  await expect(
    page.getByRole("heading", { name: "Lerne Vokabeln mit Karteikarten" }),
  ).toBeVisible();
  findings.push(...(await audit(page, "Bibliothek leer")));

  await page.goto("./#/help");
  findings.push(...(await audit(page, "Hilfe")));
  for (const summary of await page.locator("summary").all()) await summary.click();
  findings.push(...(await audit(page, "Hilfe aufgeklappt")));

  await page.goto("./#/help/learning");
  findings.push(...(await audit(page, "Hilfe Lernplan")));

  await page.goto("./#/import");
  findings.push(...(await audit(page, "Import")));
  await checkText(page, "Das ist keine Vokabelliste.");
  await expect(page.getByRole("alert")).toBeVisible();
  findings.push(...(await audit(page, "Import mit Fehler")));
  await checkText(page, `Hier ist dein Set:\n${setFile("Wetter")}`);
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

  // Zuletzt, weil danach ein Set da ist: dieselbe Datei noch einmal zeigt den Hinweis auf ein Duplikat.
  await page.goto("./#/import");
  await checkText(page, setFile("Wetter"));
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(libraryMessage(page)).toBeVisible();
  await page.goto("./#/import");
  await checkText(page, setFile("Wetter"));
  await expect(page.getByText("das du schon hast", { exact: false })).toBeVisible();
  findings.push(...(await audit(page, "Import-Vorschau mit Duplikat")));

  expect(findings).toEqual([]);
  expect(errors).toEqual([]);
});

test("Mit Set: Bibliothek, Set-Ansicht, Löschen, Einrichtung, Karteikarten, Zwischenstand, Ergebnis", async ({
  page,
}) => {
  const errors = collectErrors(page);
  const findings: string[] = [];
  await importSet(page, "Wetter");
  findings.push(...(await audit(page, "Bibliothek")));

  await page.getByRole("link", { name: "Wetter", exact: true }).click();
  await expect(page.getByText("Mit diesem Set hast du noch nicht gelernt.")).toBeVisible();
  findings.push(...(await audit(page, "Set-Ansicht")));
  await page.locator("summary").first().click();
  findings.push(...(await audit(page, "Set-Ansicht aufgeklappt")));
  await setAction(page, "Set löschen");
  await expect(page.getByRole("dialog")).toBeVisible();
  findings.push(...(await audit(page, "Set löschen, Ankündigung")));
  await page.getByRole("button", { name: "Abbrechen" }).click();

  await setupLink(page, "Wetter").click();
  const start = page.getByRole("button", { name: "3 Vokabeln lernen" });
  await expect(start).toBeVisible();
  findings.push(...(await audit(page, "Einrichtung")));
  await start.click();

  // Vorderseite der noch nicht aufgedeckten Karte; die Karte wendet sich beim Aufdecken.
  const front = page.locator(".flash:not(.flipped) .front");
  await expect(front).toBeVisible();
  findings.push(...(await audit(page, "Karteikarte vorn")));
  await front.click();
  await expect(page.locator(".flash.flipped .back")).toBeFocused();
  findings.push(...(await audit(page, "Karteikarte hinten")));
  await page.getByRole("button", { name: "Nochmal" }).click();
  await expect(front).toBeVisible();
  await page.getByRole("button", { name: "Beenden" }).click();
  const pause = page.getByRole("dialog", { name: "Zwischenstand" });
  await expect(pause).toBeVisible();
  findings.push(...(await audit(page, "Zwischenstand")));
  await pause.getByRole("button", { name: /^Weiterlernen/ }).click();

  // Alle übrigen Karten als gewusst bewerten, bis das Ergebnis erscheint.
  const done = page.getByRole("heading", { name: /Geschafft/ });
  for (;;) {
    await expect(front.or(done)).toBeVisible();
    if (await done.isVisible()) break;
    await front.click();
    await page.getByRole("button", { name: "Gewusst", exact: true }).click();
    await expect(page.locator(".flash.flipped")).toHaveCount(0);
  }
  findings.push(...(await audit(page, "Ergebnis")));

  await page.goto("./");
  await expect(page.locator(".setcard .status")).toContainText("zuletzt heute");
  await expect(page.getByRole("button", { name: /^Weiterlernen/ })).toBeVisible();
  await expect(page.locator(".hints")).not.toHaveAttribute("aria-busy");
  findings.push(...(await audit(page, "Bibliothek mit Lernstand, Weiterlernen")));
  await page.getByRole("link", { name: "Wetter", exact: true }).click();
  // Mit den Zeilen je Richtung (TDD 12.7).
  await expect(page.locator(".stages li")).toHaveCount(2);
  findings.push(...(await audit(page, "Set-Ansicht mit Lernstand")));
  await setupLink(page, "Wetter").click();
  await expect(page.getByRole("region", { name: "Wie beim letzten Mal" })).toBeVisible();
  findings.push(...(await audit(page, "Einrichtung wie beim letzten Mal")));

  // Zwei Tage später ist das Gelernte fällig (TDD 12.8): „Jetzt wiederholen“ und „Selbst auswählen“.
  await page.clock.setFixedTime(new Date(Date.now() + 2 * 86_400_000));
  await page.goto("./");
  await expect(page.locator(".setcard .status .plan")).toContainText("fällig");
  await expect(page.locator(".hints")).not.toHaveAttribute("aria-busy");
  findings.push(...(await audit(page, "Bibliothek mit Fälligem")));
  await page.getByRole("link", { name: "Wetter", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Wiederholen/ })).toBeVisible();
  findings.push(...(await audit(page, "Set-Ansicht mit Fälligem")));

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
  await expect(page.getByRole("dialog")).toBeVisible();
  findings.push(...(await audit(page, "Alle Daten löschen, Ankündigung")));

  expect(findings).toEqual([]);
  expect(errors).toEqual([]);
});

test("Speicherschutz, Installation und Backup-Erinnerung (TDD 5.1, 6.6)", async ({ page }) => {
  const errors = collectErrors(page);
  const findings: string[] = [];
  const hintsChecked = () => expect(page.locator(".hints")).not.toHaveAttribute("aria-busy");
  await fakeDevice(page, { ios: true });
  await page.goto("./");
  await expect(page.getByRole("region", { name: "Zuerst auf den Home-Bildschirm" })).toBeVisible();
  findings.push(...(await audit(page, "Empty State mit Anleitung zum Home-Bildschirm")));

  await importSet(page, "Wetter");
  await page.getByRole("button", { name: "Schützen" }).click();
  await expect(page.getByRole("dialog", { name: "Auf den Home-Bildschirm" })).toBeVisible();
  findings.push(...(await audit(page, "Blatt mit dem Umzug auf den Home-Bildschirm")));
  await page.keyboard.press("Escape");
  findings.push(...(await audit(page, "Bibliothek mit „Schützen“")));

  // Nicht geschützt, Browser bietet die Installation an (TDD 5.1).
  await changeDevice(page, { ios: false });
  await fakeInstallPrompt(page);
  await page.reload();
  await expect(page.getByRole("button", { name: "Installieren" })).toBeVisible();
  findings.push(...(await audit(page, "Bibliothek mit Hinweis auf Backups und Installieren")));

  // Eine Antwort vor acht Tagen ohne Backup: Die Erinnerung ist fällig (D-46).
  const now = Date.now();
  await page.clock.setFixedTime(new Date(now - 8 * 86_400_000));
  await startLearning(page, "Wetter");
  await page.locator(".flash .front").click();
  await page.getByRole("button", { name: "Gewusst", exact: true }).click();
  await expect(page.getByText("1 von 3 geschafft")).toBeVisible();
  await endPractice(page);
  await page.clock.setFixedTime(new Date(now));
  await page.reload();
  await hintsChecked();
  await expect(page.getByRole("button", { name: "Sichern" })).toBeEnabled();
  findings.push(...(await audit(page, "Bibliothek mit Backup-Erinnerung")));

  // Geschützt wie Chrome auf Android: nur das Angebot zur Installation.
  await changeDevice(page, { granted: true });
  await page.reload();
  await expect(page.getByText("Als App installieren? Deine Vokabeln kommen mit.")).toBeVisible();
  findings.push(...(await audit(page, "Bibliothek mit Installationsangebot")));
  await page.goto("./#/settings");
  await expect(page.getByRole("button", { name: "Als App installieren" })).toBeVisible();
  findings.push(...(await audit(page, "Einstellungen mit Installieren")));

  expect(findings).toEqual([]);
  expect(errors).toEqual([]);
});

test("Beispielset: Set-Ansicht mit Lernstand, Multiple Choice mit Rückmeldung", async ({
  page,
}) => {
  const errors = collectErrors(page);
  const findings: string[] = [];
  // Mit englischer Stimme: Lautsprecher an den Wörtern und „Lernen“ in den Einstellungen (TDD 12.11).
  await fakeSpeech(page, [{ lang: "en-GB" }]);
  await page.goto("./");
  await page.getByRole("button", { name: "Beispielset ausprobieren" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Beispielset");
  findings.push(...(await audit(page, "Set-Ansicht Beispielset")));
  await page.locator(".section summary").first().click();
  await expect(page.getByRole("button", { name: /vorlesen$/ }).first()).toBeVisible();
  findings.push(...(await audit(page, "Set-Ansicht mit Lautsprechern")));
  await page.goto("./#/settings");
  await expect(page.getByRole("switch", { name: /Automatisch vorlesen/ })).toBeVisible();
  findings.push(...(await audit(page, "Einstellungen mit Vorlesen")));
  await page.goBack();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Beispielset");
  await page.getByText("Über dieses Set").click();
  findings.push(...(await audit(page, "Set-Ansicht, Über dieses Set")));
  await page.getByRole("banner").getByRole("button", { name: "Weitere Aktionen" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  findings.push(...(await audit(page, "Menü der Set-Ansicht")));
  await page.keyboard.press("Escape");

  await setAction(page, "Exportieren");
  await expect(page.getByText(/^Ganzes Set: /)).toBeVisible();
  findings.push(...(await audit(page, "Export")));
  await page.getByRole("radio", { name: "Einzelne Sektionen" }).check();
  await page.getByRole("checkbox").first().check();
  findings.push(...(await audit(page, "Export, einzelne Sektionen")));
  await backButton(page).click();

  await page
    .getByRole("link", { name: /(lernen|selbst auswählen)$/ })
    .first()
    .click();
  await page.getByRole("slider", { name: "Multiple Choice" }).fill("100");
  await page.getByRole("radio", { name: "10", exact: true }).check();
  await page.getByRole("button", { name: "10 Vokabeln lernen" }).click();
  const options = page.locator(".options button");
  await expect(page.getByRole("button", { name: "Antworten zeigen" })).toBeVisible();
  await expect(page.getByRole("button", { name: /vorlesen$/ })).toBeVisible();
  findings.push(...(await audit(page, "Multiple Choice vor den Antworten, mit Lautsprecher")));
  // Die Uhr läuft (mit angehaltener hinge axe): Unter Last erscheinen die Antworten nach 3 s schon während
  // der Prüfung von selbst (TDD 12.3). Enter zeigt sie nach der Sperre, falls nicht, sonst nichts.
  await cardReady(page);
  await page.keyboard.press("Enter");
  await expect(options).toHaveCount(4);
  await expect(options.first()).toBeVisible();
  findings.push(...(await audit(page, "Multiple Choice")));
  // Eine falsche Antwort: Nach einer richtigen ginge es während der Prüfung von selbst weiter (D-67).
  const term = await page.locator(".question .prompt").textContent();
  const entries = (await readStore<StoredSet>(page, "sets")).flatMap((set) =>
    set.sections.flatMap((section) => section.entries),
  );
  const entry = entries.find((candidate) => candidate.term.text === term)!;
  const right = entry.meanings.map((meaning) => meaning.text).join("; ");
  await options.filter({ hasNotText: right }).first().click();
  await expect(page.getByText(/^Leider falsch/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Weiter" })).toBeVisible();
  findings.push(...(await audit(page, "Multiple Choice mit Rückmeldung")));

  expect(findings).toEqual([]);
  expect(errors).toEqual([]);
});

test("Tablet: Set-Ansicht, Bibliothek und Karteikarte bei 768 px (TDD 13.7)", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  const errors = collectErrors(page);
  const findings: string[] = [];
  await page.goto("./");
  await page.getByRole("button", { name: "Beispielset ausprobieren" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Beispielset");
  findings.push(...(await audit(page, "Set-Ansicht Tablet")));

  await backButton(page).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Vokabeltrainer");
  await expect(page.locator(".hints")).not.toHaveAttribute("aria-busy");
  findings.push(...(await audit(page, "Bibliothek Tablet")));

  // Über die Einrichtung, damit es Karteikarten werden; der runde Knopf startete neue Vokabeln (D-63).
  await page.locator(".setcard a.title").first().click();
  await page.getByRole("link", { name: /selbst auswählen$/ }).click();
  await page.getByRole("slider", { name: "Multiple Choice" }).fill("0");
  await page.getByRole("button", { name: "20 Vokabeln lernen" }).click();
  await page.locator(".flash .front").click();
  await expect(page.getByRole("button", { name: "Gewusst", exact: true })).toBeVisible();
  findings.push(...(await audit(page, "Karteikarte hinten Tablet")));
  expect(findings).toEqual([]);
  expect(errors, "Fehler in der Konsole").toEqual([]);
});

test("Bearbeiten: Set bearbeiten, Eintragsformular, Fehler, Frage beim Verlassen", async ({
  page,
}) => {
  const errors = collectErrors(page);
  const findings: string[] = [];
  await page.goto("./");
  await page.getByRole("button", { name: "Beispielset ausprobieren" }).click();
  await setAction(page, "Bearbeiten");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("bearbeiten");
  findings.push(...(await audit(page, "Set bearbeiten")));

  // Sortiermodus mit Griff und Menü am Eintrag (D-54).
  await page.getByRole("button", { name: "Reihenfolge ändern" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Reihenfolge ändern");
  findings.push(...(await audit(page, "Reihenfolge ändern")));
  await page.locator(".sort-list li[data-entry-id] .iconbtn").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  findings.push(...(await audit(page, "Reihenfolge ändern, Menü am Eintrag")));
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Fertig" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("bearbeiten");

  // Ein Eintrag mit Beispielen; „Weitere Angaben“ ist zugeklappt und wird aufgeklappt.
  const entries = page.locator(".edit-entries a");
  const count = await entries.count();
  for (let index = 0; index < count; index++) {
    await entries.nth(index).click();
    await expect(page.getByRole("heading", { name: "Eintrag bearbeiten" })).toBeVisible();
    if ((await page.locator(".more-details .example").count()) > 0) break;
    await page.goBack();
  }
  await page.getByText("Weitere Angaben").click();
  await expect(page.locator(".more-details .example").first()).toBeVisible();
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

test("Sets und Sektionen: Anlegen, Angaben, Umbenennen, Sektion löschen", async ({ page }) => {
  const errors = collectErrors(page);
  const findings: string[] = [];
  await page.goto("./#/new-set");
  await expect(page.getByRole("heading", { name: "Leeres Set anlegen" })).toBeVisible();
  findings.push(...(await audit(page, "Leeres Set anlegen")));
  await page.getByLabel("Lernsprache", { exact: true }).selectOption({ label: "Andere Sprache …" });
  await page.getByRole("button", { name: "Set anlegen" }).click();
  await expect(page.getByRole("main").getByRole("alert").first()).toContainText("Der Titel fehlt.");
  findings.push(...(await audit(page, "Leeres Set anlegen mit Fehlern")));

  await page.getByLabel("Titel", { exact: true }).fill("Wetter");
  await page.getByLabel("Sprachcode der Lernsprache").fill("en");
  await page.getByRole("button", { name: "Set anlegen" }).click();
  await expect(page.getByRole("heading", { name: "Wetter bearbeiten" })).toBeVisible();
  await page.getByRole("button", { name: "Sektion hinzufügen" }).click();
  await page.getByLabel("Name der neuen Sektion").fill("Sektion 1");
  await page.getByRole("button", { name: "Hinzufügen", exact: true }).click();
  await expect(page.getByLabel("Name der neuen Sektion")).toHaveAttribute("aria-invalid", "true");
  findings.push(...(await audit(page, "Set bearbeiten, neue Sektion mit Fehler")));
  await page.getByLabel("Name der neuen Sektion").fill("Jahreszeiten");
  await page.getByRole("button", { name: "Hinzufügen", exact: true }).click();
  await page.getByRole("link", { name: "Eintrag hinzufügen zu „Sektion 1“" }).click();
  await page.getByRole("group", { name: "Wort", exact: true }).getByLabel("Text").fill("rain");
  await page.getByRole("group", { name: "Bedeutung" }).getByLabel("Text").fill("Regen");
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await page.getByRole("button", { name: "Sektion „Sektion 1“: weitere Aktionen" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  findings.push(...(await audit(page, "Menü einer Sektion")));
  await page.getByRole("dialog").getByRole("button", { name: "Umbenennen" }).click();
  findings.push(...(await audit(page, "Set bearbeiten, Umbenennen")));
  await page.getByRole("button", { name: "Abbrechen" }).click();
  await page.getByRole("button", { name: "Sektion „Sektion 1“: weitere Aktionen" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Sektion löschen" }).click();
  await expect(page.getByRole("dialog", { name: "Sektion löschen?" })).toBeVisible();
  findings.push(...(await audit(page, "Sektion löschen, Ankündigung")));
  await page.getByRole("dialog").getByRole("button", { name: "Abbrechen" }).click();

  await page.getByRole("link", { name: "Angaben bearbeiten" }).click();
  await page.getByText("Weitere Angaben").click();
  findings.push(...(await audit(page, "Angaben bearbeiten")));

  expect(findings).toEqual([]);
  expect(errors).toEqual([]);
});

test("Vorschau für ein vorhandenes Set: Konflikt, nicht mehr vorhanden, Ersetzen mit Löschungen", async ({
  page,
}) => {
  const errors = collectErrors(page);
  const findings: string[] = [];
  const file = (entries: unknown[]) =>
    JSON.stringify({
      set: {
        id: "m4x8c2r9tw",
        title: "Englisch – Wetter",
        termLanguage: "en",
        meaningLanguage: "de",
      },
      sections: [{ id: "q7h3kd", title: "Wetter", entries }],
    });
  await page.goto("./#/import");
  await checkText(
    page,
    file([
      { id: "a8f2kc", term: "rain", meanings: ["Regen"], notes: "auch: Niederschlag" },
      { id: "b3c4d5", term: "sun", meanings: ["Sonne"] },
    ]),
  );
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(libraryMessage(page)).toBeVisible();

  // Ohne Prüfwert und anders als in der App: Konflikt; dazu ein unbekannter und ein neuer Eintrag.
  await page.goto("./#/import");
  await checkText(
    page,
    file([
      {
        id: "a8f2kc",
        term: { text: "rain", acceptedVariants: ["shower"] },
        meanings: ["Regen", "Regenschauer"],
        examples: [{ text: "It rains a lot.", translation: "Es regnet viel." }],
      },
      { id: "gone11", term: "hail", meanings: ["Hagel"] },
      { term: "fog", meanings: ["Nebel"] },
    ]),
  );
  await expect(page.getByRole("heading", { name: "1 Konflikt" })).toBeVisible();
  findings.push(...(await audit(page, "Vorschau Aktualisieren mit Konflikt")));
  await page.getByRole("radio", { name: "Ersetzen" }).check();
  await expect(page.getByRole("button", { name: "Ersetzen und 1 Eintrag löschen" })).toBeVisible();
  findings.push(...(await audit(page, "Vorschau Ersetzen mit Löschungen")));

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

  // Eine Meldung der Ansicht hat Vorrang vor der Überschrift: nach dem Speichern in der Set-Ansicht.
  await page.goto("./#/import");
  await checkText(page, setFile("Wetter"));
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(libraryMessage(page)).toBeFocused();
  await page.goto("./");

  // Die Set-Ansicht lädt nach; der Fokus folgt, sobald die Überschrift da ist.
  await page.getByRole("link", { name: "Wetter", exact: true }).click();
  await expect(heading("Wetter")).toBeFocused();
  await expect(page).toHaveTitle("Wetter – Vokabeltrainer");

  await page.goto("./#/backup");
  await expect(heading("Backup und Wiederherstellung")).toBeFocused();
  await expect(page).toHaveTitle("Backup und Wiederherstellung – Vokabeltrainer");

  // Die Sitzung fokussiert die Karte selbst.
  await page.goto("./");
  // Ohne Gelerntes startet der Knopf der Bibliothek gleich neue Vokabeln (D-63).
  await page.getByRole("button", { name: "Wetter lernen" }).click();
  await expect(page.locator(".flash .front")).toBeFocused();

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
