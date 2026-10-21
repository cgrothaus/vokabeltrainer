// Gemeinsame Helfer der E2E-Tests. Die Vokabeln sind frei gewählter Grundwortschatz.
import { expect, type Page } from "@playwright/test";

/** Drei Einträge; `rain`, `sun` und `autumn` mit ihren Bedeutungen. */
export function setFile(title: string, id?: string): string {
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

/** Bedeutungen der Einträge aus `setFile`. */
export const MEANINGS: Record<string, string> = { rain: "Regen", sun: "Sonne", autumn: "Herbst" };

/** Titel und Zahl der Einträge je Set in der Bibliothek, ohne die Schaltflächen. */
export const librarySets = (page: Page) =>
  page.getByRole("region", { name: "Vokabelsets" }).getByRole("listitem").locator("div");

/** Sammelt Fehler aus der Seite; die Abläufe sollen auch im Fehlerfall keine erzeugen. */
export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return errors;
}

/** Importiert ein Set über das Textfeld und die Vorschau; die Seite steht danach in der Bibliothek. */
export async function importSet(page: Page, title: string, base = "./"): Promise<void> {
  await page.goto(`${base}#/import`);
  await page.getByLabel("Text einfügen").fill(setFile(title));
  await page.getByRole("button", { name: "Prüfen" }).click();
  await page.getByRole("button", { name: "Importieren" }).click();
  await expect(libraryMessage(page)).toHaveText(`„${title}“ mit 3 Einträgen gespeichert.`);
}

/** Meldung oben in der Bibliothek, z. B. nach dem Import; die Hinweisleiste für Updates zählt nicht. */
export const libraryMessage = (page: Page) => page.getByRole("main").getByRole("status");

/** Liest alle Datensätze eines Stores direkt aus der Datenbank der App. */
export function readStore<T>(page: Page, store: string): Promise<T[]> {
  return page.evaluate(
    (store) =>
      new Promise<T[]>((resolve, reject) => {
        const request = indexedDB.open("vokabeltrainer");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const all = db.transaction(store).objectStore(store).getAll();
          all.onsuccess = () => {
            db.close();
            resolve(all.result as T[]);
          };
          all.onerror = () => reject(all.error);
        };
      }),
    store,
  );
}
