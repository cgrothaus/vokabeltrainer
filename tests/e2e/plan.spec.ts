// Wiederholen nach Plan (S-50): Mit fester Uhr und Antworten über mehrere Tage zeigen Bibliothek und
// Set-Ansicht, was fällig ist; „Jetzt wiederholen“ fragt genau die fälligen und wenige neue ab, in der
// Form nach ihrer Phase (S-51), „Selbst auswählen“ bleibt erreichbar (TDD 12.8, FR-37, AK-31, D-63, D-66).
import { expect, test } from "@playwright/test";
import { entryRev } from "../../src/domain/hash";
import type { Direction, ReviewEvent, Session, StoredSet } from "../../src/domain/model";
import { collectErrors, endPractice, readStore } from "./support";

const WORDS: [string, string][] = [
  ["rain", "Regen"],
  ["sun", "Sonne"],
  ["snow", "Schnee"],
  ["wind", "Brise"],
  ["fog", "Nebel"],
  ["ice", "Eis"],
  ["cloud", "Wolke"],
  ["storm", "Sturm"],
];

const SET: StoredSet = {
  id: "w7k2p9x4mq",
  title: "Englisch – Wetter",
  termLanguage: "en",
  meaningLanguage: "de",
  editCount: 0,
  createdAt: "2026-11-01T12:00:00.000Z",
  updatedAt: "2026-11-01T12:00:00.000Z",
  sections: [
    {
      id: "s8d3rf",
      title: "Wetter",
      entries: WORDS.map(([term, meaning]) => ({
        id: `e${term}`.padEnd(6, "x"),
        term: { text: term },
        meanings: [{ text: meaning }],
      })),
    },
  ],
};

const id = (term: string) => `e${term}`.padEnd(6, "x");

/** Richtige Antworten Lernsprache → Muttersprache je Tag im November 2026, um 12 Uhr UTC. */
const ANSWERS: [day: number, term: string][] = [
  // rain: gestern zum ersten Mal, Phase 1 – heute fällig.
  [19, "rain"],
  // sun: Phase 2 seit dem 14., Abstand 3 Tage – seit dem 17. fällig.
  [13, "sun"],
  [14, "sun"],
  // snow: heute zum ersten Mal – nicht fällig.
  [20, "snow"],
  // wind: Phase 3 seit dem 14., Abstand 7 Tage – erst morgen; die Gegenrichtung ist neu dran.
  [10, "wind"],
  [11, "wind"],
  [14, "wind"],
];

const at = (day: number, second: number) =>
  new Date(Date.UTC(2026, 10, day, 12, 0, second)).toISOString();

function backup(): string {
  const days = [...new Set(ANSWERS.map(([day]) => day))];
  const sessionId = (day: number) => `session${String(day).padStart(5, "0")}`;
  const sessions: Session[] = days.map((day) => ({
    id: sessionId(day),
    setId: SET.id,
    sectionIds: ["s8d3rf"],
    startedAt: at(day, 0),
    endedAt: at(day, 59),
    status: "completed",
    config: { direction: "termToMeaning", count: 8, mcShare: 0 },
  }));
  const reviewEvents: ReviewEvent[] = ANSWERS.map(([day, term], i) => ({
    id: `event${String(i).padStart(7, "0")}`,
    sessionId: sessionId(day),
    setId: SET.id,
    entryId: id(term),
    entryRev: entryRev(SET.sections[0]!.entries.find((entry) => entry.id === id(term))!),
    occurredAt: at(day, i + 1),
    direction: "termToMeaning" as Direction,
    mode: "flashcard",
    result: "correct",
    firstAttempt: true,
  }));
  // Gemerkte Einrichtung ohne Multiple Choice: Der Plan fragt trotzdem nach der Phase ab (D-66).
  const settings = [
    {
      key: `practice:${SET.id}`,
      value: { sections: "all", direction: "termToMeaning", count: 10, mcShare: 0 },
    },
  ];
  return JSON.stringify({
    format: "vokabeltrainer-backup",
    formatVersion: 1,
    dataVersion: 1,
    appVersion: "0.1.0+test",
    exportedAt: "2026-11-20T11:00:00.000Z",
    data: { sets: [SET], reviewEvents, sessions, settings },
  });
}

