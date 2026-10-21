// Text aus der Zwischenablage lesen (TDD 8.1). iOS fragt dabei mit „Einfügen“ nach; Chromium fragt
// nach der Berechtigung. Beides verlangt eine frische Nutzergeste: im Klick ohne vorheriges `await` aufrufen.

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
