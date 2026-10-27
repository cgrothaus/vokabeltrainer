// Speicherhinweis (TDD 6.5, 13.1, D-32): eine ruhige Leiste, wenn etwas ohne eigene Meldung am Ort nicht
// gespeichert wurde (z. B. das Ende einer Lernsitzung) oder der Speicher nicht erreichbar ist. Der
// nächste erfolgreiche Schreibvorgang nimmt sie wieder weg; sie blockiert nie.
import { type StorageFailure, storageFailure } from "../../storage/errors";
import { h } from "../dom";
import { storageMessage } from "../storageMessages";

let region: HTMLElement | null = null;

/** Nach einem Fehler im Hintergrund gibt es nichts zu wiederholen; der nächste Zugriff verbindet neu. */
const NEXT: Record<StorageFailure, string | undefined> = {
  quota: undefined,
  connection: "",
  failed: "Wenn das wieder passiert, lade die Seite neu.",
};

const UNREACHABLE =
  "Der Speicher ist gerade nicht erreichbar. Lade die App neu; deine gespeicherten Daten bleiben erhalten.";

/** Bindet den Hinweis an einen bestehenden Statusbereich außerhalb der Ansichten. */
export function mountStorageNotice(element: HTMLElement): void {
  region = element;
}

/** `consequence` wie bei storageMessage, z. B. „Das Ende der Lernsitzung wurde nicht gespeichert.“ */
export function reportStorageProblem(error: unknown, consequence: string): void {
  const failure = storageFailure(error);
  render(storageMessage(failure, consequence, NEXT[failure]), false);
}

/** Die Verbindung ließ sich nicht wieder öffnen; nur Neuladen hilft. */
export function reportStorageUnreachable(): void {
  render(UNREACHABLE, true);
}

export function clearStorageProblem(): void {
  region?.replaceChildren();
}

function render(text: string, reload: boolean): void {
  if (!region) return;
  const actions = h(
    "div",
    { class: "actions" },
    reload ? h("button", { type: "button", onclick: () => location.reload() }, "Neu laden") : null,
    h("button", { type: "button", class: "secondary", onclick: clearStorageProblem }, "Ausblenden"),
  );
  region.replaceChildren(h("p", null, text), actions);
}
