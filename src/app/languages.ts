// Sprachcodes für die Oberfläche als deutsche Namen, z. B. „en“ → „Englisch“. Unbekanntes bleibt als Code.

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
