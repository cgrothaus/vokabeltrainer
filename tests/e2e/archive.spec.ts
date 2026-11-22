// Volle Bibliothek ordnen (S-60): Filter nach Sprache, die zuletzt gelernten Sets oben, Archiv,
// Auswahlmodus mit Lernstufe für mehrere Sets und Vorschlag der Lernstufe beim Hinzufügen (TDD 13.1,
// FR-43, D-72). Die Daten kommen aus einem Backup; es enthält auch einen Archivvermerk.
import { expect, type Page, test } from "@playwright/test";
import { entryRev } from "../../src/domain/hash";
import type { ReviewEvent, Session, StoredSet } from "../../src/domain/model";
import { checkText, collectErrors, libraryMessage } from "./support";

let next = 0;

function set(title: string, termLanguage: string, level?: string): StoredSet {
  const n = next++;
  return {
    id: `set${String(n).padStart(7, "0")}`,
    title,
    termLanguage,
    meaningLanguage: "de",
    ...(level !== undefined && { level }),
    editCount: 0,
    createdAt: new Date(Date.UTC(2026, 9, 1 + n, 12)).toISOString(),
    updatedAt: new Date(Date.UTC(2026, 9, 1 + n, 12)).toISOString(),
    sections: [
      {
        id: `sec${String(n).padStart(3, "0")}`,
        title: "Text A",
        entries: ["one", "two", "three", "four"].map((word, i) => ({
          id: `e${n}x${i}`.padEnd(6, "0"),
          term: { text: `${word} ${n}` },
          meanings: [{ text: `Wort ${n}.${i}` }],
        })),
      },
    ],
  };
}

const EN = [
  set("Unit 1 – Moving out", "en", "Klasse 11"),
  set("Unit 2 – Media worlds", "en", "Klasse 11"),
  set("Unit 3 – Work and future", "en", "Klasse 11"),
  set("Unit 10 – Global challenges", "en", "Klasse 11"),
  set("Phrasal verbs", "en"),
  set("Argumentieren", "en"),
];
const FR = [set("Unité 1 – En ville", "fr", "Klasse 11"), set("Faux amis", "fr")];
const OLD = set("Unit 1 – Teenage life", "en", "Klasse 10");

/** Zuletzt gelernt, jüngste zuerst; die jüngste Sitzung gehört dem archivierten Set. */
const LEARNED: [StoredSet, day: number][] = [
  [OLD, 20],
  [EN[2]!, 19],
  [EN[5]!, 18],
  [EN[0]!, 17],
  [EN[1]!, 10],
];

const at = (day: number, second: number) =>
  new Date(Date.UTC(2026, 10, day, 12, 0, second)).toISOString();

function backup(): string {
  const sessions: Session[] = LEARNED.map(([learned, day]) => ({
    id: `session${String(day).padStart(5, "0")}`,
    setId: learned.id,
    sectionIds: [learned.sections[0]!.id],
    startedAt: at(day, 0),
    endedAt: at(day, 59),
    status: "completed",
    config: { direction: "termToMeaning", count: 4, mcShare: 0 },
  }));
  const reviewEvents: ReviewEvent[] = LEARNED.map(([learned, day]) => {
    const entry = learned.sections[0]!.entries[0]!;
    return {
      id: `event${String(day).padStart(7, "0")}`,
      sessionId: `session${String(day).padStart(5, "0")}`,
      setId: learned.id,
      entryId: entry.id,
      entryRev: entryRev(entry),
      occurredAt: at(day, 1),
      direction: "termToMeaning",
      mode: "flashcard",
      result: "correct",
      firstAttempt: true,
    };
  });
  return JSON.stringify({
    format: "vokabeltrainer-backup",
    formatVersion: 1,
    dataVersion: 1,
    appVersion: "0.1.0+test",
    exportedAt: "2026-11-21T18:00:00.000Z",
    data: {
      sets: [...EN, ...FR, OLD],
      reviewEvents,
      sessions,
      settings: [{ key: `archived:${OLD.id}`, value: true }],
    },
  });
}

async function restoreLibrary(page: Page): Promise<void> {
  await page.clock.setFixedTime(new Date("2026-11-22T12:00:00.000Z"));
  await page.goto("./#/backup");
  await page.getByLabel("Backup-Datei auswählen").setInputFiles({
    name: "Vokabeltrainer-Backup_2026-11-21.json",
    mimeType: "application/json",
    buffer: Buffer.from(backup()),
  });
  await page.getByRole("button", { name: "Wiederherstellen", exact: true }).click();
  await expect(page.getByText("Backup wiederhergestellt.")).toBeFocused();
  await page.goto("./");
}

