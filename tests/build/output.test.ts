// Build-Prüfung (TAK-01): dist/index.html ist eigenständig und lädt nichts von außen.
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const indexPath = new URL("../../dist/index.html", import.meta.url);

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
});
