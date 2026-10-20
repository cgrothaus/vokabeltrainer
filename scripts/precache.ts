// Vorab gespeicherte Dateien und Cache-Version des Service Workers (TDD 4.2, 5.2).
// Genutzt vom Service-Worker-Build (vite.sw.config.ts) und von der Build-Prüfung.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface Precache {
  /** URLs relativ zum Service Worker; die App selbst steht unter `./`, weil jede Navigation sie bekommt. */
  files: string[];
  /** Hash über Pfade und Inhalte aller Dateien: Ändert sich eine davon, ändert sich `sw.js`. */
  version: string;
}

export function precache(dist: string): Precache {
  const paths = [
    "index.html",
    "manifest.webmanifest",
    ...readdirSync(join(dist, "icons")).map((name) => `icons/${name}`),
  ].sort();
  const hash = createHash("sha256");
  for (const path of paths) {
    const content = readFileSync(join(dist, path));
    hash.update(`${path}\0${content.length}\0`).update(content);
  }
  return {
    files: paths.map((path) => (path === "index.html" ? "./" : `./${path}`)),
    version: hash.digest("hex").slice(0, 12),
  };
}
