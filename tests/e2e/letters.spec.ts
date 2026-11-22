// E2E-35 Schreiben ohne Tastatur (S-55, TDD 12.3, FR-41, AK-35, D-70): In Richtung Lernsprache setzt
// man das Wort aus Kacheln zusammen, ohne Eingabefeld und damit ohne Bildschirmtastatur. „Selbst
// auswählen“ schaltet es zu, der Plan stellt sichere Karten in dieser Richtung so.
import { expect, type Page, test } from "@playwright/test";
import { entryRev } from "../../src/domain/hash";
import type { ReviewEvent, Session, StoredSet } from "../../src/domain/model";
import { collectErrors, goToSetup, importSet, MEANINGS, readStore } from "./support";

const TERMS = Object.fromEntries(
  Object.entries(MEANINGS).map(([term, meaning]) => [meaning, term]),
);

const prompt = (page: Page) => page.locator(".question .prompt");

/** Setzt das Wort Buchstabe für Buchstabe aus den noch freien Kacheln zusammen. */
async function spell(page: Page, word: string): Promise<void> {
  for (const letter of word) {
    await page
      .locator(".letter-tiles .tile:not(.used)")
      .filter({ hasText: new RegExp(`^${letter}$`) })
      .first()
      .click();
  }
}

test("E2E-35 Selbst auswählen mit Buchstaben: antippen, zurücknehmen, prüfen, tippen", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto("./");
  await importSet(page, "Englisch – Wetter");
  await goToSetup(page, "Englisch – Wetter");
  const letters = page.getByRole("switch", { name: /Schreiben mit Buchstaben/ });
  // Nur sichtbar, wenn die Richtung Karten in die Lernsprache enthält.
  await expect(letters).toBeHidden();
  await page.getByRole("radio", { name: "Deutsch → Englisch", exact: true }).check();
  await letters.check();
  await expect(page.getByText("25 % (Rest: Buchstaben)")).toBeVisible();
  await page.getByRole("button", { name: "3 Vokabeln lernen" }).click();

  // Erste Karte: zwei Kacheln setzen, eine zurücknehmen; „Prüfen“ erst, wenn alle Stellen belegt sind.
  // Drei Einträge sind zu wenige für Multiple Choice: alles Buchstaben.
  await expect(page.locator(".kind")).toHaveText("Buchstaben");
  await expect(page.locator("main input, main textarea")).toHaveCount(0);
  const first = TERMS[(await prompt(page).textContent())!]!;
  const check = page.getByRole("button", { name: "Prüfen" });
  await spell(page, first.slice(0, 2));
  await expect(check).toHaveAttribute("aria-disabled", "true");
  await page.getByRole("button", { name: `„${first[1]}“ zurücknehmen` }).click();
  await expect(page.locator(".word .slot button")).toHaveCount(1);
  await spell(page, first.slice(1));
  await expect(check).not.toHaveAttribute("aria-disabled");
  await check.click();
  await expect(page.locator(".feedback")).toHaveText("Richtig.");
  // Richtig geht es von selbst weiter (D-67).
  await expect(prompt(page)).not.toHaveText(MEANINGS[first]!);

  // Zweite Karte falsch: das Wort rückwärts.
  const second = TERMS[(await prompt(page).textContent())!]!;
  await spell(page, [...second].reverse().join(""));
  await check.click();
  await expect(page.locator(".feedback")).toHaveText(`Leider falsch. Richtig ist: ${second}`);
  await expect(page.locator(".letter-tiles")).toBeHidden();
  await page.getByRole("button", { name: "Weiter" }).click();

  // Dritte Karte mit der Tastatur: Buchstaben, Rücktaste, Enter. Die alte Karte läuft noch kurz aus.
  await expect(prompt(page)).not.toHaveText(MEANINGS[second]!);
  await expect(page.locator(".letter-tiles")).toBeVisible();
  const third = TERMS[(await prompt(page).textContent())!]!;
  await page.keyboard.type(third.slice(0, 1));
  await page.keyboard.press("Backspace");
  await expect(page.locator(".word .slot button")).toHaveCount(0);
  await page.keyboard.type(third);
  await page.keyboard.press("Enter");
  await expect(page.locator(".feedback")).toHaveText("Richtig.");

  await expect
    .poll(async () => (await readStore<ReviewEvent>(page, "reviewEvents")).length)
    .toBe(3);
  const events = await readStore<ReviewEvent>(page, "reviewEvents");
  expect(events.every((event) => event.mode === "letters")).toBe(true);
  expect(events.every((event) => event.direction === "meaningToTerm")).toBe(true);
  expect(events.filter((event) => event.result === "correct")).toHaveLength(2);
  expect(errors).toEqual([]);
});

