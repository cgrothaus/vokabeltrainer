// Hinweis auf eine neue App-Version (TDD 5.3). Er erscheint nie während einer Lernsitzung oder
// Bearbeitung (TAK-12), sondern erst danach.
import type { ActivateUpdate } from "../../platform/serviceWorker";
import { h } from "../dom";

let region: HTMLElement | null = null;
let pending: ActivateUpdate | null = null;
let busy = false;

/** Bindet den Hinweis an einen bestehenden Statusbereich außerhalb der Ansichten. */
export function mountUpdateNotice(element: HTMLElement): void {
  region = element;
  render();
}

export function showUpdateNotice(activate: ActivateUpdate): void {
  pending = activate;
  render();
}

/** Für Lernsitzung und Bearbeitung (ab S-08): Solange `true`, bleibt der Hinweis verborgen. */
export function setUpdateBlocked(value: boolean): void {
  busy = value;
  render();
}

function render(): void {
  if (!region) return;
  const activate = pending;
  if (!activate || busy) {
    region.replaceChildren();
    return;
  }
  const button = h(
    "button",
    {
      type: "button",
      onclick: () => {
        button.disabled = true;
        activate();
      },
    },
    "Jetzt aktualisieren",
  );
  region.replaceChildren(h("p", null, "Neue Version verfügbar."), button);
}
