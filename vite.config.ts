import { defineConfig } from "vitest/config";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  // Relative Verweise: läuft unter einem Unterpfad (GitHub Pages) und unter eigener Domain.
  base: "./",
  plugins: [viteSingleFile()],
  // Alles liegt in einer Datei; es gibt nichts vorzuladen.
  build: { modulePreload: { polyfill: false } },
  test: {
    // Entfällt mit dem ersten Unit-Test (S-06/S-07); bis dahin enthält src/ nur DOM-Code.
    passWithNoTests: true,
    projects: [
      // Unit- und Integrationstests liegen neben dem Code; fake-indexeddb wird pro Testdatei importiert.
      { test: { name: "unit", include: ["src/**/*.test.ts"], environment: "node" } },
      // Prüfung der Build-Ausgabe (TAK-01), läuft als Teil von `npm run build`.
      { test: { name: "build", include: ["tests/build/**/*.test.ts"], environment: "node" } },
    ],
  },
});
