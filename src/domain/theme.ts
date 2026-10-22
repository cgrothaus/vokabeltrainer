// Darstellung (TDD 13.5, FR-25): „system“ folgt dem Gerät, „light“ und „dark“ haben Vorrang.

export const THEMES = ["system", "light", "dark"] as const;

export type Theme = (typeof THEMES)[number];

/** Schlüssel im Store `settings`; gilt für die ganze App, nicht pro Set. */
export const THEME_KEY = "theme";

/** Tolerant, weil der Wert auch aus einem Backup stammen kann: Unbekanntes folgt dem Gerät. */
export function readTheme(value: unknown): Theme {
  return THEMES.find((theme) => theme === value) ?? "system";
}
