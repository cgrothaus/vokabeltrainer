// Lernen über mehrere Sets (S-54): „Zusammen lernen“ nur für Sets mit demselben Sprachpaar, falsche
// Antworten aus den Sets der Sitzung, danach eigener Lernstand je Set; das Löschen des einen lässt die
// Lerndaten des anderen vollständig (TDD 12.10, FR-39, AK-22, AK-33).
import { expect, type Page, test } from "@playwright/test";
import type { ReviewEvent, Session } from "../../src/domain/model";
import { collectErrors, importText, readStore, setAction } from "./support";

const ENGLISH: [title: string, words: [string, string][]][] = [
  [
    "Lektion 1",
    [
      ["rain", "Regen"],
      ["sun", "Sonne"],
      ["snow", "Schnee"],
    ],
  ],
  [
    "Lektion 2",
    [
      ["dog", "Hund"],
      ["cat", "Katze"],
      ["bird", "Vogel"],
    ],
  ],
];

function file(title: string, termLanguage: string, words: [string, string][]): string {
  return JSON.stringify({
    format: "vokabeltrainer-set",
    formatVersion: 1,
    set: { title, termLanguage, meaningLanguage: "de" },
    sections: [
      { title: "Wörter", entries: words.map(([term, meaning]) => ({ term, meanings: [meaning] })) },
    ],
  });
}

const saved = (title: string) => `„${title}“ mit 3 Einträgen gespeichert.`;

async function importAll(page: Page): Promise<void> {
  for (const [title, words] of ENGLISH)
    await importText(page, file(title, "en", words), saved(title));
  const french: [string, string][] = [
    ["la pluie", "Regen"],
    ["le chat", "Katze"],
    ["le chien", "Hund"],
  ];
  await importText(page, file("Leçon 1", "fr", french), saved("Leçon 1"));
}

test("E2E-34 Zwei Sets mit demselben Sprachpaar zusammen lernen, jedes behält seinen Lernstand", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await importAll(page);

  // Nur die englische Gruppe hat zwei Sets: Dort steht „Zusammen lernen“, beim Französischen nicht.
  const together = page.getByRole("link", { name: "Zusammen lernen" });
  await expect(together).toHaveCount(1);
  await together.click();
  await expect(page).toHaveURL(/#\/together\/en\/de$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Zusammen lernen");
  const boxes = page.getByRole("checkbox");
  await expect(boxes).toHaveCount(2);
  await expect(page.getByRole("checkbox", { name: /Lektion 1/ })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: /Lektion 2/ })).toBeChecked();
  await expect(page.locator(".together .plan")).toHaveText("6 neu");

  // Neue Vokabeln aus beiden Sets, als Multiple Choice: Allein hätte jedes Set zu wenige Kandidaten.
  await page.locator(".dock").getByRole("button", { name: "Neue Vokabeln lernen" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Lektion 1 und Lektion 2");
  await expect(page.getByText("0 von 6 geschafft")).toBeVisible();
  const answers = new Map(ENGLISH.flatMap(([, words]) => words));
  const meanings = new Set(answers.values());
  const offered = new Set<string>();
  for (let i = 0; i < 6; i++) {
    const prompt = page.locator(".question .prompt");
    const text = (await prompt.textContent())!;
    await page.getByRole("button", { name: "Antworten zeigen" }).click();
    const options = await page.locator(".options button").allTextContents();
    expect(options).toHaveLength(4);
    // Alle Antworten auf der Sprachseite der Frage und aus den Sets der Sitzung (AK-22).
    for (const option of options) {
      expect(meanings).toContain(option.trim());
      offered.add(option.trim());
    }
    await page.locator(".options button", { hasText: answers.get(text)! }).click();
    await expect
      .poll(async () => ((await prompt.count()) > 0 ? prompt.first().textContent() : ""))
      .not.toBe(text);
  }
  await expect(page.getByRole("heading", { name: "Geschafft" })).toBeVisible();
  // Zu Fragen aus dem einen Set kamen auch Antworten aus dem anderen.
  expect(offered).toEqual(meanings);

  // Je Set ein Datensatz mit gemeinsamer Gruppe; jede Antwort gehört zum Datensatz ihres Sets.
  const sessions = await readStore<Session>(page, "sessions");
  expect(sessions).toHaveLength(2);
  expect(sessions[0]!.groupId).toBeDefined();
  expect(sessions[1]!.groupId).toBe(sessions[0]!.groupId);
  const events = await readStore<ReviewEvent>(page, "reviewEvents");
  const sessionOf = new Map(sessions.map((session) => [session.setId, session.id]));
  expect(events).toHaveLength(6);
  for (const event of events) expect(event.sessionId).toBe(sessionOf.get(event.setId));

  // „Weiterlernen“ nennt die Zusammenstellung; jedes Set zeigt seinen eigenen Lernstand.
  await page.getByRole("link", { name: "Zur Bibliothek" }).click();
  const resume = page.locator(".dock").getByRole("button", { name: /^Weiterlernen/ });
  await expect(resume).toHaveText("Weiterlernen Zusammen: Lektion 1 und Lektion 2");
  for (const [title] of ENGLISH) {
    await page.getByRole("link", { name: title, exact: true }).click();
    await expect(page.locator(".overview .stages li .counts").first()).toHaveText("3 im Aufbau");
    await page.goto("./");
  }

  // Ohne Fälliges und Neues startet „Weiterlernen“ die Zusammenstellung frei.
  await resume.click();
  await expect(page.getByText("0 von 6 geschafft")).toBeVisible();
  await page.getByRole("button", { name: "Beenden" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Vokabeltrainer" })).toBeVisible();

  // Lektion 1 löschen: Sitzungen und Antworten von Lektion 2 bleiben vollständig (AK-33).
  await page.getByRole("link", { name: "Lektion 1", exact: true }).click();
  const firstId = decodeURIComponent(new URL(page.url()).hash.slice("#/set/".length));
  const before = await readStore<Session>(page, "sessions");
  const keptSessions = before.filter((session) => session.setId !== firstId);
  const keptEvents = events.filter((event) => event.setId !== firstId);
  expect(keptEvents).toHaveLength(3);
  await setAction(page, "Set löschen");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /löschen$/ })
    .click();
  await expect(page.getByText("„Lektion 1“ gelöscht.")).toBeVisible();
  expect(await readStore<Session>(page, "sessions")).toEqual(keptSessions);
  expect(await readStore<ReviewEvent>(page, "reviewEvents")).toEqual(keptEvents);
  // Mit einem Set ist es keine Zusammenstellung mehr: „Weiterlernen“ nennt Lektion 2.
  await expect(resume).toHaveText(/^Weiterlernen Lektion 2/);
  await expect(page.getByRole("link", { name: "Zusammen lernen" })).toHaveCount(0);
  expect(errors).toEqual([]);
});
