// Zweiter Build-Schritt (TDD 4.2): baut src/sw/sw.ts nach dist/sw.js, nachdem `vite build` die App erzeugt hat.
// Dateiliste und Cache-Version stammen aus dist/, damit sich sw.js genau dann ändert, wenn sich die App ändert.
import { defineConfig } from "vite";
import { precache } from "./scripts/precache.ts";

const { files, version } = precache("dist");

export default defineConfig({
  publicDir: false,
  define: {
    __CACHE_VERSION__: JSON.stringify(version),
    __PRECACHE__: JSON.stringify(files),
  },
  build: {
    emptyOutDir: false,
    // IIFE: klassisches Skript ohne Modul-Syntax, läuft in jedem Browser als Service Worker.
    lib: { entry: "src/sw/sw.ts", formats: ["iife"], name: "sw", fileName: () => "sw.js" },
  },
});
