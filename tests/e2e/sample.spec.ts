// Beispielset (S-16): aus dem Empty State laden und üben (FR-32, AK-23, TDD 13.2). E2E-05 mit Multiple
// Choice (S-18, AK-22), Ergebnisliste und „Nur Fehler üben“ (S-19, AK-08).
import { expect, type Page, test } from "@playwright/test";
import type { Answer, ReviewEvent, Session, StoredEntry, StoredSet } from "../../src/domain/model";
import {
  collectErrors,
  importSet,
  importText,
  libraryMessage,
  readStore,
  startLearning,
} from "./support";

const TITLE = "Englisch – Grundwortschatz (Beispielset)";

test("Empty State → Beispielset ausprobieren → Set-Ansicht → Lernen", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("./");
  await page.getByRole("button", { name: "Beispielset ausprobieren" }).click();

  await expect(page).toHaveURL(/#\/set\/[2-9a-hjkmnp-z]{10}$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(TITLE);
  // Die Notiz des Sets nennt die Herkunft auch; deshalb genau.
  await expect(page.getByText("Eigene Zusammenstellung", { exact: true })).toBeVisible();
  await expect(page.getByText("CC0", { exact: true })).toBeVisible();
  await expect(page.locator("summary")).toHaveText([
    "In der Schule 15 Einträge",
    "Freizeit und Sport 14 Einträge",
    "Essen und Trinken 14 Einträge",
    "Unterwegs 14 Einträge",
  ]);
  const [set] = await readStore<StoredSet>(page, "sets");
  expect(set).toMatchObject({ title: TITLE, source: "Eigene Zusammenstellung", license: "CC0" });
  expect(set!.sections.flatMap((section) => section.entries.map((entry) => entry.id))).toHaveLength(
    57,
  );

  await startLearning(page, TITLE);
  await expect(page.getByText("0 von 57 geschafft")).toBeVisible();
  expect(errors, "Fehler in der Konsole").toEqual([]);
});

test("Beispielset gibt es nur bei leerer Bibliothek, nach dem Löschen wieder", async ({ page }) => {
  const errors = collectErrors(page);
  await importSet(page, "Englisch – Wetter");
  await expect(page.getByRole("button", { name: "Beispielset ausprobieren" })).toHaveCount(0);

  await page.getByRole("link", { name: "Englisch – Wetter", exact: true }).click();
  await page.getByRole("button", { name: "Set löschen" }).click();
  await page.getByRole("button", { name: "Set mit 3 Einträgen löschen" }).click();
  await expect(libraryMessage(page)).toHaveText("„Englisch – Wetter“ gelöscht.");
  await expect(page.getByRole("button", { name: "Beispielset ausprobieren" })).toBeVisible();
  expect(errors, "Fehler in der Konsole").toEqual([]);
});

/** Ein Set in einer zweiten Lernsprache; seine Bedeutungen dürfen nie als Antwort erscheinen. */
async function importFrench(page: Page): Promise<void> {
  const title = "Französisch – Tiere";
  const pairs = [
    ["le chien", "Hund"],
    ["le chat", "Katze"],
    ["le cheval", "Pferd"],
    ["la vache", "Kuh"],
    ["le lapin", "Kaninchen"],
  ];
  const file = {
    format: "vokabeltrainer-set",
    formatVersion: 1,
    set: { title, termLanguage: "fr", meaningLanguage: "de" },
    sections: [
      { title: "Tiere", entries: pairs.map(([term, meaning]) => ({ term, meanings: [meaning] })) },
    ],
  };
  await importText(page, JSON.stringify(file), `„${title}“ mit 5 Einträgen gespeichert.`);
}

const comparable = (text: string) => text.normalize("NFC").trim().toLowerCase();
const accepted = (answers: Answer[]) =>
  answers.flatMap((answer) => [answer.text, ...(answer.acceptedVariants ?? [])]).map(comparable);
const shown = (entry: StoredEntry) => entry.meanings.map((meaning) => meaning.text).join("; ");

