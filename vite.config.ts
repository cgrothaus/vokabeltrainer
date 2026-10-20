import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { defineConfig } from "vitest/config";
import { viteSingleFile } from "vite-plugin-singlefile";

/** App-Version (TDD 4.2): Version aus package.json plus kurzer Git-Commit, z. B. `0.1.0+a1b2c3d`. */
function appVersion(): string {
  const { version } = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };
  try {
    return `${version}+${execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim()}`;
  } catch {
    return version;
  }
}

export default defineConfig({
  // Relative Verweise: läuft unter einem Unterpfad (GitHub Pages) und unter eigener Domain.
  base: "./",
  plugins: [viteSingleFile()],
  define: { __APP_VERSION__: JSON.stringify(appVersion()) },
  // Alles liegt in einer Datei; es gibt nichts vorzuladen.
  build: { modulePreload: { polyfill: false } },
  test: {
    projects: [
      // Unit- und Integrationstests liegen neben dem Code; fake-indexeddb wird pro Testdatei importiert.
      { test: { name: "unit", include: ["src/**/*.test.ts"], environment: "node" } },
      // Prüfung der Build-Ausgabe (TAK-01), läuft als Teil von `npm run build`.
      { test: { name: "build", include: ["tests/build/**/*.test.ts"], environment: "node" } },
    ],
  },
});
