// E2E-12 (TDD 15.4, 3.4, 7.2): Die App gibt ihre Verbindung für eine neuere Version frei und schreibt
// nie in eine Datenbank, die neuer ist als sie selbst.
import { expect, test } from "@playwright/test";

test("E2E-12 Neuere Datenbankversion: App gibt die Verbindung frei und bittet ums Neuladen", async ({
  page,
}) => {
  await page.goto("./");
  // Die Bibliothek erscheint erst, wenn die Datenbank offen ist.
  await expect(page.getByText(/dauerhaft/)).toBeVisible();

  // Wie eine neuere App-Version in einem anderen Tab: Das Upgrade gelingt nur, wenn die App loslässt.
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("vokabeltrainer", 2);
        request.onsuccess = () => {
          request.result.close();
          resolve();
        };
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error("Die App hat die Verbindung nicht freigegeben"));
      }),
  );
  await expect(page.getByRole("heading", { name: "Bitte neu laden" })).toBeVisible();
  await expect(page.getByText("in einem anderen Tab aktualisiert")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Bitte neu laden" })).toBeVisible();
  await expect(page.getByText("Die App wurde inzwischen aktualisiert.")).toBeVisible();
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("vokabeltrainer");
        request.onsuccess = () => {
          const version = request.result.version;
          request.result.close();
          if (version === 2) resolve();
          else reject(new Error(`Version ${version} statt 2`));
        };
        request.onerror = () => reject(request.error);
      }),
  );
});
