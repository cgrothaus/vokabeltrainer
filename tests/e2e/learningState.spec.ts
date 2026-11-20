// Lernstand pro Vokabel (S-49): Aus einem Backup mit Antworten über mehrere Tage zeigen Set-Ansicht
// und Bibliothek je Richtung, wie viele Vokabeln sicher, im Aufbau und neu sind (TDD 12.7, FR-36,
// AK-30, D-62). Das Backup hat das Format von vor M6; der Lernstand entsteht allein aus den Antworten.
import { expect, test } from "@playwright/test";
import { entryRev } from "../../src/domain/hash";
import type { Direction, ReviewEvent, Session, StoredSet } from "../../src/domain/model";
import { collectErrors } from "./support";

const SET: StoredSet = {
  id: "4pwbrsk48z",
  title: "Englisch – Wetter",
  termLanguage: "en",
  meaningLanguage: "de",
  editCount: 0,
  createdAt: "2026-10-31T12:00:00.000Z",
  updatedAt: "2026-10-31T12:00:00.000Z",
  sections: [
    {
      id: "7e7sht",
      title: "Wetter",
      entries: [
        { id: "mx4zzc", term: { text: "rain" }, meanings: [{ text: "Regen" }] },
        { id: "fma6s4", term: { text: "sun" }, meanings: [{ text: "Sonne" }] },
        { id: "zfpzft", term: { text: "autumn" }, meanings: [{ text: "Herbst" }] },
      ],
    },
  ],
};

type Answer = [day: number, entryId: string, Direction, ReviewEvent["mode"], ReviewEvent["result"]];

/** Je Tag im November 2026 eine Sitzung um 12 Uhr UTC, damit der Tag in jeder Zeitzone der CI stimmt. */
const ANSWERS: Answer[] = [
  // rain: an fälligen Tagen richtig, 1 → 2 → 3 → 4, also sicher.
  [1, "mx4zzc", "termToMeaning", "flashcard", "correct"],
  [2, "mx4zzc", "termToMeaning", "flashcard", "correct"],
  [5, "mx4zzc", "termToMeaning", "flashcard", "correct"],
  [12, "mx4zzc", "termToMeaning", "flashcard", "correct"],
  // sun: dreimal am selben Tag richtig, nur Phase 1.
  [10, "fma6s4", "termToMeaning", "flashcard", "correct"],
  [10, "fma6s4", "termToMeaning", "flashcard", "correct"],
  [10, "fma6s4", "termToMeaning", "flashcard", "correct"],
  // autumn: nur Multiple Choice an fälligen Tagen, bleibt bei Phase 3 im Aufbau.
  [1, "zfpzft", "termToMeaning", "multipleChoice", "correct"],
  [2, "zfpzft", "termToMeaning", "multipleChoice", "correct"],
  [5, "zfpzft", "termToMeaning", "multipleChoice", "correct"],
  [12, "zfpzft", "termToMeaning", "multipleChoice", "correct"],
  // Gegenrichtung nur einmal, falsch.
  [15, "mx4zzc", "meaningToTerm", "flashcard", "incorrect"],
];

const at = (day: number, second: number) =>
  new Date(Date.UTC(2026, 10, day, 12, 0, second)).toISOString();

function backup(): string {
  const days = [...new Set(ANSWERS.map(([day]) => day))];
  const sessions: Session[] = days.map((day) => ({
    id: `session${String(day).padStart(5, "0")}`,
    setId: SET.id,
    sectionIds: ["7e7sht"],
    startedAt: at(day, 0),
    endedAt: at(day, 59),
    status: "completed",
    config: { direction: "termToMeaning", count: 3, mcShare: 0 },
  }));
  const seen = new Set<string>();
  const reviewEvents: ReviewEvent[] = ANSWERS.map(([day, entryId, direction, mode, result], i) => ({
    id: `event${String(i).padStart(7, "0")}`,
    sessionId: `session${String(day).padStart(5, "0")}`,
    setId: SET.id,
    entryId,
    entryRev: entryRev(SET.sections[0]!.entries.find((entry) => entry.id === entryId)!),
    occurredAt: at(day, i + 1),
    direction,
    mode,
    result,
    // Wie in der Sitzung: Nur die erste Antwort zu einer Karte am Tag ist ein Erstversuch.
    firstAttempt: !seen.has(`${day}:${entryId}`) && Boolean(seen.add(`${day}:${entryId}`)),
  }));
  return JSON.stringify({
    format: "vokabeltrainer-backup",
    formatVersion: 1,
    dataVersion: 1,
    appVersion: "0.1.0+test",
    exportedAt: "2026-11-16T18:00:00.000Z",
    data: { sets: [SET], reviewEvents, sessions, settings: [] },
  });
}

test("E2E-32 Lernstand je Richtung aus einem Backup mit Antworten über mehrere Tage", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.clock.setFixedTime(new Date("2026-11-20T12:00:00.000Z"));
  await page.goto("./#/backup");
  await page.getByLabel("Backup-Datei auswählen").setInputFiles({
    name: "Vokabeltrainer-Backup_2026-11-16.json",
    mimeType: "application/json",
    buffer: Buffer.from(backup()),
  });
  await page.getByRole("button", { name: "Wiederherstellen", exact: true }).click();
  await expect(page.getByText("Backup wiederhergestellt.")).toBeFocused();

  await page.goto(`./#/set/${SET.id}`);
  const stages = page.locator(".overview .stages li");
  await expect(stages.locator(".direction")).toHaveText([
    "Englisch → Deutsch",
    "Deutsch → Englisch",
  ]);
  await expect(stages.locator(".counts")).toHaveText([
    "1 sicher · 2 im Aufbau",
    "1 im Aufbau · 2 neu",
  ]);

  await page.goto("./");
  await expect(
    page
      .getByRole("region", { name: "Vokabelsets" })
      .getByRole("listitem")
      .filter({ has: page.getByRole("link", { name: SET.title, exact: true }) })
      .locator(".status"),
  ).toHaveText(
    "3 fällig zuletzt am 15. Nov. Lernstand Englisch nach Deutsch: 1 sicher, 2 im Aufbau; Deutsch nach Englisch: 1 im Aufbau, 2 neu",
  );
  expect(errors).toEqual([]);
});
