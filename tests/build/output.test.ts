// Build-Prüfung (TAK-01): dist/index.html ist eigenständig und lädt nichts von außen;
// Manifest und Icons liegen daneben und werden relativ verwiesen.
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { describe, expect, test } from "vitest";
import { precache } from "../../scripts/precache";

const dist = new URL("../../dist/", import.meta.url);
const indexPath = new URL("index.html", dist);

describe("Build-Ausgabe", () => {
  if (!existsSync(indexPath)) {
    test("dist/index.html existiert", () => {
      expect.fail("dist/index.html fehlt – zuerst `npm run build` ausführen");
    });
    return;
  }
  const html = readFileSync(indexPath, "utf8");

  test("JS und CSS sind eingebettet", () => {
    expect(html).toMatch(/<script type="module"[^>]*>[^<]/);
    expect(html).toMatch(/<style[^>]*>[^<]/);
  });

  test("kein <script src>", () => {
    expect(html).not.toMatch(/<script\b[^>]*\bsrc\s*=/i);
  });

  test("kein Stylesheet-Link", () => {
    expect(html).not.toMatch(/<link\b[^>]*\brel\s*=\s*["']?stylesheet/i);
  });

  test("keine externen URLs", () => {
    // XML-Namespaces (z. B. für SVG) sind Bezeichner, keine Anfragen.
    const external = (html.match(/https?:\/\/[^\s"'`)<>]+/gi) ?? []).filter(
      (url) => !url.startsWith("http://www.w3.org/"),
    );
    expect(external).toEqual([]);
    expect(html).not.toMatch(/\b(?:src|href)\s*=\s*["']?\/\//i);
  });

  test("Kopfzeilen verweisen relativ auf vorhandene Dateien", () => {
    const links = [...html.matchAll(/<link\b[^>]*\brel="([^"]+)"[^>]*\bhref="([^"]+)"/g)].map(
      ([, rel, href]) => ({ rel, href }),
    );
    expect(links.map((link) => link.rel).sort()).toEqual(["apple-touch-icon", "icon", "manifest"]);
    for (const { href } of links) {
      expect(href, href).toMatch(/^\.\//);
      expect(existsSync(new URL(href!, dist)), `${href} fehlt`).toBe(true);
    }
  });
});

describe("Web-App-Manifest", () => {
  const manifestPath = new URL("manifest.webmanifest", dist);

  test("existiert", () => {
    expect(existsSync(manifestPath)).toBe(true);
  });
  if (!existsSync(manifestPath)) return;
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

  test("enthält die Angaben für die Installation (TDD 5.1)", () => {
    expect(manifest).toMatchObject({
      name: "Vokabeltrainer",
      short_name: "Vokabeln",
      start_url: "./",
      scope: "./",
      display: "standalone",
    });
    expect(manifest.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(manifest.background_color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  test("Icons 192 und 512 sowie maskierbar, alle vorhanden", () => {
    const icons: { src: string; sizes: string; purpose?: string }[] = manifest.icons;
    expect(icons.map((icon) => icon.sizes)).toEqual(expect.arrayContaining(["192x192", "512x512"]));
    expect(icons.some((icon) => icon.purpose === "maskable")).toBe(true);
    for (const icon of icons) {
      expect(icon.src, icon.src).not.toMatch(/^(\/|[a-z]+:)/i);
      expect(existsSync(new URL(icon.src, manifestPath)), `${icon.src} fehlt`).toBe(true);
    }
  });
});

describe("Service Worker", () => {
  const swPath = new URL("sw.js", dist);

  test("existiert", () => {
    expect(existsSync(swPath)).toBe(true);
  });
  if (!existsSync(swPath)) return;
  const sw = readFileSync(swPath, "utf8");
  const { files, version } = precache(fileURLToPath(dist));

  test("lädt beim Installieren App, Manifest und Icons in den Cache der aktuellen Version", async () => {
    // sw.js in einer Attrappe ausführen und mitschreiben, was der install-Handler anfordert.
    const handlers = new Map<string, (event: unknown) => void>();
    const stored: { cache: string; urls: string[] }[] = [];
    const context = {
      self: {
        addEventListener: (type: string, fn: (event: unknown) => void) => handlers.set(type, fn),
      },
      caches: {
        open: async (cache: string) => ({
          addAll: async (requests: { url: string; cache: string }[]) => {
            expect(requests.every((request) => request.cache === "reload")).toBe(true);
            stored.push({ cache, urls: requests.map((request) => request.url) });
          },
        }),
      },
      Request: class {
        url: string;
        cache: string;
        constructor(url: string, init: { cache: string }) {
          this.url = url;
          this.cache = init.cache;
        }
      },
    };
    runInNewContext(sw, context);
    let done: Promise<unknown> = Promise.resolve();
    handlers.get("install")!({ waitUntil: (promise: Promise<unknown>) => (done = promise) });
    await done;

    expect(stored).toEqual([{ cache: `vokabeltrainer-${version}`, urls: files }]);
    expect(files).toEqual(
      expect.arrayContaining(["./", "./manifest.webmanifest", "./icons/icon-192.png"]),
    );
  });

  test("ist ein klassisches Skript ohne externe URLs", () => {
    expect(sw).not.toMatch(/^\s*(import|export)\b/m);
    expect(sw).not.toMatch(/https?:\/\//);
  });
});