test("E2E-05 Empty State → Beispielset → Sitzung mit Multiple Choice", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("./");
  await page.getByRole("button", { name: "Beispielset ausprobieren" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(TITLE);
  await importFrench(page);
  const set = (await readStore<StoredSet>(page, "sets")).find((s) => s.title === TITLE)!;
  const entries = set.sections.flatMap((section) => section.entries);
  const byTerm = new Map(entries.map((entry) => [entry.term.text, entry]));
  const meaningsOfSet = new Set(entries.map(shown));

  await page.getByRole("link", { name: `${TITLE} lernen` }).click();
  await page.getByRole("slider", { name: "Multiple Choice" }).fill("100");
  await page.getByRole("radio", { name: "10", exact: true }).check();
  await page.getByRole("button", { name: "10 Vokabeln lernen" }).click();
  await expect(page.getByText("0 von 10 geschafft")).toBeVisible();

  const options = page.locator(".options button");
  let missed: string | undefined;
  for (let question = 0; question < 11; question++) {
    await expect(options).toHaveCount(4);
    const prompt = page.locator(".card .prompt");
    await expect(prompt).toHaveAttribute("lang", "en");
    const entry = byTerm.get((await prompt.textContent())!)!;
    const texts = await options.allTextContents();
    await expect(options.first()).toHaveAttribute("lang", "de");
    // Alle aus diesem Set und von der Bedeutungsseite, verschieden, genau eine richtig (AK-22).
    expect(texts.every((text) => meaningsOfSet.has(text))).toBe(true);
    expect(new Set(texts).size).toBe(4);
    expect(texts.filter((text) => text === shown(entry))).toHaveLength(1);
    const correct = new Set(accepted(entry.meanings));
    for (const text of texts.filter((text) => text !== shown(entry))) {
      const candidate = entries.find((other) => shown(other) === text)!;
      expect(accepted(candidate.meanings).some((answer) => correct.has(answer))).toBe(false);
    }

    // Die erste Frage falsch, alle anderen richtig.
    const wrong = question === 0;
    const choice = wrong
      ? texts.findIndex((text) => text !== shown(entry))
      : texts.indexOf(shown(entry));
    if (wrong) missed = entry.term.text;
    await options.nth(choice).click();
    if (wrong) {
      await expect(page.getByText(`Leider falsch. Richtig ist: ${shown(entry)}`)).toBeVisible();
      await expect(options.nth(choice)).toHaveText(`✗ ${texts[choice]}`);
      await expect(options.filter({ hasText: `✓ ${shown(entry)}` })).toHaveCount(1);
    } else {
      await expect(page.getByText("Richtig.", { exact: true })).toBeVisible();
    }
    await expect(options.first()).toBeDisabled();
    if (entry.notes) await expect(page.getByText(`Notiz: ${entry.notes}`)).toBeVisible();
    await expect(page.getByRole("button", { name: "Weiter" })).toBeFocused();
    await page.getByRole("button", { name: "Weiter" }).click();
  }
  await expect(page.getByRole("heading", { name: "Geschafft" })).toBeVisible();
  await expect(page.getByText("9 von 10 beim ersten Mal gewusst.")).toBeVisible();

  const answers = await readStore<ReviewEvent>(page, "reviewEvents");
  expect(answers).toHaveLength(11);
  expect(answers.every((event) => event.mode === "multipleChoice")).toBe(true);
  // Die falsch beantwortete Frage kam als Multiple Choice wieder.
  const again = answers.filter((event) => event.entryId === byTerm.get(missed!)!.id);
  expect(again.map((event) => event.result).sort()).toEqual(["correct", "incorrect"]);
  const [session] = await readStore<Session>(page, "sessions");
  expect(session!.config).toMatchObject({ count: 10, mcShare: 100 });

  // Ergebnisliste mit dem Fehler; „Nur Fehler üben“ stellt ihn wieder als Multiple Choice (D-29).
  const wrongEntry = byTerm.get(missed!)!;
  await expect(page.locator(".mistakes li")).toHaveText([`${missed} – ${shown(wrongEntry)}`]);
  await page.getByRole("button", { name: "Nur Fehler üben (1)" }).click();
  await expect(page.getByText("0 von 1 geschafft")).toBeVisible();
  await expect(page.locator(".card .prompt")).toHaveText(missed!);
  await expect(options).toHaveCount(4);
  await options.nth((await options.allTextContents()).indexOf(shown(wrongEntry))).click();
  await page.getByRole("button", { name: "Weiter" }).click();
  await expect(page.getByRole("heading", { name: "Geschafft" })).toBeVisible();
  await expect(page.getByText("1 von 1 beim ersten Mal gewusst.")).toBeVisible();
  await expect(page.locator(".mistakes")).toHaveCount(0);
  const repeat = (await readStore<Session>(page, "sessions")).find((s) => s.repeatOf)!;
  expect(repeat).toMatchObject({ repeatOf: session!.id, config: { count: 1, mcShare: 100 } });
  const last = (await readStore<ReviewEvent>(page, "reviewEvents")).filter(
    (event) => event.sessionId === repeat.id,
  );
  expect(last).toMatchObject([
    { entryId: wrongEntry.id, mode: "multipleChoice", firstAttempt: true },
  ]);
  expect(errors, "Fehler in der Konsole").toEqual([]);
});
