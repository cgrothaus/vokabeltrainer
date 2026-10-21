import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import type { Connect, Plugin } from "vite";
import { defineConfig } from "vitest/config";
import { viteSingleFile } from "vite-plugin-singlefile";
import { PUBLISHED_DOCS } from "./scripts/precache.ts";

/** App-Version (TDD 4.2): Version aus package.json plus kurzer Git-Commit, z. B. `0.1.0+a1b2c3d`. */
function appVersion(): string {
  const { version } = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };
  try {
    return `${version}+${execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim()}`;
  } catch {
    return version;
  }
}

/**
 * Formatspezifikation und Schema aus docs/ unverändert neben index.html ausgeben (D-26), im Dev-Server
 * unter derselben Adresse. Eine Kopie in public/ könnte veralten. Beide Server liefern mit Zeichensatz
 * aus wie GitHub Pages; ohne ihn zeigt der Browser Umlaute in der geöffneten Datei falsch an.
 */
function publishDocs(): Plugin {
  const serve =
    (path: (name: string, source: string) => string): Connect.NextHandleFunction =>
    (request, response, next) => {
      const name = request.url?.split("?")[0]?.slice(1) ?? "";
      const source = PUBLISHED_DOCS[name];
      if (!source) return next();
      const type = name.endsWith(".json") ? "application/json" : "text/markdown";
      response.setHeader("Content-Type", `${type}; charset=utf-8`);
      response.end(readFileSync(path(name, source)));
    };
  return {
    name: "publish-docs",
    configureServer(server) {
      server.middlewares.use(serve((_name, source) => source));
    },
    configurePreviewServer(server) {
      server.middlewares.use(serve((name) => `${server.config.build.outDir}/${name}`));
    },
    generateBundle() {
      for (const [fileName, source] of Object.entries(PUBLISHED_DOCS)) {
        this.emitFile({ type: "asset", fileName, source: readFileSync(source) });
      }
    },
  };
}

export default defineConfig({
  // Relative Verweise: läuft unter einem Unterpfad (GitHub Pages) und unter eigener Domain.
  base: "./",
  plugins: [viteSingleFile(), publishDocs()],
  define: { __APP_VERSION__: JSON.stringify(appVersion()) },
  // Alles liegt in einer Datei; es gibt nichts vorzuladen.
  build: { modulePreload: { polyfill: false } },
  test: {
    projects: [
      // Unit- und Integrationstests liegen neben dem Code; fake-indexeddb wird pro Testdatei importiert.
      // Der Schemaabgleich liest Fixtures mit Node-APIs und liegt deshalb unter tests/ (TDD 15.3).
      {
        test: {
          name: "unit",
          include: ["src/**/*.test.ts", "tests/format/**/*.test.ts"],
          environment: "node",
        },
      },
      // Prüfung der Build-Ausgabe (TAK-01), läuft als Teil von `npm run build`.
      { test: { name: "build", include: ["tests/build/**/*.test.ts"], environment: "node" } },
    ],
  },
});