const sets = (page: Page) => page.getByRole("region", { name: "Vokabelsets" });
const titles = (page: Page) => sets(page).locator(".setcard .title");
const language = (page: Page) => page.getByRole("radiogroup", { name: "Sprache" });
const heading = (page: Page) => page.getByRole("heading", { level: 1 });

test("E2E-36 Bibliothek mit Filter nach Sprache, zuletzt gelernten Sets oben und Archiv", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await restoreLibrary(page);

  // Filter erst ab zwei Sprachen, mit Zahl; das archivierte Set fehlt überall.
  await expect(language(page).locator("label")).toHaveText([
    "Alle 8",
    "Englisch 6",
    "Französisch 2",
  ]);
  await expect(language(page).getByRole("radio", { name: "Alle 8" })).toBeChecked();
  const english = sets(page).locator("section.language").first();
  await expect(english.getByRole("heading")).toHaveText([
    "Englisch",
    "Zuletzt gelernt",
    "Weitere Sets",
  ]);
  await expect(english.locator(".setcard .title")).toHaveText([
    "Unit 3 – Work and future",
    "Argumentieren",
    "Unit 1 – Moving out",
    "Unit 2 – Media worlds",
    "Unit 10 – Global challenges",
    "Phrasal verbs",
  ]);
  await expect(page.getByRole("link", { name: "Unit 1 – Teenage life" })).toHaveCount(0);
  // „Weiterlernen“ nennt kein archiviertes Set; „Backup und Wiederherstellung“ steht in den Einstellungen.
  await expect(page.locator(".dock")).toBeHidden();
  await expect(page.getByRole("link", { name: "Backup und Wiederherstellung" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /^Archiv/ }).locator(".tail")).toHaveText("1 Set");

  // Eine Sprache: ohne Gruppenüberschrift; die Wahl bleibt nach dem Neuladen.
  await language(page)
    .getByRole("radio", { name: /^Französisch/ })
    .check();
  await expect(language(page).getByRole("radio", { name: /^Französisch/ })).toBeFocused();
  await expect(titles(page)).toHaveText(["Unité 1 – En ville", "Faux amis"]);
  await expect(sets(page).getByRole("heading", { name: "Französisch" })).toHaveCount(0);
  await page.reload();
  await expect(titles(page)).toHaveText(["Unité 1 – En ville", "Faux amis"]);
  await language(page).getByRole("radio", { name: /^Alle/ }).check();
  await expect(titles(page)).toHaveCount(8);

  // Archiv: nach Lernstufe, ein Set öffnet seine Set-Ansicht mit dem Hinweis.
  await page.getByRole("link", { name: /^Archiv/ }).click();
  await expect(heading(page)).toHaveText("Archiv");
  // Eine Lernstufe: Überschrift, aber kein Filter.
  await expect(page.getByRole("heading", { level: 2 })).toHaveText(["Klasse 10"]);
  await expect(page.getByRole("radiogroup")).toHaveCount(0);
  await expect(page.locator(".setcard .count")).toHaveText(["Englisch · 4 Einträge"]);
  await page.getByRole("link", { name: "Unit 1 – Teenage life", exact: true }).click();
  await expect(page.getByText("Dieses Set liegt im Archiv.", { exact: false })).toBeVisible();
  const menuButton = page.getByRole("banner").getByRole("button", { name: "Weitere Aktionen" });
  await menuButton.click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Aus dem Archiv zurückholen" })
    .click();
  await expect(page.getByRole("main").getByRole("status")).toHaveText(
    "„Unit 1 – Teenage life“ ist wieder in der Bibliothek.",
  );
  await expect(page.getByText("Dieses Set liegt im Archiv.", { exact: false })).toHaveCount(0);
  await menuButton.click();
  await page.getByRole("dialog").getByRole("button", { name: "Archivieren" }).click();
  await expect(page.getByRole("main").getByRole("status")).toHaveText(
    "„Unit 1 – Teenage life“ liegt jetzt im Archiv.",
  );
  expect(errors, "Fehler in der Konsole").toEqual([]);
});