test("E2E-33 Fälliges in Bibliothek und Set-Ansicht, „Jetzt wiederholen“ fragt genau das Fällige ab", async ({
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

  // Bibliothek: vorn die Zahl des Fälligen.
  await page.goto("./");
  const card = page
    .getByRole("region", { name: "Vokabelsets" })
    .getByRole("listitem")
    .filter({ has: page.getByRole("link", { name: SET.title, exact: true }) });
  await expect(card.locator(".status .plan")).toHaveText("2 fällig");
  await expect(page.locator(".dock").getByRole("button")).toHaveText(
    `Weiterlernen ${SET.title} · 2 fällig`,
  );

  // Set-Ansicht: dieselbe Zahl, „Jetzt wiederholen“ als Hauptaktion, daneben „Selbst auswählen“.
  await page.getByRole("link", { name: SET.title, exact: true }).click();
  await expect(page.locator(".overview .plan")).toHaveText("2 fällig");
  const dock = page.locator(".dock");
  await expect(dock.getByRole("link", { name: `${SET.title} selbst auswählen` })).toBeVisible();
  await dock.getByRole("button", { name: "Wiederholen (2)" }).click();

  // Genau die fälligen (sun, rain) und fünf neue: die Gegenrichtung von wind und vier neue Wörter.
  // Neue und Karten in Phase 1 als Multiple Choice, sun in Phase 2 als Karteikarte (S-51).
  await expect(page.getByText("0 von 7 geschafft")).toBeVisible();
  const answers = new Map(
    WORDS.flatMap(([term, meaning]) => [
      [term, meaning],
      [meaning, term],
    ]),
  );
  const modes: Record<string, string> = {};
  for (let i = 0; i < 7; i++) {
    const prompt = page.locator(".question .prompt, .flash:not(.flipped) .front .prompt");
    const text = (await prompt.textContent())!;
    if ((await page.locator(".question").count()) > 0) {
      modes[text] = "multipleChoice";
      await page.getByRole("button", { name: "Antworten zeigen" }).click();
      await page.locator(".options button", { hasText: answers.get(text)! }).click();
      // Richtig: Es geht von selbst weiter (D-67); der Zähler steht schon vorher. Danach kommt eine
      // Frage in beliebiger Form oder das Ergebnis.
      await expect
        .poll(async () => ((await prompt.count()) > 0 ? prompt.first().textContent() : ""))
        .not.toBe(text);
    } else {
      modes[text] = "flashcard";
      await page.locator(".flash:not(.flipped) .front").click();
      await page.getByRole("button", { name: "Gewusst", exact: true }).click();
    }
    // Nach der letzten Karte kommt das Ergebnis statt des Zählers.
    if (i < 6) await expect(page.getByText(`${i + 1} von 7 geschafft`)).toBeVisible();
  }
  await expect(page.getByRole("heading", { name: "Geschafft" })).toBeVisible();
  expect(modes).toEqual({
    Brise: "multipleChoice",
    cloud: "multipleChoice",
    fog: "multipleChoice",
    ice: "multipleChoice",
    rain: "multipleChoice",
    storm: "multipleChoice",
    sun: "flashcard",
  });
  const sessions = await readStore<Session>(page, "sessions");
  const planned = sessions.find((session) => session.startedAt.startsWith("2026-11-20T12:30"));
  expect(planned?.config).toEqual({ direction: "mixed", count: 7, mcShare: 86 });
  // Die gemerkte Einrichtung bleibt, wie sie war.
  expect(await readStore(page, "settings")).toContainEqual({
    key: `practice:${SET.id}`,
    value: { sections: "all", direction: "termToMeaning", count: 10, mcShare: 0 },
  });
  await page.getByRole("link", { name: "Zur Bibliothek" }).click();

  // Nichts mehr fällig: Neu sind jetzt die Gegenrichtungen von rain und sun (ab Phase 2).
  await expect(card.locator(".status .plan")).toHaveText("2 neu");

  // Die freie Einrichtung bleibt erreichbar, ihre Antworten zählen für den Lernstand.
  await page.getByRole("link", { name: SET.title, exact: true }).click();
  await page.getByRole("link", { name: `${SET.title} selbst auswählen` }).click();
  await expect(page).toHaveURL(/#\/learn\//);
  await page.getByRole("button", { name: "Los geht’s" }).click();
  await expect(page.getByText("0 von 8 geschafft")).toBeVisible();
  await page.locator(".flash:not(.flipped) .front").click();
  await page.getByRole("button", { name: "Gewusst", exact: true }).click();
  await expect(page.getByText("1 von 8 geschafft")).toBeVisible();
  await endPractice(page);
  const events = await readStore<ReviewEvent>(page, "reviewEvents");
  expect(events).toHaveLength(ANSWERS.length + 8);
  expect(errors).toEqual([]);
});
