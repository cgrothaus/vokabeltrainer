// Hinweis zum Speicherschutz über der Bibliotheksliste (TDD 6.6, 13.1, FR-31, AK-20, D-38): auf iOS
// ohne Sets die Anleitung zum Home-Bildschirm als Karte, mit Sets eine ruhige Zeile mit „Schützen“;
// sonst eine ruhige Zeile mit dem Weg zum Backup und, wo möglich, „Installieren“. Welcher Hinweis
// erscheint, entscheidet `protectionNotice` in domain/storageProtection.ts.
import type { ProtectionNotice } from "../../domain/storageProtection";
import { h } from "../dom";
import { icon, type IconName } from "../icons";
import { homeScreenCard, type IosDevice, openHomeScreenSheet } from "./homeScreen";

export interface ProtectionHintOptions {
  hasSets: boolean;
  device: IosDevice;
  /** Element der Ansicht, an das das Blatt angehängt wird. */
  within: Element;
  /** „Installieren“, wenn der Browser es anbietet (TDD 5.1); direkt im Klick aufrufen. */
  install?: () => void;
}

/** Ruhige Zeile für Hinweise (TDD 13.7): Symbol, Satz, zurückhaltende Aktionen. */
export function quietRow(symbol: IconName, text: string, ...actions: Node[]): HTMLElement {
  return h(
    "div",
    { class: "quiet hint" },
    icon(symbol),
    h("p", null, text),
    h("div", { class: "quiet-actions" }, actions),
  );
}

export function protectionHint(
  notice: ProtectionNotice,
  options: ProtectionHintOptions,
): Node | null {
  if (notice === "install") {
    if (!options.hasSets) return homeScreenCard(options.device);
    const protect: HTMLButtonElement = h(
      "button",
      {
        type: "button",
        class: "textbtn",
        onclick: () =>
          openHomeScreenSheet(options.within, {
            device: options.device,
            hasSets: true,
            returnTo: protect,
          }),
      },
      "Schützen",
    );
    return quietRow(
      "phone",
      `Im Browser kann dein ${options.device} die Vokabeln löschen.`,
      protect,
    );
  }
  if (notice === "backup")
    return quietRow(
      "shield",
      "Deine Daten sind auf diesem Gerät nicht dauerhaft geschützt.",
      h("a", { href: "#/backup", class: "textbtn" }, "Backup"),
      ...(options.install
        ? [
            h(
              "button",
              { type: "button", class: "textbtn", onclick: options.install },
              "Installieren",
            ),
          ]
        : []),
    );
  return null;
}
