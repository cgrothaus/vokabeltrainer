// Sprachcodes für die Oberfläche als deutsche Namen, z. B. „en“ → „Englisch“. Unbekanntes bleibt als Code.

/** Zur Auswahl beim Anlegen (D-41); andere Sprachen gehen über „Andere Sprache …“ mit Code. */
const COMMON_LANGUAGES = "ar cs da de el en es fi fr grc it ja la nl no pl pt ru sv tr uk zh".split(
  " ",
);

/**
 * Sprachen für eine Auswahlliste als `[Code, Name]`, nach deutschem Namen sortiert: die gängigen und
 * die übergebenen, z. B. aus vorhandenen Sets oder der aktuelle Wert.
 */
export function languageOptions(extra: readonly string[]): [string, string][] {
  const codes = new Set([...COMMON_LANGUAGES, ...extra.filter((code) => code !== "")]);
  return [...codes]
    .map((code): [string, string] => [code, languageName(code)])
    .sort(([, a], [, b]) => a.localeCompare(b, "de"));
}

let names: Intl.DisplayNames | null | undefined;

export function languageName(code: string): string {
  if (names === undefined) {
    try {
      names = new Intl.DisplayNames(["de"], { type: "language" });
    } catch {
      names = null;
    }
  }
  try {
    return names?.of(code) ?? code;
  } catch {
    return code;
  }
}
