import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  // Relative Verweise: läuft unter einem Unterpfad (GitHub Pages) und unter eigener Domain.
  base: "./",
  plugins: [viteSingleFile()],
  // Alles liegt in einer Datei; es gibt nichts vorzuladen.
  build: { modulePreload: { polyfill: false } },
});