test("E2E-36 Auswahl: Lernstufe für mehrere Sets, archivieren und zurückholen", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await restoreLibrary(page);

  // Auswahlmodus auf einem eigenen Verlaufseintrag: Zurück beendet ihn.
  await page.getByRole("button", { name: "Sets auswählen" }).click();
  await expect(heading(page)).toHaveText("Sets auswählen");
  await expect(page.getByRole("button", { name: "Archivieren" })).toBeDisabled();
  await page.getByRole("checkbox", { name: /^Phrasal verbs/ }).check();
  await expect(heading(page)).toHaveText("1 ausgewählt");
  await page.goBack();
  await expect(heading(page)).toHaveText("Vokabeltrainer");
  await expect(page.getByRole("checkbox")).toHaveCount(0);

  // Lernstufe für alle französischen Sets, als neue Stufe.
  await page.getByRole("button", { name: "Sets auswählen" }).click();
  await page.getByRole("button", { name: "Alle aus Französisch auswählen" }).click();
  await expect(heading(page)).toHaveText("2 ausgewählt");
  await expect(page.getByRole("button", { name: "Keine aus Französisch auswählen" })).toBeFocused();
  await page.getByRole("button", { name: "Lernstufe …" }).click();
  await expect(heading(page)).toHaveText("Lernstufe setzen");
  await expect(page.getByRole("listitem")).toHaveText(["Unité 1 – En ville", "Faux amis"]);
  await page.getByRole("button", { name: "Übernehmen" }).click();
  await expect(page.getByText("Wähle eine Lernstufe.")).toBeVisible();
  await page.getByRole("radio", { name: "Neue Lernstufe" }).check();
  await page.getByRole("button", { name: "Übernehmen" }).click();
  await expect(page.getByText("Gib einen Namen für die Lernstufe ein.")).toBeVisible();
  await page.getByRole("textbox", { name: "Name der neuen Lernstufe" }).fill("Kursstufe 1");
  await page.getByRole("button", { name: "Übernehmen" }).click();
  await expect(libraryMessage(page)).toHaveText("2 Sets jetzt in „Kursstufe 1“.");
  await expect(heading(page)).toHaveText("Vokabeltrainer");
  await expect(
    sets(page).getByRole("listitem").filter({ hasText: "Faux amis" }).locator(".count"),
  ).toHaveText("Kursstufe 1 · 4 Einträge");
  // Zurück führt nicht in die Auswahl oder das Formular.
  await page.goBack();
  await expect(page).not.toHaveURL(/#\/level\//);

  // Archivieren: Die französischen Sets verschwinden, mit ihnen der Filter.
  await page.goto("./");
  await page.getByRole("button", { name: "Sets auswählen" }).click();
  await page.getByRole("button", { name: "Alle aus Französisch auswählen" }).click();
  await page.getByRole("button", { name: "Archivieren" }).click();
  await expect(libraryMessage(page)).toHaveText(
    "2 Sets archiviert. Du findest sie unter „Archiv“.",
  );
  await expect(heading(page)).toHaveText("Vokabeltrainer");
  await expect(language(page)).toHaveCount(0);
  await expect(titles(page)).toHaveCount(6);
  await expect(page.getByRole("link", { name: /^Archiv/ }).locator(".tail")).toHaveText("3 Sets");

  // Im Archiv nach Lernstufe gefiltert; Zurückholen über die Auswahl.
  await page.getByRole("link", { name: /^Archiv/ }).click();
  const level = page.getByRole("radiogroup", { name: "Lernstufe" });
  await expect(level.locator("label")).toHaveText(["Alle 3", "Klasse 10 1", "Kursstufe 1 2"]);
  await expect(page.getByRole("heading", { level: 2 })).toHaveText(["Klasse 10", "Kursstufe 1"]);
  await level.getByRole("radio", { name: /^Kursstufe 1/ }).check();
  await expect(page.locator(".setcard .title")).toHaveText(["Faux amis", "Unité 1 – En ville"]);
  await page.getByRole("button", { name: "Sets auswählen" }).click();
  await page.getByRole("checkbox", { name: /^Faux amis/ }).check();
  await page.getByRole("button", { name: "Zurückholen" }).click();
  await expect(page.getByRole("main").getByRole("status")).toHaveText(
    "1 Set ist wieder in der Bibliothek.",
  );
  await expect(heading(page)).toHaveText("Archiv");
  await expect(page.locator(".setcard .title")).toHaveText(["Unité 1 – En ville"]);
  expect(errors, "Fehler in der Konsole").toEqual([]);
});

test("E2E-36 Vorschau schlägt die Lernstufe des zuletzt hinzugefügten Sets vor", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await restoreLibrary(page);
  await page.goto("./#/import");
  await checkText(
    page,
    JSON.stringify({
      format: "vokabeltrainer-set",
      formatVersion: 1,
      set: { title: "Unit 5 – Science", termLanguage: "en", meaningLanguage: "de" },
      sections: [{ title: "Text A", entries: [{ term: "cloud", meanings: ["Wolke"] }] }],
    }),
  );
  // Zuletzt hinzugefügt mit Lernstufe ist das archivierte Set aus Klasse 10.
  const choice = page.getByRole("combobox", { name: "Lernstufe" });
  await expect(choice).toHaveValue("Klasse 10");
  await choice.selectOption("Klasse 11");
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(page.getByText("Englisch → Deutsch · 1 Eintrag · Klasse 11")).toBeVisible();
  expect(errors, "Fehler in der Konsole").toEqual([]);
});
