// Updates ohne Unterbrechung (TDD 5.3, NFR-05): Eine neue Version wartet, bis man sie bestätigt, und
// erscheint nie während einer Lernsitzung (TAK-12).
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Page, type TestInfo, test } from "@playwright/test";
import { preview } from "vite";
import { precache } from "../../scripts/precache";
import { importSet, startLearning } from "./support";

const dist = fileURLToPath(new URL("../../dist/", import.meta.url));

/** Ersetzt `search` in einer Datei; der Test soll scheitern, wenn sich der Build so ändert, dass nichts mehr passt. */
function replaceIn(file: string, search: string, replacement: string): void {
  const content = readFileSync(file, "utf8");
  expect(content, `${search} in ${file}`).toContain(search);
  writeFileSync(file, content.replaceAll(search, replacement));
}

/**
 * Eigener Server auf einer Kopie von dist/, damit der Test eine neue Version ausliefern kann, ohne das
 * gemeinsame Artefakt zu ändern. page.route hilft nicht: Chromium leitet die Update-Prüfung nicht darüber.
 */
async function withCopiedApp(
  testInfo: TestInfo,
  run: (url: string, dir: string) => Promise<void>,
): Promise<void> {
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
    await run(server.resolvedUrls!.local[0]!, dir);
  } finally {
    await server.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Neue Version ausliefern: andere Cache-Version, also ein anderer `sw.js`. */
const publishNewVersion = (dir: string) =>
  replaceIn(join(dir, "sw.js"), precache(dist).version, "neueversion");

const serviceWorkerReady = (page: Page) =>
  page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });

test("Neue Version wird erst nach Bestätigung aktiv", async ({ page }, testInfo) => {
  await withCopiedApp(testInfo, async (url, dir) => {
    const oldText = "Noch keine Vokabelsets";
    const newText = "Die neue Version ist aktiv.";
    const notice = page.getByRole("status");

    await page.goto(url);
    await expect(page.getByText(oldText)).toBeVisible();
    await serviceWorkerReady(page);
    await expect(notice).toBeEmpty();

    replaceIn(join(dir, "index.html"), oldText, newText);
    publishNewVersion(dir);

    // Die neue Version wird beim Neuladen gefunden und wartet; auch weiteres Neuladen aktiviert sie nicht.
    await page.reload();
    await expect(notice).toContainText("Neue Version verfügbar");
    await page.reload();
    await expect(notice).toContainText("Neue Version verfügbar");
    await expect(page.getByText(oldText)).toBeVisible();

    await notice.getByRole("button", { name: "Jetzt aktualisieren" }).click();
    await expect(page.getByText(newText)).toBeVisible();
    await expect(notice).toBeEmpty();
  });
});

test("E2E-14 Während einer Lernsitzung erscheint der Hinweis erst danach", async ({
  page,
}, testInfo) => {
  await withCopiedApp(testInfo, async (url, dir) => {
    const notice = page.getByRole("status");
    await importSet(page, "Englisch – Update", url);
    await serviceWorkerReady(page);
    // Erst nach dem Neuladen steuert der Service Worker die Seite; vorher gilt nichts als Update.
    await page.goto(url);
    await startLearning(page, "Englisch – Update");
    await expect(page.getByText("0 von 3 geschafft")).toBeVisible();

    // Die Prüfung beim Zurückkehren in den Vordergrund findet die neue Version mitten in der Sitzung.
    publishNewVersion(dir);
    await page.evaluate(async () => {
      await (await navigator.serviceWorker.getRegistration())!.update();
    });
    await expect
      .poll(() =>
        page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting),
      )
      .toBe(true);

    for (const done of ["1 von 3", "2 von 3"]) {
      await expect(notice).toBeEmpty();
      await page.getByRole("button", { name: /Tippen zum Aufdecken/ }).click();
      await page.getByRole("button", { name: "Gewusst" }).click();
      await expect(page.getByText(`${done} geschafft`)).toBeVisible();
    }
    // Auch im Zwischenstand läuft die Sitzung noch.
    await page.getByRole("button", { name: "Beenden" }).click();
    await expect(page.getByRole("heading", { name: "Zwischenstand" })).toBeVisible();
    await expect(notice).toBeEmpty();
    await page.getByRole("button", { name: "Weiterlernen (1 offen)" }).click();
    await page.getByRole("button", { name: /Tippen zum Aufdecken/ }).click();
    await page.getByRole("button", { name: "Gewusst" }).click();
    await expect(page.getByRole("heading", { name: "Geschafft" })).toBeVisible();
    await expect(notice).toContainText("Neue Version verfügbar");
  });
});
