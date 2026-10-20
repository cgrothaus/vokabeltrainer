// Datei an die Person übergeben (TDD 11.2, D-17). Vorerst nur als Download; das Teilen-Menü auf
// Mobilgeräten ergänzt S-09.

export function deliverFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  // Erst freigeben, wenn der Browser die Datei sicher übernommen hat.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
