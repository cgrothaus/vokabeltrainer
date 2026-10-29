// Ruhiger Hinweis zum Speicherschutz über der Bibliotheksliste (TDD 6.6, 13.1, FR-31, AK-20). Welcher
// Hinweis erscheint, entscheidet `protectionNotice` in domain/storageProtection.ts.
import type { ProtectionNotice } from "../../domain/storageProtection";
import { h } from "../dom";

export function protectionHint(notice: ProtectionNotice, hasSets: boolean): Node | null {
  if (notice === "install") return installHint(hasSets);
  if (notice === "backup")
    return h(
      "div",
      { class: "hint" },
      h(
        "p",
        null,
        "Deine Daten sind auf diesem Gerät nicht dauerhaft geschützt. Speichere deshalb regelmäßig ein ",
        h("a", { href: "#/backup" }, "Backup"),
        ".",
      ),
    );
  return null;
}

/**
 * Auf iOS schützt erst der Home-Bildschirm die Daten (S-11). Die App dort hat einen eigenen Speicher:
 * Vorhandene Sets ziehen per Backup um.
 */
function installHint(hasSets: boolean): Node {
  const steps = [
    hasSets &&
      h(
        "li",
        null,
        "Speichere hier ein ",
        h("a", { href: "#/backup" }, "Backup"),
        ". Die App auf dem Home-Bildschirm hat einen eigenen Speicher und sieht deine Daten aus dem Browser nicht.",
      ),
    h(
      "li",
      null,
      "Tippe auf „Teilen“ (je nach Ansicht hinter „…“) und wähle „Zum Home-Bildschirm“, dann „Hinzufügen“.",
    ),
    h("li", null, "Öffne die App über das neue Symbol auf dem Home-Bildschirm."),
    hasSets &&
      h("li", null, "Stelle dort unter „Backup und Wiederherstellung“ das Backup wieder her."),
  ];
  return h(
    "div",
    { class: "hint" },
    h(
      "p",
      null,
      "Im Browser kann iOS deine Daten löschen, wenn du die App einige Tage nicht nutzt. Auf dem Home-Bildschirm bleiben sie erhalten.",
    ),
    h(
      "details",
      null,
      h("summary", null, "So kommt die App auf den Home-Bildschirm"),
      h("ol", null, steps),
    ),
  );
}
