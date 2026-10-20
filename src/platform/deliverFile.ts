// Datei an die Person übergeben (TDD 11.2, D-17): auf Mobilgeräten über das Teilen-Menü, dort lässt sie
// sich z. B. in „Dateien“ sichern; sonst als Download. Ob das auf iPhone und Android trägt, klärt der
// Gerätecheck zu S-09 (O-03).

/** `cancelled`: Die Person hat das Teilen-Menü geschlossen; die Datei gilt als nicht gespeichert. */
export type Delivery = "shared" | "downloaded" | "cancelled";

/**
 * Zwischen dem Tippen und dem Aufruf darf nichts Langsames liegen: `share()` verlangt eine frische
 * Nutzergeste. Den Inhalt daher vorher fertigstellen.
 */
export async function deliverFile(blob: Blob, filename: string): Promise<Delivery> {
  const file = new File([blob], filename, { type: blob.type });
  if (isMobile() && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return "shared";
    } catch (error) {
      if ((error as { name?: unknown } | null)?.name === "AbortError") return "cancelled";
      // z. B. NotAllowedError, wenn die Geste verbraucht ist: dann wenigstens herunterladen.
      console.warn("Teilen nicht möglich, Datei wird heruntergeladen", error);
    }
  }
  download(blob, filename);
  // Ob der Download gelingt, meldet der Browser nicht; es zählt das Auslösen (TDD 11.3).
  return "downloaded";
}

/** Touch-Gerät oder installierte App (TDD 11.2); `navigator.standalone` gibt es nur auf iOS. */
function isMobile(): boolean {
  return (
    matchMedia("(pointer: coarse)").matches ||
    matchMedia("(display-mode: standalone)").matches ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  // Erst freigeben, wenn der Browser die Datei sicher übernommen hat.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
