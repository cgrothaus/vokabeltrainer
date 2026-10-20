// Updates ohne Unterbrechung (TDD 5.3, NFR-05): Eine neue Version wartet, bis man sie bestätigt.
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { preview } from "vite";
import { precache } from "../../scripts/precache";

const dist = fileURLToPath(new URL("../../dist/", import.meta.url));

/** Ersetzt `search` in einer Datei; der Test soll scheitern, wenn sich der Build so ändert, dass nichts mehr passt. */
function replaceIn(file: string, search: string, replacement: string): void {
  const content = readFileSync(file, "utf8");
  expect(content, `${search} in ${file}`).toContain(search);
  writeFileSync(file, content.replaceAll(search, replacement));
}

test("Neue Version wird erst nach Bestätigung aktiv", async ({ page }, testInfo) => {
  // Eigener Server auf einer Kopie von dist/, damit der Test eine neue Version ausliefern kann, ohne das
  // gemeinsame Artefakt zu ändern. page.route hilft nicht: Chromium leitet die Update-Prüfung nicht darüber.
  const dir = mkdtempSync(join(tmpdir(), "vokabeltrainer-update-"));
  cpSync(dist, dir, { recursive: true });
  const server = await preview({
    configFile: false,
    base: "./",
    logLevel: "warn",
    build: { outDir: dir },
    // Nicht 4190: Der Port steht auf der Sperrliste des Fetch-Standards, WebKit lädt dort nichts.
    preview: { port: 4280 + testInfo.parallelIndex, strictPort: true },
  });
  try {
    const url = server.resolvedUrls!.local[0]!;
    const oldText = "Noch keine Vokabelsets vorhanden.";
    const newText = "Die neue Version ist aktiv.";
    const notice = page.getByRole("status");

    await page.goto(url);
    await expect(page.getByText(oldText)).toBeVisible();
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await expect(notice).toBeEmpty();

    // Neue Version ausliefern: anderer Inhalt, andere Cache-Version.
    replaceIn(join(dir, "index.html"), oldText, newText);
    replaceIn(join(dir, "sw.js"), precache(dist).version, "neueversion");

    // Die neue Version wird beim Neuladen gefunden und wartet; auch weiteres Neuladen aktiviert sie nicht.
    await page.reload();
    await expect(notice).toContainText("Neue Version verfügbar");
    await page.reload();
    await expect(notice).toContainText("Neue Version verfügbar");
    await expect(page.getByText(oldText)).toBeVisible();

    await notice.getByRole("button", { name: "Jetzt aktualisieren" }).click();
    await expect(page.getByText(newText)).toBeVisible();
    await expect(notice).toBeEmpty();
  } finally {
    await server.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
