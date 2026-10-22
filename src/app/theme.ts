// Darstellung (TDD 13.5, FR-25): gespeichert in `settings` unter `theme`, angewendet über
// `data-theme` an <html>. Ohne Attribut folgt das CSS dem Gerät.
import { readTheme, type Theme, THEME_KEY } from "../domain/theme";
import { getSetting, setSetting } from "../storage/settings";

export type SaveThemeOutcome = { ok: true } | { ok: false; error: string };

const NOT_SAVED =
  "Die Darstellung konnte nicht gespeichert werden. Sie gilt nur, bis du die App schließt.";

/** Ist der Wert nicht lesbar, folgt die App dem Gerät; das Lernen hängt nicht davon ab. */
export async function loadTheme(db: IDBDatabase): Promise<Theme> {
  try {
    return readTheme(await getSetting(db, THEME_KEY));
  } catch (error) {
    console.warn("Darstellung nicht lesbar", error);
    return "system";
  }
}

export async function saveTheme(db: IDBDatabase, theme: Theme): Promise<SaveThemeOutcome> {
  try {
    await setSetting(db, { key: THEME_KEY, value: theme });
    return { ok: true };
  } catch (error) {
    console.error("Darstellung nicht gespeichert", error);
    return { ok: false, error: NOT_SAVED };
  }
}

/** Inhalt der `theme-color`-Angaben aus index.html (je Farbschema), für die Rückkehr zu „system“. */
const deviceColors = new Map<HTMLMetaElement, string>();

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === "system") delete root.dataset.theme;
  else root.dataset.theme = theme;
  // Die Leiste des Browsers bzw. der Home-Bildschirm-App nimmt den Hintergrund der gewählten
  // Darstellung; die Farbe kommt aus dem CSS, damit sie nur dort steht.
  const background = getComputedStyle(root).getPropertyValue("--bg").trim();
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    if (!deviceColors.has(meta)) deviceColors.set(meta, meta.content);
    meta.content = theme === "system" ? deviceColors.get(meta)! : background;
  }
}
