import { describe, expect, it } from "vitest";
import { readTheme, THEME_KEY, THEMES } from "./theme";

describe("readTheme", () => {
  it.each(THEMES)("übernimmt %s", (theme) => {
    expect(readTheme(theme)).toBe(theme);
  });

  it.each([undefined, null, "", "Dark", "auto", 1, true, { theme: "dark" }, ["dark"]])(
    "liest %j als Systemeinstellung",
    (value) => {
      expect(readTheme(value)).toBe("system");
    },
  );
});

describe("THEME_KEY", () => {
  it("gehört zu keinem Set", () => {
    expect(THEME_KEY).toBe("theme");
    expect(THEME_KEY).not.toContain(":");
  });
});
