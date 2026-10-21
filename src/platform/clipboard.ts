// Zwischenablage (TDD 8.1, 13.1). Lesen: iOS fragt mit „Einfügen“ nach, Chromium nach der Berechtigung.
// Lesen und Schreiben verlangen eine frische Nutzergeste: im Klick ohne vorheriges `await` aufrufen.

export type ClipboardResult =
  { ok: true; text: string } | { ok: false; reason: "denied" | "empty" };

export function canReadClipboard(): boolean {
  return typeof navigator.clipboard?.readText === "function";
}

export async function readClipboard(): Promise<ClipboardResult> {
  let text: string;
  try {
    text = await navigator.clipboard.readText();
  } catch (error) {
    // Abgelehnt, „Einfügen“ nicht bestätigt oder kein Text in der Zwischenablage.
    console.warn("Zwischenablage nicht lesbar", error);
    return { ok: false, reason: "denied" };
  }
  if (text.trim() === "") return { ok: false, reason: "empty" };
  return { ok: true, text };
}

/** `false`, wenn der Browser das Schreiben nicht kann oder ablehnt; dann kopiert die Person selbst. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.warn("Zwischenablage nicht beschreibbar", error);
    return false;
  }
}