const WORDS: [string, string][] = [
  ["rain", "Regen"],
  ["sun", "Sonne"],
  ["snow", "Schnee"],
];

const SET: StoredSet = {
  id: "b4n8r2k6zq",
  title: "Englisch – Wetter",
  termLanguage: "en",
  meaningLanguage: "de",
  editCount: 0,
  createdAt: "2026-10-01T12:00:00.000Z",
  updatedAt: "2026-10-01T12:00:00.000Z",
  sections: [
    {
      id: "s4k9tw",
      title: "Wetter",
      entries: WORDS.map(([term, meaning]) => ({
        id: `e${term}`.padEnd(6, "x"),
        term: { text: term },
        meanings: [{ text: meaning }],
      })),
    },
  ],
};

/**
 * „rain“ in Richtung Lernsprache: richtig am 10., 11., 14. und 21. Oktober, also Phase 4 mit 14 Tagen
 * Abstand, seit dem 4. November fällig. Um 12 Uhr UTC, damit der Tag in jeder Zeitzone stimmt.
 */
function backup(): string {
  const entry = SET.sections[0]!.entries[0]!;
  const days = [10, 11, 14, 21];
  const at = (day: number, second: number) =>
    new Date(Date.UTC(2026, 9, day, 12, 0, second)).toISOString();
  const sessions: Session[] = days.map((day) => ({
    id: `session${String(day).padStart(5, "0")}`,
    setId: SET.id,
    sectionIds: ["s4k9tw"],
    startedAt: at(day, 0),
    endedAt: at(day, 59),
    status: "completed",
    config: { direction: "meaningToTerm", count: 1, mcShare: 0 },
  }));
  const reviewEvents: ReviewEvent[] = days.map((day, i) => ({
    id: `event${String(i).padStart(7, "0")}`,
    sessionId: `session${String(day).padStart(5, "0")}`,
    setId: SET.id,
    entryId: entry.id,
    entryRev: entryRev(entry),
    occurredAt: at(day, 1),
    direction: "meaningToTerm",
    mode: "flashcard",
    result: "correct",
    firstAttempt: true,
  }));
  return JSON.stringify({
    format: "vokabeltrainer-backup",
    formatVersion: 1,
    dataVersion: 1,
    appVersion: "0.1.0+test",
    exportedAt: "2026-11-20T11:00:00.000Z",
    data: { sets: [SET], reviewEvents, sessions, settings: [] },
  });
}

test("E2E-35 Der Plan stellt sichere Karten in Richtung Lernsprache aus Buchstaben", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.clock.setFixedTime(new Date("2026-11-20T12:30:00.000Z"));
  await page.goto("./#/backup");
  await page.getByLabel("Backup-Datei auswählen").setInputFiles({
    name: "Vokabeltrainer-Backup_2026-11-20.json",
    mimeType: "application/json",
    buffer: Buffer.from(backup()),
  });
  await page.getByRole("button", { name: "Wiederherstellen", exact: true }).click();
  await expect(page.getByText("Backup wiederhergestellt.")).toBeFocused();

  await page.goto("./");
  await page.getByRole("link", { name: SET.title, exact: true }).click();
  await page.locator(".dock").getByRole("button", { name: "Wiederholen (1)" }).click();

  // „rain“ fällig und dazu zwei neue; nur „rain“ in Richtung Lernsprache als Buchstaben, die neuen
  // als Karteikarte (zu wenige Kandidaten für Multiple Choice).
  await expect(page.getByText("0 von 3 geschafft")).toBeVisible();
  for (let i = 0; i < 3; i++) {
    const kind = await page.locator(".kind").textContent();
    if (kind === "Buchstaben") {
      await expect(prompt(page)).toHaveText("Regen");
      await spell(page, "rain");
      await page.getByRole("button", { name: "Prüfen" }).click();
      await expect(page.locator(".feedback")).toHaveText("Richtig.");
    } else {
      expect(kind).toBe("Karteikarte");
      await page.locator(".flash:not(.flipped) .front").click();
      await page.getByRole("button", { name: "Gewusst" }).click();
    }
    if (i < 2) await expect(page.getByText(`${i + 1} von 3 geschafft`)).toBeVisible();
  }
  await expect(page.getByRole("heading", { name: "Geschafft" })).toBeVisible();

  const events = await readStore<ReviewEvent>(page, "reviewEvents");
  const today = events.filter((event) => event.occurredAt.startsWith("2026-11-20"));
  expect(today.map((event) => [event.entryId, event.direction, event.mode]).sort()).toEqual(
    [
      ["erainx", "meaningToTerm", "letters"],
      ["esnowx", "termToMeaning", "flashcard"],
      ["esunxx", "termToMeaning", "flashcard"],
    ].sort(),
  );
  expect(errors).toEqual([]);
});
